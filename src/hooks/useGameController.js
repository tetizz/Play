import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getBotProfile, loadBotStyleProfile } from '../data/botProfiles'
import { dialogueAfterBotMove, dialogueForGameEnd, initialDialogue } from '../data/dialogue'
import { calculationProfile, chooseCoachMove, moveContext, shouldActivateBeltMode } from '../lib/coachEngine'
import { buildFallbackFinalReview, reviewGameWithStockfish } from '../lib/reviewEngine'
import { createStockfishClient } from '../lib/stockfishClient'
import {
  applyPremove,
  clearSession,
  gameFromHistory,
  loadSession,
  saveSession,
  shouldResumeBotTurn,
} from '../lib/gameSession'

const restored = typeof localStorage === 'undefined' ? null : loadSession()
const PLAYER = Object.freeze({ name: 'player', rating: 100, countryCode: 'us' })
const BOT_DELAY_MS = 2000
const EMPTY_STYLE_PROFILE = Object.freeze({ openingBook: {}, bookMaxPlies: 0 })

export function useGameController(defaultBotId) {
  const [phase, setPhase] = useState(restored?.phase || 'setup')
  const [botId, setBotId] = useState(restored?.botId || defaultBotId)
  const [colorChoice, setColorChoice] = useState(restored?.colorChoice || 'random')
  const [humanColor, setHumanColor] = useState(restored?.humanColor || 'white')
  const [history, setHistory] = useState(restored?.history || [])
  const [turnState, setTurnState] = useState('human')
  const [message, setMessage] = useState(() =>
    initialDialogue(getBotProfile(restored?.botId || defaultBotId)),
  )
  const [lastMove, setLastMove] = useState(restored?.lastMove || null)
  const [premove, setPremove] = useState(null)
  const [selectedSquare, setSelectedSquare] = useState(null)
  const [arrows, setArrows] = useState([])
  const [viewPly, setViewPly] = useState(restored?.history?.length || 0)
  const [beltMode, setBeltMode] = useState(Boolean(restored?.beltMode))
  const [loadedStyleProfile, setLoadedStyleProfile] = useState({
    botId: null,
    data: EMPTY_STYLE_PROFILE,
  })
  const [review, setReview] = useState(null)
  const [reviewProgress, setReviewProgress] = useState({ completed: 0, total: 0 })
  const [reviewPly, setReviewPly] = useState(0)

  const profile = useMemo(() => getBotProfile(botId), [botId])
  const styleProfileReady = loadedStyleProfile.botId === botId
  const styleProfile = styleProfileReady ? loadedStyleProfile.data : EMPTY_STYLE_PROFILE
  const game = useMemo(() => gameFromHistory(history), [history])
  const historyRef = useRef(history)
  const premoveRef = useRef(null)
  const beltRef = useRef(beltMode)
  const generationRef = useRef(0)
  const timerRef = useRef(null)
  const initializedRef = useRef(false)
  const gameplayClientRef = useRef(null)
  const reviewClientRef = useRef(null)
  const reviewAbortRef = useRef(null)
  const scheduleBotTurnRef = useRef(null)

  useEffect(() => {
    historyRef.current = history
  }, [history])

  useEffect(() => {
    beltRef.current = beltMode
  }, [beltMode])

  useEffect(() => {
    premoveRef.current = premove
  }, [premove])

  useEffect(() => {
    gameplayClientRef.current = createStockfishClient()
    reviewClientRef.current = createStockfishClient()
    return () => {
      gameplayClientRef.current?.destroy()
      reviewClientRef.current?.destroy()
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    loadBotStyleProfile(botId).then((loaded) => {
      if (!cancelled) {
        setLoadedStyleProfile({ botId, data: loaded })
      }
    })
    return () => {
      cancelled = true
    }
  }, [botId])

  useEffect(() => {
    if (phase === 'setup') return
    saveSession({
      phase,
      botId,
      colorChoice,
      humanColor,
      history,
      beltMode,
      lastMove,
    })
  }, [beltMode, botId, colorChoice, history, humanColor, lastMove, phase])

  const cancelWork = useCallback(() => {
    generationRef.current += 1
    clearTimeout(timerRef.current)
    timerRef.current = null
    gameplayClientRef.current?.cancelAll()
    reviewClientRef.current?.cancelAll()
    reviewAbortRef.current?.abort()
    reviewAbortRef.current = null
  }, [])

  const commitHistory = useCallback((nextHistory, nextLastMove = null) => {
    historyRef.current = nextHistory
    setHistory(nextHistory)
    setLastMove(nextLastMove)
    setViewPly(nextHistory.length)
    setSelectedSquare(null)
    setArrows([])
  }, [])

  const runReview = useCallback(async (finishedHistory) => {
    const token = generationRef.current
    const controller = new AbortController()
    reviewAbortRef.current = controller
    setPhase('review')
    setReview(null)
    setReviewPly(finishedHistory.length)
    setReviewProgress({ completed: 0, total: finishedHistory.length })
    let result
    try {
      result = await reviewGameWithStockfish({
        history: finishedHistory,
        client: reviewClientRef.current,
        repertoire: styleProfile,
        signal: controller.signal,
        onProgress: (progress) => {
          if (generationRef.current === token) setReviewProgress(progress)
        },
      })
    } catch {
      result = buildFallbackFinalReview(finishedHistory)
    }
    if (generationRef.current !== token) return
    setReview(result)
    setReviewPly(finishedHistory.length)
  }, [styleProfile])

  const finishGame = useCallback((finishedGame, nextHistory) => {
    setTurnState('game-over')
    const result = gameResult(finishedGame)
    const line = dialogueForGameEnd(profile, result)
    if (line) setMessage(line)
    runReview(nextHistory)
  }, [profile, runReview])

  const scheduleBotTurn = useCallback((baseHistory, delay = BOT_DELAY_MS) => {
    const token = ++generationRef.current
    clearTimeout(timerRef.current)
    gameplayClientRef.current?.cancelAll()
    setTurnState('bot-delay')
    timerRef.current = setTimeout(async () => {
      if (generationRef.current !== token) return
      const beforeGame = gameFromHistory(baseHistory)
      if (beforeGame.isGameOver()) {
        finishGame(beforeGame, beforeGame.history())
        return
      }
      setTurnState('bot-analysis')
      let candidates
      const beltActivated = !beltRef.current &&
        shouldActivateBeltMode(profile, beforeGame.history(), humanColor)
      if (beltActivated) {
        beltRef.current = true
        setBeltMode(true)
      }
      const activeBelt = beltRef.current && profile.capabilities.beltMode
      try {
        candidates = await gameplayClientRef.current.bestMoves(
          beforeGame.fen(),
          calculationProfile(profile, activeBelt),
        ) || []
      } catch {
        candidates = []
      }
      if (generationRef.current !== token) return
      const decision = chooseCoachMove(beforeGame, candidates, profile, styleProfile, activeBelt)
      if (!decision.move) {
        setTurnState('human')
        return
      }
      const context = moveContext(
        beforeGame,
        decision.move,
        decision,
        activeBelt || beltActivated,
        beltActivated,
        profile,
      )
      beforeGame.move(decision.move)
      let nextHistory = beforeGame.history()
      commitHistory(nextHistory, { from: decision.move.from, to: decision.move.to })
      const nextMessage = dialogueAfterBotMove(profile, context)
      setMessage(nextMessage)
      if (beforeGame.isGameOver()) {
        finishGame(beforeGame, nextHistory)
        return
      }

      const queued = premoveRef.current
      setPremove(null)
      premoveRef.current = null
      if (queued) {
        const applied = applyPremove(nextHistory, queued)
        if (applied.applied) {
          nextHistory = applied.history
          const afterPremove = gameFromHistory(nextHistory)
          commitHistory(nextHistory, { from: applied.move.from, to: applied.move.to })
          const activated = beltRef.current ||
            shouldActivateBeltMode(profile, nextHistory, humanColor)
          if (!beltRef.current && activated) {
            beltRef.current = true
            setBeltMode(true)
          }
          if (afterPremove.isGameOver()) {
            finishGame(afterPremove, nextHistory)
          } else {
            scheduleBotTurnRef.current?.(nextHistory)
          }
          return
        }
      }
      setTurnState('human')
    }, delay)
  }, [commitHistory, finishGame, humanColor, profile, styleProfile])

  useEffect(() => {
    scheduleBotTurnRef.current = scheduleBotTurn
  }, [scheduleBotTurn])

  useEffect(() => {
    if (initializedRef.current || !styleProfileReady) return
    initializedRef.current = true
    queueMicrotask(() => {
      if (phase === 'review' && game.isGameOver()) {
        runReview(history)
      } else if (phase === 'game' && shouldResumeBotTurn(history, humanColor)) {
        scheduleBotTurn(history, 250)
      }
    })
  }, [game, history, humanColor, phase, profile, runReview, scheduleBotTurn, styleProfileReady])

  useEffect(() => {
    if (phase !== 'game') return undefined
    const onKeyDown = (event) => {
      if (event.key === 'ArrowLeft') setViewPly((ply) => Math.max(0, ply - 1))
      if (event.key === 'ArrowRight') setViewPly((ply) => Math.min(historyRef.current.length, ply + 1))
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [phase])

  function selectBot(nextBotId) {
    if (phase !== 'setup') return
    setBotId(nextBotId)
    setMessage(initialDialogue(getBotProfile(nextBotId)))
  }

  function startGame() {
    cancelWork()
    const nextColor = colorChoice === 'random'
      ? Math.random() < 0.5 ? 'white' : 'black'
      : colorChoice
    setHumanColor(nextColor)
    setHistory([])
    historyRef.current = []
    setLastMove(null)
    setViewPly(0)
    setSelectedSquare(null)
    setPremove(null)
    premoveRef.current = null
    setArrows([])
    setBeltMode(false)
    beltRef.current = false
    setReview(null)
    setPhase('game')
    setMessage(initialDialogue(profile))
    saveSession({
      phase: 'game',
      botId,
      colorChoice,
      humanColor: nextColor,
      history: [],
      beltMode: false,
      lastMove: null,
    })
    if (nextColor === 'black') scheduleBotTurn([])
    else setTurnState('human')
  }

  function returnToSetup() {
    cancelWork()
    clearSession()
    setPhase('setup')
    setHistory([])
    historyRef.current = []
    setReview(null)
    setPremove(null)
    premoveRef.current = null
    setBeltMode(false)
    beltRef.current = false
    setLastMove(null)
    setViewPly(0)
    setMessage(initialDialogue(profile))
  }

  function makeMove(from, to) {
    if (!from || !to || phase !== 'game' || viewPly !== history.length) return false
    const current = gameFromHistory(historyRef.current)
    const playerTurn = humanColor === 'white' ? 'w' : 'b'
    if (current.isGameOver()) return false
    if (current.turn() !== playerTurn || turnState !== 'human') {
      const piece = current.get(from)
      if (!piece || piece.color !== playerTurn || from === to) return false
      const queued = { from, to, promotion: 'q' }
      premoveRef.current = queued
      setPremove(queued)
      setSelectedSquare(null)
      return true
    }
    let move
    try {
      move = current.move({ from, to, promotion: 'q' })
    } catch {
      return false
    }
    if (!move) return false
    const nextHistory = current.history()
    commitHistory(nextHistory, { from: move.from, to: move.to })
    const activated = beltRef.current || shouldActivateBeltMode(profile, nextHistory, humanColor)
    if (!beltRef.current && activated) {
      beltRef.current = true
      setBeltMode(true)
    }
    if (current.isGameOver()) finishGame(current, nextHistory)
    else scheduleBotTurn(nextHistory)
    return true
  }

  function undo() {
    if (phase !== 'game' || !history.length) return
    cancelWork()
    const count = Math.min(2, history.length)
    const nextHistory = history.slice(0, history.length - count)
    commitHistory(nextHistory, null)
    setPremove(null)
    premoveRef.current = null
    setReview(null)
    const activeBelt = shouldActivateBeltMode(profile, nextHistory, humanColor)
    setBeltMode(activeBelt)
    beltRef.current = activeBelt
    const restoredGame = gameFromHistory(nextHistory)
    const playerTurn = humanColor === 'white' ? 'w' : 'b'
    if (restoredGame.turn() === playerTurn) setTurnState('human')
    else scheduleBotTurn(nextHistory, 250)
  }

  function resign() {
    if (phase !== 'game') return
    cancelWork()
    setTurnState('game-over')
    runReview(history)
  }

  return {
    phase,
    profile,
    player: PLAYER,
    colorChoice,
    setColorChoice,
    humanColor,
    history,
    game,
    turnState,
    message,
    lastMove,
    premove,
    setPremove,
    selectedSquare,
    setSelectedSquare,
    arrows,
    setArrows,
    viewPly,
    setViewPly,
    beltMode,
    review,
    reviewProgress,
    reviewPly,
    setReviewPly,
    selectBot,
    startGame,
    returnToSetup,
    makeMove,
    undo,
    resign,
  }
}

function gameResult(game) {
  if (game.isCheckmate()) return game.turn() === 'w' ? 'Black wins by checkmate' : 'Player wins by checkmate'
  if (game.isDraw()) return 'Draw'
  return 'Game over'
}

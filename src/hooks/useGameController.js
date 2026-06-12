import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getBotProfile, loadBotStyleProfile } from '../data/botProfiles'
import { dialogueAfterBotMove, dialogueForGameEnd, initialDialogue } from '../data/dialogue'
import {
  bishopKnightPromotionUcis,
  calculationProfile,
  chooseCoachMove,
  moveContext,
  shouldActivateBeltMode,
} from '../lib/coachEngine'
import { buildFallbackFinalReview, reviewGameWithStockfish } from '../lib/reviewEngine'
import { createStockfishClient } from '../lib/stockfishClient'
import {
  createTablebaseClient,
  isTablebaseEligible,
  selectTablebaseDecision,
} from '../lib/tablebaseClient'
import {
  applyNextPremove,
  clearSession,
  gameFromHistory,
  isAutomaticDraw,
  isAutomaticGameOver,
  loadSession,
  saveSession,
  shouldResumeBotTurn,
} from '../lib/gameSession'

const restored = typeof localStorage === 'undefined' ? null : loadSession()
const PLAYER = Object.freeze({ name: 'player', rating: 100, countryCode: 'us' })
const BOT_DELAY_MS = 2000
const BOT_MATCH_DELAY_MS = 850
const EMPTY_STYLE_PROFILE = Object.freeze({ openingBook: {}, bookMaxPlies: 0 })

export function useGameController(defaultBotId) {
  const [phase, setPhase] = useState(restored?.phase || 'setup')
  const [gameMode, setGameMode] = useState(restored?.gameMode || 'player')
  const [botId, setBotId] = useState(restored?.botId || defaultBotId)
  const [whiteBotId, setWhiteBotId] = useState(restored?.whiteBotId || 'trixize')
  const [blackBotId, setBlackBotId] = useState(restored?.blackBotId || 'akshit')
  const [colorChoice, setColorChoice] = useState(restored?.colorChoice || 'random')
  const [humanColor, setHumanColor] = useState(restored?.humanColor || 'white')
  const [history, setHistory] = useState(restored?.history || [])
  const [turnState, setTurnState] = useState('human')
  const [message, setMessage] = useState(() =>
    initialDialogue(getBotProfile(restored?.botId || defaultBotId)),
  )
  const [dialogueLog, setDialogueLog] = useState(restored?.dialogueLog || [])
  const [lastMove, setLastMove] = useState(restored?.lastMove || null)
  const [premoveQueue, setPremoveQueue] = useState(restored?.premoveQueue || [])
  const [pendingPromotion, setPendingPromotion] = useState(null)
  const [selectedSquare, setSelectedSquare] = useState(null)
  const [arrows, setArrows] = useState([])
  const [viewPly, setViewPly] = useState(restored?.history?.length || 0)
  const [beltMode, setBeltMode] = useState(Boolean(restored?.beltMode))
  const [loadedStyleProfiles, setLoadedStyleProfiles] = useState({})
  const [review, setReview] = useState(null)
  const [reviewProgress, setReviewProgress] = useState({ completed: 0, total: 0 })
  const [reviewPly, setReviewPly] = useState(0)

  const profile = useMemo(() => getBotProfile(botId), [botId])
  const whiteProfile = useMemo(() => getBotProfile(whiteBotId), [whiteBotId])
  const blackProfile = useMemo(() => getBotProfile(blackBotId), [blackBotId])
  const requiredBotIds = useMemo(
    () => gameMode === 'bots' ? [whiteBotId, blackBotId] : [botId],
    [blackBotId, botId, gameMode, whiteBotId],
  )
  const styleProfilesReady = requiredBotIds.every((id) => Boolean(loadedStyleProfiles[id]))
  const game = useMemo(() => gameFromHistory(history), [history])
  const boardOrientation = gameMode === 'bots' ? 'white' : humanColor
  const historyRef = useRef(history)
  const premoveQueueRef = useRef(premoveQueue)
  const beltRef = useRef(beltMode)
  const generationRef = useRef(0)
  const timerRef = useRef(null)
  const initializedRef = useRef(false)
  const gameplayClientRef = useRef(null)
  const mateClientRef = useRef(null)
  const tablebaseClientRef = useRef(null)
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
    premoveQueueRef.current = premoveQueue
  }, [premoveQueue])

  useEffect(() => {
    gameplayClientRef.current = createStockfishClient()
    mateClientRef.current = createStockfishClient()
    tablebaseClientRef.current = createTablebaseClient()
    reviewClientRef.current = createStockfishClient()
    return () => {
      gameplayClientRef.current?.destroy()
      mateClientRef.current?.destroy()
      tablebaseClientRef.current?.destroy()
      reviewClientRef.current?.destroy()
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    Promise.all(requiredBotIds.map(async (id) => [id, await loadBotStyleProfile(id)]))
      .then((entries) => {
        if (!cancelled) {
          setLoadedStyleProfiles((current) => ({ ...current, ...Object.fromEntries(entries) }))
        }
      })
    return () => {
      cancelled = true
    }
  }, [requiredBotIds])

  useEffect(() => {
    if (phase === 'setup') return
    saveSession({
      phase,
      gameMode,
      botId,
      whiteBotId,
      blackBotId,
      colorChoice,
      humanColor,
      history,
      beltMode,
      lastMove,
      premoveQueue,
      dialogueLog,
    })
  }, [
    beltMode,
    blackBotId,
    botId,
    colorChoice,
    dialogueLog,
    gameMode,
    history,
    humanColor,
    lastMove,
    phase,
    premoveQueue,
    whiteBotId,
  ])

  const cancelWork = useCallback(() => {
    generationRef.current += 1
    clearTimeout(timerRef.current)
    timerRef.current = null
    gameplayClientRef.current?.cancelAll()
    mateClientRef.current?.cancelAll()
    tablebaseClientRef.current?.cancelAll()
    reviewClientRef.current?.cancelAll()
    reviewAbortRef.current?.abort()
    reviewAbortRef.current = null
  }, [])

  const updatePremoveQueue = useCallback((nextQueue) => {
    premoveQueueRef.current = nextQueue
    setPremoveQueue(nextQueue)
  }, [])

  const commitHistory = useCallback((nextHistory, nextLastMove = null) => {
    historyRef.current = nextHistory
    setHistory(nextHistory)
    setLastMove(nextLastMove)
    setViewPly(nextHistory.length)
    setSelectedSquare(null)
    setArrows([])
  }, [])

  const appendDialogue = useCallback((speaker, text, ply) => {
    if (!text) return
    setDialogueLog((current) => [...current, {
      id: `${ply}-${speaker.id}-${Date.now()}`,
      botId: speaker.id,
      text,
      ply,
    }].slice(-8))
  }, [])

  const runReview = useCallback(async (finishedHistory) => {
    const token = generationRef.current
    const controller = new AbortController()
    reviewAbortRef.current = controller
    setPhase('review')
    setReview(null)
    setReviewPly(finishedHistory.length)
    setReviewProgress({ completed: 0, total: finishedHistory.length })
    const repertoire = gameMode === 'bots'
      ? {
          white: loadedStyleProfiles[whiteBotId] || EMPTY_STYLE_PROFILE,
          black: loadedStyleProfiles[blackBotId] || EMPTY_STYLE_PROFILE,
        }
      : loadedStyleProfiles[botId] || EMPTY_STYLE_PROFILE
    let result
    try {
      result = await reviewGameWithStockfish({
        history: finishedHistory,
        client: reviewClientRef.current,
        repertoire,
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
  }, [blackBotId, botId, gameMode, loadedStyleProfiles, whiteBotId])

  const finishGame = useCallback((finishedGame, nextHistory, lastSpeaker = null) => {
    setTurnState('game-over')
    const result = gameResult(finishedGame, gameMode, whiteProfile, blackProfile)
    const speaker = lastSpeaker || profile
    const line = dialogueForGameEnd(speaker, result)
    if (gameMode === 'bots') appendDialogue(speaker, line, nextHistory.length)
    else if (line) setMessage(line)
    runReview(nextHistory)
  }, [appendDialogue, blackProfile, gameMode, profile, runReview, whiteProfile])

  const scheduleBotTurn = useCallback((baseHistory, delay = null, humanColorOverride = null) => {
    const token = ++generationRef.current
    clearTimeout(timerRef.current)
    gameplayClientRef.current?.cancelAll()
    setTurnState('bot-delay')
    const activeDelay = delay ?? (gameMode === 'bots' ? BOT_MATCH_DELAY_MS : BOT_DELAY_MS)
    timerRef.current = setTimeout(async () => {
      if (generationRef.current !== token) return
      const beforeGame = gameFromHistory(baseHistory)
      if (isAutomaticGameOver(beforeGame)) {
        finishGame(beforeGame, beforeGame.history())
        return
      }

      const side = beforeGame.turn()
      const activeHumanColor = humanColorOverride || humanColor
      const automatedProfile = gameMode === 'bots'
        ? side === 'w' ? whiteProfile : blackProfile
        : profile
      if (gameMode === 'player') {
        const playerTurn = activeHumanColor === 'white' ? 'w' : 'b'
        if (side === playerTurn) {
          setTurnState('human')
          return
        }
      }

      const styleProfile = loadedStyleProfiles[automatedProfile.id] || EMPTY_STYLE_PROFILE
      const opponentColor = gameMode === 'bots'
        ? side === 'w' ? 'black' : 'white'
        : activeHumanColor
      setTurnState('bot-analysis')
      const beltActivated = !beltRef.current &&
        shouldActivateBeltMode(automatedProfile, beforeGame.history(), opponentColor)
      if (beltActivated) {
        beltRef.current = true
        setBeltMode(true)
      }
      const activeBelt = beltRef.current && automatedProfile.capabilities.beltMode
      let decision = null
      if (
        automatedProfile.capabilities.exactTablebase &&
        isTablebaseEligible(beforeGame.fen())
      ) {
        const tablebase = await tablebaseClientRef.current.probe(beforeGame.fen())
        if (generationRef.current !== token) return
        decision = selectTablebaseDecision(beforeGame, tablebase, {
          preferBishopKnightObjective: automatedProfile.capabilities.bishopKnightObjective,
        })
      }

      if (!decision) {
        const enginePolicy = calculationProfile(automatedProfile, activeBelt, beforeGame)
        let candidates
        try {
          const mateSafety = automatedProfile.capabilities.maximumEngine
            ? automatedProfile.strengthPolicy.mateSafety
            : null
          const [engineCandidates, mateCandidates] = await Promise.all([
            gameplayClientRef.current.bestMoves(beforeGame.fen(), enginePolicy),
            mateSafety
              ? mateClientRef.current.bestMoves(beforeGame.fen(), {
                  ...mateSafety,
                  elo: undefined,
                  count: 1,
                })
              : Promise.resolve([]),
          ])
          candidates = mergeEngineCandidates(engineCandidates || [], mateCandidates || [])
          const promotionMoves = automatedProfile.capabilities.bishopKnightObjective
            ? bishopKnightPromotionUcis(beforeGame)
            : []
          if (promotionMoves.length) {
            const objectiveCandidates = await gameplayClientRef.current.bestMoves(
              beforeGame.fen(),
              {
                ...enginePolicy,
                depth: Math.max(22, enginePolicy.depth),
                moveTime: Math.max(3200, enginePolicy.moveTime),
                count: promotionMoves.length,
                searchMoves: promotionMoves,
              },
            ) || []
            candidates = mergeEngineCandidates(candidates, objectiveCandidates)
          }
        } catch {
          candidates = []
        }
        if (generationRef.current !== token) return

        decision = chooseCoachMove(
          beforeGame,
          candidates,
          automatedProfile,
          styleProfile,
          activeBelt,
        )
      }
      if (!decision.move) {
        if (gameMode === 'bots') scheduleBotTurnRef.current?.(baseHistory)
        else setTurnState('human')
        return
      }

      const context = moveContext(
        beforeGame,
        decision.move,
        decision,
        activeBelt || beltActivated,
        beltActivated,
        automatedProfile,
      )
      beforeGame.move(decision.move)
      let nextHistory = beforeGame.history()
      commitHistory(nextHistory, {
        from: decision.move.from,
        to: decision.move.to,
        promotion: decision.move.promotion,
      })
      const nextMessage = dialogueAfterBotMove(automatedProfile, context)
      if (gameMode === 'bots') {
        appendDialogue(automatedProfile, nextMessage, nextHistory.length)
      } else {
        setMessage(nextMessage)
      }
      if (isAutomaticGameOver(beforeGame)) {
        finishGame(beforeGame, nextHistory, automatedProfile)
        return
      }

      if (gameMode === 'bots') {
        scheduleBotTurnRef.current?.(nextHistory)
        return
      }

      const queued = applyNextPremove(nextHistory, premoveQueueRef.current)
      updatePremoveQueue(queued.remaining)
      if (queued.applied) {
        nextHistory = queued.history
        const afterPremove = gameFromHistory(nextHistory)
        commitHistory(nextHistory, {
          from: queued.move.from,
          to: queued.move.to,
          promotion: queued.move.promotion,
        })
        const activated = beltRef.current ||
          shouldActivateBeltMode(profile, nextHistory, humanColor)
        if (!beltRef.current && activated) {
          beltRef.current = true
          setBeltMode(true)
        }
        if (isAutomaticGameOver(afterPremove)) {
          finishGame(afterPremove, nextHistory)
        } else {
          scheduleBotTurnRef.current?.(nextHistory)
        }
        return
      }
      setTurnState('human')
    }, activeDelay)
  }, [
    appendDialogue,
    blackProfile,
    commitHistory,
    finishGame,
    gameMode,
    humanColor,
    loadedStyleProfiles,
    profile,
    updatePremoveQueue,
    whiteProfile,
  ])

  useEffect(() => {
    scheduleBotTurnRef.current = scheduleBotTurn
  }, [scheduleBotTurn])

  useEffect(() => {
    if (initializedRef.current || !styleProfilesReady) return
    initializedRef.current = true
    queueMicrotask(() => {
      if (phase === 'review' && isAutomaticGameOver(game)) {
        runReview(history)
      } else if (
        phase === 'game' &&
        (gameMode === 'bots' || shouldResumeBotTurn(history, humanColor))
      ) {
        scheduleBotTurn(history, 250)
      }
    })
  }, [
    game,
    gameMode,
    history,
    humanColor,
    phase,
    runReview,
    scheduleBotTurn,
    styleProfilesReady,
  ])

  useEffect(() => {
    if (phase !== 'game') return undefined
    const onKeyDown = (event) => {
      if (event.key === 'ArrowLeft') setViewPly((ply) => Math.max(0, ply - 1))
      if (event.key === 'ArrowRight') {
        setViewPly((ply) => Math.min(historyRef.current.length, ply + 1))
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [phase])

  function selectBot(nextBotId) {
    if (phase !== 'setup') return
    setBotId(nextBotId)
    setMessage(initialDialogue(getBotProfile(nextBotId)))
  }

  function selectMatchBot(side, nextBotId) {
    if (phase !== 'setup') return
    if (side === 'white') {
      setWhiteBotId(nextBotId)
      if (nextBotId === blackBotId) {
        setBlackBotId(firstDifferentBot(nextBotId))
      }
    } else {
      setBlackBotId(nextBotId)
      if (nextBotId === whiteBotId) {
        setWhiteBotId(firstDifferentBot(nextBotId))
      }
    }
  }

  function startGame() {
    if (!styleProfilesReady) return
    cancelWork()
    const nextColor = gameMode === 'bots'
      ? 'white'
      : colorChoice === 'random'
        ? Math.random() < 0.5 ? 'white' : 'black'
        : colorChoice
    setHumanColor(nextColor)
    setHistory([])
    historyRef.current = []
    setLastMove(null)
    setViewPly(0)
    setSelectedSquare(null)
    updatePremoveQueue([])
    setPendingPromotion(null)
    setArrows([])
    setBeltMode(false)
    beltRef.current = false
    setReview(null)
    setDialogueLog([])
    setPhase('game')
    setMessage(gameMode === 'bots' ? '' : initialDialogue(profile))
    saveSession({
      phase: 'game',
      gameMode,
      botId,
      whiteBotId,
      blackBotId,
      colorChoice,
      humanColor: nextColor,
      history: [],
      beltMode: false,
      lastMove: null,
      premoveQueue: [],
      dialogueLog: [],
    })
    if (gameMode === 'bots' || nextColor === 'black') scheduleBotTurn([], 300, nextColor)
    else setTurnState('human')
  }

  function returnToSetup() {
    cancelWork()
    clearSession()
    setPhase('setup')
    setHistory([])
    historyRef.current = []
    setReview(null)
    updatePremoveQueue([])
    setPendingPromotion(null)
    setDialogueLog([])
    setBeltMode(false)
    beltRef.current = false
    setLastMove(null)
    setViewPly(0)
    setMessage(initialDialogue(profile))
  }

  function makeMove(from, to, promotion = null) {
    if (
      !from ||
      !to ||
      phase !== 'game' ||
      gameMode !== 'player' ||
      viewPly !== history.length
    ) {
      return false
    }
    const current = gameFromHistory(historyRef.current)
    const playerTurn = humanColor === 'white' ? 'w' : 'b'
    if (isAutomaticGameOver(current)) return false
    const piece = current.get(from)
    const isPremove = current.turn() !== playerTurn || turnState !== 'human'
    if (needsPromotion(piece, to) && !promotion) {
      setPendingPromotion({ from, to, isPremove, color: piece?.color || playerTurn })
      setSelectedSquare(null)
      return true
    }

    if (isPremove) {
      if (!piece || piece.color !== playerTurn || from === to) return false
      const queued = {
        id: `${Date.now()}-${premoveQueueRef.current.length}`,
        from,
        to,
        promotion: promotion || 'q',
      }
      updatePremoveQueue([...premoveQueueRef.current, queued])
      setSelectedSquare(null)
      return true
    }

    let move
    try {
      move = current.move({ from, to, promotion: promotion || 'q' })
    } catch {
      return false
    }
    if (!move) return false
    const nextHistory = current.history()
    commitHistory(nextHistory, {
      from: move.from,
      to: move.to,
      promotion: move.promotion,
    })
    const activated = beltRef.current || shouldActivateBeltMode(profile, nextHistory, humanColor)
    if (!beltRef.current && activated) {
      beltRef.current = true
      setBeltMode(true)
    }
    if (isAutomaticGameOver(current)) finishGame(current, nextHistory)
    else scheduleBotTurn(nextHistory)
    return true
  }

  function confirmPromotion(piece) {
    if (!pendingPromotion) return
    const move = pendingPromotion
    setPendingPromotion(null)
    makeMove(move.from, move.to, piece)
  }

  function cancelPromotion() {
    setPendingPromotion(null)
    setSelectedSquare(null)
  }

  function clearPremoves() {
    updatePremoveQueue([])
    setSelectedSquare(null)
  }

  function undo() {
    if (phase !== 'game' || !history.length) return
    cancelWork()
    const count = Math.min(2, history.length)
    const nextHistory = history.slice(0, history.length - count)
    commitHistory(nextHistory, null)
    updatePremoveQueue([])
    setPendingPromotion(null)
    setReview(null)
    const activeBelt = gameMode === 'player' &&
      shouldActivateBeltMode(profile, nextHistory, humanColor)
    setBeltMode(activeBelt)
    beltRef.current = activeBelt
    const restoredGame = gameFromHistory(nextHistory)
    if (gameMode === 'bots') {
      scheduleBotTurn(nextHistory, 250)
      return
    }
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
    gameMode,
    setGameMode,
    profile,
    player: PLAYER,
    whiteProfile,
    blackProfile,
    whiteBotId,
    blackBotId,
    colorChoice,
    setColorChoice,
    humanColor,
    boardOrientation,
    history,
    game,
    turnState,
    message,
    dialogueLog,
    lastMove,
    premoveQueue,
    pendingPromotion,
    selectedSquare,
    setSelectedSquare,
    arrows,
    setArrows,
    viewPly,
    setViewPly,
    beltMode,
    styleProfilesReady,
    review,
    reviewProgress,
    reviewPly,
    setReviewPly,
    selectBot,
    selectMatchBot,
    startGame,
    returnToSetup,
    makeMove,
    confirmPromotion,
    cancelPromotion,
    clearPremoves,
    undo,
    resign,
  }
}

function gameResult(game, gameMode, whiteProfile, blackProfile) {
  if (game.isCheckmate()) {
    const winner = game.turn() === 'w' ? blackProfile : whiteProfile
    return gameMode === 'bots'
      ? `${winner.name} wins by checkmate`
      : game.turn() === 'w' ? 'Black wins by checkmate' : 'Player wins by checkmate'
  }
  if (isAutomaticDraw(game)) return 'Draw'
  return 'Game over'
}

function needsPromotion(piece, targetSquare) {
  return piece?.type === 'p' && (
    piece.color === 'w' ? targetSquare?.[1] === '8' : targetSquare?.[1] === '1'
  )
}

function firstDifferentBot(botId) {
  return ['mubassar', 'ayden', 'akshit', 'trixize'].find((id) => id !== botId) || 'mubassar'
}

function mergeEngineCandidates(primary, objective) {
  const byMove = new Map()
  for (const candidate of [...primary, ...objective]) {
    if (!candidate?.uci) continue
    const existing = byMove.get(candidate.uci)
    if (
      !existing ||
      (Number.isFinite(candidate.score) && candidate.score > (existing.score ?? -Infinity))
    ) {
      byMove.set(candidate.uci, candidate)
    }
  }
  return [...byMove.values()]
    .sort((a, b) => {
      const aMate = Number.isFinite(a.mate) && a.mate > 0 ? a.mate : Infinity
      const bMate = Number.isFinite(b.mate) && b.mate > 0 ? b.mate : Infinity
      if (aMate !== bMate) return aMate - bMate
      return (b.score ?? -Infinity) - (a.score ?? -Infinity)
    })
    .map((candidate, index) => ({ ...candidate, rank: index + 1 }))
}

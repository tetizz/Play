import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Chess } from 'chess.js'
import { BOT_PROFILES, getBotProfile, loadBotStyleProfile } from '../data/botProfiles'
import { isIWantCheckmateProfile } from '../data/iwantcheckmateProfiles'
import {
  guaranteedMateInOneCandidates,
  isEvilMartinAwake,
  isMartinDerivedProfile,
  resolveIWantCheckmateAvatar,
  runningVariantElo,
  variantEngineElo,
  variantEventField,
} from '../lib/iwantcheckmateVariants'
import {
  dialogueAfterBotMove,
  dialogueForBotBattle,
  dialogueForGameEnd,
  initialDialogue,
  resetDialogueHistory,
} from '../data/dialogue'
import {
  bishopKnightObjectiveUcis,
  calculationProfile,
  chooseCoachMove,
  moveContext,
  shouldActivateBeltMode,
} from '../lib/coachEngine'
import {
  annotateBadMannersCandidates,
  badMannersSearchUcis,
  createBadMannersClient,
  isBadMannersDecisionSafe,
  shouldUseBadMannersTakeover,
} from '../lib/badMannersClient'
import { buildFallbackFinalReview, reviewGameWithStockfish } from '../lib/reviewEngine'
import { createStockfishClient } from '../lib/stockfishClient'
import {
  createTablebaseClient,
  isExactWinningMove,
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
  normalizeVariantEvents,
  saveSession,
  shouldResumeBotTurn,
} from '../lib/gameSession'
import {
  buildPremoveProjection,
  isPotentialPremove,
  normalizePremoveQueue,
  premovePieceAt,
} from '../lib/premoveRules'

const restored = typeof localStorage === 'undefined' ? null : loadSession()
const PLAYER = Object.freeze({ name: 'player', rating: 100, countryCode: 'us' })
const BOT_DELAY_MS = 850
const BOT_MATCH_DELAY_MS = 450
const EMPTY_STYLE_PROFILE = Object.freeze({ openingBook: {}, bookMaxPlies: 0 })
const BAD_MANNERS_SAFE_SCORE = 120

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
  const [speechEventId, setSpeechEventId] = useState(0)
  const [dialogueLog, setDialogueLog] = useState(restored?.dialogueLog || [])
  const [lastMove, setLastMove] = useState(restored?.lastMove || null)
  const [premoveQueue, setPremoveQueue] = useState(() =>
    normalizePremoveQueue(restored?.premoveQueue),
  )
  const [pendingPromotion, setPendingPromotion] = useState(null)
  const [selectedSquare, setSelectedSquare] = useState(null)
  const [arrows, setArrows] = useState([])
  const [viewPly, setViewPly] = useState(restored?.history?.length || 0)
  const [beltMode, setBeltMode] = useState(Boolean(restored?.beltMode))
  const [loadedStyleProfiles, setLoadedStyleProfiles] = useState({})
  const [review, setReview] = useState(null)
  const [reviewProgress, setReviewProgress] = useState({ completed: 0, total: 0 })
  const [reviewPly, setReviewPly] = useState(0)
  const [reviewResult, setReviewResult] = useState(restored?.reviewResult || null)
  const [variantEvents, setVariantEvents] = useState(() => normalizeVariantEvents(restored?.variantEvents))
  const [eloDropEvent, setEloDropEvent] = useState(null)

  const baseProfile = useMemo(() => getBotProfile(botId), [botId])
  const baseWhiteProfile = useMemo(() => getBotProfile(whiteBotId), [whiteBotId])
  const baseBlackProfile = useMemo(() => getBotProfile(blackBotId), [blackBotId])
  const profile = useMemo(
    () => resolveIWantCheckmateAvatar(baseProfile, variantEvents[baseProfile.id]),
    [baseProfile, variantEvents],
  )
  const whiteProfile = useMemo(
    () => resolveIWantCheckmateAvatar(
      baseWhiteProfile,
      variantEvents[baseWhiteProfile.id],
    ),
    [baseWhiteProfile, variantEvents],
  )
  const blackProfile = useMemo(
    () => resolveIWantCheckmateAvatar(
      baseBlackProfile,
      variantEvents[baseBlackProfile.id],
    ),
    [baseBlackProfile, variantEvents],
  )
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
  const badMannersClientRef = useRef(null)
  const tablebaseClientRef = useRef(null)
  const reviewClientRef = useRef(null)
  const reviewPlayedClientRef = useRef(null)
  const reviewAbortRef = useRef(null)
  const scheduleBotTurnRef = useRef(null)
  const variantClientRef = useRef(null)
  const variantEventsRef = useRef(variantEvents)
  const eloDropTimerRef = useRef(null)

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
    variantEventsRef.current = variantEvents
  }, [variantEvents])

  useEffect(() => {
    gameplayClientRef.current = createStockfishClient()
    mateClientRef.current = createStockfishClient()
    badMannersClientRef.current = createBadMannersClient()
    tablebaseClientRef.current = createTablebaseClient()
    reviewClientRef.current = createStockfishClient()
    reviewPlayedClientRef.current = createStockfishClient()
    variantClientRef.current = createStockfishClient()
    return () => {
      gameplayClientRef.current?.destroy()
      mateClientRef.current?.destroy()
      badMannersClientRef.current?.destroy()
      tablebaseClientRef.current?.destroy()
      reviewClientRef.current?.destroy()
      reviewPlayedClientRef.current?.destroy()
      variantClientRef.current?.destroy()
      clearTimeout(eloDropTimerRef.current)
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
      variantEvents,
      reviewResult,
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
    reviewResult,
    variantEvents,
    whiteBotId,
  ])

  const cancelWork = useCallback(() => {
    generationRef.current += 1
    clearTimeout(timerRef.current)
    timerRef.current = null
    gameplayClientRef.current?.cancelAll()
    mateClientRef.current?.cancelAll()
    badMannersClientRef.current?.cancelAll()
    tablebaseClientRef.current?.cancelAll()
    reviewClientRef.current?.cancelAll()
    reviewPlayedClientRef.current?.cancelAll()
    variantClientRef.current?.cancelAll()
    reviewAbortRef.current?.abort()
    reviewAbortRef.current = null
  }, [])

  const updatePremoveQueue = useCallback((nextQueue) => {
    premoveQueueRef.current = nextQueue
    setPremoveQueue(nextQueue)
  }, [])

  const recordVariantEvent = useCallback((targetProfile, field, ply) => {
    if (!isIWantCheckmateProfile(targetProfile) || !variantUsesEvent(targetProfile, field)) {
      return variantEventsRef.current
    }
    const marker = `${field}:${ply}`
    const current = variantEventsRef.current
    const previousEvents = current[targetProfile.id] || emptyVariantEvents()
    if (previousEvents.applied.includes(marker)) return current

    const nextEvents = {
      ...previousEvents,
      [field]: previousEvents[field] + 1,
      applied: appendVariantMarker(previousEvents.applied, marker),
    }
    const next = { ...current, [targetProfile.id]: nextEvents }
    const before = runningVariantElo(targetProfile, previousEvents)
    const after = runningVariantElo(targetProfile, nextEvents)
    variantEventsRef.current = next
    setVariantEvents(next)
    if (after !== before) {
      const event = {
        id: `${targetProfile.id}:${marker}:${Date.now()}`,
        botId: targetProfile.id,
        delta: after - before,
      }
      setEloDropEvent(event)
      clearTimeout(eloDropTimerRef.current)
      eloDropTimerRef.current = setTimeout(() => setEloDropEvent(null), 1020)
    }
    return next
  }, [])

  const setVariantModeElo = useCallback((targetProfile, rating, awake, ply) => {
    if (!isIWantCheckmateProfile(targetProfile) || !Number.isFinite(rating)) {
      return variantEventsRef.current
    }
    const current = variantEventsRef.current
    const previousEvents = current[targetProfile.id] || emptyVariantEvents()
    if (previousEvents.currentElo === rating && previousEvents.evilAwake === awake) return current
    const nextEvents = {
      ...previousEvents,
      currentElo: rating,
      evilAwake: awake,
      applied: appendVariantMarker(
        previousEvents.applied,
        `mode:${ply}:${rating}:${awake ? 1 : 0}`,
      ),
    }
    const next = { ...current, [targetProfile.id]: nextEvents }
    variantEventsRef.current = next
    setVariantEvents(next)
    if (Number.isFinite(previousEvents.currentElo) && previousEvents.currentElo !== rating) {
      setEloDropEvent({
        id: `${targetProfile.id}:mode:${ply}:${Date.now()}`,
        botId: targetProfile.id,
        delta: rating - previousEvents.currentElo,
      })
      clearTimeout(eloDropTimerRef.current)
      eloDropTimerRef.current = setTimeout(() => setEloDropEvent(null), 1020)
    }
    return next
  }, [])

  const assessVariantOpponentMove = useCallback(async (targetProfile, baseHistory) => {
    if (!isIWantCheckmateProfile(targetProfile) || !baseHistory.length) {
      return variantEventsRef.current
    }
    const variantType = targetProfile.variant?.trigger
    if (!['opponent-check', 'opponent-best-move', 'opponent-worst-move'].includes(variantType)) {
      return variantEventsRef.current
    }
    const before = gameFromHistory(baseHistory.slice(0, -1))
    const played = before.moves({ verbose: true }).find((move) => move.san === baseHistory.at(-1))
    if (!played) return variantEventsRef.current
    const ply = baseHistory.length
    if (variantType === 'opponent-check') {
      return played.san.includes('+') || played.san.includes('#')
        ? recordVariantEvent(targetProfile, 'opponentChecks', ply)
        : variantEventsRef.current
    }

    const beforeFen = before.fen()
    const probePolicy = {
      elo: undefined,
      depth: 14,
      moveTime: 420,
      count: 16,
      timeout: 2600,
    }
    const candidates = variantType === 'opponent-worst-move'
      ? await analyzeEveryLegalMove(variantClientRef.current, before, probePolicy)
      : await variantClientRef.current.bestMoves(beforeFen, probePolicy)
    const best = candidates[0]
    if (!best || !Number.isFinite(best.score)) return variantEventsRef.current
    const playedUci = moveToUci(played)
    let playedLine = candidates.find((candidate) => candidate.uci === playedUci) || null
    if (!playedLine) {
      const after = gameFromHistory(baseHistory)
      const replyScore = await variantClientRef.current.evaluateFen(after.fen(), {
        depth: 14,
        moveTime: 420,
        timeout: 1800,
      })
      if (Number.isFinite(replyScore)) {
        playedLine = { uci: playedUci, score: -replyScore, rank: 99 }
      }
    }
    if (!playedLine || !Number.isFinite(playedLine.score)) return variantEventsRef.current
    return isExactVariantTrigger(variantType, playedUci, candidates)
      ? recordVariantEvent(
          targetProfile,
          variantType === 'opponent-best-move' ? 'opponentBestMoves' : 'opponentWorstMoves',
          ply,
        )
      : variantEventsRef.current
  }, [recordVariantEvent])

  const ratingFor = useCallback((targetProfile) => {
    if (!isIWantCheckmateProfile(targetProfile)) {
      return { rating: targetProfile.displayRating, event: null }
    }
    return {
      rating: runningVariantElo(targetProfile, variantEvents[targetProfile.id]),
      event: eloDropEvent?.botId === targetProfile.id ? eloDropEvent : null,
    }
  }, [eloDropEvent, variantEvents])

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

  const runReview = useCallback(async (finishedHistory, resultOverride = null) => {
    const token = generationRef.current
    const controller = new AbortController()
    reviewAbortRef.current = controller
    setPhase('review')
    setReview(null)
    setReviewResult(resultOverride)
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
        playedClient: reviewPlayedClientRef.current,
        repertoire,
        resultOverride,
        signal: controller.signal,
        onProgress: (progress) => {
          if (generationRef.current === token) setReviewProgress(progress)
        },
      })
    } catch {
      result = buildFallbackFinalReview(finishedHistory, resultOverride)
    }
    if (generationRef.current !== token) return
    setReview(result)
    setReviewPly(finishedHistory.length)
  }, [blackBotId, botId, gameMode, loadedStyleProfiles, whiteBotId])

  const finishGame = useCallback((finishedGame, nextHistory, lastSpeaker = null) => {
    updatePremoveQueue([])
    setTurnState('game-over')
    const result = gameResult(finishedGame, gameMode, whiteProfile, blackProfile)
    const speaker = lastSpeaker || profile
    const line = dialogueForGameEnd(speaker, result)
    if (gameMode === 'bots') appendDialogue(speaker, line, nextHistory.length)
    else if (line) {
      setMessage(line)
      setSpeechEventId((current) => current + 1)
    }
    runReview(nextHistory, result)
  }, [
    appendDialogue,
    blackProfile,
    gameMode,
    profile,
    runReview,
    updatePremoveQueue,
    whiteProfile,
  ])

  const settleReadyPremove = useCallback((baseHistory) => {
    const playerTurn = humanColor === 'white' ? 'w' : 'b'
    const readyGame = gameFromHistory(baseHistory)
    if (readyGame.turn() !== playerTurn) return false

    const queue = normalizePremoveQueue(premoveQueueRef.current)
    if (!queue.length) return false
    const queued = applyNextPremove(baseHistory, queue)
    if (!queued.applied) {
      updatePremoveQueue([])
      return false
    }

    const afterPremove = gameFromHistory(queued.history)
    const projection = buildPremoveProjection(afterPremove, queued.remaining, playerTurn)
    updatePremoveQueue(projection.acceptedMoves)
    commitHistory(queued.history, {
      from: queued.move.from,
      to: queued.move.to,
      promotion: queued.move.promotion,
    })
    const activated = beltRef.current ||
      shouldActivateBeltMode(profile, queued.history, humanColor)
    if (!beltRef.current && activated) {
      beltRef.current = true
      setBeltMode(true)
    }
    if (isAutomaticGameOver(afterPremove)) {
      finishGame(afterPremove, queued.history)
    } else {
      scheduleBotTurnRef.current?.(queued.history)
    }
    return true
  }, [
    commitHistory,
    finishGame,
    humanColor,
    profile,
    updatePremoveQueue,
  ])

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
      let activeVariantEvents = variantEventsRef.current
      const variantEloAtTurnStart = isIWantCheckmateProfile(automatedProfile)
        ? runningVariantElo(
            automatedProfile,
            activeVariantEvents[automatedProfile.id],
          )
        : null
      try {
        activeVariantEvents = await assessVariantOpponentMove(automatedProfile, baseHistory)
      } catch {
        // Retain the current persisted Elo when a one-off trigger probe is unavailable.
      }
      if (generationRef.current !== token) return
      const engineEloOverride = isIWantCheckmateProfile(automatedProfile)
        ? variantEngineElo(automatedProfile, activeVariantEvents[automatedProfile.id])
        : null
      let decision = null
      const tablebaseEligible = automatedProfile.capabilities.exactTablebase &&
        isTablebaseEligible(beforeGame.fen())
      let tablebaseLoaded = false
      let tablebasePayload = null
      const tablebasePromise = tablebaseEligible
        ? tablebaseClientRef.current.probe(beforeGame.fen()).catch(() => null)
        : null
      const loadTablebase = async () => {
        if (!tablebasePromise) return null
        if (!tablebaseLoaded) {
          tablebasePayload = await tablebasePromise
          tablebaseLoaded = true
        }
        return tablebasePayload
      }

      if (!decision && shouldUseBadMannersTakeover(beforeGame, automatedProfile)) {
        const badMannersPolicy = calculationProfile(automatedProfile, activeBelt, beforeGame, engineEloOverride)
        const badMannersObjectiveMoves = badMannersSearchUcis(beforeGame)
        try {
          const badMannersCandidates = await badMannersClientRef.current?.bestMoves(
            beforeGame.fen(),
            {
              ...badMannersPolicy,
              depth: Math.max(24, badMannersPolicy.depth || 0),
              moveTime: Math.max(4200, badMannersPolicy.moveTime || 0),
              count: badMannersObjectiveMoves.length
                ? Math.min(16, badMannersObjectiveMoves.length)
                : Math.max(1, badMannersPolicy.count || 1),
              searchMoves: badMannersObjectiveMoves,
              timeout: Math.max(9000, (badMannersPolicy.moveTime || 0) + 6000),
            },
          ) || []
          if (generationRef.current !== token) return
          if (badMannersCandidates.length) {
            const annotatedCandidates = annotateBadMannersCandidates(beforeGame, badMannersCandidates)
            const badMannersDecision = chooseCoachMove(
              beforeGame,
              annotatedCandidates,
              automatedProfile,
              styleProfile,
              activeBelt,
            )
            if (badMannersDecision.move) {
              const playedUci = moveToUci(badMannersDecision.move)
              const exactPayload = tablebaseEligible ? await loadTablebase() : null
              if (generationRef.current !== token) return
              const exactSafe = exactPayload ? isExactWinningMove(exactPayload, playedUci) : false
              const keepsWin = isBadMannersDecisionSafe(badMannersDecision, {
                hasObjectiveMoves: badMannersObjectiveMoves.length > 0,
                exactPayloadAvailable: Boolean(exactPayload),
                exactWinning: exactSafe,
                minimumScore: BAD_MANNERS_SAFE_SCORE,
              })
              if (keepsWin) {
                decision = {
                  ...badMannersDecision,
                  source: badMannersDecision.source === 'engine-objective'
                    ? 'bad-manners-objective'
                    : 'bad-manners-stockfish',
                  badManners: true,
                  exact: exactSafe || badMannersDecision.exact,
                }
              }
            }
          }
        } catch {
          decision = null
        }
      }

      if (
        !decision &&
        tablebaseEligible
      ) {
        const tablebase = await loadTablebase()
        if (generationRef.current !== token) return
        decision = selectTablebaseDecision(beforeGame, tablebase, {
          preferBishopKnightObjective: automatedProfile.capabilities.bishopKnightObjective,
        })
      }

      if (!decision) {
        const enginePolicy = calculationProfile(automatedProfile, activeBelt, beforeGame, engineEloOverride)
        let candidates
        let engineSearchFailed = false
        try {
          const guaranteedMates = isMartinDerivedProfile(automatedProfile)
            ? guaranteedMateInOneCandidates(beforeGame)
            : []
          const mateSafety = shouldRunMateSafety(beforeGame, automatedProfile)
            ? automatedProfile.strengthPolicy.mateSafety
            : null
          const needsEveryLegalMove = requiresEveryLegalMove(automatedProfile)
          const [engineCandidates, mateCandidates] = await Promise.all([
            analyzeCandidatesWithRetry(
              gameplayClientRef.current,
              variantClientRef.current,
              beforeGame,
              enginePolicy,
              needsEveryLegalMove,
            ),
            mateSafety
              ? mateClientRef.current.bestMoves(beforeGame.fen(), {
                  ...mateSafety,
                  elo: undefined,
                  count: Math.max(1, guaranteedMates.length),
                  searchMoves: guaranteedMates.length
                    ? guaranteedMates.map((candidate) => candidate.uci)
                    : undefined,
                }).catch(() => [])
              : Promise.resolve([]),
          ])
          candidates = mergeEngineCandidates(
            engineCandidates || [],
            [...(mateCandidates || []), ...guaranteedMates],
          )
          if (automatedProfile.variant?.movePolicy?.type === 'evil-martin') {
            const mode = resolveEvilMartinMode(
              automatedProfile,
              candidates,
              activeVariantEvents[automatedProfile.id] || emptyVariantEvents(),
            )
            activeVariantEvents = setVariantModeElo(
              automatedProfile,
              mode.rating,
              mode.awake,
              baseHistory.length,
            )
          }
          const objectiveMoves = automatedProfile.capabilities.bishopKnightObjective
            ? bishopKnightObjectiveUcis(beforeGame)
            : []
          if (objectiveMoves.length) {
            const objectiveCandidates = await gameplayClientRef.current.bestMoves(
              beforeGame.fen(),
              {
                ...enginePolicy,
                depth: Math.max(22, enginePolicy.depth),
                moveTime: Math.max(3200, enginePolicy.moveTime),
                count: Math.min(16, objectiveMoves.length),
                searchMoves: objectiveMoves,
              },
            ) || []
            const verifiedObjectiveCandidates = await verifyObjectiveCandidates(
              beforeGame,
              objectiveCandidates,
              gameplayClientRef.current,
              enginePolicy,
            )
            candidates = mergeEngineCandidates(candidates, verifiedObjectiveCandidates)
          }
        } catch {
          candidates = []
          engineSearchFailed = true
        }
        if (generationRef.current !== token) return
        if (engineSearchFailed && isIWantCheckmateProfile(automatedProfile)) {
          scheduleBotTurnRef.current?.(baseHistory, 650, activeHumanColor)
          return
        }

        decision = chooseCoachMove(
          beforeGame,
          candidates,
          automatedProfile,
          styleProfile,
          activeBelt,
          Math.random,
          {
            events: activeVariantEvents[automatedProfile.id] || emptyVariantEvents(),
            rating: runningVariantElo(
              automatedProfile,
              activeVariantEvents[automatedProfile.id],
            ),
            evaluation: candidates?.[0]?.score,
          },
        )
      }
      if (!decision?.move) {
        if (isIWantCheckmateProfile(automatedProfile)) {
          scheduleBotTurnRef.current?.(baseHistory, 650, activeHumanColor)
          return
        }
        const fallbackMove = beforeGame.moves({ verbose: true })[0]
        if (!fallbackMove) {
          finishGame(beforeGame, beforeGame.history(), automatedProfile)
          return
        }
        decision = {
          move: fallbackMove,
          source: 'legal-fallback',
          rank: null,
          score: null,
        }
      }

      const baseContext = moveContext(
        beforeGame,
        decision.move,
        decision,
        activeBelt || beltActivated,
        beltActivated,
        automatedProfile,
      )
      beforeGame.move(decision.move)
      let nextHistory = beforeGame.history()
      let nextVariantEvents = recordVariantEvent(
        automatedProfile,
        'botMoves',
        nextHistory.length,
      )
      if (
        decision.move.captured ||
        decision.move.san.includes('+') ||
        decision.move.san.includes('#')
      ) {
        nextVariantEvents = recordVariantEvent(
          automatedProfile,
          'botCaptureChecks',
          nextHistory.length,
        )
      }
      if (decision.move.captured) {
        nextVariantEvents = recordVariantEvent(
          automatedProfile,
          'botCaptures',
          nextHistory.length,
        )
      }
      const variantEloAfterMove = isIWantCheckmateProfile(automatedProfile)
        ? runningVariantElo(
            automatedProfile,
            nextVariantEvents[automatedProfile.id],
          )
        : null
      const context = {
        ...baseContext,
        variantElo: variantEloAfterMove,
        variantEloBefore: variantEloAtTurnStart,
        variantEloDelta: Number.isFinite(variantEloAfterMove) &&
          Number.isFinite(variantEloAtTurnStart)
          ? variantEloAfterMove - variantEloAtTurnStart
          : 0,
      }
      commitHistory(nextHistory, {
        from: decision.move.from,
        to: decision.move.to,
        promotion: decision.move.promotion,
      })
      const opponentProfile = gameMode === 'bots'
        ? side === 'w' ? blackProfile : whiteProfile
        : null
      const nextMessage = gameMode === 'bots'
        ? dialogueForBotBattle(automatedProfile, context, opponentProfile)
        : dialogueAfterBotMove(automatedProfile, context)
      if (gameMode === 'bots') {
        appendDialogue(automatedProfile, nextMessage, nextHistory.length)
      } else {
        setMessage(nextMessage)
        setSpeechEventId((current) => current + 1)
      }
      if (isAutomaticGameOver(beforeGame)) {
        finishGame(beforeGame, nextHistory, automatedProfile)
        return
      }

      if (gameMode === 'bots') {
        scheduleBotTurnRef.current?.(nextHistory)
        return
      }

      if (settleReadyPremove(nextHistory)) return
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
    assessVariantOpponentMove,
    recordVariantEvent,
    settleReadyPremove,
    setVariantModeElo,
    whiteProfile,
  ])

  useEffect(() => {
    scheduleBotTurnRef.current = scheduleBotTurn
  }, [scheduleBotTurn])

  useEffect(() => {
    if (
      phase !== 'game' ||
      gameMode !== 'player' ||
      !styleProfilesReady ||
      turnState === 'game-over' ||
      !premoveQueue.length
    ) {
      return
    }
    let cancelled = false
    queueMicrotask(() => {
      if (cancelled) return
      const currentHistory = historyRef.current
      const readyGame = gameFromHistory(currentHistory)
      const playerTurn = humanColor === 'white' ? 'w' : 'b'
      if (readyGame.turn() !== playerTurn || !premoveQueueRef.current.length) return
      if (!settleReadyPremove(currentHistory)) setTurnState('human')
    })
    return () => {
      cancelled = true
    }
  }, [
    gameMode,
    history,
    humanColor,
    phase,
    premoveQueue.length,
    settleReadyPremove,
    styleProfilesReady,
    turnState,
  ])

  useEffect(() => {
    if (initializedRef.current || !styleProfilesReady) return
    initializedRef.current = true
    queueMicrotask(() => {
      if (phase === 'review' && (isAutomaticGameOver(game) || reviewResult)) {
        runReview(history, reviewResult)
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
    reviewResult,
    runReview,
    scheduleBotTurn,
    styleProfilesReady,
  ])

  useEffect(() => {
    if (phase !== 'game') return undefined
    const onKeyDown = (event) => {
      if (event.key === 'Escape' && premoveQueueRef.current.length) {
        updatePremoveQueue([])
        setSelectedSquare(null)
        return
      }
      if (event.key === 'ArrowLeft') setViewPly((ply) => Math.max(0, ply - 1))
      if (event.key === 'ArrowRight') {
        setViewPly((ply) => Math.min(historyRef.current.length, ply + 1))
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [phase, updatePremoveQueue])

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
    resetDialogueHistory()
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
    setReviewResult(null)
    const openingDialogue = gameMode === 'bots'
      ? initialBotDialogueLog(whiteProfile, blackProfile)
      : []
    setDialogueLog(openingDialogue)
    variantEventsRef.current = {}
    setVariantEvents({})
    clearTimeout(eloDropTimerRef.current)
    setEloDropEvent(null)
    setPhase('game')
    setMessage(gameMode === 'bots' ? '' : initialDialogue(profile))
    if (gameMode === 'player') setSpeechEventId((current) => current + 1)
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
      dialogueLog: openingDialogue,
      variantEvents: {},
      reviewResult: null,
    })
    if (gameMode === 'bots' || nextColor === 'black') scheduleBotTurn([], 300, nextColor)
    else setTurnState('human')
  }

  function returnToSetup() {
    cancelWork()
    resetDialogueHistory()
    clearSession()
    setPhase('setup')
    setHistory([])
    historyRef.current = []
    setReview(null)
    setReviewResult(null)
    updatePremoveQueue([])
    setPendingPromotion(null)
    setDialogueLog([])
    variantEventsRef.current = {}
    setVariantEvents({})
    clearTimeout(eloDropTimerRef.current)
    setEloDropEvent(null)
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
    const isPremove = current.turn() !== playerTurn || turnState !== 'human'
    const projection = isPremove
      ? buildPremoveProjection(current, premoveQueueRef.current, playerTurn)
      : null
    const piece = isPremove ? premovePieceAt(projection, from) : current.get(from)
    if (needsPromotion(piece, to) && !promotion) {
      setPendingPromotion({ from, to, isPremove, color: piece?.color || playerTurn })
      setSelectedSquare(null)
      return true
    }

    if (isPremove) {
      if (
        !piece ||
        piece.color !== playerTurn ||
        from === to ||
        !isPotentialPremove(projection, from, to, piece)
      ) {
        return false
      }
      const queued = {
        id: `${Date.now()}-${projection.acceptedMoves.length}`,
        from,
        to,
        promotion: promotion || 'q',
      }
      updatePremoveQueue([...projection.acceptedMoves, queued])
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
    const nextVariantEvents = pruneVariantEvents(variantEventsRef.current, nextHistory.length)
    variantEventsRef.current = nextVariantEvents
    setVariantEvents(nextVariantEvents)
    clearTimeout(eloDropTimerRef.current)
    setEloDropEvent(null)
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
    updatePremoveQueue([])
    setPendingPromotion(null)
    setSelectedSquare(null)
    setTurnState('game-over')
    const result = gameMode === 'bots'
      ? 'Match ended'
      : humanColor === 'white'
        ? 'Black wins by resignation'
        : 'White wins by resignation'
    runReview(history, result)
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
    speechEventId,
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
    ratingFor,
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
  return BOT_PROFILES.find((profile) => profile.id !== botId)?.id || 'mubassar'
}

function emptyVariantEvents() {
  return {
    botMoves: 0,
    botCaptureChecks: 0,
    botCaptures: 0,
    opponentChecks: 0,
    opponentBestMoves: 0,
    opponentWorstMoves: 0,
    currentElo: null,
    evilAwake: false,
    applied: [],
  }
}

function initialBotDialogueLog(whiteProfile, blackProfile) {
  return [whiteProfile, blackProfile].flatMap((speaker, index) => {
    const text = initialDialogue(speaker)
    if (!text) return []
    return [{
      id: `intro-${speaker.id}-${index}`,
      botId: speaker.id,
      text,
      ply: 0,
    }]
  })
}

function variantUsesEvent(profile, field) {
  if (field === 'botMoves' && profile?.variant?.movePolicy?.type === 'cycle') {
    return true
  }
  return variantEventField(profile) === field
}

export function pruneVariantEvents(events, maxPly) {
  return Object.fromEntries(Object.entries(events || {}).map(([botId, current]) => {
    const remaining = (current.applied || []).filter((marker) => {
      const ply = variantMarkerPly(marker)
      return Number.isFinite(ply) && ply <= maxPly
    })
    const next = emptyVariantEvents()
    for (const marker of remaining) {
      const [field] = marker.split(':')
      if (field === 'mode') {
        const mode = parseVariantModeMarker(marker)
        if (mode) {
          next.currentElo = mode.rating
          next.evilAwake = mode.awake
        }
      } else if (Object.hasOwn(next, field)) {
        next[field] += 1
      }
    }
    next.applied = remaining
    const hasLegacyMode = remaining.some((marker) =>
      String(marker).startsWith('mode:') && !parseVariantModeMarker(marker))
    if (hasLegacyMode && next.currentElo === null) {
      next.currentElo = Number.isFinite(current.currentElo) ? current.currentElo : null
      next.evilAwake = Boolean(current.evilAwake)
    }
    return [botId, next]
  }))
}

export function isExactVariantTrigger(variantType, playedUci, candidates) {
  const finite = (candidates || []).filter((candidate) =>
    candidate?.uci && Number.isFinite(candidate.score))
  if (!finite.length || !playedUci) return false
  if (variantType === 'opponent-best-move') {
    const best = [...finite].sort((a, b) => {
      const rankDifference = Number(a.rank || Infinity) - Number(b.rank || Infinity)
      return rankDifference || b.score - a.score
    })[0]
    return best?.uci === playedUci
  }
  if (variantType !== 'opponent-worst-move') return false
  const worstScore = Math.min(...finite.map((candidate) => candidate.score))
  return finite.some((candidate) =>
    candidate.uci === playedUci && candidate.score === worstScore)
}

export function requiresEveryLegalMove(profile) {
  const policy = profile?.variant?.movePolicy
  return policy?.allLegalMoves === true ||
    policy?.type === 'target-evaluation' ||
    policy?.type === 'random-blunder'
}

export function resolveEvilMartinMode(profile, candidates, events = {}) {
  const policy = profile?.variant?.movePolicy
  const awake = Boolean(events.evilAwake) || isEvilMartinAwake(profile, candidates, {
    events,
    evaluation: candidates?.[0]?.score,
  })
  return {
    awake,
    rating: awake ? policy?.awakeElo : policy?.sleepyElo,
  }
}

function appendVariantMarker(applied, marker) {
  const markers = [...(applied || []), marker]
  if (markers.length <= 240) return markers
  const modeMarkers = markers.filter((candidate) => String(candidate).startsWith('mode:'))
  const eventMarkers = markers
    .filter((candidate) => !String(candidate).startsWith('mode:'))
    .slice(-Math.max(0, 240 - modeMarkers.length))
  const retained = new Set([...modeMarkers, ...eventMarkers])
  return markers.filter((candidate) => retained.has(candidate))
}

function variantMarkerPly(marker) {
  const parts = String(marker).split(':')
  return Number(parts[0] === 'mode' && parts.length >= 4 ? parts[1] : parts.at(-1))
}

function parseVariantModeMarker(marker) {
  const [field, ply, rating, awake] = String(marker).split(':')
  if (
    field !== 'mode' ||
    !Number.isFinite(Number(ply)) ||
    !Number.isFinite(Number(rating)) ||
    !['0', '1'].includes(awake)
  ) {
    return null
  }
  return {
    ply: Number(ply),
    rating: Number(rating),
    awake: awake === '1',
  }
}

async function analyzeEveryLegalMove(client, game, policy) {
  const legalMoves = game.moves({ verbose: true }).map(moveToUci)
  if (!legalMoves.length) return []
  const chunks = []
  for (let index = 0; index < legalMoves.length; index += 16) {
    chunks.push(legalMoves.slice(index, index + 16))
  }
  const moveTime = Math.max(100, Math.floor(Number(policy.moveTime || 500) / chunks.length))
  const results = []
  for (const searchMoves of chunks) {
    const lines = await client.bestMoves(game.fen(), {
      ...policy,
      elo: undefined,
      depth: Math.min(15, Math.max(10, Number(policy.depth || 12))),
      moveTime,
      count: searchMoves.length,
      searchMoves,
      timeout: Math.max(2200, moveTime + 1500),
    })
    results.push(...(lines || []))
  }
  return results
    .filter((candidate) => candidate?.uci)
    .sort((a, b) => {
      if (!Number.isFinite(a.score)) return 1
      if (!Number.isFinite(b.score)) return -1
      return b.score - a.score
    })
    .map((candidate, index) => ({ ...candidate, rank: index + 1 }))
}

export async function analyzeCandidatesWithRetry(
  primaryClient,
  retryClient,
  game,
  policy,
  exhaustive,
) {
  const clients = [primaryClient, retryClient].filter(Boolean)
  let lastError = null
  for (let index = 0; index < clients.length; index += 1) {
    const client = clients[index]
    const attemptPolicy = index === 0
      ? policy
      : {
          ...policy,
          depth: Math.max(10, Math.min(16, Number(policy.depth || 12))),
          moveTime: Math.max(350, Number(policy.moveTime || 500)),
          timeout: Math.max(3000, Number(policy.timeout || 0)),
        }
    try {
      const candidates = exhaustive
        ? await analyzeEveryLegalMove(client, game, attemptPolicy)
        : await client.bestMoves(game.fen(), attemptPolicy)
      if (candidates?.length) return candidates
      lastError = new Error('Stockfish returned no candidate moves')
    } catch (error) {
      lastError = error
    }
  }
  throw lastError || new Error('No Stockfish client is available')
}

function shouldRunMateSafety(game, profile) {
  if (!profile?.capabilities?.maximumEngine || !profile.strengthPolicy?.mateSafety) return false
  if (isMartinDerivedProfile(profile)) return true
  if (game.inCheck()) return true
  const pieces = game.board().flat().filter(Boolean)
  if (pieces.length <= 12) return true
  const legalMoves = game.moves({ verbose: true })
  return legalMoves.some((move) =>
    move.san.includes('+') ||
    move.san.includes('#') ||
    move.captured === 'q' ||
    move.promotion,
  )
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
      byMove.set(candidate.uci, {
        ...existing,
        ...candidate,
        objectiveVerified: existing?.objectiveVerified === true || candidate.objectiveVerified === true,
      })
    } else if (candidate.objectiveVerified === true) {
      byMove.set(candidate.uci, {
        ...existing,
        objectiveVerified: true,
        objectiveVerificationScore: candidate.objectiveVerificationScore ?? existing.objectiveVerificationScore,
      })
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

async function verifyObjectiveCandidates(beforeGame, candidates, client, policy) {
  const legalMoves = new Map(
    beforeGame.moves({ verbose: true }).map((move) => [moveToUci(move), move]),
  )
  const verified = []
  for (const candidate of candidates) {
    const move = legalMoves.get(candidate.uci)
    if (!move) {
      verified.push(candidate)
      continue
    }
    const targetGames = objectiveVerificationGames(beforeGame, move)
    const scores = []
    let objectiveVerified = targetGames.length > 0
    for (const targetGame of targetGames) {
      const proof = await client.bestMoves(targetGame.fen(), {
        depth: Math.max(20, policy.depth || 0),
        moveTime: Math.max(2200, policy.moveTime || 0),
        count: 1,
        elo: undefined,
      }) || []
      const score = scoreForColor(proof[0], targetGame.turn(), move.color)
      scores.push(score)
      if (!Number.isFinite(score) || score < 650) {
        objectiveVerified = false
        break
      }
    }
    verified.push({
      ...candidate,
      objectiveVerified,
      objectiveVerificationScore: scores.length ? Math.min(...scores) : null,
    })
  }
  return verified
}

function objectiveVerificationGames(beforeGame, move) {
  const afterMove = new Chess(beforeGame.fen())
  afterMove.move(move)
  if (afterMove.isGameOver()) return []
  const games = [afterMove]
  const capture = afterMove.moves({ verbose: true }).find((reply) =>
    reply.piece === 'k' &&
    reply.to === move.to &&
    Boolean(reply.captured),
  )
  if (capture) {
    const afterCapture = new Chess(afterMove.fen())
    afterCapture.move(capture)
    if (afterCapture.isGameOver()) return []
    games.push(afterCapture)
  }
  return games
}

function scoreForColor(line, turn, color) {
  if (!line || !Number.isFinite(line.score)) return null
  return turn === color ? line.score : -line.score
}

function moveToUci(move) {
  return `${move.from}${move.to}${move.promotion || ''}`
}

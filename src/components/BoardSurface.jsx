import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Chessboard } from 'react-chessboard'
import { gameFromHistory } from '../lib/gameSession'
import {
  buildPremoveProjection,
  potentialPremoveTargets,
  premovePieceAt,
  premovePositionObject,
} from '../lib/premoveRules'
import { kaneoPieces } from '../lib/kaneoPieces'

export function BoardSurface({
  history,
  viewPly,
  orientation,
  humanColor,
  turnState,
  lastMove,
  premoves = [],
  selectedSquare,
  setSelectedSquare,
  arrows,
  setArrows,
  onMove,
  onCancelPremove = () => {},
  interactive = true,
}) {
  const boardRef = useRef(null)
  const arrowStart = useRef(null)
  const keyboardSquare = useRef(orientation === 'black' ? 'h8' : 'a1')
  const keyboardInputActive = useRef(false)
  const focusFrame = useRef(null)
  const keyboardHandler = useRef(null)
  const [reduceMotion, setReduceMotion] = useState(() =>
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  )
  const game = useMemo(() => gameFromHistory(history.slice(0, viewPly)), [history, viewPly])
  const liveGame = useMemo(() => gameFromHistory(history), [history])
  const latest = viewPly === history.length
  const playerColor = humanColor === 'white' ? 'w' : 'b'
  const premoveProjection = useMemo(
    () => buildPremoveProjection(liveGame, premoves, playerColor),
    [liveGame, playerColor, premoves],
  )
  const projectedPremoves = premoveProjection.acceptedMoves
  const displayedPosition = latest
    ? premovePositionObject(premoveProjection)
    : game.fen()

  const scheduleKeyboardFocus = useCallback(() => {
    if (focusFrame.current !== null) {
      window.cancelAnimationFrame(focusFrame.current)
    }
    focusFrame.current = window.requestAnimationFrame(() => {
      focusFrame.current = window.requestAnimationFrame(() => {
        focusFrame.current = null
        if (!keyboardInputActive.current) return
        const board = boardRef.current
        const square = keyboardSquare.current
        for (const squareElement of board?.querySelectorAll('[data-square]') || []) {
          squareElement.setAttribute(
            'tabindex',
            squareElement.dataset.square === square ? '0' : '-1',
          )
        }
        board
          ?.querySelector(`[data-square="${square}"]`)
          ?.focus({ preventScroll: true })
      })
    })
  }, [])

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const updatePreference = () => setReduceMotion(query.matches)
    query.addEventListener('change', updatePreference)
    return () => query.removeEventListener('change', updatePreference)
  }, [])

  const legalTargets = useMemo(() => {
    if (!selectedSquare || !latest || !interactive) return []
    const piece = premovePieceAt(premoveProjection, selectedSquare)
    if (!piece || piece.color !== playerColor) return []
    return moveTargets(
      liveGame,
      premoveProjection,
      selectedSquare,
      piece,
      playerColor,
      turnState,
      projectedPremoves.length,
    )
  }, [
    interactive,
    latest,
    liveGame,
    playerColor,
    premoveProjection,
    projectedPremoves.length,
    selectedSquare,
    turnState,
  ])

  const squareStyles = useMemo(() => {
    const styles = {}
    if (latest && lastMove) {
      styles[lastMove.from] = highlight('rgba(231, 194, 73, 0.72)')
      styles[lastMove.to] = highlight('rgba(231, 194, 73, 0.72)')
    }
    for (const target of legalTargets) {
      styles[target.square] = target.capture
        ? {
            ...styles[target.square],
            boxShadow: joinShadow(
              styles[target.square]?.boxShadow,
              'inset 0 0 0 clamp(5px, 0.9vw, 9px) rgba(238, 248, 231, 0.92)',
            ),
          }
        : {
            ...styles[target.square],
            backgroundImage: 'radial-gradient(circle, rgba(238, 248, 231, 0.94) 0 18%, rgba(52, 76, 38, 0.6) 20% 23%, transparent 25%)',
          }
    }
    if (latest && selectedSquare) {
      styles[selectedSquare] = {
        ...styles[selectedSquare],
        backgroundColor: 'rgba(132, 188, 74, 0.74)',
        boxShadow: joinShadow(
          styles[selectedSquare]?.boxShadow,
          'inset 0 0 0 4px rgba(230, 255, 205, 0.76)',
        ),
      }
    }
    if (latest) {
      for (let index = projectedPremoves.length - 1; index >= 0; index -= 1) {
        const premove = projectedPremoves[index]
        const next = index === 0
        for (const square of [premove.from, premove.to]) {
          const fillAlpha = next ? 0.84 : Math.max(0.5, 0.68 - index * 0.035)
          const borderAlpha = next ? 0.9 : 0.66
          const borderWidth = next ? '4px' : '3px'
          styles[square] = {
            ...styles[square],
            backgroundColor: `rgba(205, 55, 64, ${fillAlpha})`,
            backgroundImage: 'none',
            boxShadow: joinShadow(
              styles[square]?.boxShadow,
              `inset 0 0 0 ${borderWidth} rgba(255, 188, 192, ${borderAlpha})`,
            ),
          }
        }
      }
    }
    const checkSquare = checkedKing(game)
    if (checkSquare) {
      styles[checkSquare] = {
        ...styles[checkSquare],
        backgroundImage: 'radial-gradient(circle, rgba(211,43,50,.98) 0 44%, rgba(211,43,50,.55) 46% 65%, transparent 72%)',
        boxShadow: joinShadow(
          styles[checkSquare]?.boxShadow,
          'inset 0 0 0 5px rgba(255, 212, 214, 0.95)',
        ),
      }
    }
    return styles
  }, [game, lastMove, latest, legalTargets, projectedPremoves, selectedSquare])

  useEffect(() => {
    const board = boardRef.current
    if (!board) return undefined
    const syncSquareAccessibility = () => {
      const squares = [...board.querySelectorAll('[data-square]')]
      if (!interactive || !latest) {
        for (const squareElement of squares) {
          squareElement.removeAttribute('role')
          squareElement.removeAttribute('tabindex')
          squareElement.removeAttribute('aria-label')
          squareElement.removeAttribute('aria-pressed')
        }
        return
      }
      for (const squareElement of squares) {
        const square = squareElement.dataset.square
        const piece = latest
          ? premovePieceAt(premoveProjection, square)
          : game.get(square)
        const status = []
        if (selectedSquare === square) status.push('selected')
        const premoveStatuses = queueStatuses(projectedPremoves, square)
        status.push(...premoveStatuses.labels)
        if (premoveStatuses.badge) {
          squareElement.dataset.premoveStep = premoveStatuses.badge
        } else {
          delete squareElement.dataset.premoveStep
        }
        squareElement.setAttribute('role', 'button')
        squareElement.setAttribute('tabindex', square === keyboardSquare.current ? '0' : '-1')
        squareElement.setAttribute('aria-label', squareLabel(square, piece, status))
        squareElement.setAttribute(
          'aria-pressed',
          selectedSquare === square ? 'true' : 'false',
        )
      }
    }

    const observer = new MutationObserver(() => {
      syncSquareAccessibility()
      if (keyboardInputActive.current) scheduleKeyboardFocus()
    })
    syncSquareAccessibility()
    if (keyboardInputActive.current) scheduleKeyboardFocus()
    observer.observe(board, { childList: true, subtree: true })

    return () => {
      observer.disconnect()
      if (focusFrame.current !== null) {
        window.cancelAnimationFrame(focusFrame.current)
        focusFrame.current = null
      }
    }
  }, [
    game,
    interactive,
    latest,
    premoveProjection,
    projectedPremoves,
    scheduleKeyboardFocus,
    selectedSquare,
  ])

  function chooseSquare(square) {
    if (!interactive || !latest) return
    if (selectedSquare === square) {
      setSelectedSquare(null)
      return
    }
    if (selectedSquare) {
      const targetIsAvailable = legalTargets.some((target) => target.square === square)
      if (targetIsAvailable && onMove(selectedSquare, square)) {
        setSelectedSquare(null)
        return
      }
    }
    const piece = premovePieceAt(premoveProjection, square)
    setSelectedSquare(piece?.color === playerColor ? square : null)
  }

  function focusSquare(square) {
    keyboardSquare.current = square
    for (const squareElement of boardRef.current?.querySelectorAll('[data-square]') || []) {
      squareElement.setAttribute(
        'tabindex',
        squareElement.dataset.square === square ? '0' : '-1',
      )
    }
    boardRef.current
      ?.querySelector(`[data-square="${square}"]`)
      ?.focus({ preventScroll: true })
    scheduleKeyboardFocus()
  }

  function handleBoardFocus(event) {
    const square = event.target.closest?.('[data-square]')?.dataset.square
    if (square && square !== keyboardSquare.current) {
      keyboardSquare.current = square
      for (const squareElement of boardRef.current?.querySelectorAll('[data-square]') || []) {
        squareElement.setAttribute(
          'tabindex',
          squareElement.dataset.square === square ? '0' : '-1',
        )
      }
    }
  }

  function handleBoardKeyDown(event) {
    if (!interactive || !latest) return
    const square = event.target.closest?.('[data-square]')?.dataset.square ||
      (keyboardInputActive.current ? keyboardSquare.current : null)
    if (!square) return
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      event.stopPropagation()
      keyboardInputActive.current = true
      chooseSquare(square)
      focusSquare(square)
      return
    }
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      keyboardInputActive.current = true
      if (premoves.length) onCancelPremove()
      setSelectedSquare(null)
      setArrows([])
      return
    }
    const nextSquare = keyboardDestination(square, event.key, orientation)
    if (!nextSquare) return
    event.preventDefault()
    event.stopPropagation()
    keyboardInputActive.current = true
    focusSquare(nextSquare)
  }

  useEffect(() => {
    keyboardHandler.current = handleBoardKeyDown
  })

  useEffect(() => {
    const handleDetachedSquareKey = (event) => {
      const board = boardRef.current
      const activeElement = document.activeElement
      if (
        !keyboardInputActive.current ||
        !board ||
        board.contains(event.target) ||
        (
          activeElement !== document.body &&
          activeElement !== document.documentElement &&
          !board.contains(activeElement)
        )
      ) {
        return
      }
      if (!['Enter', ' ', 'Escape', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
        return
      }
      event.stopImmediatePropagation()
      keyboardHandler.current?.(event)
    }
    window.addEventListener('keydown', handleDetachedSquareKey, true)
    return () => window.removeEventListener('keydown', handleDetachedSquareKey, true)
  }, [])

  function handleMouseDown({ square }, event) {
    if (event.button === 0) return
    if (event.button === 2) {
      arrowStart.current = { square, color: event.altKey ? '#3d8fe8' : '#7eaf45' }
    }
  }

  function handleMouseUp({ square }, event) {
    if (event.button !== 2 || !arrowStart.current) return
    const start = arrowStart.current
    arrowStart.current = null
    if (start.square === square) {
      if (premoves.length) onCancelPremove()
      setArrows([])
      return
    }
    const next = { startSquare: start.square, endSquare: square, color: start.color }
    setArrows((current) => {
      const exists = current.some((arrow) =>
        arrow.startSquare === next.startSquare &&
        arrow.endSquare === next.endSquare &&
        arrow.color === next.color,
      )
      return exists ? current.filter((arrow) => arrow !== current.find((item) =>
        item.startSquare === next.startSquare &&
        item.endSquare === next.endSquare &&
        item.color === next.color,
      )) : [...current, next]
    })
  }

  return (
    <div
      ref={boardRef}
      className="board-surface"
      role="group"
      aria-label={`${orientation === 'black' ? 'Black' : 'White'}-oriented chessboard`}
      aria-keyshortcuts="ArrowUp ArrowDown ArrowLeft ArrowRight Enter Space Escape"
      data-turn-state={turnState}
      data-has-premove={projectedPremoves.length ? 'true' : 'false'}
      data-premove-count={projectedPremoves.length}
      onContextMenu={(event) => event.preventDefault()}
      onFocus={handleBoardFocus}
      onKeyDown={handleBoardKeyDown}
      onPointerDownCapture={() => {
        keyboardInputActive.current = false
      }}
    >
      <Chessboard options={{
        id: 'play-bots-board',
        position: displayedPosition,
        pieces: kaneoPieces,
        boardOrientation: orientation,
        boardStyle: { borderRadius: 2 },
        lightSquareStyle: { backgroundColor: '#e0bf78' },
        darkSquareStyle: { backgroundColor: '#9f6839' },
        showNotation: true,
        darkSquareNotationStyle: {
          color: 'rgba(255, 239, 205, 0.9)',
          fontWeight: 900,
        },
        lightSquareNotationStyle: {
          color: 'rgba(90, 54, 29, 0.82)',
          fontWeight: 900,
        },
        alphaNotationStyle: { fontSize: 'clamp(9px, 1.35vw, 14px)' },
        numericNotationStyle: { fontSize: 'clamp(9px, 1.35vw, 14px)' },
        squareStyles,
        arrows,
        allowDrawingArrows: false,
        allowDragOffBoard: false,
        allowAutoScroll: false,
        dragActivationDistance: 3,
        clearArrowsOnPositionChange: false,
        animationDurationInMs: reduceMotion ? 0 : 140,
        showAnimations: !reduceMotion,
        draggingPieceGhostStyle: { opacity: 0.18 },
        draggingPieceStyle: {
          opacity: 1,
          zIndex: 80,
          transform: 'scale(1)',
          transformOrigin: 'center',
        },
        canDragPiece: ({ square }) => {
          if (!interactive || !latest || !square || turnState === 'game-over') return false
          return premovePieceAt(premoveProjection, square)?.color === playerColor
        },
        onPieceDrag: ({ square }) => setSelectedSquare(square),
        onPieceDrop: ({ sourceSquare, targetSquare }) => {
          if (!targetSquare) {
            setSelectedSquare(null)
            return false
          }
          const piece = premovePieceAt(premoveProjection, sourceSquare)
          const targetIsAvailable = piece?.color === playerColor &&
            moveTargets(
              liveGame,
              premoveProjection,
              sourceSquare,
              piece,
              playerColor,
              turnState,
              projectedPremoves.length,
            ).some((target) => target.square === targetSquare)
          if (!targetIsAvailable) {
            setSelectedSquare(null)
            return false
          }
          const moved = onMove(sourceSquare, targetSquare)
          setSelectedSquare(null)
          return moved
        },
        onSquareClick: ({ square }) => chooseSquare(square),
        onSquareMouseDown: handleMouseDown,
        onSquareMouseUp: handleMouseUp,
      }} />
    </div>
  )
}

function checkedKing(game) {
  if (!game.inCheck()) return null
  for (let rank = 0; rank < 8; rank += 1) {
    for (let file = 0; file < 8; file += 1) {
      const piece = game.board()[rank][file]
      if (piece?.type === 'k' && piece.color === game.turn()) {
        return `${'abcdefgh'[file]}${8 - rank}`
      }
    }
  }
  return null
}

function highlight(color) {
  return { backgroundColor: color }
}

function joinShadow(current, next) {
  return current ? `${current}, ${next}` : next
}

function moveTargets(
  game,
  projection,
  square,
  piece,
  playerColor,
  turnState,
  premoveCount,
) {
  if (game.turn() === playerColor && turnState === 'human' && premoveCount === 0) {
    return game.moves({ square, verbose: true }).map((move) => ({
      square: move.to,
      capture: Boolean(move.captured),
    }))
  }
  return potentialPremoveTargets(projection, square, piece)
}

function squareLabel(square, piece, status) {
  const pieceNames = {
    p: 'pawn',
    n: 'knight',
    b: 'bishop',
    r: 'rook',
    q: 'queen',
    k: 'king',
  }
  const contents = piece
    ? `${piece.color === 'w' ? 'White' : 'Black'} ${pieceNames[piece.type]}`
    : 'empty'
  return `${square}, ${contents}${status.length ? `, ${status.join(', ')}` : ''}`
}

function queueStatuses(premoves, square) {
  const events = []
  const destinations = []
  premoves.forEach((premove, index) => {
    const step = index + 1
    if (premove.from === square) events.push({ step, role: 'source' })
    if (premove.to === square) {
      events.push({ step, role: 'destination' })
      destinations.push(step)
    }
  })
  return {
    labels: queueEventLabels(events),
    badge: queueStepBadge(destinations),
  }
}

function queueEventLabels(events) {
  const chronological = [...events].sort((a, b) => a.step - b.step)
  if (chronological.length <= 3) {
    return chronological.map(({ step, role }) => `premove ${step} ${role}`)
  }
  const first = chronological[0]
  return [`premove ${first.step} ${first.role} and ${chronological.length - 1} later queue visits`]
}

function queueStepBadge(steps) {
  if (steps.length <= 2) return steps.join('·')
  return `${steps[0]}+${steps.length - 1}`
}

function keyboardDestination(square, key, orientation) {
  const vectors = orientation === 'black'
    ? {
        ArrowUp: [0, -1],
        ArrowDown: [0, 1],
        ArrowLeft: [1, 0],
        ArrowRight: [-1, 0],
      }
    : {
        ArrowUp: [0, 1],
        ArrowDown: [0, -1],
        ArrowLeft: [-1, 0],
        ArrowRight: [1, 0],
      }
  const vector = vectors[key]
  if (!vector) return null
  const file = square.charCodeAt(0) - 97 + vector[0]
  const rank = Number(square[1]) - 1 + vector[1]
  if (file < 0 || file > 7 || rank < 0 || rank > 7) return null
  return `${String.fromCharCode(97 + file)}${rank + 1}`
}

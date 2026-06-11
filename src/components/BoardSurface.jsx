import { useMemo, useRef } from 'react'
import { Chessboard } from 'react-chessboard'
import { gameFromHistory } from '../lib/gameSession'

export function BoardSurface({
  history,
  viewPly,
  orientation,
  humanColor,
  turnState,
  lastMove,
  premove,
  selectedSquare,
  setSelectedSquare,
  arrows,
  setArrows,
  onMove,
  interactive = true,
}) {
  const arrowStart = useRef(null)
  const game = useMemo(() => gameFromHistory(history.slice(0, viewPly)), [history, viewPly])
  const liveGame = useMemo(() => gameFromHistory(history), [history])
  const latest = viewPly === history.length
  const playerColor = humanColor === 'white' ? 'w' : 'b'
  const legalTargets = useMemo(() => {
    if (!selectedSquare || !latest || !interactive) return []
    const piece = liveGame.get(selectedSquare)
    if (!piece || piece.color !== playerColor) return []
    if (liveGame.turn() === playerColor && turnState === 'human') {
      return liveGame.moves({ square: selectedSquare, verbose: true }).map((move) => ({
        square: move.to,
        capture: Boolean(move.captured),
      }))
    }
    return pseudoLegalTargets(liveGame, selectedSquare, piece)
  }, [interactive, latest, liveGame, playerColor, selectedSquare, turnState])

  const squareStyles = useMemo(() => {
    const styles = {}
    if (latest && lastMove) {
      styles[lastMove.from] = highlight('#e5c04d99')
      styles[lastMove.to] = highlight('#e5c04d99')
    }
    if (latest && premove) {
      styles[premove.from] = { boxShadow: 'inset 0 0 0 5px #4c8ed8' }
      styles[premove.to] = { boxShadow: 'inset 0 0 0 5px #4c8ed8' }
    }
    for (const target of legalTargets) {
      styles[target.square] = target.capture
        ? {
            ...styles[target.square],
            boxShadow: `${styles[target.square]?.boxShadow ? `${styles[target.square].boxShadow},` : ''} inset 0 0 0 9px rgba(255,255,255,.92)`,
          }
        : {
            ...styles[target.square],
            backgroundImage: 'radial-gradient(circle, rgba(255,255,255,.96) 0 24%, transparent 26%)',
          }
    }
    const checkSquare = checkedKing(game)
    if (checkSquare) {
      styles[checkSquare] = {
        ...styles[checkSquare],
        backgroundImage: 'radial-gradient(circle, rgba(211,43,50,.98) 0 44%, rgba(211,43,50,.55) 46% 65%, transparent 72%)',
        boxShadow: 'inset 0 0 0 5px rgba(255,67,75,.95)',
      }
    }
    return styles
  }, [game, lastMove, latest, legalTargets, premove])

  function chooseSquare(square) {
    if (!interactive || !latest) return
    if (selectedSquare && selectedSquare !== square && onMove(selectedSquare, square)) {
      setSelectedSquare(null)
      return
    }
    const piece = liveGame.get(square)
    setSelectedSquare(piece?.color === playerColor ? square : null)
  }

  function handleMouseDown({ square }, event) {
    if (event.button === 0) {
      const piece = liveGame.get(square)
      if (piece?.color === playerColor) setSelectedSquare(square)
      return
    }
    if (event.button === 2) {
      arrowStart.current = { square, color: event.altKey ? '#3d8fe8' : '#7eaf45' }
    }
  }

  function handleMouseUp({ square }, event) {
    if (event.button !== 2 || !arrowStart.current) return
    const start = arrowStart.current
    arrowStart.current = null
    if (start.square === square) {
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
    <div className="board-surface" onContextMenu={(event) => event.preventDefault()}>
      <Chessboard options={{
        id: 'play-bots-board',
        position: game.fen(),
        boardOrientation: orientation,
        boardStyle: { borderRadius: 0 },
        lightSquareStyle: { backgroundColor: '#daba6d' },
        darkSquareStyle: { backgroundColor: '#a56f3d' },
        squareStyles,
        arrows,
        allowDrawingArrows: false,
        allowDragOffBoard: false,
        clearArrowsOnPositionChange: false,
        animationDurationInMs: 170,
        draggingPieceGhostStyle: { opacity: 0.18 },
        draggingPieceStyle: {
          opacity: 1,
          zIndex: 80,
          transform: 'scale(1)',
          transformOrigin: 'center',
        },
        canDragPiece: ({ square }) => {
          if (!interactive || !latest || !square) return false
          return liveGame.get(square)?.color === playerColor
        },
        onPieceDrag: ({ square }) => setSelectedSquare(square),
        onPieceDrop: ({ sourceSquare, targetSquare }) => {
          if (!targetSquare) {
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

function pseudoLegalTargets(game, square, piece) {
  const file = square.charCodeAt(0) - 97
  const rank = Number(square[1]) - 1
  const targets = []
  const add = (nextFile, nextRank) => {
    if (nextFile < 0 || nextFile > 7 || nextRank < 0 || nextRank > 7) return false
    const target = `${String.fromCharCode(97 + nextFile)}${nextRank + 1}`
    const occupant = game.get(target)
    if (occupant?.color === piece.color) return false
    targets.push({ square: target, capture: Boolean(occupant) })
    return !occupant
  }
  if (piece.type === 'n') {
    for (const [df, dr] of [[1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1]]) add(file + df, rank + dr)
  } else if (piece.type === 'k') {
    for (let df = -1; df <= 1; df += 1) {
      for (let dr = -1; dr <= 1; dr += 1) if (df || dr) add(file + df, rank + dr)
    }
  } else if (piece.type === 'p') {
    const direction = piece.color === 'w' ? 1 : -1
    if (!game.get(`${String.fromCharCode(97 + file)}${rank + direction + 1}`)) add(file, rank + direction)
    for (const df of [-1, 1]) {
      const targetFile = file + df
      const targetRank = rank + direction
      if (targetFile < 0 || targetFile > 7 || targetRank < 0 || targetRank > 7) continue
      const target = `${String.fromCharCode(97 + targetFile)}${targetRank + 1}`
      if (game.get(target)?.color !== piece.color) targets.push({ square: target, capture: true })
    }
  } else {
    const directions = piece.type === 'b'
      ? [[1, 1], [1, -1], [-1, 1], [-1, -1]]
      : piece.type === 'r'
        ? [[1, 0], [-1, 0], [0, 1], [0, -1]]
        : [[1, 1], [1, -1], [-1, 1], [-1, -1], [1, 0], [-1, 0], [0, 1], [0, -1]]
    for (const [df, dr] of directions) {
      for (let step = 1; step < 8; step += 1) {
        if (!add(file + df * step, rank + dr * step)) break
      }
    }
  }
  return targets
}

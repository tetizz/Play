const FILES = 'abcdefgh'
const PROMOTION_PIECES = new Set(['q', 'r', 'b', 'n'])

export function hasCastlingRight(game, color, direction) {
  return castlingRightSet(game).has(castlingRightFor(color, direction))
}

export function normalizePremoveQueue(queue) {
  if (!Array.isArray(queue)) return []
  const normalized = []
  for (const [index, move] of queue.entries()) {
    const from = normalizeSquare(move?.from)
    const to = normalizeSquare(move?.to)
    if (!from || !to || from === to) break
    const promotion = PROMOTION_PIECES.has(move?.promotion) ? move.promotion : 'q'
    normalized.push({
      id: typeof move.id === 'string' && move.id ? move.id : `restored-${index}`,
      from,
      to,
      promotion,
    })
  }
  return normalized
}

export function buildPremoveProjection(game, queue = [], playerColor = null) {
  const projection = {
    pieces: positionPieces(game),
    castlingRights: castlingRightSet(game),
    acceptedMoves: [],
    rejectedIndex: -1,
  }

  for (const move of normalizePremoveQueue(queue)) {
    const piece = projection.pieces[move.from]
    if (
      !piece ||
      (playerColor && piece.color !== playerColor) ||
      !isPotentialPremove(projection, move.from, move.to, piece)
    ) {
      projection.rejectedIndex = projection.acceptedMoves.length
      break
    }
    applyProjectedPremove(projection, move, piece)
    projection.acceptedMoves.push(move)
  }

  return projection
}

export function premovePieceAt(projection, square) {
  return projection?.pieces?.[square] || null
}

export function premovePositionObject(projection) {
  return Object.fromEntries(
    Object.entries(projection?.pieces || {}).map(([square, piece]) => [
      square,
      { pieceType: `${piece.color}${piece.type.toUpperCase()}` },
    ]),
  )
}

export function isPotentialPremove(projection, from, to, piece = null) {
  const activePiece = piece || premovePieceAt(projection, from)
  if (!activePiece || !from || !to || from === to) return false
  return potentialPremoveTargets(projection, from, activePiece)
    .some((target) => target.square === to)
}

export function potentialPremoveTargets(projection, square, piece = null) {
  const activePiece = piece || premovePieceAt(projection, square)
  if (!activePiece || !normalizeSquare(square)) return []

  const file = square.charCodeAt(0) - 97
  const rank = Number(square[1]) - 1
  const targets = []
  const add = (nextFile, nextRank) => {
    if (!isBoardCoordinate(nextFile, nextRank)) return false
    const target = squareAt(nextFile, nextRank)
    const occupant = premovePieceAt(projection, target)
    if (occupant?.color === activePiece.color) return false
    if (occupant?.type === 'k') return false
    targets.push({ square: target, capture: Boolean(occupant) })
    return !occupant
  }

  if (activePiece.type === 'n') {
    for (const [df, dr] of KNIGHT_STEPS) add(file + df, rank + dr)
    return targets
  }

  if (activePiece.type === 'k') {
    for (let df = -1; df <= 1; df += 1) {
      for (let dr = -1; dr <= 1; dr += 1) {
        if (df || dr) add(file + df, rank + dr)
      }
    }
    const homeRank = activePiece.color === 'w' ? 0 : 7
    if (file === 4 && rank === homeRank) {
      for (const rookFile of [0, 7]) {
        const direction = rookFile === 0 ? -1 : 1
        const rook = premovePieceAt(projection, squareAt(rookFile, homeRank))
        const path = direction < 0 ? [1, 2, 3] : [5, 6]
        if (
          projection.castlingRights.has(castlingRightFor(activePiece.color, direction)) &&
          rook?.type === 'r' &&
          rook.color === activePiece.color &&
          path.every((pathFile) => !premovePieceAt(projection, squareAt(pathFile, homeRank)))
        ) {
          targets.push({
            square: squareAt(file + direction * 2, homeRank),
            capture: false,
          })
        }
      }
    }
    return targets
  }

  if (activePiece.type === 'p') {
    const direction = activePiece.color === 'w' ? 1 : -1
    const oneStepRank = rank + direction
    if (
      isBoardCoordinate(file, oneStepRank) &&
      !premovePieceAt(projection, squareAt(file, oneStepRank))
    ) {
      targets.push({ square: squareAt(file, oneStepRank), capture: false })
      const homeRank = activePiece.color === 'w' ? 1 : 6
      const twoStepRank = rank + direction * 2
      if (
        rank === homeRank &&
        isBoardCoordinate(file, twoStepRank) &&
        !premovePieceAt(projection, squareAt(file, twoStepRank))
      ) {
        targets.push({ square: squareAt(file, twoStepRank), capture: false })
      }
    }
    for (const df of [-1, 1]) {
      const targetFile = file + df
      const targetRank = rank + direction
      if (!isBoardCoordinate(targetFile, targetRank)) continue
      const target = squareAt(targetFile, targetRank)
      const occupant = premovePieceAt(projection, target)
      if (occupant?.color !== activePiece.color && occupant?.type !== 'k') {
        targets.push({ square: target, capture: true })
      }
    }
    return targets
  }

  const directions = activePiece.type === 'b'
    ? DIAGONAL_DIRECTIONS
    : activePiece.type === 'r'
      ? STRAIGHT_DIRECTIONS
      : activePiece.type === 'q'
        ? [...DIAGONAL_DIRECTIONS, ...STRAIGHT_DIRECTIONS]
        : []
  for (const [df, dr] of directions) {
    for (let step = 1; step < 8; step += 1) {
      if (!add(file + df * step, rank + dr * step)) break
    }
  }
  return targets
}

function applyProjectedPremove(projection, move, piece) {
  const captured = projection.pieces[move.to]
  updateCastlingRights(projection.castlingRights, move.from, move.to, piece, captured)
  if (
    piece.type === 'p' &&
    move.from[0] !== move.to[0] &&
    !captured
  ) {
    removeConditionalEnPassantPawn(projection, move, piece)
  }
  delete projection.pieces[move.from]
  projection.pieces[move.to] = {
    color: piece.color,
    type: piece.type === 'p' && isPromotionRank(piece.color, move.to)
      ? move.promotion
      : piece.type,
  }

  if (piece.type !== 'k' || Math.abs(move.to.charCodeAt(0) - move.from.charCodeAt(0)) !== 2) {
    return
  }
  const homeRank = piece.color === 'w' ? '1' : '8'
  const kingSide = move.to[0] === 'g'
  const rookFrom = `${kingSide ? 'h' : 'a'}${homeRank}`
  const rookTo = `${kingSide ? 'f' : 'd'}${homeRank}`
  const rook = projection.pieces[rookFrom]
  if (rook?.type === 'r' && rook.color === piece.color) {
    delete projection.pieces[rookFrom]
    projection.pieces[rookTo] = rook
  }
}

function removeConditionalEnPassantPawn(projection, move, piece) {
  const sourceRank = Number(move.from[1])
  const enPassantRank = piece.color === 'w' ? 5 : 4
  if (sourceRank !== enPassantRank) return

  const opponentColor = piece.color === 'w' ? 'b' : 'w'
  const adjacentSquare = `${move.to[0]}${move.from[1]}`
  const adjacent = projection.pieces[adjacentSquare]
  if (adjacent?.color === opponentColor && adjacent.type === 'p') {
    delete projection.pieces[adjacentSquare]
    return
  }

  const opponentHomeRank = piece.color === 'w' ? '7' : '2'
  const homeSquare = `${move.to[0]}${opponentHomeRank}`
  const homePawn = projection.pieces[homeSquare]
  if (homePawn?.color === opponentColor && homePawn.type === 'p') {
    delete projection.pieces[homeSquare]
  }
}

function updateCastlingRights(rights, from, to, piece, captured) {
  if (piece.type === 'k') {
    rights.delete(piece.color === 'w' ? 'K' : 'k')
    rights.delete(piece.color === 'w' ? 'Q' : 'q')
  }
  removeRookRight(rights, from, piece)
  removeRookRight(rights, to, captured)
}

function removeRookRight(rights, square, piece) {
  if (piece?.type !== 'r') return
  const rightsBySquare = {
    a1: 'Q',
    h1: 'K',
    a8: 'q',
    h8: 'k',
  }
  const right = rightsBySquare[square]
  if (right) rights.delete(right)
}

function positionPieces(game) {
  const pieces = {}
  for (const file of FILES) {
    for (let rank = 1; rank <= 8; rank += 1) {
      const square = `${file}${rank}`
      const piece = game.get(square)
      if (piece) pieces[square] = { color: piece.color, type: piece.type }
    }
  }
  return pieces
}

function castlingRightSet(game) {
  const rights = game?.fen?.().split(/\s+/)[2] || '-'
  return new Set(rights === '-' ? [] : rights)
}

function castlingRightFor(color, direction) {
  if (color === 'w') return direction < 0 ? 'Q' : 'K'
  return direction < 0 ? 'q' : 'k'
}

function normalizeSquare(square) {
  const normalized = String(square || '').toLowerCase()
  return /^[a-h][1-8]$/.test(normalized) ? normalized : null
}

function isPromotionRank(color, square) {
  return color === 'w' ? square[1] === '8' : square[1] === '1'
}

function isBoardCoordinate(file, rank) {
  return file >= 0 && file < 8 && rank >= 0 && rank < 8
}

function squareAt(file, rank) {
  return `${FILES[file]}${rank + 1}`
}

const KNIGHT_STEPS = [
  [1, 2],
  [2, 1],
  [-1, 2],
  [-2, 1],
  [1, -2],
  [2, -1],
  [-1, -2],
  [-2, -1],
]
const DIAGONAL_DIRECTIONS = [[1, 1], [1, -1], [-1, 1], [-1, -1]]
const STRAIGHT_DIRECTIONS = [[1, 0], [-1, 0], [0, 1], [0, -1]]

export function hasCastlingRight(game, color, direction) {
  const castlingRights = game.fen().split(/\s+/)[2] || '-'
  const right = color === 'w'
    ? direction < 0 ? 'Q' : 'K'
    : direction < 0 ? 'q' : 'k'
  return castlingRights.includes(right)
}

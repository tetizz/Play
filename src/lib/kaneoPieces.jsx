const PIECE_CODES = [
  'wP',
  'wN',
  'wB',
  'wR',
  'wQ',
  'wK',
  'bP',
  'bN',
  'bB',
  'bR',
  'bQ',
  'bK',
]

const pieceRoot = `${import.meta.env.BASE_URL}assets/pieces/kaneo/`

export const kaneoPieces = Object.fromEntries(
  PIECE_CODES.map((pieceCode) => [
    pieceCode,
    ({ svgStyle } = {}) => (
      <img
        src={`${pieceRoot}${pieceCode}.svg`}
        alt=""
        aria-hidden="true"
        draggable="false"
        style={{
          ...svgStyle,
          display: 'block',
          width: '100%',
          height: '100%',
          objectFit: 'contain',
          pointerEvents: 'none',
          userSelect: 'none',
        }}
      />
    ),
  ]),
)

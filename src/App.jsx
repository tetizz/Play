import { useEffect, useMemo, useRef, useState } from 'react'
import { Chess } from 'chess.js'
import { Chessboard } from 'react-chessboard'
import {
  Bot,
  ChevronLeft,
  ChevronRight,
  Flag,
  Lightbulb,
  Undo2,
} from 'lucide-react'
import { calculationProfile, chooseCoachMove, shouldActivateBeltMode } from './lib/coachEngine'
import { reviewGameWithStockfish } from './lib/reviewEngine'
import { createStockfishClient } from './lib/stockfishClient'
import './App.css'

const AVATAR = './assets/mubassar-avatar.png'
const START_FEN = new Chess().fen()

function App() {
  const [phase, setPhase] = useState('setup')
  const [game, setGame] = useState(() => new Chess())
  const coachLevel = 2300
  const [colorChoice, setColorChoice] = useState('white')
  const [color, setColor] = useState('white')
  const [engineStatus, setEngineStatus] = useState('JS fallback ready')
  const [thinking, setThinking] = useState(false)
  const [selectedMove, setSelectedMove] = useState(null)
  const [lastBotMove, setLastBotMove] = useState(null)
  const [viewPly, setViewPly] = useState(0)
  const [finalReview, setFinalReview] = useState(null)
  const [reviewingGame, setReviewingGame] = useState(false)
  const [beltMode, setBeltMode] = useState(false)
  const [premove, setPremove] = useState(null)
  const [arrows, setArrows] = useState([])
  const stockfishRef = useRef(null)
  const premoveRef = useRef(null)
  const arrowStartRef = useRef(null)
  const [messages, setMessages] = useState([
    {
      speaker: 'Mubassar',
      text: 'Hey! I’m Mubassar. I’m a National Chess Master from NYC who is pursuing a FIDE title. Pick your settings and let’s play.',
    },
  ])

  const moveHistory = game.history()
  const latestPly = moveHistory.length
  const activePly = Math.min(viewPly, latestPly)
  const isViewingLatest = activePly === latestPly
  const displayedGame = useMemo(() => {
    const replay = new Chess()
    for (const san of moveHistory.slice(0, activePly)) replay.move(san)
    return replay
  }, [moveHistory, activePly])
  const displayedFen = displayedGame.fen()
  const gameState = getGameState(game, thinking)

  useEffect(() => {
    stockfishRef.current = createStockfishClient()
    return stockfishRef.current.onStatus(setEngineStatus)
  }, [])

  useEffect(() => {
    if (phase !== 'game') return undefined
    function onKeyDown(event) {
      if (event.key === 'ArrowLeft') setViewPly((current) => Math.max(0, current - 1))
      if (event.key === 'ArrowRight') setViewPly((current) => Math.min(latestPly, current + 1))
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [latestPly, phase])

  useEffect(() => {
    if (phase !== 'game' || thinking || !game.isGameOver() || finalReview || reviewingGame) return
    let cancelled = false
    async function runFinalReview() {
      setReviewingGame(true)
      const review = await reviewGameWithStockfish(
        game.history(),
        stockfishRef.current?.evaluateFen,
      )
      if (!cancelled) {
        setFinalReview(review)
        setReviewingGame(false)
      }
    }
    runFinalReview()
    return () => {
      cancelled = true
    }
  }, [finalReview, game, phase, reviewingGame, thinking])

  const legalTargets = useMemo(() => {
    if (!selectedMove || !isViewingLatest) return new Set()
    const playerTurn = color === 'white' ? 'w' : 'b'
    const piece = game.get(selectedMove)
    if (!piece || piece.color !== playerTurn) return new Set()
    if (game.turn() === playerTurn) {
      return new Set(game.moves({ square: selectedMove, verbose: true }).map((move) => move.to))
    }
    return new Set(premoveTargets(game, selectedMove, playerTurn))
  }, [color, game, isViewingLatest, selectedMove])

  const squareStyles = useMemo(() => {
    const styles = {}
    if (lastBotMove && isViewingLatest) {
      styles[lastBotMove.from] = { ...styles[lastBotMove.from], ...highlightStyle('#e4c15c') }
      styles[lastBotMove.to] = { ...styles[lastBotMove.to], ...highlightStyle('#e4c15c') }
    }
    if (premove && isViewingLatest) {
      styles[premove.from] = {
        ...styles[premove.from],
        boxShadow: 'inset 0 0 0 4px rgba(66, 153, 225, .95)',
      }
      styles[premove.to] = {
        ...styles[premove.to],
        boxShadow: 'inset 0 0 0 4px rgba(66, 153, 225, .95)',
      }
    }
    const checkSquare = findCheckedKingSquare(displayedGame)
    if (checkSquare) {
      styles[checkSquare] = {
        ...styles[checkSquare],
        background:
          'radial-gradient(circle, rgba(221, 31, 44, 0.98) 0 48%, rgba(221, 31, 44, 0.64) 49% 67%, rgba(221, 31, 44, 0.24) 68%, transparent 82%)',
        boxShadow: `${styles[checkSquare]?.boxShadow ? `${styles[checkSquare].boxShadow}, ` : ''}inset 0 0 0 5px rgba(255, 64, 76, 0.95)`,
      }
    }
    return styles
  }, [displayedGame, isViewingLatest, lastBotMove, premove])

  function startGame() {
    const fresh = new Chess()
    const chosenColor = colorChoice === 'random'
      ? (Math.random() > 0.5 ? 'white' : 'black')
      : colorChoice
    setColor(chosenColor)
    setGame(fresh)
    setPhase('game')
    setSelectedMove(null)
    setLastBotMove(null)
    setViewPly(0)
    setFinalReview(null)
    setReviewingGame(false)
    setBeltMode(false)
    clearPremove()
    setArrows([])
    setMessages([
      {
        speaker: 'Mubassar',
        text: 'Good luck! Try to keep up!',
      },
    ])
    if (chosenColor === 'black') playBotReply(fresh)
  }

  function resetGame() {
    setGame(new Chess())
    setPhase('setup')
    setThinking(false)
    setSelectedMove(null)
    setLastBotMove(null)
    setViewPly(0)
    setFinalReview(null)
    setReviewingGame(false)
    setBeltMode(false)
    clearPremove()
    setArrows([])
    setColor('white')
    setColorChoice('white')
    setMessages([
      {
        speaker: 'Mubassar',
        text: 'Hey! I’m Mubassar. I’m a National Chess Master from NYC who is pursuing a FIDE title. Pick your settings and let’s play.',
      },
    ])
  }

  function updateBoard(nextGame) {
    setGame(cloneGame(nextGame))
    setViewPly(nextGame.history().length)
    setArrows([])
  }

  function addCoachLine(text) {
    setMessages((current) => [{ speaker: 'Mubassar', text }, ...current.slice(0, 4)])
  }

  function setQueuedPremove(nextPremove) {
    premoveRef.current = nextPremove
    setPremove(nextPremove)
  }

  function clearPremove() {
    premoveRef.current = null
    setPremove(null)
  }

  function playBotReply(nextGame, forceBeltMode = beltMode, beltLine = null) {
    if (nextGame.isGameOver()) return
    setThinking(true)
    window.setTimeout(() => playBotReplyAsync(nextGame, forceBeltMode, beltLine), 2000)
  }

  async function playBotReplyAsync(nextGame, forceBeltMode = beltMode, beltLine = null) {
    const activeLevel = forceBeltMode ? 2700 : coachLevel
    let engineMove = null
    try {
      engineMove = await stockfishRef.current?.bestMove(
        nextGame.fen(),
        calculationProfile(activeLevel),
      )
    } catch {
      setEngineStatus('JS fallback ready')
    }

    const decision = chooseCoachMove(nextGame, activeLevel, engineMove)
    if (decision.move) {
      nextGame.move(decision.move)
      setLastBotMove({ from: decision.move.from, to: decision.move.to })
      addCoachLine(beltLine || decision.note)
      const queued = premoveRef.current
      if (queued) {
        const premoveMove = nextGame.move({
          from: queued.from,
          to: queued.to,
          promotion: 'q',
        })
        clearPremove()
        if (premoveMove) {
          setLastBotMove(null)
          updateBoard(nextGame)
          const nextBeltMode = forceBeltMode || shouldActivateBeltMode(nextGame.history(), color)
          const beltLine = 'You are going to get belt for playing this trash opening. Activating belt mode.'
          if (!forceBeltMode && nextBeltMode) setBeltMode(true)
          if (!nextGame.isGameOver()) {
            playBotReply(nextGame, nextBeltMode, !forceBeltMode && nextBeltMode ? beltLine : null)
            return
          }
        } else {
          addCoachLine('Premove did not work after my move.')
        }
      }
      updateBoard(nextGame)
    }
    setThinking(false)
  }

  function makeHumanMove(sourceSquare, targetSquare) {
    if (game.isGameOver() || !isViewingLatest) return false
    const playerTurn = color === 'white' ? 'w' : 'b'
    if (thinking || game.turn() !== playerTurn) {
      return queuePremove(sourceSquare, targetSquare, playerTurn)
    }

    const nextGame = cloneGame(game)
    const move = nextGame.move({ from: sourceSquare, to: targetSquare, promotion: 'q' })
    if (!move) return false

    setSelectedMove(null)
    setLastBotMove(null)
    clearPremove()
    updateBoard(nextGame)
    const nextBeltMode = beltMode || shouldActivateBeltMode(nextGame.history(), color)
    const beltLine = 'You are going to get belt for playing this trash opening. Activating belt mode.'
    if (!beltMode && nextBeltMode) {
      setBeltMode(true)
    }
    if (!nextGame.isGameOver()) {
      playBotReply(nextGame, nextBeltMode, !beltMode && nextBeltMode ? beltLine : null)
    }
    return true
  }

  function onSquareClick(args) {
    const square = typeof args === 'string' ? args : args.square
    if (selectedMove && selectedMove !== square && makeHumanMove(selectedMove, square)) return
    selectPiece(square)
  }

  function onPieceClick({ square }) {
    selectPiece(square)
  }

  function onPieceDrag({ square }) {
    selectPiece(square)
  }

  function selectPiece(square) {
    if (!square) return
    setSelectedMove((current) => {
      if (current === square) return current
      const playerTurn = color === 'white' ? 'w' : 'b'
      const piece = game.get(square)
      return piece?.color === playerTurn ? square : null
    })
  }

  function onSquareMouseDown({ square }, event) {
    if (event.button === 0) {
      const playerTurn = color === 'white' ? 'w' : 'b'
      const piece = game.get(square)
      if (piece?.color === playerTurn) selectPiece(square)
      return
    }
    if (event.button !== 2) return
    arrowStartRef.current = { square, color: arrowColor(event) }
  }

  function onSquareMouseUp({ square }, event) {
    if (event.button !== 2 || !arrowStartRef.current) return
    const { square: startSquare, color: arrowColorValue } = arrowStartRef.current
    arrowStartRef.current = null
    if (startSquare === square) {
      setArrows([])
      return
    }
    setArrows((current) => toggleArrow(current, {
      startSquare,
      endSquare: square,
      color: arrowColorValue,
    }))
  }

  function queuePremove(sourceSquare, targetSquare, playerTurn) {
    const piece = game.get(sourceSquare)
    if (!piece || piece.color !== playerTurn || sourceSquare === targetSquare) return false
    setSelectedMove(null)
    setQueuedPremove({ from: sourceSquare, to: targetSquare })
    return true
  }

  function undoPair() {
    const nextGame = cloneGame(game)
    nextGame.undo()
    nextGame.undo()
    updateBoard(nextGame)
    setLastBotMove(null)
    setFinalReview(null)
    setReviewingGame(false)
    setBeltMode(false)
    clearPremove()
    addCoachLine('Undo is fine for training. Now improve the idea, not only the move.')
  }

  if (phase === 'setup') {
    return (
      <main className="setup-shell">
        <section className="setup-board-preview">
          <PlayerStrip name="Mubassar" rating={coachLevel} title="NM" country="Bangladesh" />
          <PreviewBoard />
          <PlayerStrip name="trixize1234" rating="800" country="United States" bottom />
        </section>

        <section className="setup-panel">
          <div className="play-bots-title">
            <Bot size={28} />
            <h1>Play Bots</h1>
          </div>
          <div className="intro-row">
            <Avatar className="intro-avatar" />
            <div className="speech-bubble">
              Hey! I’m Mubassar. I’m a National Chess Master from NYC who is pursuing a FIDE
              title.
            </div>
          </div>

          <div className="color-picker" aria-label="Choose color">
            {[
              { key: 'white', piece: '♔', label: 'White' },
              { key: 'black', piece: '♚', label: 'Black' },
              { key: 'random', piece: '?', label: 'Random' },
            ].map((item) => (
              <button
                key={item.key}
                type="button"
                className={colorChoice === item.key ? 'selected' : ''}
                onClick={() => setColorChoice(item.key)}
              >
                <span>{item.piece}</span>
                <strong>{item.label}</strong>
              </button>
            ))}
          </div>

          <button type="button" className="play-button" onClick={startGame}>
            Play
          </button>
        </section>
      </main>
    )
  }

  return (
    <main className="game-shell">
      <section className="game-left">
        <PlayerStrip name="Mubassar" rating={coachLevel} title="NM" country="Bangladesh" />
        <div className="board-frame">
          <Chessboard
            options={{
              id: 'mubassar-board',
              position: displayedFen,
              boardOrientation: color,
              onPieceDrop: ({ sourceSquare, targetSquare }) =>
                makeHumanMove(sourceSquare, targetSquare),
              onSquareClick,
              onPieceClick,
              onPieceDrag,
              onSquareMouseDown,
              onSquareMouseUp,
              allowDragging: isViewingLatest,
              squareStyles,
              dropSquareStyle: { boxShadow: 'none' },
              draggingPieceGhostStyle: { opacity: 1 },
              allowDrawingArrows: false,
              arrows,
              arrowOptions: {
                color: '#79b64c',
                secondaryColor: '#f2c94c',
                tertiaryColor: '#d85050',
                arrowLengthReducerDenominator: 6,
                sameTargetArrowLengthReducerDenominator: 4,
                arrowWidthDenominator: 5,
                activeArrowWidthMultiplier: 0.9,
                opacity: 0.78,
                activeOpacity: 0.62,
                arrowStartOffset: 0.32,
              },
              squareRenderer: ({ piece, square, children }) => (
                <SquareWithHint
                  isLegalTarget={legalTargets.has(square)}
                  hasPiece={Boolean(piece)}
                >
                  {children}
                </SquareWithHint>
              ),
              boardStyle: { borderRadius: 0 },
              darkSquareStyle: { backgroundColor: '#9c693b' },
              lightSquareStyle: { backgroundColor: '#d9b66b' },
            }}
          />
        </div>
        <PlayerStrip name="trixize1234" rating="800" country="United States" bottom />
      </section>

      <aside className="game-right">
        <div className="play-bots-title compact">
          <Bot size={24} />
          <h1>Play Bots</h1>
        </div>
        <div className="intro-row in-game">
          <Avatar className="side-avatar" />
          <div className="speech-bubble">{messages[0]?.text}</div>
        </div>
        <MoveHistory
          moves={moveHistory}
          viewPly={activePly}
          latestPly={latestPly}
          openingName={detectOpeningName(moveHistory)}
          onBack={() => setViewPly((current) => Math.max(0, current - 1))}
          onForward={() => setViewPly((current) => Math.min(latestPly, current + 1))}
        />
        <div className="status-line">
          <span>{gameState}</span>
          <span>{premove ? `Premove ${premove.from}-${premove.to}` : engineStatus}</span>
        </div>
        <div className="action-row">
          <ActionButton label="Resign" icon={Flag} onClick={resetGame} />
          <ActionButton label="Undo" icon={Undo2} onClick={undoPair} />
          <ActionButton label="Show Hint" icon={Lightbulb} onClick={() => addCoachLine('Look for checks, captures, and threats. Then compare the quiet improving move.')} />
        </div>
        {reviewingGame || finalReview ? (
          <ReviewPanel finalReview={finalReview} reviewing={reviewingGame} />
        ) : null}
      </aside>
    </main>
  )
}

function PreviewBoard() {
  return (
    <div className="board-frame preview-board" aria-hidden="true">
      <Chessboard
        options={{
          id: 'mubassar-preview-board',
          position: START_FEN,
          allowDragging: false,
          boardStyle: { borderRadius: 0 },
          darkSquareStyle: { backgroundColor: '#9c693b' },
          lightSquareStyle: { backgroundColor: '#d9b66b' },
        }}
      />
    </div>
  )
}

function PlayerStrip({ name, rating, title, country, bottom = false }) {
  return (
    <div className={`player-strip ${bottom ? 'bottom' : ''}`}>
      {bottom ? <div className="user-avatar" /> : <Avatar className="strip-avatar" />}
      <div>
        {title ? <span className="nm-badge">NM</span> : null}
        <strong>{name}</strong>
        <span>({rating})</span>
        {country === 'Bangladesh' ? <BangladeshFlag /> : <span className="us-flag">US</span>}
      </div>
    </div>
  )
}

function MoveHistory({ moves, viewPly, latestPly, openingName, onBack, onForward }) {
  const groupedMoves = []
  for (let index = 0; index < moves.length; index += 2) {
    groupedMoves.push({
      number: index / 2 + 1,
      white: moves[index],
      black: moves[index + 1],
      whitePly: index + 1,
      blackPly: index + 2,
    })
  }

  return (
    <section className="notation-panel" aria-label="Move history">
      <div className="notation-header">
        <span>{openingName || 'Moves'}</span>
        <div className="notation-nav">
          <button type="button" onClick={onBack} disabled={viewPly === 0} aria-label="Previous move">
            <ChevronLeft size={24} />
          </button>
          <button
            type="button"
            onClick={onForward}
            disabled={viewPly === latestPly}
            aria-label="Next move"
          >
            <ChevronRight size={24} />
          </button>
        </div>
      </div>
      <div className="notation-list">
        {groupedMoves.length ? (
          groupedMoves.map((move) => (
            <div className="notation-row" key={move.number}>
              <span className="move-number">{move.number}.</span>
              <MoveToken san={move.white} active={viewPly === move.whitePly} />
              <MoveToken san={move.black} active={viewPly === move.blackPly} />
            </div>
          ))
        ) : (
          <span className="notation-empty">Moves will appear here.</span>
        )}
      </div>
    </section>
  )
}

function MoveToken({ san, active }) {
  if (!san) return <span />
  const isMate = san.includes('#')
  const isCheck = san.includes('+') && !isMate
  return (
    <span className={`${active ? 'current-move' : ''} ${isMate ? 'mate-move' : ''} ${isCheck ? 'check-move' : ''}`}>
      {san}
    </span>
  )
}

function Avatar({ className = '' }) {
  return (
    <span className={`avatar-frame ${className}`}>
      <img className="avatar" src={AVATAR} alt="Mubassar avatar" />
    </span>
  )
}

function SquareWithHint({ isLegalTarget, hasPiece, children }) {
  return (
    <div className="square-content">
      {children}
      {isLegalTarget ? (
        <span className={`legal-marker ${hasPiece ? 'capture' : ''}`} />
      ) : null}
    </div>
  )
}

function BangladeshFlag() {
  return (
    <span className="bd-flag" aria-label="Bangladesh flag">
      <span />
    </span>
  )
}

function ActionButton({ label, icon: Icon, onClick }) {
  return (
    <button type="button" className="action-button" onClick={onClick} aria-label={label}>
      <span className="tooltip">{label}</span>
      <Icon size={34} />
    </button>
  )
}

function ReviewPanel({ finalReview, reviewing }) {
  if (finalReview) {
    return (
      <section className="review-panel">
        <h2>Game Review</h2>
        <div className="review-summary">
          <strong>{finalReview.result}</strong>
          <span>{finalReview.engine}</span>
          {finalReview.accuracy ? <span>{finalReview.accuracy}% accuracy estimate</span> : null}
        </div>
        {finalReview.moments.length ? (
          finalReview.moments.map((moment) => (
            <p key={`${moment.move}-${moment.san}-${moment.label}`}>
              <strong>{moment.label}</strong> {moment.move}. {moment.san}
              <span>{moment.note}</span>
            </p>
          ))
        ) : (
          <p>No major swings. That was a clean game.</p>
        )}
      </section>
    )
  }

  return (
    <section className="review-panel">
      <h2>Game Review</h2>
      {reviewing ? (
        <p>Stockfish 18 is reviewing the finished game.</p>
      ) : (
        <p>The game review appears after checkmate, resignation, or draw.</p>
      )}
    </section>
  )
}

function getGameState(game, thinking) {
  if (game.isCheckmate()) return 'Checkmate'
  if (game.isDraw()) return 'Draw'
  if (game.inCheck()) return 'Check'
  return thinking ? 'Mubassar calculating' : 'Your move'
}

function detectOpeningName(moves) {
  const clean = moves.map((move) => move.replace(/[+#?!]+/g, ''))
  const whiteMoves = clean.filter((_, index) => index % 2 === 0)
  const blackMoves = clean.filter((_, index) => index % 2 === 1)
  if (whiteMoves.includes('Nf3') && whiteMoves.includes('g3') && (whiteMoves.includes('Bg2') || whiteMoves.includes('O-O'))) {
    return "King's Indian Attack"
  }
  if (blackMoves.includes('d6') && blackMoves.includes('Nf6') && (blackMoves.includes('g6') || blackMoves.includes('Bg7'))) {
    return 'Pirc Defense'
  }
  if (blackMoves.includes('Nf6') && blackMoves.includes('g6') && (blackMoves.includes('Bg7') || blackMoves.includes('d6') || blackMoves.includes('O-O'))) {
    return "King's Indian Defense"
  }
  if (clean[0] === 'd4' && clean[1] === 'Nf6') return "Queen's Pawn Game"
  if (clean[0] === 'e4' && clean[1] === 'c6') return 'Caro-Kann Defense'
  if (clean[0] === 'd4' && clean[1] === 'd5') return "Queen's Pawn Game"
  return moves.length ? 'Moves' : ''
}

function cloneGame(source) {
  const cloned = new Chess()
  for (const san of source.history()) cloned.move(san)
  return cloned
}

function findCheckedKingSquare(game) {
  if (!game.inCheck() && !game.isCheckmate()) return null
  const turn = game.turn()
  const board = game.board()
  for (let rank = 0; rank < 8; rank += 1) {
    for (let file = 0; file < 8; file += 1) {
      const piece = board[rank][file]
      if (piece?.type === 'k' && piece.color === turn) {
        return `${'abcdefgh'[file]}${8 - rank}`
      }
    }
  }
  return null
}

function premoveTargets(game, square, playerTurn) {
  const piece = game.get(square)
  if (!piece || piece.color !== playerTurn) return []
  const files = 'abcdefgh'
  const fileIndex = files.indexOf(square[0])
  const rank = Number(square[1])
  const targets = []
  const add = (file, nextRank) => {
    if (file < 0 || file > 7 || nextRank < 1 || nextRank > 8) return false
    const target = `${files[file]}${nextRank}`
    const occupant = game.get(target)
    if (occupant?.color === playerTurn) return false
    targets.push(target)
    return !occupant
  }
  const ray = (df, dr) => {
    for (let step = 1; step < 8; step += 1) {
      if (!add(fileIndex + df * step, rank + dr * step)) break
    }
  }

  if (piece.type === 'p') {
    const direction = playerTurn === 'w' ? 1 : -1
    const startRank = playerTurn === 'w' ? 2 : 7
    const forwardRank = rank + direction
    const twoStepRank = rank + direction * 2
    const one = squareName(fileIndex, forwardRank)
    if (one && !game.get(one)) {
      targets.push(one)
      const two = squareName(fileIndex, twoStepRank)
      if (two && rank === startRank && !game.get(two)) targets.push(two)
    }
    for (const df of [-1, 1]) {
      const target = squareName(fileIndex + df, forwardRank)
      if (target) targets.push(target)
    }
  } else if (piece.type === 'n') {
    for (const [df, dr] of [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]]) {
      add(fileIndex + df, rank + dr)
    }
  } else if (piece.type === 'b' || piece.type === 'q') {
    for (const [df, dr] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) ray(df, dr)
  }
  if (piece.type === 'r' || piece.type === 'q') {
    for (const [df, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) ray(df, dr)
  }
  if (piece.type === 'k') {
    for (const [df, dr] of [[1, 1], [1, 0], [1, -1], [0, 1], [0, -1], [-1, 1], [-1, 0], [-1, -1]]) {
      add(fileIndex + df, rank + dr)
    }
  }
  return [...new Set(targets)]
}

function squareName(file, rank) {
  if (file < 0 || file > 7 || rank < 1 || rank > 8) return null
  return `${'abcdefgh'[file]}${rank}`
}

function arrowColor(event) {
  if (event.altKey) return '#1f8cff'
  if (event.shiftKey) return '#f2c94c'
  if (event.ctrlKey) return '#d85050'
  return '#79b64c'
}

function toggleArrow(current, nextArrow) {
  const existingIndex = current.findIndex((arrow) =>
    arrow.startSquare === nextArrow.startSquare &&
    arrow.endSquare === nextArrow.endSquare &&
    arrow.color === nextArrow.color,
  )
  if (existingIndex >= 0) return current.filter((_, index) => index !== existingIndex)
  return [...current, nextArrow]
}

function highlightStyle(color) {
  return { boxShadow: `inset 0 0 0 999px ${color}55` }
}

export default App

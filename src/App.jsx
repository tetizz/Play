import { useEffect, useMemo, useRef, useState } from 'react'
import { Chess } from 'chess.js'
import { Chessboard } from 'react-chessboard'
import {
  Bot,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  Flag,
  Lightbulb,
  Settings,
  Undo2,
  Zap,
} from 'lucide-react'
import { calculationProfile, chooseCoachMove, explainHumanMove } from './lib/coachEngine'
import { reviewGame, reviewGameWithStockfish } from './lib/reviewEngine'
import { createStockfishClient } from './lib/stockfishClient'
import './App.css'

const AVATAR = './assets/mubassar-avatar.png'
const START_FEN = new Chess().fen()

const timeControls = [
  { label: 'No Timer', minutes: 0, increment: 0, group: 'Casual' },
  { label: '1 min', minutes: 1, increment: 0, group: 'Bullet' },
  { label: '1 | 1', minutes: 1, increment: 1, group: 'Bullet' },
  { label: '2 | 1', minutes: 2, increment: 1, group: 'Bullet' },
  { label: '3 | 2', minutes: 3, increment: 2, group: 'Blitz' },
  { label: '5 min', minutes: 5, increment: 0, group: 'Blitz' },
  { label: '5 | 5', minutes: 5, increment: 5, group: 'Blitz' },
  { label: '10 min', minutes: 10, increment: 0, group: 'Rapid' },
  { label: '15 | 10', minutes: 15, increment: 10, group: 'Rapid' },
  { label: '30 min', minutes: 30, increment: 0, group: 'Rapid' },
]

function App() {
  const [phase, setPhase] = useState('setup')
  const [game, setGame] = useState(() => new Chess())
  const coachLevel = 2300
  const [timeControl, setTimeControl] = useState(timeControls[0])
  const [color, setColor] = useState('white')
  const [engineStatus, setEngineStatus] = useState('JS fallback ready')
  const [thinking, setThinking] = useState(false)
  const [selectedMove, setSelectedMove] = useState(null)
  const [lastBotMove, setLastBotMove] = useState(null)
  const [viewPly, setViewPly] = useState(0)
  const [finalReview, setFinalReview] = useState(null)
  const [reviewingGame, setReviewingGame] = useState(false)
  const stockfishRef = useRef(null)
  const [messages, setMessages] = useState([
    {
      speaker: 'Mubassar',
      text: 'Hey! I’m Mubassar. I’m a National Chess Master from NYC who is pursuing a FIDE title. Pick your settings and let’s play.',
    },
  ])

  const reviewMoments = useMemo(() => reviewGame(game.history()), [game])
  const moveHistory = game.history()
  const latestPly = moveHistory.length
  const activePly = Math.min(viewPly, latestPly)
  const isViewingLatest = activePly === latestPly
  const displayedFen = useMemo(() => {
    const replay = new Chess()
    for (const san of moveHistory.slice(0, activePly)) replay.move(san)
    return replay.fen()
  }, [moveHistory, activePly])
  const clockText = timeControl.minutes ? `${timeControl.minutes}:00` : 'No Timer'
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
      addCoachLine('Game over. Give me a second, I am checking the critical moments with Stockfish 18.')
      const review = await reviewGameWithStockfish(
        game.history(),
        stockfishRef.current?.evaluateFen,
      )
      if (!cancelled) {
        setFinalReview(review)
        addCoachLine(`${review.result}. Review complete${review.accuracy ? `: ${review.accuracy}% accuracy estimate` : ''}.`)
        setReviewingGame(false)
      }
    }
    runFinalReview()
    return () => {
      cancelled = true
    }
  }, [finalReview, game, phase, reviewingGame, thinking])

  const squareStyles = useMemo(() => {
    const styles = {}
    if (lastBotMove && isViewingLatest) {
      styles[lastBotMove.from] = highlightStyle('#e4c15c')
      styles[lastBotMove.to] = highlightStyle('#e4c15c')
    }
    if (selectedMove && isViewingLatest) {
      styles[selectedMove] = { boxShadow: 'inset 0 0 0 4px rgba(125, 190, 79, .95)' }
    }
    return styles
  }, [isViewingLatest, lastBotMove, selectedMove])

  const legalTargets = useMemo(() => {
    if (!selectedMove || !isViewingLatest) return new Set()
    return new Set(game.moves({ square: selectedMove, verbose: true }).map((move) => move.to))
  }, [game, isViewingLatest, selectedMove])

  function startGame() {
    const fresh = new Chess()
    setGame(fresh)
    setPhase('game')
    setSelectedMove(null)
    setLastBotMove(null)
    setViewPly(0)
    setFinalReview(null)
    setReviewingGame(false)
    setMessages([
      {
        speaker: 'Mubassar',
        text: 'Good luck! Try to keep up!',
      },
    ])
    if (color === 'black') playBotReply(fresh)
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
  }

  function addCoachLine(text) {
    setMessages((current) => [{ speaker: 'Mubassar', text }, ...current.slice(0, 4)])
  }

  function playBotReply(nextGame) {
    if (nextGame.isGameOver()) return
    setThinking(true)
    addCoachLine(thinkingLine(nextGame))
    window.setTimeout(() => playBotReplyAsync(nextGame), 2000)
  }

  async function playBotReplyAsync(nextGame) {
    let engineMove = null
    try {
      engineMove = await stockfishRef.current?.bestMove(
        nextGame.fen(),
        calculationProfile(coachLevel),
      )
    } catch {
      setEngineStatus('JS fallback ready')
    }

    const decision = chooseCoachMove(nextGame, coachLevel, engineMove)
    if (decision.move) {
      nextGame.move(decision.move)
      setLastBotMove({ from: decision.move.from, to: decision.move.to })
      updateBoard(nextGame)
      addCoachLine(decision.note)
    }
    setThinking(false)
  }

  function makeHumanMove(sourceSquare, targetSquare) {
    if (thinking || game.isGameOver() || !isViewingLatest) return false
    const playerTurn = color === 'white' ? 'w' : 'b'
    if (game.turn() !== playerTurn) return false

    const nextGame = cloneGame(game)
    const move = nextGame.move({ from: sourceSquare, to: targetSquare, promotion: 'q' })
    if (!move) return false

    setSelectedMove(null)
    setLastBotMove(null)
    updateBoard(nextGame)
    addCoachLine(explainHumanMove(nextGame, move))
    if (!nextGame.isGameOver()) playBotReply(nextGame)
    return true
  }

  function onSquareClick(args) {
    const square = typeof args === 'string' ? args : args.square
    if (selectedMove && selectedMove !== square && makeHumanMove(selectedMove, square)) return
    setSelectedMove((current) => (current === square ? null : square))
  }

  function undoPair() {
    const nextGame = cloneGame(game)
    nextGame.undo()
    nextGame.undo()
    updateBoard(nextGame)
    setLastBotMove(null)
    setFinalReview(null)
    setReviewingGame(false)
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

          <div className="setting-row top-choice">
            <Clock />
            <span>{timeControl.label}</span>
            <ChevronDown />
          </div>
          <button
            type="button"
            className={`wide-choice ${timeControl.minutes === 0 ? 'selected' : ''}`}
            onClick={() => setTimeControl(timeControls[0])}
          >
            No Timer
          </button>

          <TimeGrid selected={timeControl} onSelect={setTimeControl} />

          <div className="color-picker" aria-label="Choose color">
            {['white', 'random', 'black'].map((item) => (
              <button
                key={item}
                type="button"
                className={color === item ? 'selected' : ''}
                onClick={() => setColor(item === 'random' ? (Math.random() > 0.5 ? 'white' : 'black') : item)}
              >
                {item === 'white' ? '♔' : item === 'black' ? '♚' : '?'}
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
              allowDragging: !thinking && isViewingLatest,
              squareStyles,
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
        <div className="settings-gear">
          <Settings />
        </div>
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
          onBack={() => setViewPly((current) => Math.max(0, current - 1))}
          onForward={() => setViewPly((current) => Math.min(latestPly, current + 1))}
        />
        <div className="status-line">
          <span>{gameState}</span>
          <span>{engineStatus}</span>
          <strong>{clockText}</strong>
        </div>
        <div className="action-row">
          <ActionButton label="Resign" icon={Flag} onClick={resetGame} />
          <ActionButton label="Undo" icon={Undo2} onClick={undoPair} />
          <ActionButton label="Show Hint" icon={Lightbulb} onClick={() => addCoachLine('Look for checks, captures, and threats. Then compare the quiet improving move.')} />
        </div>
        <div className="mini-tools">
          <Download size={22} />
          <Settings size={22} />
        </div>
        <ReviewPanel moments={reviewMoments} finalReview={finalReview} reviewing={reviewingGame} />
      </aside>
    </main>
  )
}

function TimeGrid({ selected, onSelect }) {
  const groups = ['Bullet', 'Blitz', 'Rapid']
  return (
    <div className="time-grid">
      {groups.map((group) => (
        <div className="time-group" key={group}>
          <h2>
            {group === 'Bullet' ? <Zap /> : group === 'Blitz' ? <Zap /> : <Clock />}
            {group}
          </h2>
          <div className="time-buttons">
            {timeControls
              .filter((control) => control.group === group)
              .map((control) => (
                <button
                  type="button"
                  key={control.label}
                  className={selected.label === control.label ? 'selected' : ''}
                  onClick={() => onSelect(control)}
                >
                  {control.label}
                </button>
              ))}
          </div>
        </div>
      ))}
    </div>
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

function MoveHistory({ moves, viewPly, latestPly, onBack, onForward }) {
  const groupedMoves = []
  for (let index = 0; index < moves.length; index += 2) {
    groupedMoves.push({
      number: index / 2 + 1,
      white: moves[index],
      black: moves[index + 1],
    })
  }

  return (
    <section className="notation-panel" aria-label="Move history">
      <div className="notation-header">
        <span>Moves</span>
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
            <span key={move.number}>
              <strong>{move.number}.</strong> {move.white}
              {move.black ? ` ${move.black}` : ''}
            </span>
          ))
        ) : (
          <span className="notation-empty">Moves will appear here.</span>
        )}
      </div>
    </section>
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

function ReviewPanel({ moments, finalReview, reviewing }) {
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
      ) : moments.length ? (
        moments.map((moment) => (
          <p key={`${moment.move}-${moment.san}`}>
            <strong>{moment.label}</strong> {moment.move}. {moment.san}
          </p>
        ))
      ) : (
        <p>Play a few moves and the bot will flag tactical moments.</p>
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

function thinkingLine(game) {
  const moveNumber = Math.floor(game.history().length / 2) + 1
  const lines = [
    `Move ${moveNumber}. Let me calculate like a serious NM for a second.`,
    'Hold up. Checks, captures, threats, then the clean move.',
    'I am comparing the practical move with the engine move. No cheap shots.',
    'Two seconds. I am checking whether the tactic actually works.',
    'This is where patience wins games. Let me calculate.',
  ]
  return lines[game.history().length % lines.length]
}

function cloneGame(source) {
  const cloned = new Chess()
  for (const san of source.history()) cloned.move(san)
  return cloned
}

function highlightStyle(color) {
  return { boxShadow: `inset 0 0 0 999px ${color}55` }
}

export default App

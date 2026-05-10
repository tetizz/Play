import { useEffect, useMemo, useRef, useState } from 'react'
import { Chess } from 'chess.js'
import { Chessboard } from 'react-chessboard'
import {
  Brain,
  ExternalLink,
  Flag,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Undo2,
} from 'lucide-react'
import { calculationProfile, chooseCoachMove, explainHumanMove } from './lib/coachEngine'
import { reviewGame } from './lib/reviewEngine'
import { createStockfishClient } from './lib/stockfishClient'
import './App.css'

const botLinks = [
  {
    label: 'Chess.com keepitcoming',
    href: 'https://www.chess.com/member/keepitcoming',
  },
  {
    label: 'Lichess real64squares',
    href: 'https://lichess.org/@/real64squares',
  },
  {
    label: 'Lichess guardup',
    href: 'https://lichess.org/@/guardup',
  },
]

const difficulty = [
  { label: 'Training', value: 1400 },
  { label: 'NM 2300', value: 2300 },
  { label: 'No mercy', value: 2500 },
]

function App() {
  const [game, setGame] = useState(() => new Chess())
  const boardWrapRef = useRef(null)
  const [coachLevel, setCoachLevel] = useState(2300)
  const [engineStatus, setEngineStatus] = useState('JS fallback ready')
  const [thinking, setThinking] = useState(false)
  const [selectedMove, setSelectedMove] = useState(null)
  const stockfishRef = useRef(null)
  const [messages, setMessages] = useState([
    {
      speaker: 'Mubassar',
      text: 'Play your first move. I will answer like a practical NM: development, king safety, tactics first.',
    },
  ])

  const gameState = useMemo(() => {
    if (game.isCheckmate()) return 'Checkmate'
    if (game.isDraw()) return 'Draw'
    if (game.inCheck()) return 'Check'
    return game.turn() === 'w' ? 'White to move' : 'Mubassar thinking'
  }, [game])

  const reviewMoments = useMemo(() => reviewGame(game.history()), [game])

  useEffect(() => {
    stockfishRef.current = createStockfishClient()
    return stockfishRef.current.onStatus(setEngineStatus)
  }, [])

  const legalTargets = useMemo(() => {
    if (!selectedMove) return {}
    return game.moves({ square: selectedMove, verbose: true }).reduce((acc, move) => {
      acc[move.to] = {
        background:
          'radial-gradient(circle, rgba(250, 222, 138, .78) 0 22%, transparent 24%)',
      }
      return acc
    }, {})
  }, [game, selectedMove])

  function updateBoard(nextGame) {
    setGame(new Chess(nextGame.fen()))
  }

  function addCoachLine(line) {
    setMessages((current) => [
      { speaker: 'Mubassar', text: line },
      ...current.slice(0, 5),
    ])
  }

  function playBotReply(nextGame) {
    if (nextGame.isGameOver()) return
    setThinking(true)
    window.setTimeout(() => {
      playBotReplyAsync(nextGame)
    }, 220)
  }

  async function playBotReplyAsync(nextGame) {
    const profile = calculationProfile(coachLevel)
    let engineMove = null

    try {
      engineMove = await stockfishRef.current?.bestMove(nextGame.fen(), profile)
    } catch {
      setEngineStatus('JS fallback ready')
    }

    const decision = chooseCoachMove(nextGame, coachLevel, engineMove)
    if (decision.move) {
      nextGame.move(decision.move)
      updateBoard(nextGame)
      addCoachLine(decision.note)
    }
    setThinking(false)
  }

  function makeHumanMove(sourceSquare, targetSquare) {
    if (thinking || game.turn() !== 'w' || game.isGameOver()) return false

    const nextGame = new Chess(game.fen())
    const move = nextGame.move({
      from: sourceSquare,
      to: targetSquare,
      promotion: 'q',
    })

    if (!move) return false

    setSelectedMove(null)
    updateBoard(nextGame)
    addCoachLine(explainHumanMove(nextGame, move))
    playBotReply(nextGame)
    return true
  }

  function onPieceDrop({ sourceSquare, targetSquare }) {
    return makeHumanMove(sourceSquare, targetSquare)
  }

  function onSquareClick({ square }) {
    if (thinking || game.turn() !== 'w') return
    if (selectedMove && selectedMove !== square) {
      if (makeHumanMove(selectedMove, square)) return
    }
    setSelectedMove((current) => (current === square ? null : square))
  }

  function resetGame() {
    setGame(new Chess())
    setSelectedMove(null)
    setThinking(false)
    setMessages([
      {
        speaker: 'Mubassar',
        text: 'Fresh board. I will use the Mubassar repertoire first, then calculate like a practical 2300.',
      },
    ])
  }

  function undoPair() {
    const nextGame = new Chess(game.fen())
    nextGame.undo()
    nextGame.undo()
    updateBoard(nextGame)
    setSelectedMove(null)
    addCoachLine('We rolled back a full move. Now improve the plan, not just the square.')
  }

  return (
    <main className="app-shell">
      <section className="game-area" aria-label="Mubassar chess bot board">
        <PlayerStrip
          name="Mubassar"
          rating="2300"
          title="NM"
          country="Bangladesh"
          top
        />

        <div className="board-frame" ref={boardWrapRef}>
          <Chessboard
            options={{
              id: 'mubassar-board',
              position: game.fen(),
              onPieceDrop,
              onSquareClick,
              allowDragging: !thinking && game.turn() === 'w',
              squareStyles: legalTargets,
              boardStyle: {
                borderRadius: '6px',
                boxShadow: '0 24px 70px rgba(0, 0, 0, .52)',
              },
              darkSquareStyle: { backgroundColor: '#93633b' },
              lightSquareStyle: { backgroundColor: '#dfbd7a' },
            }}
          />
        </div>

        <PlayerStrip name="trixize1234" rating="800" country="United States" />
      </section>

      <aside className="coach-panel" aria-label="Mubassar bot controls">
        <div className="coach-card">
          <div className="avatar-wrap">
            <MubassarAvatar />
            <span className="status-light" />
          </div>

          <div className="coach-title">
            <div>
              <div className="identity-row">
                <span className="nm-badge">NM</span>
                <h1>Mubassar</h1>
              </div>
              <p>2300 National Master coach bot</p>
            </div>
            <BangladeshFlag />
          </div>

          <div className="state-grid">
            <Metric icon={ShieldCheck} label="Status" value={gameState} />
            <Metric icon={Brain} label="Style" value="Practical NM" />
            <Metric icon={Sparkles} label="Engine" value={engineStatus} />
          </div>

          <div className="difficulty-row" role="group" aria-label="Bot strength">
            {difficulty.map((item) => (
              <button
                className={coachLevel === item.value ? 'active' : ''}
                key={item.value}
                type="button"
                onClick={() => setCoachLevel(item.value)}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="controls">
            <button type="button" onClick={undoPair} disabled={game.history().length < 2}>
              <Undo2 size={17} />
              Undo
            </button>
            <button type="button" onClick={resetGame}>
              <RotateCcw size={17} />
              Reset
            </button>
          </div>
        </div>

        <section className="feedback-panel">
          <div className="panel-heading">
            <h2>Coach Notes</h2>
            <span>{thinking ? 'Calculating...' : 'Live'}</span>
          </div>
          <div className="message-list">
            {messages.map((message, index) => (
              <article className="message" key={`${message.text}-${index}`}>
                <strong>{message.speaker}</strong>
                <p>{message.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="review-panel">
          <div className="panel-heading">
            <h2>Game Review</h2>
            <span>{reviewMoments.length || '0'}</span>
          </div>
          {reviewMoments.length ? (
            reviewMoments.map((moment) => (
              <article className="review-row" key={`${moment.move}-${moment.san}`}>
                <strong>{moment.label}</strong>
                <span>
                  {moment.move}. {moment.san}
                </span>
                <p>{moment.note}</p>
              </article>
            ))
          ) : (
            <p className="empty-review">Play a few moves and the bot will flag tactical moments.</p>
          )}
        </section>

        <section className="links-panel">
          <div className="panel-heading">
            <h2>Profiles</h2>
            <Flag size={16} />
          </div>
          {botLinks.map((link) => (
            <a href={link.href} key={link.href} target="_blank" rel="noreferrer">
              {link.label}
              <ExternalLink size={15} />
            </a>
          ))}
        </section>
      </aside>
    </main>
  )
}

function PlayerStrip({ name, rating, title, country, top = false }) {
  return (
    <div className={`player-strip ${top ? 'top-player' : ''}`}>
      {top ? <MubassarAvatar compact /> : <div className="user-avatar" />}
      <div className="player-copy">
        <div>
          {title ? <span className="mini-title">{title}</span> : null}
          <strong>{name}</strong>
          <span>({rating})</span>
        </div>
        <small>{country}</small>
      </div>
      {country === 'Bangladesh' ? <BangladeshFlag small /> : <span className="us-flag">US</span>}
    </div>
  )
}

function Metric({ icon: Icon, label, value }) {
  return (
    <div className="metric">
      <Icon size={17} />
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function BangladeshFlag({ small = false }) {
  return (
    <span className={`bangladesh-flag ${small ? 'small' : ''}`} aria-label="Bangladesh flag">
      <span />
    </span>
  )
}

function MubassarAvatar({ compact = false }) {
  return (
    <div className={`mubassar-avatar ${compact ? 'compact' : ''}`} aria-hidden="true">
      <div className="hair hair-a" />
      <div className="hair hair-b" />
      <div className="face">
        <span className="eye left" />
        <span className="eye right" />
        <span className="brow left" />
        <span className="brow right" />
        <span className="nose" />
        <span className="beard" />
        <span className="mouth" />
      </div>
      <div className="kurta">
        <span />
      </div>
    </div>
  )
}

export default App

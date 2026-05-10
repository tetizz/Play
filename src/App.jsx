import { useEffect, useMemo, useRef, useState } from 'react'
import { Chess } from 'chess.js'
import { Chessboard } from 'react-chessboard'
import {
  Bot,
  ChevronDown,
  Clock,
  Download,
  ExternalLink,
  Flag,
  Lightbulb,
  Settings,
  Undo2,
  Zap,
} from 'lucide-react'
import { calculationProfile, chooseCoachMove, explainHumanMove } from './lib/coachEngine'
import { reviewGame } from './lib/reviewEngine'
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

const strengths = [
  { label: '1800', value: 1800 },
  { label: '2000', value: 2000 },
  { label: '2200', value: 2200 },
  { label: 'NM 2300', value: 2300 },
  { label: '2400', value: 2400 },
  { label: '2600', value: 2600 },
]

const botLinks = [
  ['Chess.com', 'keepitcoming', 'https://www.chess.com/member/keepitcoming'],
  ['Lichess', 'real64squares', 'https://lichess.org/@/real64squares'],
  ['Lichess', 'guardup', 'https://lichess.org/@/guardup'],
]

function App() {
  const [phase, setPhase] = useState('setup')
  const [game, setGame] = useState(() => new Chess())
  const [coachLevel, setCoachLevel] = useState(2300)
  const [timeControl, setTimeControl] = useState(timeControls[0])
  const [color, setColor] = useState('white')
  const [engineStatus, setEngineStatus] = useState('JS fallback ready')
  const [thinking, setThinking] = useState(false)
  const [selectedMove, setSelectedMove] = useState(null)
  const [lastBotMove, setLastBotMove] = useState(null)
  const stockfishRef = useRef(null)
  const [messages, setMessages] = useState([
    {
      speaker: 'Mubassar',
      text: 'Hey! I’m Mubassar. I’m a National Chess Master from NYC who is pursuing a FIDE title. Pick your settings and let’s play.',
    },
  ])

  const reviewMoments = useMemo(() => reviewGame(game.history()), [game])
  const clockText = timeControl.minutes ? `${timeControl.minutes}:00` : 'No Timer'
  const gameState = getGameState(game, thinking)

  useEffect(() => {
    stockfishRef.current = createStockfishClient()
    return stockfishRef.current.onStatus(setEngineStatus)
  }, [])

  const squareStyles = useMemo(() => {
    const styles = {}
    if (lastBotMove) {
      styles[lastBotMove.from] = highlightStyle('#e4c15c')
      styles[lastBotMove.to] = highlightStyle('#e4c15c')
    }
    if (selectedMove) {
      styles[selectedMove] = { boxShadow: 'inset 0 0 0 4px rgba(125, 190, 79, .95)' }
      for (const move of game.moves({ square: selectedMove, verbose: true })) {
        styles[move.to] = {
          background:
            'radial-gradient(circle, rgba(255,255,255,.88) 0 22%, transparent 24%)',
        }
      }
    }
    return styles
  }, [game, lastBotMove, selectedMove])

  function startGame() {
    const fresh = new Chess()
    setGame(fresh)
    setPhase('game')
    setSelectedMove(null)
    setLastBotMove(null)
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
    setMessages([
      {
        speaker: 'Mubassar',
        text: 'Hey! I’m Mubassar. I’m a National Chess Master from NYC who is pursuing a FIDE title. Pick your settings and let’s play.',
      },
    ])
  }

  function updateBoard(nextGame) {
    setGame(new Chess(nextGame.fen()))
  }

  function addCoachLine(text) {
    setMessages((current) => [{ speaker: 'Mubassar', text }, ...current.slice(0, 4)])
  }

  function playBotReply(nextGame) {
    if (nextGame.isGameOver()) return
    setThinking(true)
    window.setTimeout(() => playBotReplyAsync(nextGame), 180)
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
    if (thinking || game.isGameOver()) return false
    const playerTurn = color === 'white' ? 'w' : 'b'
    if (game.turn() !== playerTurn) return false

    const nextGame = new Chess(game.fen())
    const move = nextGame.move({ from: sourceSquare, to: targetSquare, promotion: 'q' })
    if (!move) return false

    setSelectedMove(null)
    setLastBotMove(null)
    updateBoard(nextGame)
    addCoachLine(explainHumanMove(nextGame, move))
    playBotReply(nextGame)
    return true
  }

  function onSquareClick({ square }) {
    if (selectedMove && selectedMove !== square && makeHumanMove(selectedMove, square)) return
    setSelectedMove((current) => (current === square ? null : square))
  }

  function undoPair() {
    const nextGame = new Chess(game.fen())
    nextGame.undo()
    nextGame.undo()
    updateBoard(nextGame)
    setLastBotMove(null)
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

          <div className="strength-settings">
            <h2>Coach Strength</h2>
            <div className="strength-grid">
              {strengths.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  className={coachLevel === item.value ? 'selected' : ''}
                  onClick={() => setCoachLevel(item.value)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

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
              position: game.fen(),
              boardOrientation: color,
              onPieceDrop: ({ sourceSquare, targetSquare }) =>
                makeHumanMove(sourceSquare, targetSquare),
              onSquareClick,
              allowDragging: !thinking,
              squareStyles,
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
        <div className="move-row">
          <span>Starting Position</span>
          <span>{game.history().join(' ') || ' '}</span>
        </div>
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
        <ProfileLinks />
        <ReviewPanel moments={reviewMoments} />
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
        <small>{country}</small>
      </div>
    </div>
  )
}

function Avatar({ className = '' }) {
  return <img className={`avatar ${className}`} src={AVATAR} alt="Mubassar avatar" />
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

function ProfileLinks() {
  return (
    <section className="profile-links">
      {botLinks.map(([site, username, href]) => (
        <a href={href} target="_blank" rel="noreferrer" key={href}>
          <span>{site}</span>
          <strong>{username}</strong>
          <ExternalLink size={16} />
        </a>
      ))}
    </section>
  )
}

function ReviewPanel({ moments }) {
  return (
    <section className="review-panel">
      <h2>Game Review</h2>
      {moments.length ? (
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

function highlightStyle(color) {
  return { boxShadow: `inset 0 0 0 999px ${color}55` }
}

export default App

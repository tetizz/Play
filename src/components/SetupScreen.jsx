import { useId, useRef } from 'react'
import { Bot, Home, Swords, UserRound } from 'lucide-react'
import { BOT_PROFILES } from '../data/botProfiles'
import { Avatar, CountryFlag } from './Identity'

const HOME_URL = 'https://tetizz.github.io/Home/'

const choices = [
  { id: 'white', image: './assets/white-king.png', label: 'White' },
  { id: 'random', image: null, label: 'Random' },
  { id: 'black', image: './assets/black-king.png', label: 'Black' },
]

const MARTIN_BOT_IDS = new Set([
  'iwc-smartin',
  'iwc-hungry-martin',
  'iwc-martinfish',
  'iwc-martinfish-2',
  'iwc-martinfish-3',
  'iwc-random-martinfish',
  'iwc-evil-martin',
])

const ROSTER_SECTIONS = [
  {
    id: 'coach',
    label: 'Coach Bots',
    bots: BOT_PROFILES.filter((bot) => !bot.capabilities?.videoVariant),
  },
  {
    id: 'stockfish',
    label: 'Stockfish Bots',
    bots: BOT_PROFILES.filter(
      (bot) => bot.capabilities?.videoVariant && !MARTIN_BOT_IDS.has(bot.id),
    ),
  },
  {
    id: 'martin',
    label: 'Martin Bots',
    bots: BOT_PROFILES.filter((bot) => MARTIN_BOT_IDS.has(bot.id)),
  },
]

export function SetupScreen({
  profile,
  gameMode,
  setGameMode,
  colorChoice,
  setColorChoice,
  whiteProfile,
  blackProfile,
  whiteBotId,
  blackBotId,
  selectBot,
  selectMatchBot,
  startGame,
  styleProfilesReady,
}) {
  const tabIdPrefix = useId()
  const modeTabsRef = useRef({})
  const playerTabId = `${tabIdPrefix}-player-tab`
  const botsTabId = `${tabIdPrefix}-bots-tab`
  const playerPanelId = `${tabIdPrefix}-player-panel`
  const botsPanelId = `${tabIdPrefix}-bots-panel`

  function selectGameMode(nextMode) {
    setGameMode(nextMode)
    modeTabsRef.current[nextMode]?.focus()
  }

  function handleModeTabKeyDown(event) {
    const modeOrder = ['player', 'bots']
    const currentIndex = modeOrder.indexOf(gameMode)
    let nextMode = null

    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      nextMode = modeOrder[(currentIndex + 1) % modeOrder.length]
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      nextMode = modeOrder[(currentIndex - 1 + modeOrder.length) % modeOrder.length]
    } else if (event.key === 'Home') {
      nextMode = modeOrder[0]
    } else if (event.key === 'End') {
      nextMode = modeOrder[modeOrder.length - 1]
    }

    if (!nextMode) return
    event.preventDefault()
    selectGameMode(nextMode)
  }

  return (
    <main className="setup-page">
      <header className="setup-header">
        <div className="app-brand"><Bot /> <span>Play Bots</span></div>
        <div className="setup-header-actions">
          <a className="home-nav-button" href={HOME_URL} aria-label="Open tetizz chess projects home">
            <Home />
            <span>Home</span>
          </a>
        </div>
      </header>
      <div className="play-mode-choice" role="tablist" aria-label="Game mode">
        <button
          type="button"
          role="tab"
          id={playerTabId}
          aria-controls={playerPanelId}
          aria-selected={gameMode === 'player'}
          tabIndex={gameMode === 'player' ? 0 : -1}
          ref={(element) => {
            modeTabsRef.current.player = element
          }}
          className={gameMode === 'player' ? 'selected' : ''}
          onClick={() => setGameMode('player')}
          onKeyDown={handleModeTabKeyDown}
        >
          <UserRound /> Play a bot
        </button>
        <button
          type="button"
          role="tab"
          id={botsTabId}
          aria-controls={botsPanelId}
          aria-selected={gameMode === 'bots'}
          tabIndex={gameMode === 'bots' ? 0 : -1}
          ref={(element) => {
            modeTabsRef.current.bots = element
          }}
          className={gameMode === 'bots' ? 'selected' : ''}
          onClick={() => setGameMode('bots')}
          onKeyDown={handleModeTabKeyDown}
        >
          <Swords /> Bot vs Bot
        </button>
      </div>

      <section
        className="setup-player-panel"
        role="tabpanel"
        id={playerPanelId}
        aria-labelledby={playerTabId}
        tabIndex={0}
        hidden={gameMode !== 'player'}
      >
        <BotRoster selectedId={profile.id} onSelect={selectBot} />
        <section className="setup-focus">
          <BotPortrait profile={profile} />
          <div className="setup-actions">
            <div className="color-choice" aria-label="Choose your color">
              {choices.map((choice) => (
                <button
                  type="button"
                  key={choice.id}
                  aria-pressed={colorChoice === choice.id}
                  className={colorChoice === choice.id ? 'selected' : ''}
                  onClick={() => setColorChoice(choice.id)}
                >
                  {choice.image
                    ? <img src={choice.image} alt="" />
                    : <span className="random-choice" aria-hidden="true">?</span>}
                  <strong>{choice.label}</strong>
                </button>
              ))}
            </div>
            <button
              type="button"
              className="primary-play"
              onClick={startGame}
              disabled={!styleProfilesReady}
            >
              Play
            </button>
          </div>
        </section>
      </section>
      <section
        className="bot-match-setup"
        role="tabpanel"
        id={botsPanelId}
        aria-labelledby={botsTabId}
        tabIndex={0}
        hidden={gameMode !== 'bots'}
      >
        <div className="matchup-heading">
          <Swords />
          <div>
            <h1>Bot vs Bot</h1>
            <p>Choose the White and Black players.</p>
          </div>
        </div>
        <div className="matchup-seats">
          <BotSeat
            color="White"
            profile={whiteProfile}
            value={whiteBotId}
            onChange={(id) => selectMatchBot('white', id)}
          />
          <span className="versus-mark">VS</span>
          <BotSeat
            color="Black"
            profile={blackProfile}
            value={blackBotId}
            onChange={(id) => selectMatchBot('black', id)}
          />
        </div>
        <button
          type="button"
          className="primary-play"
          onClick={startGame}
          disabled={!styleProfilesReady}
        >
          Start match
        </button>
      </section>
    </main>
  )
}

function BotRoster({ selectedId, onSelect }) {
  return (
    <section className="bot-roster" aria-labelledby="bot-roster-heading">
      <h1 id="bot-roster-heading" className="visually-hidden">Choose a bot</h1>
      {ROSTER_SECTIONS.map((section) => (
        <section
          className="bot-roster-section"
          aria-labelledby={`bot-roster-${section.id}`}
          key={section.id}
        >
          <h2 id={`bot-roster-${section.id}`}>{section.label}</h2>
          <div className="bot-roster-grid">
            {section.bots.map((bot) => (
              <button
                type="button"
                key={bot.id}
                aria-pressed={bot.id === selectedId}
                className={bot.id === selectedId ? 'selected' : ''}
                onClick={() => onSelect(bot.id)}
              >
                <Avatar profile={bot} size="small" />
                <span>
                  <strong>{bot.fullName}</strong>
                  <small>
                    {bot.videoLabel ||
                      `${bot.title ? `${bot.title} ` : ''}${ratingLabel(bot.displayRating)}`}
                  </small>
                </span>
                <CountryFlag code={bot.countryCode} label={bot.country} />
              </button>
            ))}
          </div>
        </section>
      ))}
    </section>
  )
}

function BotPortrait({ profile }) {
  return (
    <div className="setup-portrait">
      <Avatar profile={profile} size="large" />
      <div>
        <div className="setup-name-line">
          {profile.title ? <span className="title-badge">{profile.title}</span> : null}
          <h1>{profile.fullName}</h1>
          {Number.isFinite(profile.displayRating)
            ? <span>{ratingLabel(profile.displayRating)}</span>
            : null}
          <CountryFlag code={profile.countryCode} label={profile.country} />
        </div>
        <p>{profile.intro}</p>
      </div>
    </div>
  )
}

function BotSeat({ color, profile, value, onChange }) {
  return (
    <article className="bot-seat">
      <span className={`seat-color ${color.toLowerCase()}`}>{color}</span>
      <Avatar profile={profile} size="large" />
      <div className="setup-name-line">
        {profile.title ? <span className="title-badge">{profile.title}</span> : null}
        <h2>{profile.fullName}</h2>
        {Number.isFinite(profile.displayRating)
          ? <span>{ratingLabel(profile.displayRating)}</span>
          : null}
        <CountryFlag code={profile.countryCode} label={profile.country} />
      </div>
      <p>{profile.intro}</p>
      <label>
        <span>Choose {color}</span>
        <select
          aria-label={`${color} bot`}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        >
          {BOT_PROFILES.map((bot) => (
            <option key={bot.id} value={bot.id}>
              {bot.fullName}{Number.isFinite(bot.displayRating) ? ` ${ratingLabel(bot.displayRating)}` : ''}
            </option>
          ))}
        </select>
      </label>
    </article>
  )
}

function ratingLabel(rating) {
  return Number.isFinite(rating) ? `(${rating})` : ''
}

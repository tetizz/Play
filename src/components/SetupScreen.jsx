import { useId, useRef, useState } from 'react'
import { Bot, ChevronDown, Home, Swords, UserRound } from 'lucide-react'
import { BOT_PROFILES } from '../data/botProfiles'
import { Avatar, CountryFlag } from './Identity'

const HOME_URL = 'https://tetizz.github.io/Home/'

const choices = [
  { id: 'white', image: './assets/white-king.png', label: 'White' },
  { id: 'random', image: null, label: 'Random' },
  { id: 'black', image: './assets/black-king.png', label: 'Black' },
]

const ROSTER_SECTION_DEFINITIONS = [
  {
    id: 'coach',
    label: 'Player Bots',
  },
  {
    id: 'stockfish',
    label: 'Stockfish Variants',
  },
  {
    id: 'martin',
    label: 'Martin Variants',
  },
]

const ROSTER_SECTIONS = ROSTER_SECTION_DEFINITIONS.map((section) => ({
  ...section,
  bots: BOT_PROFILES.filter((bot) => bot.category === section.id),
}))

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
  const rosterIdPrefix = useId()
  const selectedSectionId = ROSTER_SECTIONS.find((section) => (
    section.bots.some((bot) => bot.id === selectedId)
  ))?.id ?? ROSTER_SECTIONS[0]?.id
  const [expandedSectionId, setExpandedSectionId] = useState(selectedSectionId)

  return (
    <section className="bot-roster" aria-labelledby="bot-roster-heading">
      <h1 id="bot-roster-heading" className="visually-hidden">Choose a bot</h1>
      <p className="visually-hidden" aria-live="polite">
        {BOT_PROFILES.find((bot) => bot.id === selectedId)?.fullName} selected
      </p>
      {ROSTER_SECTIONS.map((section) => {
        const isExpanded = expandedSectionId === section.id
        const triggerId = `${rosterIdPrefix}-${section.id}-trigger`
        const panelId = `${rosterIdPrefix}-${section.id}-panel`
        const representative = section.bots[0]

        return (
          <section
            className={`bot-family bot-family-${section.id} ${isExpanded ? 'expanded' : ''}`}
            key={section.id}
          >
            <h2 className="bot-family-heading">
              <button
                type="button"
                id={triggerId}
                className="bot-family-trigger"
                aria-expanded={isExpanded}
                aria-controls={panelId}
                aria-label={section.label}
                onClick={() => {
                  setExpandedSectionId((current) => (
                    current === section.id ? null : section.id
                  ))
                }}
              >
                <span className="bot-family-avatar" aria-hidden="true">
                  <Avatar profile={representative} size="small" />
                </span>
                <span className="bot-family-title">{section.label}</span>
                <span className="bot-family-count" aria-hidden="true">
                  {section.bots.length} {section.bots.length === 1 ? 'bot' : 'bots'}
                </span>
                <ChevronDown className="bot-family-chevron" aria-hidden="true" />
              </button>
            </h2>
            <div
              id={panelId}
              className="bot-family-panel"
              role="region"
              aria-labelledby={triggerId}
              hidden={!isExpanded}
            >
              <ul className="bot-family-gallery">
                {section.bots.map((bot) => (
                  <li key={bot.id}>
                    <button
                      type="button"
                      aria-label={`${bot.fullName} ${profileRosterLabel(bot)}`}
                      aria-pressed={bot.id === selectedId}
                      className={`bot-family-option ${bot.id === selectedId ? 'selected' : ''}`}
                      onClick={() => onSelect(bot.id)}
                    >
                      <span className="bot-family-option-avatar" aria-hidden="true">
                        <Avatar profile={bot} size="small" />
                      </span>
                      <strong>{bot.fullName}</strong>
                      <small>{profileRosterLabel(bot)}</small>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )
      })}
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
            : <span>{profileRuleLabel(profile)}</span>}
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
          : <span>{profileRuleLabel(profile)}</span>}
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
          {ROSTER_SECTIONS.map((section) => (
            <optgroup key={section.id} label={section.label}>
              {section.bots.map((bot) => (
                <option key={bot.id} value={bot.id}>
                  {bot.fullName} {profileSelectionLabel(bot)}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </label>
    </article>
  )
}

function ratingLabel(rating) {
  return Number.isFinite(rating) ? `(${rating})` : ''
}

function profileRuleLabel(profile) {
  return profile.videoLabel || profile.intro || 'Variable strength'
}

function profileRosterLabel(profile) {
  if (profile.capabilities?.videoVariant) return profileRuleLabel(profile)
  return `${profile.title ? `${profile.title} ` : ''}${ratingLabel(profile.displayRating)}`
}

function profileSelectionLabel(profile) {
  return Number.isFinite(profile.displayRating)
    ? ratingLabel(profile.displayRating)
    : `- ${profileRuleLabel(profile)}`
}

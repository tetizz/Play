import { useEffect, useId, useRef, useState } from 'react'
import {
  Bot,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Home,
  LoaderCircle,
  Search,
  Star,
  Swords,
  UserRound,
  X,
} from 'lucide-react'
import { BOT_PROFILES } from '../data/botProfiles'
import { Avatar, CountryFlag } from './Identity'

const HOME_URL = 'https://tetizz.github.io/Home/'
const ROSTER_PREFERENCES_KEY = 'play-bots-roster-v1'
const MAX_RECENT_BOTS = 6

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
  const [rosterPreferences, setRosterPreferences] = useState(readRosterPreferences)
  const playerTabId = `${tabIdPrefix}-player-tab`
  const botsTabId = `${tabIdPrefix}-bots-tab`
  const playerPanelId = `${tabIdPrefix}-player-panel`
  const botsPanelId = `${tabIdPrefix}-bots-panel`

  useEffect(() => {
    writeRosterPreferences(rosterPreferences)
  }, [rosterPreferences])

  function rememberBot(botId) {
    setRosterPreferences((current) => ({
      ...current,
      recent: [botId, ...current.recent.filter((id) => id !== botId)].slice(0, MAX_RECENT_BOTS),
    }))
  }

  function handleBotSelect(botId) {
    rememberBot(botId)
    selectBot(botId)
  }

  function handleMatchBotSelect(side, botId) {
    rememberBot(botId)
    selectMatchBot(side, botId)
  }

  function toggleFavorite(botId) {
    setRosterPreferences((current) => ({
      ...current,
      favorites: current.favorites.includes(botId)
        ? current.favorites.filter((id) => id !== botId)
        : [...current.favorites, botId],
    }))
  }

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
        <div className="brand-lockup">
          <div className="app-brand"><Bot /> <span>Play Bots</span></div>
          <p>Pick a personality. Set the board. Play real chess.</p>
        </div>
        <div className="setup-header-actions">
          <span className="roster-total"><strong>{BOT_PROFILES.length}</strong> opponents</span>
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
        aria-busy={!styleProfilesReady}
        hidden={gameMode !== 'player'}
      >
        <BotRoster
          selectedId={profile.id}
          onSelect={handleBotSelect}
          preferences={rosterPreferences}
        />
        <section className="setup-focus">
          <BotPortrait
            profile={profile}
            favorite={rosterPreferences.favorites.includes(profile.id)}
            onToggleFavorite={() => toggleFavorite(profile.id)}
          />
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
            <ProfileReadiness ready={styleProfilesReady} profiles={[profile]} id="player-profile-readiness" />
            <button
              type="button"
              className="primary-play"
              onClick={startGame}
              disabled={!styleProfilesReady}
              aria-describedby="player-profile-readiness"
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
        aria-busy={!styleProfilesReady}
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
            onChange={(id) => handleMatchBotSelect('white', id)}
          />
          <span className="versus-mark">VS</span>
          <BotSeat
            color="Black"
            profile={blackProfile}
            value={blackBotId}
            onChange={(id) => handleMatchBotSelect('black', id)}
          />
        </div>
        <ProfileReadiness
          ready={styleProfilesReady}
          profiles={[whiteProfile, blackProfile]}
          id="match-profile-readiness"
        />
        <button
          type="button"
          className="primary-play"
          onClick={startGame}
          disabled={!styleProfilesReady}
          aria-describedby="match-profile-readiness"
        >
          Start match
        </button>
      </section>
    </main>
  )
}

function BotRoster({ selectedId, onSelect, preferences }) {
  const rosterIdPrefix = useId()
  const searchId = `${rosterIdPrefix}-search`
  const selectedSectionId = ROSTER_SECTIONS.find((section) => (
    section.bots.some((bot) => bot.id === selectedId)
  ))?.id ?? ROSTER_SECTIONS[0]?.id
  const [expandedSectionId, setExpandedSectionId] = useState(selectedSectionId)
  const [collapsedFilterSections, setCollapsedFilterSections] = useState([])
  const [query, setQuery] = useState('')
  const [view, setView] = useState('all')
  const normalizedQuery = query.trim().toLocaleLowerCase()
  const activeIds = view === 'favorites'
    ? preferences.favorites
    : view === 'recent'
      ? preferences.recent
      : null
  const visibleSections = ROSTER_SECTIONS.map((section) => ({
    ...section,
    bots: section.bots.filter((bot) => {
      if (activeIds && !activeIds.includes(bot.id)) return false
      if (!normalizedQuery) return true
      return [
        bot.fullName,
        bot.name,
        bot.goal,
        bot.intro,
        section.label,
        profileRosterLabel(bot),
      ].filter(Boolean).join(' ').toLocaleLowerCase().includes(normalizedQuery)
    }),
  })).filter((section) => section.bots.length)
  const filterActive = Boolean(normalizedQuery || view !== 'all')
  const visibleBotCount = visibleSections.reduce((total, section) => total + section.bots.length, 0)

  return (
    <section className="bot-roster" aria-labelledby="bot-roster-heading">
      <h1 id="bot-roster-heading" className="visually-hidden">Choose a bot</h1>
      <p className="visually-hidden" aria-live="polite">
        {BOT_PROFILES.find((bot) => bot.id === selectedId)?.fullName} selected
      </p>
      <div className="roster-tools">
        <label className="roster-search" htmlFor={searchId}>
          <Search aria-hidden="true" />
          <span className="visually-hidden">Search opponents</span>
          <input
            id={searchId}
            type="search"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value)
              setCollapsedFilterSections([])
            }}
            placeholder={`Search ${BOT_PROFILES.length} opponents`}
            autoComplete="off"
          />
          {query ? (
            <button
              type="button"
              onClick={() => {
                setQuery('')
                setCollapsedFilterSections([])
              }}
              aria-label="Clear opponent search"
            >
              <X aria-hidden="true" />
            </button>
          ) : null}
        </label>
        <div className="roster-views" role="group" aria-label="Filter opponents">
          <button type="button" aria-pressed={view === 'all'} onClick={() => { setView('all'); setCollapsedFilterSections([]) }}>
            All <span>{BOT_PROFILES.length}</span>
          </button>
          <button
            type="button"
            aria-pressed={view === 'favorites'}
            onClick={() => { setView('favorites'); setCollapsedFilterSections([]) }}
          >
            <Star aria-hidden="true" /> Favorites <span>{preferences.favorites.length}</span>
          </button>
          <button type="button" aria-pressed={view === 'recent'} onClick={() => { setView('recent'); setCollapsedFilterSections([]) }}>
            <Clock3 aria-hidden="true" /> Recent <span>{preferences.recent.length}</span>
          </button>
        </div>
        <p className="roster-result-count" aria-live="polite">
          {filterActive
            ? `${visibleBotCount} ${visibleBotCount === 1 ? 'opponent' : 'opponents'} shown`
            : 'Choose a family, then an opponent.'}
        </p>
      </div>
      {visibleSections.map((section) => {
        const isExpanded = filterActive
          ? !collapsedFilterSections.includes(section.id)
          : expandedSectionId === section.id
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
                  if (filterActive) {
                    setCollapsedFilterSections((current) => (
                      current.includes(section.id)
                        ? current.filter((id) => id !== section.id)
                        : [...current, section.id]
                    ))
                  } else {
                    setExpandedSectionId((current) => (
                      current === section.id ? null : section.id
                    ))
                  }
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
                      onClick={() => {
                        setExpandedSectionId(bot.category)
                        onSelect(bot.id)
                      }}
                    >
                      <span className="bot-family-option-avatar" aria-hidden="true">
                        <Avatar profile={bot} size="small" />
                      </span>
                      <strong>{bot.fullName}</strong>
                      <small>{profileRosterLabel(bot)}</small>
                      {preferences.favorites.includes(bot.id)
                        ? <Star className="favorite-marker" aria-hidden="true" />
                        : null}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )
      })}
      {!visibleBotCount ? (
        <div className="roster-empty" role="status">
          <Search aria-hidden="true" />
          <strong>No opponents found</strong>
          <p>{view === 'favorites' ? 'Favorite a bot from its profile to keep it here.' : 'Try another name, rating, or family.'}</p>
          <button type="button" onClick={() => { setQuery(''); setView('all'); setCollapsedFilterSections([]) }}>Show every bot</button>
        </div>
      ) : null}
    </section>
  )
}

function BotPortrait({ profile, favorite, onToggleFavorite }) {
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
        {profile.intro ? <p>{profile.intro}</p> : null}
        <button
          type="button"
          className="favorite-bot"
          aria-pressed={favorite}
          onClick={onToggleFavorite}
        >
          <Star aria-hidden="true" /> {favorite ? 'Favorited' : 'Favorite bot'}
        </button>
      </div>
    </div>
  )
}

function ProfileReadiness({ ready, profiles, id }) {
  const names = profiles.map((profile) => profile.name).join(' and ')
  return (
    <div
      id={id}
      className={`profile-readiness ${ready ? 'ready' : 'loading'}`}
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      {ready
        ? <CheckCircle2 aria-hidden="true" />
        : <LoaderCircle className="readiness-spinner" aria-hidden="true" />}
      <span>
        <strong>{ready ? 'Ready to play' : 'Preparing opponent'}</strong>
        <small>
          {ready
            ? `${profiles.length > 1 ? 'Profiles' : 'Profile'} loaded for ${names}.`
            : `Loading ${names}'s style and opening book.`}
        </small>
      </span>
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
      {profile.intro ? <p>{profile.intro}</p> : null}
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

function readRosterPreferences() {
  if (typeof localStorage === 'undefined') return { favorites: [], recent: [] }
  try {
    const stored = JSON.parse(localStorage.getItem(ROSTER_PREFERENCES_KEY) || '{}')
    const available = new Set(BOT_PROFILES.map((profile) => profile.id))
    return {
      favorites: uniqueKnownIds(stored.favorites, available),
      recent: uniqueKnownIds(stored.recent, available).slice(0, MAX_RECENT_BOTS),
    }
  } catch {
    return { favorites: [], recent: [] }
  }
}

function writeRosterPreferences(preferences) {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(ROSTER_PREFERENCES_KEY, JSON.stringify(preferences))
  } catch {
    // The roster still works when storage is unavailable or full.
  }
}

function uniqueKnownIds(value, available) {
  if (!Array.isArray(value)) return []
  return [...new Set(value.filter((id) => typeof id === 'string' && available.has(id)))]
}

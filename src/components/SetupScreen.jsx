import { Bot, Home, Swords, UserRound } from 'lucide-react'
import { BOT_PROFILES } from '../data/botProfiles'
import { Avatar, CountryFlag } from './Identity'

const HOME_URL = 'https://tetizz.github.io/Home/'

const choices = [
  { id: 'white', image: './assets/white-king.png', label: 'White' },
  { id: 'random', image: null, label: 'Random' },
  { id: 'black', image: './assets/black-king.png', label: 'Black' },
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
  return (
    <main className="setup-page">
      <header className="setup-header">
        <div className="app-brand"><Bot /> <span>Play Bots</span></div>
        <div className="setup-header-actions">
          <a className="home-nav-button" href={HOME_URL} role="button">
            <Home />
            <span>Home</span>
          </a>
        </div>
      </header>
      <div className="play-mode-choice" role="tablist" aria-label="Game mode">
        <button
          type="button"
          role="tab"
          aria-selected={gameMode === 'player'}
          className={gameMode === 'player' ? 'selected' : ''}
          onClick={() => setGameMode('player')}
        >
          <UserRound /> Play a bot
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={gameMode === 'bots'}
          className={gameMode === 'bots' ? 'selected' : ''}
          onClick={() => setGameMode('bots')}
        >
          <Swords /> Bot vs Bot
        </button>
      </div>

      {gameMode === 'player' ? (
        <>
          <BotRoster selectedId={profile.id} onSelect={selectBot} />
          <section className="setup-focus">
            <BotPortrait profile={profile} />
            <div className="color-choice" aria-label="Choose your color">
              {choices.map((choice) => (
                <button
                  type="button"
                  key={choice.id}
                  className={colorChoice === choice.id ? 'selected' : ''}
                  onClick={() => setColorChoice(choice.id)}
                >
                  {choice.image
                    ? <img src={choice.image} alt="" />
                    : <span className="random-choice">?</span>}
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
          </section>
        </>
      ) : (
        <section className="bot-match-setup">
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
      )}
    </main>
  )
}

function BotRoster({ selectedId, onSelect }) {
  return (
    <section className="bot-roster" aria-label="Choose a bot">
      {BOT_PROFILES.map((bot) => (
        <button
          type="button"
          key={bot.id}
          className={bot.id === selectedId ? 'selected' : ''}
          onClick={() => onSelect(bot.id)}
        >
          <Avatar profile={bot} size="small" />
          <span>
            <strong>{bot.fullName}</strong>
            <small>{`${bot.title ? `${bot.title} ` : ''}(${bot.displayRating})`}</small>
          </span>
          <CountryFlag code={bot.countryCode} label={bot.country} />
        </button>
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
          <span>({profile.displayRating})</span>
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
        <span>({profile.displayRating})</span>
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
              {bot.fullName} ({bot.displayRating})
            </option>
          ))}
        </select>
      </label>
    </article>
  )
}

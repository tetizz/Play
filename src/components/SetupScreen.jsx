import { Bot } from 'lucide-react'
import { BOT_PROFILES } from '../data/botProfiles'
import { Avatar, CountryFlag } from './Identity'

const choices = [
  { id: 'white', image: './assets/white-king.png', label: 'White' },
  { id: 'random', image: null, label: 'Random' },
  { id: 'black', image: './assets/black-king.png', label: 'Black' },
]

export function SetupScreen({ profile, colorChoice, setColorChoice, selectBot, startGame }) {
  return (
    <main className="setup-page">
      <header className="app-brand"><Bot /> <span>Play Bots</span></header>
      <section className="bot-roster" aria-label="Choose a bot">
        {BOT_PROFILES.map((bot) => (
          <button key={bot.id} className={bot.id === profile.id ? 'selected' : ''} onClick={() => selectBot(bot.id)}>
            <Avatar profile={bot} size="small" />
            <span><strong>{bot.fullName}</strong><small>{`${bot.title ? `${bot.title} ` : ''}(${bot.displayRating})`}</small></span>
            <CountryFlag code={bot.countryCode} label={bot.country} />
          </button>
        ))}
      </section>
      <section className="setup-focus">
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
        <div className="color-choice" aria-label="Choose your color">
          {choices.map((choice) => (
            <button key={choice.id} className={colorChoice === choice.id ? 'selected' : ''} onClick={() => setColorChoice(choice.id)}>
              {choice.image ? <img src={choice.image} alt="" /> : <span className="random-choice">?</span>}
              <strong>{choice.label}</strong>
            </button>
          ))}
        </div>
        <button type="button" className="primary-play" onClick={startGame}>Play</button>
      </section>
    </main>
  )
}

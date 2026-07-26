export function Avatar({ profile, size = 'medium' }) {
  const avatar = profile.avatar
  if (avatar.type === 'placeholder') {
    return <div className={`avatar avatar-${size} avatar-placeholder`}>{avatar.text}</div>
  }
  return (
    <div className={`avatar avatar-${size}${avatar.transparent ? ' avatar-transparent' : ''}`}>
      <img
        src={avatar.src}
        alt={avatar.alt}
        style={{
          objectPosition: avatar.objectPosition,
          transform: `scale(${avatar.scale || 1})`,
        }}
      />
    </div>
  )
}

export function CountryFlag({ code, label }) {
  if (!code) return null
  return <img className="country-flag" src={`./assets/flags/${code}.svg`} alt={label || code} />
}

export function PlayerStrip({ profile, player, side = 'top', ratingState = null }) {
  if (player) {
    return (
      <div className={`player-strip ${side}`}>
        <div className="player-silhouette" aria-hidden="true" />
        <div className="player-name"><strong>player</strong> <span>(100)</span></div>
        <CountryFlag code="us" label="United States" />
      </div>
    )
  }
  const rating = ratingState?.rating ?? profile.displayRating
  return (
    <div className={`player-strip ${side}`}>
      <Avatar profile={profile} size="small" />
      {profile.title ? <span className="title-badge">{profile.title}</span> : null}
      <div className="player-name">
        <strong>{profile.name}</strong>
        <EloRating rating={rating} event={ratingState?.event} />
      </div>
      <CountryFlag code={profile.countryCode} label={profile.country} />
    </div>
  )
}

function EloRating({ rating, event = null }) {
  if (!Number.isFinite(rating)) return null
  return (
    <span className="elo-rating-wrap">
      <span className="elo-rating">{`(${rating})`}</span>
      {event ? (
        <span
          className={`elo-delta ${event.delta > 0 ? 'gain' : 'loss'}`}
          key={event.id}
          aria-label={`${event.delta > 0 ? 'Gained' : 'Lost'} ${Math.abs(event.delta)} Elo`}
        >
          {event.delta > 0 ? '+' : ''}{event.delta}
        </span>
      ) : null}
    </span>
  )
}

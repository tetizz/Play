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

export function PlayerStrip({
  profile,
  player,
  side = 'top',
  ratingState = null,
  material = null,
}) {
  if (player) {
    return (
      <div className={`player-strip ${side}`}>
        <div className="player-silhouette" aria-hidden="true" />
        <div className="player-details">
          <div className="player-name"><strong>player</strong> <span>(100)</span></div>
          <CapturedMaterial material={material} />
        </div>
        <CountryFlag code="us" label="United States" />
      </div>
    )
  }
  const rating = ratingState?.rating ?? profile.displayRating
  return (
    <div className={`player-strip ${side}`}>
      <Avatar profile={profile} size="small" />
      {profile.title ? <span className="title-badge">{profile.title}</span> : null}
      <div className="player-details">
        <div className="player-name">
          <strong>{profile.name}</strong>
          <EloRating rating={rating} event={ratingState?.event} />
        </div>
        <CapturedMaterial material={material} />
      </div>
      <CountryFlag code={profile.countryCode} label={profile.country} />
    </div>
  )
}

function CapturedMaterial({ material }) {
  if (!material || (!material.captures.length && !material.advantage)) return null
  const captureNames = {
    p: 'pawn',
    b: 'bishop',
    n: 'knight',
    r: 'rook',
    q: 'queen',
  }
  const capturedColor = material.color === 'white' ? 'w' : 'b'
  const summary = [
    material.captures.length
      ? `Captured ${material.captures.map((piece) => captureNames[piece]).join(', ')}`
      : null,
    material.advantage ? `up ${material.advantage} points` : null,
  ].filter(Boolean).join('; ')

  return (
    <div className="captured-material" aria-label={summary}>
      {material.captures.length ? (
        <span className="captured-pieces" aria-hidden="true">
          {material.captures.map((piece, index) => (
            <img
              src={`./assets/pieces/kaneo/${capturedColor}${piece.toUpperCase()}.svg`}
              alt=""
              key={`${piece}-${index}`}
            />
          ))}
        </span>
      ) : null}
      {material.advantage ? (
        <span className="material-advantage">+{material.advantage}</span>
      ) : null}
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

export function Avatar({ profile, size = 'medium' }) {
  const avatar = profile.avatar
  if (avatar.type === 'placeholder') {
    return <div className={`avatar avatar-${size} avatar-placeholder`}>{avatar.text}</div>
  }
  return (
    <div className={`avatar avatar-${size}`}>
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
  return <img className="country-flag" src={`./assets/flags/${code}.svg`} alt={label || code} />
}

export function PlayerStrip({ profile, player, side = 'top' }) {
  if (player) {
    return (
      <div className={`player-strip ${side}`}>
        <div className="player-silhouette" aria-hidden="true" />
        <div className="player-name"><strong>player</strong> <span>(100)</span></div>
        <CountryFlag code="us" label="United States" />
      </div>
    )
  }
  return (
    <div className={`player-strip ${side}`}>
      <Avatar profile={profile} size="small" />
      {profile.title ? <span className="title-badge">{profile.title}</span> : null}
      <div className="player-name"><strong>{profile.name}</strong> <span>{`(${profile.displayRating})`}</span></div>
      <CountryFlag code={profile.countryCode} label={profile.country} />
    </div>
  )
}

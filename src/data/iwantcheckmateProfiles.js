const SILENT_DIALOGUE_POLICY = 'silent'

function stockfishVariant({
  id,
  videoId,
  videoTitle,
  rating = 3600,
  variant,
}) {
  return Object.freeze({
    id,
    name: 'Stockfish',
    fullName: 'Stockfish',
    displayRating: rating,
    title: 'IWantCheckmate',
    dialoguePolicy: SILENT_DIALOGUE_POLICY,
    capabilities: Object.freeze({
      silentDialogue: true,
      videoVariant: true,
    }),
    source: Object.freeze({
      channel: 'IWantCheckmate',
      videoId,
      videoTitle,
      videoUrl: `https://www.youtube.com/watch?v=${videoId}`,
    }),
    variant: Object.freeze({
      initialElo: rating,
      minElo: 250,
      maxElo: 3600,
      ...variant,
    }),
  })
}

export const IWANTCHECKMATE_VIDEO_PROFILES = Object.freeze([
  stockfishVariant({
    id: 'iwc-worst-move',
    videoId: 'SbPYufgaG-I',
    videoTitle: 'Stockfish, But It Loses 500 ELO If I Play the WORST Move',
    variant: { type: 'opponent-worst-move', eloDelta: -500 },
  }),
  stockfishVariant({
    id: 'iwc-give-check',
    videoId: 'vIvVdaTQi3s',
    videoTitle: 'Stockfish, But It Loses 300 ELO When I Give Check',
    variant: { type: 'opponent-check', eloDelta: -300 },
  }),
  stockfishVariant({
    id: 'iwc-best-move',
    videoId: 'U6J7XjR_5Ik',
    videoTitle: 'Stockfish, But It Loses 100 ELO If I Play The BEST Move',
    variant: { type: 'opponent-best-move', eloDelta: -100 },
  }),
  Object.freeze({
    id: 'martinfish',
    name: 'Martin',
    fullName: 'Martin',
    displayRating: 250,
    title: 'IWantCheckmate',
    dialoguePolicy: SILENT_DIALOGUE_POLICY,
    capabilities: Object.freeze({
      silentDialogue: true,
      videoVariant: true,
    }),
    source: Object.freeze({
      channel: 'IWantCheckmate',
      videoId: 'PPvPTwZg0JQ',
      videoTitle: 'Martin, But He Gains 100 ELO Every Move',
      videoUrl: 'https://www.youtube.com/watch?v=PPvPTwZg0JQ',
    }),
    variant: Object.freeze({
      type: 'own-move',
      initialElo: 250,
      minElo: 250,
      maxElo: 3600,
      eloDelta: 100,
    }),
  }),
  stockfishVariant({
    id: 'iwc-elo-decay',
    videoId: 'Uccowk6xbFc',
    videoTitle: 'Stockfish, But It Loses 50 ELO Every Move',
    variant: { type: 'own-move', eloDelta: -50 },
  }),
  stockfishVariant({
    id: 'iwc-random-blunder',
    videoId: 'ROkJSsMOfu0',
    videoTitle: 'Stockfish, But 5% Chance of Blundering Every Move',
    variant: { type: 'random-blunder', chance: 0.05 },
  }),
  stockfishVariant({
    id: 'iwc-random-top-three',
    videoId: 'qJLOLAKx6Fo',
    videoTitle: 'Stockfish, But It Randomly Picks 1 of 3 Top Moves',
    variant: { type: 'random-top-n', count: 3 },
  }),
  stockfishVariant({
    id: 'iwc-zero-evaluation',
    videoId: 'mUmTeprNjzU',
    videoTitle: 'Stockfish, But It Plays for 0.00 Evaluation',
    variant: { type: 'target-evaluation', targetCp: 0 },
  }),
  stockfishVariant({
    id: 'iwc-second-best',
    videoId: 'TQR5zCSzrqw',
    videoTitle: 'Stockfish, But It Plays the 2nd Best Move...',
    variant: { type: 'ranked-move', rank: 2 },
  }),
])

export const IWANTCHECKMATE_VARIANT_IDS = Object.freeze(
  IWANTCHECKMATE_VIDEO_PROFILES.map((profile) => profile.id),
)

export function getIWantCheckmateProfile(profileId) {
  return IWANTCHECKMATE_VIDEO_PROFILES.find((profile) => profile.id === profileId) || null
}

export function isIWantCheckmateProfile(profile) {
  return Boolean(profile?.capabilities?.videoVariant)
}

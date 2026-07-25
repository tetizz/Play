import { IWANTCHECKMATE_VIDEO_PROFILES } from './iwantcheckmateProfiles.js'

const BOT_PROFILE_LIST = [
  {
    id: 'mubassar',
    name: 'Mubassar',
    fullName: 'Mubassar',
    displayRating: 2300,
    title: 'NM',
    country: 'Bangladesh',
    countryCode: 'bd',
    avatar: {
      type: 'image',
      src: './assets/mubassar-avatar.png',
      alt: 'Mubassar avatar',
      objectPosition: '50% 22%',
      scale: 1.45,
    },
    accounts: {
      lichess: ['real64squares', 'guardup'],
      chesscom: ['keepitcoming'],
    },
    goal: 'Practical NM chess, recent repertoire, and sharp tactical punishment.',
    intro: 'Hey! I’m Mubassar. I’m a National Chess Master from NYC pursuing a FIDE title.',
    dialoguePolicy: 'mubassar',
    capabilities: {
      beltMode: true,
      knightSpecialist: false,
      perfectTheory: false,
    },
    strengthPolicy: {
      engineElo: 2300,
      depth: 11,
      moveTime: 1100,
      candidates: 5,
      styleWindowCp: 18,
      bookWindowCp: 30,
      bookMinGames: 8,
      bookMinRecentWeight: 1.2,
      belt: {
        engineElo: 2700,
        depth: 12,
        moveTime: 1200,
        candidates: 5,
        styleWindowCp: 12,
        bookWindowCp: 25,
      },
    },
    repertoireSource: {
      chesscom: ['keepitcoming'],
      lichess: ['real64squares', 'guardup'],
      recentHalfLifeDays: 180,
      forceWhiteFirstMove: 'd4',
    },
  },
  {
    id: 'ayden',
    name: 'Ayden',
    fullName: 'Ayden Spellman',
    displayRating: 1900,
    country: 'United States',
    countryCode: 'us',
    avatar: {
      type: 'placeholder',
      text: 'AS',
      alt: 'Ayden placeholder avatar',
    },
    accounts: {
      lichess: ['AydenICN'],
      chesscom: ['AA01001'],
    },
    goal: 'A recent-game version of Ayden with practical, low-noise feedback.',
    intro: 'Ayden loves the french defense',
    dialoguePolicy: 'ayden',
    capabilities: {
      beltMode: false,
      knightSpecialist: false,
      perfectTheory: false,
    },
    strengthPolicy: {
      engineElo: 1900,
      depth: 10,
      moveTime: 900,
      candidates: 5,
      styleWindowCp: 24,
      bookWindowCp: 35,
      bookMinGames: 5,
      bookMinRecentWeight: 0.9,
    },
    repertoireSource: {
      chesscom: ['AA01001'],
      lichess: ['AydenICN'],
      recentHalfLifeDays: 180,
    },
  },
  {
    id: 'akshit',
    name: 'Akshit',
    fullName: 'Akshit Sharma',
    displayRating: 2007,
    country: 'Nepal',
    countryCode: 'np',
    avatar: {
      type: 'image',
      src: './assets/akshit-avatar.jpg',
      alt: 'Akshit knight avatar',
      objectPosition: '50% 50%',
      scale: 1,
    },
    accounts: {
      chesscom: ['knightmanuveur_12'],
      lichess: [],
    },
    goal: 'A knight-focused tactical bot built from public games.',
    intro: 'Akshit is the Knight maneuver loves to move his knight',
    dialoguePolicy: 'akshit',
    capabilities: {
      beltMode: false,
      knightSpecialist: true,
      perfectTheory: false,
    },
    strengthPolicy: {
      engineElo: 2007,
      depth: 10,
      moveTime: 900,
      candidates: 5,
      styleWindowCp: 24,
      bookWindowCp: 35,
      bookMinGames: 5,
      bookMinRecentWeight: 0.9,
      knightRequiredGapCp: 45,
    },
    repertoireSource: {
      chesscom: ['knightmanuveur_12'],
      lichess: [],
      recentHalfLifeDays: 180,
    },
  },
  {
    id: 'trixize',
    name: 'Trixize',
    fullName: 'Trixize',
    displayRating: 1550,
    country: 'United States',
    countryCode: 'us',
    avatar: {
      type: 'image',
      src: './assets/trixize-avatar.png',
      alt: 'Trixize avatar',
      objectPosition: '50% 50%',
      scale: 1,
    },
    accounts: {
      chesscom: ['trixize1234'],
      lichess: [],
    },
    goal: 'A maximum-strength theory bot built from Trixize’s current repertoire.',
    intro: 'Adriano plays the kings indian ie the best opening',
    dialoguePolicy: 'trixize',
    capabilities: {
      beltMode: false,
      knightSpecialist: false,
      perfectTheory: true,
      weightedRepertoire: true,
      maximumEngine: true,
      bishopKnightObjective: true,
      exactTablebase: true,
      badMannersTakeover: true,
    },
    strengthPolicy: {
      engineElo: null,
      depth: 18,
      moveTime: 950,
      candidates: 8,
      styleWindowCp: 0,
      bookWindowCp: 60,
      bookMinGames: 2,
      bookMinRecentWeight: 0.2,
      endgame: {
        depth: 22,
        moveTime: 1700,
        candidates: 10,
      },
      bishopKnightMate: {
        depth: 30,
        moveTime: 4200,
        candidates: 1,
      },
      mateSafety: {
        depth: 24,
        moveTime: 1400,
        candidates: 1,
      },
    },
    repertoireSource: {
      chesscom: ['trixize1234'],
      lichess: [],
      recentHalfLifeDays: 180,
      forceWhiteFirstMove: 'Nf3',
      repertoireTemperature: 0.72,
    },
  },
  ...IWANTCHECKMATE_VIDEO_PROFILES.map(withIWantCheckmatePresentation),
]

export const BOT_PROFILES = Object.freeze(BOT_PROFILE_LIST)
export const DEFAULT_BOT_ID = 'mubassar'

const styleCache = new Map()

export function getBotProfile(botId) {
  return BOT_PROFILES.find((profile) => profile.id === botId) || BOT_PROFILES[0]
}

export async function loadBotStyleProfile(botId) {
  const profileId = getBotProfile(botId).id
  if (styleCache.has(profileId)) return styleCache.get(profileId)

  const promise = loadStyleProfile(profileId).catch(() => ({
    openingBook: {},
    bookMaxPlies: 0,
    bookKeyType: 'position',
  }))
  styleCache.set(profileId, promise)
  return promise
}

async function loadStyleProfile(botId) {
  if (botId === 'mubassar') {
    const [{ OPENING_BOOK, BOOK_MAX_PLIES }, styleModule] = await Promise.all([
      import('./openingBook.js'),
      import('./generatedMubassarStyleProfile.js').catch(() => ({ GENERATED_MUBASSAR_STYLE_PROFILE: null })),
    ])
    return {
      openingBook: OPENING_BOOK,
      bookMaxPlies: BOOK_MAX_PLIES,
      bookKeyType: 'mixed',
      learnedStyle: styleModule.GENERATED_MUBASSAR_STYLE_PROFILE,
    }
  }

  if (botId === 'ayden') {
    const [{ AYDEN_OPENING_BOOK, AYDEN_BOOK_MAX_PLIES }, { GENERATED_AYDEN_STYLE_PROFILE }] = await Promise.all([
      import('./aydenOpeningBook.js'),
      import('./generatedAydenStyleProfile.js'),
    ])
    return {
      openingBook: AYDEN_OPENING_BOOK,
      bookMaxPlies: AYDEN_BOOK_MAX_PLIES,
      bookKeyType: 'position',
      learnedStyle: GENERATED_AYDEN_STYLE_PROFILE,
    }
  }

  if (botId === 'akshit') {
    const [bookModule, styleModule] = await Promise.all([
      import('./generatedRecentAkshitRepertoireBook.js').catch(() => ({ GENERATED_RECENT_AKSHIT_REPERTOIRE_BOOK: {} })),
      import('./generatedAkshitStyleProfile.js').catch(() => ({ GENERATED_AKSHIT_STYLE_PROFILE: null })),
    ])
    return {
      openingBook: bookModule.GENERATED_RECENT_AKSHIT_REPERTOIRE_BOOK || {},
      bookMaxPlies: 20,
      bookKeyType: 'position',
      learnedStyle: styleModule.GENERATED_AKSHIT_STYLE_PROFILE,
    }
  }

  if (botId === 'trixize') {
    const [bookModule, styleModule] = await Promise.all([
      import('./trixizeOpeningBook.js').catch(() => ({ TRIXIZE_OPENING_BOOK: {} })),
      import('./generatedTrixizeStyleProfile.js').catch(() => ({ GENERATED_TRIXIZE_STYLE_PROFILE: null })),
    ])
    return {
      openingBook: bookModule.TRIXIZE_OPENING_BOOK || {},
      bookMaxPlies: 40,
      bookKeyType: 'position',
      learnedStyle: styleModule.GENERATED_TRIXIZE_STYLE_PROFILE,
    }
  }

  return {
    openingBook: {},
    bookMaxPlies: 0,
    bookKeyType: 'position',
    learnedStyle: null,
  }
}

function withIWantCheckmatePresentation(profile) {
  const isMartin = profile.id === 'martinfish'
  return {
    ...profile,
    name: isMartin ? 'Martin' : 'PityFish',
    fullName: isMartin ? 'Martin' : 'PityFish',
    title: '',
    country: 'United States',
    countryCode: 'us',
    avatar: {
      type: 'image',
      // Profile art is taken from the actual in-game player strips, not video thumbnails.
      src: `./assets/iwantcheckmate/${isMartin ? 'martin-profile' : 'pityfish-profile'}.png`,
      alt: `${isMartin ? 'Martin' : 'PityFish'} gameplay avatar`,
      objectPosition: '50% 50%',
      scale: 1,
      transparent: !isMartin,
    },
    accounts: {
      chesscom: [],
      lichess: [],
    },
    intro: profile.source.videoTitle,
    videoLabel: variantLabel(profile.variant),
    capabilities: {
      ...profile.capabilities,
      beltMode: false,
      knightSpecialist: false,
      perfectTheory: false,
      maximumEngine: true,
      bishopKnightObjective: false,
      exactTablebase: false,
    },
    strengthPolicy: {
      engineElo: null,
      depth: 17,
      moveTime: 1150,
      candidates: 8,
      styleWindowCp: 0,
      bookWindowCp: 0,
      bookMinGames: Number.POSITIVE_INFINITY,
      bookMinRecentWeight: Number.POSITIVE_INFINITY,
    },
    repertoireSource: {
      chesscom: [],
      lichess: [],
      recentHalfLifeDays: 180,
    },
  }
}

function variantLabel(variant) {
  if (variant.type === 'opponent-worst-move') return 'Lose 500 after the worst move'
  if (variant.type === 'opponent-check') return 'Lose 300 after a check'
  if (variant.type === 'opponent-best-move') return 'Lose 100 after the best move'
  if (variant.type === 'own-move' && variant.eloDelta > 0) return 'Gain 100 every move'
  if (variant.type === 'own-move') return 'Lose 50 every move'
  if (variant.type === 'random-blunder') return '5% chance to blunder'
  if (variant.type === 'random-top-n') return 'Random top-three move'
  if (variant.type === 'target-evaluation') return 'Plays for 0.00'
  if (variant.type === 'ranked-move') return 'Always second best'
  return 'Video challenge'
}

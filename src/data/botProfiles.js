import { IWANTCHECKMATE_VIDEO_PROFILES } from './iwantcheckmateProfiles.js'

const BOT_PROFILE_LIST = [
  {
    id: 'mubassar',
    name: 'Mubassar',
    fullName: 'Mubassar',
    category: 'coach',
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
    category: 'coach',
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
    category: 'coach',
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
    category: 'coach',
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
  {
    id: 'witty-alien',
    name: 'Witty Alien',
    fullName: 'Witty Alien',
    category: 'coach',
    displayRating: 2200,
    title: 'CM',
    country: 'Bulgaria',
    countryCode: 'bg',
    avatar: {
      type: 'image',
      src: './assets/witty-alien-avatar.png',
      alt: 'Witty Alien avatar',
      objectPosition: '50% 50%',
      scale: 1,
    },
    accounts: {
      chesscom: ['witty_alien'],
      lichess: [],
    },
    goal: 'Aggressive practical chess built from a complete public game history.',
    intro: 'Witty Alien lives for gambits, sacrifices, and attacks that refuse to stay quiet.',
    dialoguePolicy: 'witty-alien',
    capabilities: {
      beltMode: false,
      knightSpecialist: false,
      perfectTheory: false,
      sacrificeSpecialist: true,
      weightedRepertoire: true,
    },
    strengthPolicy: {
      engineElo: 2200,
      depth: 11,
      moveTime: 1000,
      candidates: 7,
      styleWindowCp: 20,
      bookWindowCp: 32,
      bookMinGames: 4,
      bookMinRecentWeight: 0.5,
    },
    repertoireSource: {
      chesscom: ['witty_alien'],
      lichess: [],
      recentHalfLifeDays: 180,
      archiveWindow: 'all',
      repertoireTemperature: 0.82,
    },
  },
  ...IWANTCHECKMATE_VIDEO_PROFILES,
]

export const BOT_PROFILES = Object.freeze(BOT_PROFILE_LIST)
export const DEFAULT_BOT_ID = 'mubassar'

const styleCache = new Map()

export function getBotProfile(botId) {
  const resolvedId = botId === 'martinfish' ? 'iwc-smartin' : botId
  return BOT_PROFILES.find((profile) => profile.id === resolvedId) || BOT_PROFILES[0]
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

  if (botId === 'witty-alien') {
    const [bookModule, styleModule] = await Promise.all([
      import('./generatedRecentWittyAlienRepertoireBook.js').catch(() => ({
        GENERATED_RECENT_WITTY_ALIEN_REPERTOIRE_BOOK: {},
      })),
      import('./generatedWittyAlienStyleProfile.js').catch(() => ({
        GENERATED_WITTY_ALIEN_STYLE_PROFILE: null,
      })),
    ])
    return {
      openingBook: bookModule.GENERATED_RECENT_WITTY_ALIEN_REPERTOIRE_BOOK || {},
      bookMaxPlies: 32,
      bookKeyType: 'position',
      learnedStyle: styleModule.GENERATED_WITTY_ALIEN_STYLE_PROFILE,
    }
  }

  return {
    openingBook: {},
    bookMaxPlies: 0,
    bookKeyType: 'position',
    learnedStyle: null,
  }
}

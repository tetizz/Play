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
    },
    strengthPolicy: {
      engineElo: 2400,
      depth: 10,
      moveTime: 950,
      candidates: 5,
      styleWindowCp: 24,
      bookWindowCp: 45,
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
    intro: 'Ayden plays from his recent games and keeps the commentary focused.',
    dialoguePolicy: 'ayden',
    capabilities: {
      beltMode: false,
      knightSpecialist: false,
    },
    strengthPolicy: {
      engineElo: 1900,
      depth: 8,
      moveTime: 650,
      candidates: 5,
      styleWindowCp: 42,
      bookWindowCp: 70,
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
    displayRating: 1000,
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
    intro: 'Akshit likes active knights and direct play.',
    dialoguePolicy: 'akshit',
    capabilities: {
      beltMode: false,
      knightSpecialist: true,
    },
    strengthPolicy: {
      engineElo: 1400,
      depth: 7,
      moveTime: 520,
      candidates: 5,
      styleWindowCp: 105,
      bookWindowCp: 100,
      bookMinGames: 4,
      bookMinRecentWeight: 0.65,
      knightRequiredGapCp: 45,
    },
    repertoireSource: {
      chesscom: ['knightmanuveur_12'],
      lichess: [],
      recentHalfLifeDays: 180,
    },
  },
]

export const BOT_PROFILES = Object.freeze(BOT_PROFILE_LIST)
export const DEFAULT_BOT_ID = 'mubassar'

const styleCache = new Map()

export function getBotProfile(botId) {
  return BOT_PROFILES.find((profile) => profile.id === botId) || BOT_PROFILES[0]
}

export async function loadBotStyleProfile(botId) {
  if (styleCache.has(botId)) return styleCache.get(botId)

  const promise = loadStyleProfile(botId).catch(() => ({
    openingBook: {},
    bookMaxPlies: 0,
    bookKeyType: 'position',
  }))
  styleCache.set(botId, promise)
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
      bookKeyType: 'history',
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

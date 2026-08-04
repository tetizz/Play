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
    intro: 'Ayden loves the French Defense and keeps his comments focused on the position.',
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
    intro: 'Akshit is the Knight Manuveur. If a knight can move, he will find a reason to move it.',
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
    intro: 'Adriano plays the King\'s Indian, which he will happily tell you is the best opening.',
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
    id: 'brian',
    name: 'Brian',
    fullName: 'Brian Arthur',
    category: 'coach',
    displayRating: 2400,
    country: 'United States',
    countryCode: 'us',
    avatar: {
      type: 'image',
      src: './assets/brian-avatar.svg',
      alt: 'Original Brian chess portrait',
      objectPosition: '50% 50%',
      scale: 1,
    },
    accounts: { chesscom: ['Bdot'], lichess: ['BrianART'] },
    goal: 'Fast, tactical chess shaped by Brian’s public games.',
    intro: 'Brian brings speed, tactics, and years of tournament coaching experience.',
    dialoguePolicy: 'silent',
    capabilities: { beltMode: false, knightSpecialist: false, perfectTheory: false },
    strengthPolicy: {
      engineElo: 2400, depth: 13, moveTime: 1200, candidates: 7,
      styleWindowCp: 16, bookWindowCp: 28, bookMinGames: 6, bookMinRecentWeight: 0.9,
    },
    repertoireSource: {
      chesscom: ['Bdot'], lichess: ['BrianART'], recentHalfLifeDays: 180,
    },
  },
  {
    id: 'kirk',
    name: 'Kirk',
    fullName: 'Kirk',
    category: 'coach',
    displayRating: 1700,
    country: 'United States',
    countryCode: 'us',
    avatar: {
      type: 'image',
      src: './assets/kirk-avatar.svg',
      alt: 'Original Kirk chess portrait',
      objectPosition: '50% 50%',
      scale: 1,
    },
    accounts: { chesscom: ['Mrlovechess432'], lichess: ['Coachkirk432'] },
    goal: 'Practical chess shaped by Kirk’s verified public games on both platforms.',
    intro: '',
    dialoguePolicy: 'silent',
    capabilities: { beltMode: false, knightSpecialist: false, perfectTheory: false },
    strengthPolicy: {
      engineElo: 1700, depth: 10, moveTime: 850, candidates: 5,
      styleWindowCp: 26, bookWindowCp: 38, bookMinGames: 5, bookMinRecentWeight: 0.8,
    },
    repertoireSource: {
      chesscom: ['Mrlovechess432'], lichess: ['Coachkirk432'], recentHalfLifeDays: 180,
    },
  },
  {
    id: 'alexander',
    name: 'Aleksandr',
    fullName: 'Aleksandr Lenderman',
    category: 'coach',
    displayRating: 2700,
    title: 'GM',
    country: 'United States',
    countryCode: 'us',
    avatar: {
      type: 'image',
      src: './assets/alexander-avatar.svg',
      alt: 'Original Aleksandr Lenderman chess portrait',
      objectPosition: '50% 50%',
      scale: 1,
    },
    accounts: { chesscom: ['AlexanderL'], lichess: ['AlexLenderman'] },
    goal: 'Grandmaster-strength play informed by verified public games on both platforms.',
    intro: 'Aleksandr Lenderman’s repertoire combines his public Chess.com and Lichess games.',
    dialoguePolicy: 'silent',
    capabilities: { beltMode: false, knightSpecialist: false, perfectTheory: false },
    strengthPolicy: {
      engineElo: 2700, depth: 15, moveTime: 1500, candidates: 8,
      styleWindowCp: 10, bookWindowCp: 20, bookMinGames: 6, bookMinRecentWeight: 0.75,
    },
    repertoireSource: {
      chesscom: ['AlexanderL'], lichess: ['AlexLenderman'], recentHalfLifeDays: 180, archiveWindow: 'all',
    },
  },
  {
    id: 'witty-alien',
    name: 'Witty Alien',
    fullName: 'Witty Alien',
    category: 'coach',
    displayRating: 2400,
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
      engineElo: 2400,
      depth: 14,
      moveTime: 1400,
      candidates: 8,
      styleWindowCp: 14,
      bookWindowCp: 22,
      bookMinGames: 6,
      bookMinRecentWeight: 0.75,
    },
    repertoireSource: {
      chesscom: ['witty_alien'],
      lichess: [],
      recentHalfLifeDays: 180,
      archiveWindow: 'all',
      forceWhiteFirstMove: 'e4',
      forcedWhiteLines: [
        // Alien Gambit, including Witty's main replies to Black's common defenses.
        ['e4', 'c6', 'd4', 'd5', 'Nd2', 'dxe4', 'Nxe4', 'Nf6', 'Ng5', 'h6', 'Nxf7', 'Kxf7', 'Nf3', 'c5', 'Ne5+'],
        ['e4', 'c6', 'd4', 'd5', 'Nd2', 'dxe4', 'Nxe4', 'Nf6', 'Ng5', 'h6', 'Nxf7', 'Kxf7', 'Nf3', 'Bf5', 'Ne5+'],
        ['e4', 'c6', 'd4', 'd5', 'Nd2', 'dxe4', 'Nxe4', 'Nf6', 'Ng5', 'h6', 'Nxf7', 'Kxf7', 'Nf3', 'e6', 'Bc4'],
        // Witty's recent-game continuations when Black avoids or delays the Alien.
        ['e4', 'c6', 'd4', 'd5', 'Nd2', 'Nf6', 'e5'],
        ['e4', 'c6', 'd4', 'd5', 'Nd2', 'e6', 'Ngf3'],
        ['e4', 'c6', 'd4', 'd5', 'Nd2', 'g6', 'h4'],
        ['e4', 'c6', 'd4', 'd5', 'Nd2', 'dxe4', 'Nxe4', 'Nd7', 'Ng5'],
        ['e4', 'c6', 'd4', 'd5', 'Nd2', 'dxe4', 'Nxe4', 'h6', 'Qe2'],
        ['e4', 'c6', 'd4', 'd5', 'Nd2', 'dxe4', 'Nxe4', 'e6', 'Nf3'],
        ['e4', 'c6', 'd4', 'd5', 'Nd2', 'dxe4', 'Nxe4', 'Nf6', 'Ng5', 'e6', 'N1f3'],
        ['e4', 'c6', 'd4', 'd5', 'Nd2', 'dxe4', 'Nxe4', 'Nf6', 'Ng5', 'Bf5', 'N1f3'],
        // Martian Gambit when Black develops with ...Bf5 instead of ...Nf6.
        ['e4', 'c6', 'd4', 'd5', 'Nd2', 'dxe4', 'Nxe4', 'Bf5', 'Ng5', 'Bg6', 'N1f3', 'h6', 'Ne6', 'fxe6', 'Ne5', 'Bf5', 'g4'],
        ['e4', 'c6', 'd4', 'd5', 'Nd2', 'dxe4', 'Nxe4', 'Bf5', 'Ng5', 'Bg6', 'N1f3', 'h6', 'Ne6', 'fxe6', 'Ne5', 'Bh7', 'Bc4'],
        ['e4', 'c6', 'd4', 'd5', 'Nd2', 'dxe4', 'Nxe4', 'Bf5', 'Ng5', 'Bg6', 'N1f3', 'h6', 'Ne6', 'fxe6', 'Ne5', 'Bf7', 'Bc4'],
      ],
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

  if (['brian', 'kirk', 'alexander'].includes(botId)) {
    const modules = {
      brian: [
        () => import('./generatedRecentBrianRepertoireBook.js'),
        () => import('./generatedBrianStyleProfile.js'),
        'GENERATED_RECENT_BRIAN_REPERTOIRE_BOOK',
        'GENERATED_BRIAN_STYLE_PROFILE',
      ],
      kirk: [
        () => import('./generatedRecentKirkRepertoireBook.js'),
        () => import('./generatedKirkStyleProfile.js'),
        'GENERATED_RECENT_KIRK_REPERTOIRE_BOOK',
        'GENERATED_KIRK_STYLE_PROFILE',
      ],
      alexander: [
        () => import('./generatedRecentAlexanderRepertoireBook.js'),
        () => import('./generatedAlexanderStyleProfile.js'),
        'GENERATED_RECENT_ALEXANDER_REPERTOIRE_BOOK',
        'GENERATED_ALEXANDER_STYLE_PROFILE',
      ],
    }
    const [loadBook, loadStyle, bookExport, styleExport] = modules[botId]
    const [bookModule, styleModule] = await Promise.all([
      loadBook().catch(() => ({})),
      loadStyle().catch(() => ({})),
    ])
    return {
      openingBook: bookModule[bookExport] || {},
      bookMaxPlies: botId === 'alexander' ? 32 : 24,
      bookKeyType: 'position',
      learnedStyle: styleModule[styleExport] || null,
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

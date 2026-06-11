import { AYDEN_BOOK_MAX_PLIES, AYDEN_OPENING_BOOK } from './aydenOpeningBook.js'
import { GENERATED_AYDEN_STYLE_PROFILE } from './generatedAydenStyleProfile.js'
import { BOOK_MAX_PLIES, OPENING_BOOK } from './openingBook.js'

export const BOT_PROFILES = [
  {
    id: 'mubassar',
    name: 'Mubassar',
    fullName: 'Mubassar Uddin',
    displayRating: 2300,
    botStrength: 2300,
    title: 'NM',
    country: 'Bangladesh',
    avatar: {
      type: 'image',
      src: './assets/mubassar-avatar.png',
      alt: 'Mubassar avatar',
    },
    accounts: {
      lichess: 'real64squares',
      chesscom: 'keepitcoming',
    },
    goal: 'Play practical NM chess with strong structure and tactical punishment.',
    styleProfile: {
      openingBook: OPENING_BOOK,
      bookMaxPlies: BOOK_MAX_PLIES,
    },
  },
  {
    id: 'ayden',
    name: 'Ayden',
    fullName: 'Ayden Spellman',
    displayRating: 1900,
    botStrength: 2050,
    country: 'United States',
    avatar: {
      type: 'placeholder',
      text: 'AS',
      alt: 'Ayden placeholder avatar',
    },
    accounts: {
      lichess: 'AydenICN',
      chesscom: 'AA01001',
    },
    goal: "Become a stronger version of Ayden's own style.",
    styleProfile: {
      openingBook: AYDEN_OPENING_BOOK,
      bookMaxPlies: AYDEN_BOOK_MAX_PLIES,
      bookKeyType: 'position',
      learnedStyle: GENERATED_AYDEN_STYLE_PROFILE,
    },
  },
]

export const DEFAULT_BOT_ID = 'mubassar'

export function getBotProfile(botId) {
  return BOT_PROFILES.find((profile) => profile.id === botId) || BOT_PROFILES[0]
}

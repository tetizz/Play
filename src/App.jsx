import { Component, lazy, Suspense } from 'react'
import { Bot, Home, RotateCcw } from 'lucide-react'
import { DEFAULT_BOT_ID } from './data/botProfiles'
import { useGameController } from './hooks/useGameController'
import { SetupScreen } from './components/SetupScreen'
import './App.css'

const GameScreen = lazy(() => import('./components/GameScreen').then((module) => ({
  default: module.GameScreen,
})))
const ReviewWorkspace = lazy(() => import('./components/ReviewWorkspace').then((module) => ({
  default: module.ReviewWorkspace,
})))
const HOME_URL = 'https://tetizz.github.io/Home/'

export default function App() {
  return (
    <AppErrorBoundary>
      <PlayApp />
    </AppErrorBoundary>
  )
}

function PlayApp() {
  const controller = useGameController(DEFAULT_BOT_ID)
  if (controller.phase === 'setup') {
    return <SetupScreen {...controller} />
  }
  return (
    <Suspense fallback={<RouteLoading phase={controller.phase} />}>
      {controller.phase === 'review'
        ? <ReviewWorkspace controller={controller} />
        : <GameScreen controller={controller} />}
    </Suspense>
  )
}

function RouteLoading({ phase }) {
  return (
    <main className="route-loading" role="status" aria-live="polite">
      <span className="route-loading-mark" aria-hidden="true"><Bot /></span>
      <p className="eyebrow">Play Bots</p>
      <h1>{phase === 'review' ? 'Opening game review' : 'Setting the board'}</h1>
      <p>The arena is loading.</p>
      <span className="route-loading-bar" aria-hidden="true" />
    </main>
  )
}

class AppErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  render() {
    if (!this.state.hasError) return this.props.children
    return (
      <main className="error-shell">
        <span className="eyebrow">Play Bots</span>
        <h1>The board could not open.</h1>
        <p>Your saved game is still in this browser. Reload the arena to try again.</p>
        <div className="error-shell-actions">
          <button type="button" onClick={() => window.location.reload()}>
            <RotateCcw /> Reload arena
          </button>
          <a href={HOME_URL}>
            <Home /> Chess projects
          </a>
        </div>
      </main>
    )
  }
}

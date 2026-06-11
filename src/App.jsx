import { DEFAULT_BOT_ID } from './data/botProfiles'
import { useGameController } from './hooks/useGameController'
import { GameScreen } from './components/GameScreen'
import { ReviewWorkspace } from './components/ReviewWorkspace'
import { SetupScreen } from './components/SetupScreen'
import './App.css'

export default function App() {
  const controller = useGameController(DEFAULT_BOT_ID)
  if (controller.phase === 'setup') {
    return <SetupScreen {...controller} />
  }
  if (controller.phase === 'review') {
    return <ReviewWorkspace controller={controller} />
  }
  return <GameScreen controller={controller} />
}

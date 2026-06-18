import { useState } from 'react'
import { DEFAULT_BOT_ID } from './data/botProfiles'
import { useGameController } from './hooks/useGameController'
import { BadMannersDashboard } from './components/BadMannersDashboard'
import { GameScreen } from './components/GameScreen'
import { ReviewWorkspace } from './components/ReviewWorkspace'
import { SetupScreen } from './components/SetupScreen'
import './App.css'

export default function App() {
  const [activeSurface, setActiveSurface] = useState('play')
  const controller = useGameController(DEFAULT_BOT_ID)
  if (activeSurface === 'bad-manners') {
    return <BadMannersDashboard onBack={() => setActiveSurface('play')} />
  }
  if (controller.phase === 'setup') {
    return <SetupScreen {...controller} onOpenBadManners={() => setActiveSurface('bad-manners')} />
  }
  if (controller.phase === 'review') {
    return <ReviewWorkspace controller={controller} />
  }
  return <GameScreen controller={controller} />
}

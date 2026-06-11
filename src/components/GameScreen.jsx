import { Flag, RotateCcw } from 'lucide-react'
import { Avatar, PlayerStrip } from './Identity'
import { BoardSurface } from './BoardSurface'
import { MoveList } from './MoveList'

export function GameScreen({ controller }) {
  const {
    profile,
    player,
    history,
    humanColor,
    turnState,
    message,
    lastMove,
    premove,
    selectedSquare,
    setSelectedSquare,
    arrows,
    setArrows,
    viewPly,
    setViewPly,
    beltMode,
    makeMove,
    undo,
    resign,
  } = controller
  const status = turnState === 'human' ? 'Your move' : turnState === 'game-over' ? 'Game over' : `${profile.name} is thinking`
  return (
    <main className="game-page">
      <section className="board-column">
        <PlayerStrip profile={profile} side="top" />
        <BoardSurface
          history={history}
          viewPly={viewPly}
          orientation={humanColor}
          humanColor={humanColor}
          turnState={turnState}
          lastMove={lastMove}
          premove={premove}
          selectedSquare={selectedSquare}
          setSelectedSquare={setSelectedSquare}
          arrows={arrows}
          setArrows={setArrows}
          onMove={makeMove}
        />
        <PlayerStrip player={player} side="bottom" />
      </section>
      <aside className="game-sidebar">
        <div className="dialogue-row">
          <Avatar profile={profile} size="medium" />
          {message ? <div className="speech-bubble">{message}</div> : <div className="silent-bubble" aria-label={`${profile.name} is focused`} />}
        </div>
        <MoveList
          history={history}
          activePly={viewPly}
          onSelect={setViewPly}
          onBack={() => setViewPly((ply) => Math.max(0, ply - 1))}
          onForward={() => setViewPly((ply) => Math.min(history.length, ply + 1))}
        />
        <div className="game-status">
          <span>{status}</span>
          {beltMode ? <strong>Belt mode</strong> : null}
        </div>
        <div className="game-actions">
          <button type="button" onClick={resign}><Flag /><span>Resign</span></button>
          <button type="button" onClick={undo} disabled={!history.length}><RotateCcw /><span>Undo</span></button>
        </div>
      </aside>
    </main>
  )
}

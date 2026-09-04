import { useMemo, useRef } from 'react'
import { Flag, Home, RotateCcw, X } from 'lucide-react'
import { getBotProfile } from '../data/botProfiles'
import { DIALOGUE_RUNTIME_ENABLED } from '../data/dialogue'
import { materialDisplayFromHistory } from '../lib/materialDisplay'
import { useDialogFocus } from '../hooks/useDialogFocus'
import { Avatar, PlayerStrip } from './Identity'
import { BoardSurface } from './BoardSurface'
import { MoveList } from './MoveList'

const HOME_URL = 'https://tetizz.github.io/Home/'

export function GameScreen({ controller }) {
  const {
    gameMode,
    profile,
    player,
    whiteProfile,
    blackProfile,
    history,
    game,
    humanColor,
    boardOrientation,
    turnState,
    message,
    speechEventId,
    dialogueLog,
    lastMove,
    premoveQueue,
    pendingPromotion,
    selectedSquare,
    setSelectedSquare,
    arrows,
    setArrows,
    viewPly,
    setViewPly,
    beltMode,
    ratingFor,
    makeMove,
    confirmPromotion,
    cancelPromotion,
    clearPremoves,
    undo,
    resign,
  } = controller
  const botMatch = gameMode === 'bots'
  const topProfile = botMatch ? blackProfile : profile
  const topProfileColor = botMatch ? 'black' : humanColor === 'white' ? 'black' : 'white'
  const bottomProfileColor = botMatch ? 'white' : humanColor
  const materialDisplay = useMemo(
    () => materialDisplayFromHistory(history, viewPly),
    [history, viewPly],
  )
  const materialFor = (color) => ({
    ...materialDisplay[color],
    color: color === 'white' ? 'black' : 'white',
  })
  const activeBot = game.turn() === 'w' ? whiteProfile : blackProfile
  const status = turnState === 'game-over'
    ? 'Game over'
    : botMatch
      ? `${activeBot.name} is thinking`
      : turnState === 'human' ? 'Your move' : `${profile.name} is thinking`

  return (
    <main className={`game-page ${botMatch ? 'bot-match-page' : ''}`}>
      <section className="board-column">
        <PlayerStrip
          profile={topProfile}
          side="top"
          ratingState={ratingFor?.(topProfile, topProfileColor)}
          material={materialFor(topProfileColor)}
        />
        <div className="board-stage">
          <BoardSurface
            history={history}
            viewPly={viewPly}
            orientation={boardOrientation}
            humanColor={humanColor}
            turnState={turnState}
            lastMove={lastMove}
            premoves={premoveQueue}
            selectedSquare={selectedSquare}
            setSelectedSquare={setSelectedSquare}
            arrows={arrows}
            setArrows={setArrows}
            onMove={makeMove}
            onCancelPremove={clearPremoves}
            interactive={!botMatch}
          />
          {pendingPromotion ? (
            <PromotionPicker
              color={pendingPromotion.color}
              onSelect={confirmPromotion}
              onCancel={cancelPromotion}
            />
          ) : null}
        </div>
        {botMatch
          ? (
              <PlayerStrip
                profile={whiteProfile}
                side="bottom"
                ratingState={ratingFor?.(whiteProfile, 'white')}
                material={materialFor(bottomProfileColor)}
              />
            )
          : <PlayerStrip player={player} side="bottom" material={materialFor(bottomProfileColor)} />}
      </section>
      <aside className="game-sidebar">
        {DIALOGUE_RUNTIME_ENABLED && botMatch ? (
          <BotConversation
            entries={dialogueLog}
            whiteProfile={whiteProfile}
            blackProfile={blackProfile}
          />
        ) : DIALOGUE_RUNTIME_ENABLED && profile.dialoguePolicy !== 'silent' ? (
          <div
            className={`dialogue-row ${message ? 'bot-speaking' : ''}`}
            key={`${profile.id}-${speechEventId}`}
            aria-live="polite"
          >
            <Avatar profile={profile} size="medium" />
            {message
              ? <div className="speech-bubble">{message}</div>
              : <div className="silent-bubble" aria-label={`${profile.name} is focused`} />}
          </div>
        ) : null}
        <MoveList
          history={history}
          activePly={viewPly}
          onSelect={setViewPly}
          onBack={() => setViewPly((ply) => Math.max(0, ply - 1))}
          onForward={() => setViewPly((ply) => Math.min(history.length, ply + 1))}
        />
        <div className="game-status">
          <span className="turn-status" role="status" aria-live="polite" aria-atomic="true">
            <span className={`turn-indicator ${turnState}`} aria-hidden="true" />
            {status}
          </span>
          {!botMatch && premoveQueue.length ? (
            <span className="premove-status" aria-live="polite">
              {premoveQueue.length} {premoveQueue.length === 1 ? 'premove' : 'premoves'} queued
              <button
                type="button"
                onClick={clearPremoves}
                title="Clear premoves"
                aria-label={`Clear all ${premoveQueue.length} queued ${premoveQueue.length === 1 ? 'premove' : 'premoves'}`}
              >
                <X />
              </button>
            </span>
          ) : null}
          {beltMode ? <strong>Belt mode</strong> : null}
        </div>
        <div className="game-actions">
          <a className="home-nav-button game-home-button" href={HOME_URL} role="button">
            <Home /><span>Home</span>
          </a>
          <button type="button" onClick={resign}>
            <Flag /><span>{botMatch ? 'End match' : 'Resign'}</span>
          </button>
          <button type="button" onClick={undo} disabled={!history.length}>
            <RotateCcw /><span>Undo</span>
          </button>
        </div>
      </aside>
    </main>
  )
}

function BotConversation({ entries, whiteProfile, blackProfile }) {
  if (whiteProfile.dialoguePolicy === 'silent' && blackProfile.dialoguePolicy === 'silent') return null
  const visible = entries.slice(-6)
  const activeEntryId = visible.at(-1)?.id
  return (
    <section
      className="bot-conversation"
      aria-label="Bot conversation"
      aria-live="polite"
      role="log"
    >
      {visible.length ? visible.map((entry) => {
        const speaker = getBotProfile(entry.botId)
        const side = entry.botId === blackProfile.id ? 'black-speaker' : 'white-speaker'
        return (
          <div
            className={`conversation-row ${side} ${entry.id === activeEntryId ? 'active-speaker' : ''}`}
            key={entry.id}
          >
            <Avatar profile={speaker} size="small" />
            <div className="conversation-bubble">
              <strong>{speaker.name}</strong>
              <p>{entry.text}</p>
            </div>
          </div>
        )
      }) : (
        <div className="match-waiting">
          <Avatar profile={whiteProfile} size="small" />
          <Avatar profile={blackProfile} size="small" />
          <span>The match is starting.</span>
        </div>
      )}
    </section>
  )
}

function PromotionPicker({ color, onSelect, onCancel }) {
  const dialogRef = useRef(null)
  useDialogFocus(dialogRef, onCancel)
  const pieces = color === 'b'
    ? [
        { key: 'q', symbol: '♛', label: 'Queen' },
        { key: 'r', symbol: '♜', label: 'Rook' },
        { key: 'b', symbol: '♝', label: 'Bishop' },
        { key: 'n', symbol: '♞', label: 'Knight' },
      ]
    : [
        { key: 'q', symbol: '♕', label: 'Queen' },
        { key: 'r', symbol: '♖', label: 'Rook' },
        { key: 'b', symbol: '♗', label: 'Bishop' },
        { key: 'n', symbol: '♘', label: 'Knight' },
      ]
  return (
    <div className="promotion-backdrop" role="presentation">
      <div
        ref={dialogRef}
        className="promotion-picker"
        role="dialog"
        aria-modal="true"
        aria-labelledby="promotion-title"
      >
        <div className="promotion-heading">
          <strong id="promotion-title">Promote pawn</strong>
          <button type="button" onClick={onCancel} aria-label="Cancel promotion"><X /></button>
        </div>
        <div className="promotion-options">
          {pieces.map((piece) => (
            <button
              type="button"
              key={piece.key}
              onClick={() => onSelect(piece.key)}
              aria-label={`Promote to ${piece.label}`}
              title={piece.label}
              data-dialog-initial={piece.key === 'q' ? 'true' : undefined}
            >
              <span>{piece.symbol}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

import { ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react'
import { BoardSurface } from './BoardSurface'
import { PlayerStrip } from './Identity'
import { MoveList } from './MoveList'

export function ReviewWorkspace({ controller }) {
  const {
    profile,
    player,
    humanColor,
    history,
    review,
    reviewProgress,
    reviewPly,
    setReviewPly,
    returnToSetup,
  } = controller
  const selected = review?.moments?.[Math.max(0, reviewPly - 1)] || null
  const progress = reviewProgress.total
    ? Math.round((reviewProgress.completed / reviewProgress.total) * 100)
    : 0
  return (
    <main className="review-page">
      <section className="review-board-column">
        <PlayerStrip profile={profile} side="top" />
        <div className="review-board-row">
          <EvaluationBar score={selected?.scoreAfter || 0} />
          <BoardSurface
            history={history}
            viewPly={reviewPly}
            orientation={humanColor}
            humanColor={humanColor}
            turnState="game-over"
            lastMove={selected ? uciSquares(selected.uci) : null}
            premove={null}
            selectedSquare={null}
            setSelectedSquare={() => {}}
            arrows={[]}
            setArrows={() => {}}
            onMove={() => false}
            interactive={false}
          />
        </div>
        <PlayerStrip player={player} side="bottom" />
      </section>
      <aside className="review-sidebar">
        <div className="review-heading">
          <div>
            <span className="eyebrow">Stockfish 18</span>
            <h1>Game Review</h1>
          </div>
          <button type="button" className="icon-button" onClick={returnToSetup} title="New game"><RotateCcw /></button>
        </div>
        {!review ? (
          <section className="review-progress">
            <strong>{progress}%</strong>
            <div><span style={{ width: `${progress}%` }} /></div>
            <p>Reviewing move {Math.min(reviewProgress.completed + 1, reviewProgress.total || 1)} of {reviewProgress.total || history.length}</p>
          </section>
        ) : (
          <>
            <section className="accuracy-strip">
              <div><span>player</span><strong>{accuracyForHuman(review.accuracy, humanColor)}%</strong></div>
              <div><span>{profile.name}</span><strong>{accuracyForBot(review.accuracy, humanColor)}%</strong></div>
            </section>
            <EvaluationGraph graph={review.graph} activePly={reviewPly} onSelect={setReviewPly} />
            <MoveList
              history={history}
              activePly={reviewPly}
              onSelect={setReviewPly}
              onBack={() => setReviewPly((ply) => Math.max(0, ply - 1))}
              onForward={() => setReviewPly((ply) => Math.min(history.length, ply + 1))}
              title={review.result}
            />
            <MoveExplanation moment={selected} />
          </>
        )}
        <div className="review-nav">
          <button onClick={() => setReviewPly((ply) => Math.max(0, ply - 1))}><ChevronLeft /> Previous</button>
          <button onClick={() => setReviewPly((ply) => Math.min(history.length, ply + 1))}>Next <ChevronRight /></button>
        </div>
      </aside>
    </main>
  )
}

function EvaluationBar({ score }) {
  const white = Math.max(5, Math.min(95, 50 + score / 24))
  return (
    <div className="evaluation-bar" aria-label={`Evaluation ${formatScore(score)}`}>
      <span className="evaluation-number">{formatScore(score)}</span>
      <div className="evaluation-white" style={{ height: `${white}%` }} />
    </div>
  )
}

function EvaluationGraph({ graph = [], activePly, onSelect }) {
  const width = 640
  const height = 120
  const points = graph.map((point, index) => {
    const x = graph.length <= 1 ? 0 : index / (graph.length - 1) * width
    const y = height / 2 - Math.max(-1000, Math.min(1000, point.score)) / 2000 * height
    return `${x},${y}`
  }).join(' ')
  return (
    <div className="evaluation-graph">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Evaluation graph">
        <line x1="0" y1={height / 2} x2={width} y2={height / 2} />
        <polyline points={points} />
      </svg>
      <input
        type="range"
        min="0"
        max={Math.max(0, graph.length - 1)}
        value={activePly}
        onChange={(event) => onSelect(Number(event.target.value))}
        aria-label="Review move"
      />
    </div>
  )
}

function MoveExplanation({ moment }) {
  if (!moment) return <section className="move-explanation"><p>Select a move to inspect it.</p></section>
  return (
    <section className="move-explanation" style={{ '--classification': moment.color }}>
      <div className="classification-title">
        <img src={moment.icon} alt="" />
        <div><strong>{moment.san}</strong><span>{moment.label}</span></div>
      </div>
      <p>{moment.explanation}</p>
      <dl>
        <div><dt>Best move</dt><dd>{moment.bestMove || '—'}</dd></div>
        <div><dt>Evaluation change</dt><dd>{moment.evaluationChange === null ? '—' : `${moment.evaluationChange} cp`}</dd></div>
        <div><dt>Principal variation</dt><dd>{moment.bestLine?.slice(0, 6).join(' ') || '—'}</dd></div>
      </dl>
    </section>
  )
}

function accuracyForHuman(accuracy, humanColor) {
  return humanColor === 'white' ? accuracy.white ?? 0 : accuracy.black ?? 0
}

function accuracyForBot(accuracy, humanColor) {
  return humanColor === 'white' ? accuracy.black ?? 0 : accuracy.white ?? 0
}

function uciSquares(uci) {
  return uci ? { from: uci.slice(0, 2), to: uci.slice(2, 4) } : null
}

function formatScore(score) {
  const pawns = Math.abs(score / 100).toFixed(1)
  return score >= 0 ? pawns : `-${pawns}`
}

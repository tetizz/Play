import { useState } from 'react'
import { ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react'
import { BoardSurface } from './BoardSurface'
import { Avatar, PlayerStrip } from './Identity'
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
  const [activeTab, setActiveTab] = useState('summary')
  const selected = review?.moments?.[Math.max(0, reviewPly - 1)] || null
  const activePoint = review?.graph?.[reviewPly] || review?.graph?.[0] || null
  const progress = reviewProgress.total
    ? Math.round((reviewProgress.completed / reviewProgress.total) * 100)
    : 0

  return (
    <main className="review-page">
      <section className="review-board-column">
        <PlayerStrip profile={profile} side="top" />
        <div className="review-board-row">
          <EvaluationBar point={activePoint} />
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
            <span className="eyebrow">{review?.engine || 'Stockfish 18'}</span>
            <h1>Game Review</h1>
            {review ? <p>{review.result}</p> : null}
          </div>
          <button type="button" className="icon-button" onClick={returnToSetup} title="New game">
            <RotateCcw />
          </button>
        </div>

        {!review ? (
          <section className="review-progress">
            <strong>{progress}%</strong>
            <div><span style={{ width: `${progress}%` }} /></div>
            <p>
              Reviewing move {Math.min(reviewProgress.completed + 1, reviewProgress.total || 1)}
              {' '}of {reviewProgress.total || history.length}
            </p>
          </section>
        ) : (
          <>
            <div className="review-tabs" role="tablist" aria-label="Game review views">
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'summary'}
                className={activeTab === 'summary' ? 'active' : ''}
                onClick={() => setActiveTab('summary')}
              >
                Summary
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'moves'}
                className={activeTab === 'moves' ? 'active' : ''}
                onClick={() => setActiveTab('moves')}
              >
                Review moves
              </button>
            </div>

            <div className="review-scroll">
              {activeTab === 'summary' ? (
                <ReviewSummary
                  review={review}
                  profile={profile}
                  humanColor={humanColor}
                  activePly={reviewPly}
                  onSelect={setReviewPly}
                />
              ) : (
                <MoveReview
                  review={review}
                  history={history}
                  activePly={reviewPly}
                  selected={selected}
                  onSelect={setReviewPly}
                />
              )}
            </div>
          </>
        )}

        <div className="review-nav">
          <button
            type="button"
            onClick={() => setReviewPly((ply) => Math.max(0, ply - 1))}
            disabled={!review || reviewPly <= 0}
          >
            <ChevronLeft /> Previous
          </button>
          <button
            type="button"
            onClick={() => setReviewPly((ply) => Math.min(history.length, ply + 1))}
            disabled={!review || reviewPly >= history.length}
          >
            Next <ChevronRight />
          </button>
        </div>
      </aside>
    </main>
  )
}

function ReviewSummary({ review, profile, humanColor, activePly, onSelect }) {
  const humanSide = humanColor === 'white' ? 'white' : 'black'
  const botSide = humanSide === 'white' ? 'black' : 'white'
  return (
    <div className="review-summary">
      <EvaluationGraph graph={review.graph} activePly={activePly} onSelect={onSelect} />

      <section className="review-scoreboard" aria-label="Player accuracy">
        <span className="scoreboard-label">Players</span>
        <SummaryIdentity type="player" name="player" />
        <SummaryIdentity type="bot" name={profile.name} profile={profile} />
        <span className="scoreboard-label">Accuracy</span>
        <strong className="summary-metric player-metric">{formatAccuracy(review.accuracy[humanSide])}</strong>
        <strong className="summary-metric bot-metric">{formatAccuracy(review.accuracy[botSide])}</strong>
      </section>

      <section className="classification-breakdown" aria-labelledby="classification-title">
        <h2 id="classification-title">Move classifications</h2>
        {review.counts.filter((item) => item.key !== 'forced').map((item) => (
          <div className="classification-row" key={item.key}>
            <span className="classification-label">{item.label}</span>
            <strong style={{ color: item.color }}>{item[humanSide]}</strong>
            <img src={item.icon} alt="" />
            <strong style={{ color: item.color }}>{item[botSide]}</strong>
          </div>
        ))}
      </section>

      <section className="phase-performance" aria-labelledby="phase-title">
        <h2 id="phase-title">Game performance</h2>
        <div className="game-rating-row">
          <span>Game rating</span>
          <strong>{review.gameRating[humanSide] ?? '-'}</strong>
          <strong>{review.gameRating[botSide] ?? '-'}</strong>
        </div>
        {['opening', 'middlegame', 'endgame'].map((phase) => (
          <PhaseRow
            key={phase}
            label={capitalize(phase)}
            player={review.phaseAccuracy[humanSide][phase]}
            bot={review.phaseAccuracy[botSide][phase]}
          />
        ))}
      </section>
    </div>
  )
}

function SummaryIdentity({ type, name, profile }) {
  return (
    <div className={`summary-identity ${type}`}>
      {profile ? <Avatar profile={profile} size="medium" /> : <div className="summary-player-avatar" />}
      <strong>{name}</strong>
    </div>
  )
}

function PhaseRow({ label, player, bot }) {
  return (
    <div className="phase-row">
      <span>{label}</span>
      <PhaseGrade value={player} />
      <PhaseGrade value={bot} />
    </div>
  )
}

function PhaseGrade({ value }) {
  if (!value?.moves) return <span className="phase-empty">-</span>
  return (
    <span className="phase-grade" title={`${value.accuracy}% accuracy`}>
      {value.icon ? <img src={value.icon} alt="" /> : null}
      <strong style={{ color: value.color }}>{formatAccuracy(value.accuracy)}</strong>
    </span>
  )
}

function MoveReview({ review, history, activePly, selected, onSelect }) {
  return (
    <div className="move-review">
      <EvaluationGraph graph={review.graph} activePly={activePly} onSelect={onSelect} />
      <MoveList
        history={history}
        activePly={activePly}
        onSelect={onSelect}
        onBack={() => onSelect(Math.max(0, activePly - 1))}
        onForward={() => onSelect(Math.min(history.length, activePly + 1))}
        title="Moves"
      />
      <MoveExplanation moment={selected} />
    </div>
  )
}

function EvaluationBar({ point }) {
  const white = point?.percent ?? 50
  return (
    <div
      className="evaluation-bar"
      aria-label={`Evaluation ${formatEvaluation(point)}`}
      data-eval-percent={white}
    >
      <span className={`evaluation-number ${white >= 50 ? 'on-black' : 'on-white'}`}>
        {formatEvaluation(point)}
      </span>
      <div className="evaluation-white" style={{ height: `${white}%` }} />
    </div>
  )
}

function EvaluationGraph({ graph = [], activePly, onSelect }) {
  const width = 640
  const height = 132
  const highlighted = new Set(['brilliant', 'great', 'mistake', 'miss', 'blunder'])
  const coordinates = graph.map((point, index) => {
    const x = graph.length <= 1 ? 0 : index / (graph.length - 1) * width
    const y = height - ((point.percent ?? 50) / 100) * height
    return { x, y, point }
  })
  const active = coordinates[Math.min(activePly, Math.max(0, coordinates.length - 1))]
  const stepLine = buildStepPath(coordinates)
  const whiteArea = coordinates.length
    ? `${stepLine} L ${width} ${height} L 0 ${height} Z`
    : ''
  return (
    <section className="evaluation-graph" data-eval-percent={active?.point.percent ?? 50}>
      <div className="graph-heading">
        <h2>Evaluation</h2>
        <strong>{formatEvaluation(active?.point)}</strong>
      </div>
      <div className="graph-canvas">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="none"
          role="img"
          aria-label="Evaluation graph"
        >
          <path className="evaluation-white-area" d={whiteArea} />
          <line className="evaluation-equal-line" x1="0" y1={height / 2} x2={width} y2={height / 2} />
          <path className="evaluation-line" d={stepLine} />
          {coordinates.filter(({ point }) => highlighted.has(point.classification)).map(({ x, y, point }) => (
            <circle
              className="evaluation-event"
              key={point.ply}
              cx={x}
              cy={y}
              r="7"
              fill={point.color}
            >
              <title>{`${point.classification} on move ${Math.ceil(point.ply / 2)}`}</title>
            </circle>
          ))}
          {active ? <circle className="evaluation-active" cx={active.x} cy={active.y} r="7" /> : null}
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
    </section>
  )
}

function MoveExplanation({ moment }) {
  if (!moment) {
    return (
      <section className="move-explanation">
        <h2>Starting position</h2>
        <p>Select a move to inspect the engine evaluation and tactical idea.</p>
      </section>
    )
  }
  return (
    <section className="move-explanation" style={{ '--classification': moment.color }}>
      <div className="classification-title">
        <img src={moment.icon} alt="" />
        <div>
          <strong>{moment.san}</strong>
          <span>{moment.label}</span>
        </div>
      </div>
      <p>{moment.explanation}</p>
      <dl>
        <div><dt>Best move</dt><dd>{moment.bestMoveSan || '-'}</dd></div>
        <div><dt>Evaluation</dt><dd>{formatMomentEvaluation(moment)}</dd></div>
        <div><dt>Evaluation change</dt><dd>{formatChange(moment.evaluationChange)}</dd></div>
        <div><dt>Principal variation</dt><dd>{moment.bestLineSan?.slice(0, 8).join(' ') || '-'}</dd></div>
      </dl>
    </section>
  )
}

function formatAccuracy(value) {
  return Number.isFinite(value) ? `${value.toFixed(1)}%` : '-'
}

function formatMomentEvaluation(moment) {
  return formatEvaluation({ score: moment.scoreAfter, mate: moment.mateAfter })
}

function formatChange(value) {
  if (!Number.isFinite(value)) return '-'
  const pawns = value / 100
  return `${pawns >= 0 ? '+' : ''}${pawns.toFixed(2)}`
}

function formatEvaluation(point) {
  if (Number.isFinite(point?.mate)) {
    return point.mate > 0 ? `M${point.mate}` : `-M${Math.abs(point.mate)}`
  }
  const score = Number(point?.score || 0) / 100
  return `${score >= 0 ? '+' : ''}${score.toFixed(1)}`
}

function buildStepPath(coordinates) {
  if (!coordinates.length) return ''
  let path = `M ${coordinates[0].x} ${coordinates[0].y}`
  for (let index = 1; index < coordinates.length; index += 1) {
    path += ` H ${coordinates[index].x} V ${coordinates[index].y}`
  }
  return path
}

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function uciSquares(uci) {
  return uci ? { from: uci.slice(0, 2), to: uci.slice(2, 4) } : null
}

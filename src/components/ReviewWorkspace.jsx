import { useEffect, useRef, useState } from 'react'
import { Check, ChevronLeft, ChevronRight, Copy, RotateCcw, Share2, X } from 'lucide-react'
import { BoardSurface } from './BoardSurface'
import { Avatar, PlayerStrip } from './Identity'
import { MoveList } from './MoveList'
import { buildSmoothPath, evaluationBarDisplay } from '../lib/evaluationGraph'
import { buildGamePgn } from '../lib/pgnExport'

export function ReviewWorkspace({ controller }) {
  const {
    profile,
    player,
    gameMode,
    whiteProfile,
    blackProfile,
    humanColor,
    boardOrientation,
    history,
    review,
    reviewProgress,
    reviewPly,
    setReviewPly,
    returnToSetup,
  } = controller
  const [activeTab, setActiveTab] = useState('summary')
  const [shareStatus, setShareStatus] = useState('')
  const [sharedPgn, setSharedPgn] = useState('')
  const reviewScrollRef = useRef(null)
  const pgnTextRef = useRef(null)
  const selected = review?.moments?.[Math.max(0, reviewPly - 1)] || null
  const activePoint = review?.graph?.[reviewPly] || review?.graph?.[0] || null
  const progress = reviewProgress.total
    ? Math.round((reviewProgress.completed / reviewProgress.total) * 100)
    : 0

  useEffect(() => {
    reviewScrollRef.current?.scrollTo({ top: 0 })
  }, [activeTab])

  const selectClassification = (side, key) => {
    const moveSide = side === 'white' ? 'w' : 'b'
    const firstMatch = review?.moments?.find((moment) =>
      moment.side === moveSide && moment.key === key,
    )
    if (!firstMatch) return
    setReviewPly(firstMatch.ply)
    setActiveTab('moves')
  }

  const openPgn = () => {
    const pgn = buildGamePgn({
      history,
      result: review?.result,
      gameMode,
      humanColor,
      player,
      profile,
      whiteProfile,
      blackProfile,
    })
    setSharedPgn(pgn)
    setShareStatus('')
    requestAnimationFrame(() => {
      pgnTextRef.current?.focus()
      pgnTextRef.current?.select()
    })
  }

  const copyPgn = async () => {
    try {
      await navigator.clipboard.writeText(sharedPgn)
      setShareStatus('PGN copied')
    } catch {
      pgnTextRef.current?.focus()
      pgnTextRef.current?.select()
      const copied = document.execCommand('copy')
      setShareStatus(copied ? 'PGN copied' : 'PGN selected. Press Ctrl+C to copy.')
    }
  }

  return (
    <main className="review-page">
      <section className="review-board-column">
        <PlayerStrip profile={gameMode === 'bots' ? blackProfile : profile} side="top" />
        <div className="review-board-row">
          <EvaluationBar
            point={activePoint}
            result={review?.result}
            isFinal={Boolean(review && reviewPly === history.length)}
          />
          <BoardSurface
            history={history}
            viewPly={reviewPly}
            orientation={boardOrientation}
            humanColor={humanColor}
            turnState="game-over"
            lastMove={selected ? uciSquares(selected.uci) : null}
            premoves={[]}
            selectedSquare={null}
            setSelectedSquare={() => {}}
            arrows={[]}
            setArrows={() => {}}
            onMove={() => false}
            interactive={false}
          />
        </div>
        {gameMode === 'bots'
          ? <PlayerStrip profile={whiteProfile} side="bottom" />
          : <PlayerStrip player={player} side="bottom" />}
      </section>

      <aside className="review-sidebar">
        <div className="review-heading">
          <div>
            <span className="eyebrow">{review?.engine || 'Stockfish 18'}</span>
            <h1>Game Review</h1>
            {review ? <p>{review.result}</p> : null}
          </div>
          <div className="review-heading-actions">
            <div className="review-action-buttons">
              <button
                type="button"
                className="icon-button"
                onClick={openPgn}
                title="Share PGN"
                aria-label="Share PGN"
                disabled={!review}
              >
                <Share2 />
              </button>
              <button
                type="button"
                className="icon-button"
                onClick={returnToSetup}
                title="New game"
                aria-label="New game"
              >
                <RotateCcw />
              </button>
            </div>
          </div>
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

            <div className="review-scroll" ref={reviewScrollRef}>
              {activeTab === 'summary' ? (
                <ReviewSummary
                  review={review}
                  profile={profile}
                  gameMode={gameMode}
                  whiteProfile={whiteProfile}
                  blackProfile={blackProfile}
                  humanColor={humanColor}
                  activePly={reviewPly}
                  onSelect={setReviewPly}
                  onSelectClassification={selectClassification}
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
      {sharedPgn ? (
        <div
          className="pgn-share-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setSharedPgn('')
          }}
        >
          <section
            className="pgn-share-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="pgn-share-title"
          >
            <header>
              <div>
                <span className="eyebrow">Game record</span>
                <h2 id="pgn-share-title">Copy PGN</h2>
              </div>
              <button
                type="button"
                className="icon-button"
                onClick={() => setSharedPgn('')}
                title="Close PGN"
                aria-label="Close PGN"
              >
                <X />
              </button>
            </header>
            <p>Select any part of the game record, or copy the complete PGN.</p>
            <textarea
              ref={pgnTextRef}
              value={sharedPgn}
              readOnly
              aria-label="PGN text"
              spellCheck="false"
            />
            <footer>
              <span className="pgn-copy-status" aria-live="polite">{shareStatus}</span>
              <button type="button" className="primary-button pgn-copy-button" onClick={copyPgn}>
                {shareStatus === 'PGN copied' ? <Check /> : <Copy />}
                {shareStatus === 'PGN copied' ? 'Copied' : 'Copy PGN'}
              </button>
            </footer>
          </section>
        </div>
      ) : null}
    </main>
  )
}

function ReviewSummary({
  review,
  profile,
  gameMode,
  whiteProfile,
  blackProfile,
  humanColor,
  activePly,
  onSelect,
  onSelectClassification,
}) {
  const botMatch = gameMode === 'bots'
  const leftSide = botMatch ? 'white' : humanColor === 'white' ? 'white' : 'black'
  const rightSide = botMatch ? 'black' : leftSide === 'white' ? 'black' : 'white'
  return (
    <div className="review-summary">
      <EvaluationGraph graph={review.graph} activePly={activePly} onSelect={onSelect} />

      <section className="review-scoreboard" aria-label="Player accuracy">
        <span className="scoreboard-label">Players</span>
        {botMatch
          ? <SummaryIdentity type="white-bot" name={whiteProfile.name} profile={whiteProfile} />
          : <SummaryIdentity type="player" name="player" />}
        <SummaryIdentity
          type={botMatch ? 'black-bot' : 'bot'}
          name={botMatch ? blackProfile.name : profile.name}
          profile={botMatch ? blackProfile : profile}
        />
        <span className="scoreboard-label">Accuracy</span>
        <strong className={`summary-metric ${botMatch ? 'white-metric' : 'player-metric'}`}>
          {formatAccuracy(review.accuracy[leftSide])}
        </strong>
        <strong className={`summary-metric ${botMatch ? 'black-metric' : 'bot-metric'}`}>
          {formatAccuracy(review.accuracy[rightSide])}
        </strong>
      </section>

      <section className="classification-breakdown" aria-labelledby="classification-title">
        <h2 id="classification-title">Move classifications</h2>
        {review.counts.filter((item) => item.key !== 'forced').map((item) => (
          <div className="classification-row" key={item.key}>
            <span className="classification-label">{item.label}</span>
            <ClassificationCount
              count={item[leftSide]}
              color={item.color}
              label={item.label}
              side={leftSide}
              onSelect={onSelectClassification}
              classification={item.key}
            />
            <img src={item.icon} alt="" />
            <ClassificationCount
              count={item[rightSide]}
              color={item.color}
              label={item.label}
              side={rightSide}
              onSelect={onSelectClassification}
              classification={item.key}
            />
          </div>
        ))}
      </section>

      <section className="phase-performance" aria-labelledby="phase-title">
        <h2 id="phase-title">Game performance</h2>
        <div className="game-rating-row">
          <span>Game rating</span>
          <strong>{review.gameRating[leftSide] ?? '-'}</strong>
          <strong>{review.gameRating[rightSide] ?? '-'}</strong>
        </div>
        {['opening', 'middlegame', 'endgame'].map((phase) => (
          <PhaseRow
            key={phase}
            label={capitalize(phase)}
            player={review.phaseAccuracy[leftSide][phase]}
            bot={review.phaseAccuracy[rightSide][phase]}
          />
        ))}
      </section>
    </div>
  )
}

function ClassificationCount({ count, color, label, side, classification, onSelect }) {
  const sideLabel = side === 'white' ? 'White' : 'Black'
  return (
    <button
      type="button"
      className="classification-count"
      style={{ color }}
      disabled={!count}
      aria-label={`${sideLabel} ${label}: ${count}. Go to first occurrence.`}
      onClick={() => onSelect(side, classification)}
    >
      {count}
    </button>
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
      <MoveExplanation moment={selected} />
      <EvaluationGraph graph={review.graph} activePly={activePly} onSelect={onSelect} />
      <MoveList
        history={history}
        activePly={activePly}
        onSelect={onSelect}
        onBack={() => onSelect(Math.max(0, activePly - 1))}
        onForward={() => onSelect(Math.min(history.length, activePly + 1))}
        title="Moves"
      />
    </div>
  )
}

function EvaluationBar({ point, result, isFinal }) {
  const display = evaluationBarDisplay(point, result, isFinal)
  return (
    <div
      className="evaluation-bar"
      aria-label={`Evaluation ${formatEvaluation(point)}`}
      data-eval-percent={display.percent}
      style={{ '--white-share': display.percent / 100 }}
    >
      <span className={`evaluation-number on-${display.side}`}>
        {display.label}
      </span>
      <div className="evaluation-white" />
      <div className="evaluation-divider" style={{ bottom: `${display.percent}%` }} />
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
  const curve = buildSmoothPath(coordinates, width)
  const whiteArea = coordinates.length
    ? `${curve} L ${width} ${height} L 0 ${height} Z`
    : ''
  const selectFromPointer = (event) => {
    if (graph.length <= 1) return
    const bounds = event.currentTarget.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width))
    onSelect(Math.round(ratio * (graph.length - 1)))
  }
  const selectFromKeyboard = (event) => {
    if (event.key === 'ArrowLeft') {
      event.preventDefault()
      onSelect(Math.max(0, activePly - 1))
    } else if (event.key === 'ArrowRight') {
      event.preventDefault()
      onSelect(Math.min(graph.length - 1, activePly + 1))
    }
  }
  return (
    <section className="evaluation-graph" data-eval-percent={active?.point.percent ?? 50}>
      <div className="graph-heading">
        <h2>Evaluation</h2>
        <strong>{formatEvaluation(active?.point)}</strong>
      </div>
      <div
        className="graph-canvas"
        role="slider"
        tabIndex={0}
        aria-label="Review move"
        aria-valuemin={0}
        aria-valuemax={Math.max(0, graph.length - 1)}
        aria-valuenow={activePly}
        onPointerDown={selectFromPointer}
        onKeyDown={selectFromKeyboard}
      >
        <svg
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="none"
          role="img"
          aria-label="Evaluation graph"
        >
          <path className="evaluation-white-area" d={whiteArea} />
          <line className="evaluation-equal-line" x1="0" y1={height / 2} x2={width} y2={height / 2} />
          <path className="evaluation-line" d={curve} />
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
          {active && graph.length > 1
            ? <circle className="evaluation-active" cx={active.x} cy={active.y} r="7" />
            : null}
        </svg>
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
        {moment.icon ? <img src={moment.icon} alt="" /> : null}
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

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function uciSquares(uci) {
  return uci ? { from: uci.slice(0, 2), to: uci.slice(2, 4) } : null
}

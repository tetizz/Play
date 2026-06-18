import { useEffect, useMemo, useState } from 'react'
import { Chessboard } from 'react-chessboard'
import {
  ArrowLeft,
  CheckCircle2,
  CircleDot,
  Crown,
  RefreshCcw,
  ShieldCheck,
  Swords,
  XCircle,
} from 'lucide-react'

const ACCESS_HASH = '1837b7ef406cf9b5df3881d89befd025b3a892597c2f0f4651f568e242817055'
const ACCESS_STORAGE_KEY = 'bad-manners-dashboard-access'
const CATEGORY_LABELS = {
  'minor-promotion': 'Bishop/knight promotion',
  'surplus-sacrifice': 'Surplus disposal',
  'win-enemy-piece': 'Enemy piece wins',
  'pawn-race-geometry': 'Pawn geometry',
}

const CATEGORY_ICONS = {
  'minor-promotion': Crown,
  'surplus-sacrifice': Swords,
  'win-enemy-piece': ShieldCheck,
  'pawn-race-geometry': CircleDot,
}

const REPORT_URL = `${import.meta.env.BASE_URL}private/bad-manners-kbnk-trixize-200.json`

export function BadMannersDashboard({ onBack }) {
  const [accessGranted, setAccessGranted] = useState(() =>
    localStorage.getItem(ACCESS_STORAGE_KEY) === ACCESS_HASH,
  )
  const [accessInput, setAccessInput] = useState('')
  const [accessError, setAccessError] = useState('')
  const [report, setReport] = useState(null)
  const [status, setStatus] = useState('loading')
  const [activeCategory, setActiveCategory] = useState('all')
  const [selectedId, setSelectedId] = useState(null)

  useEffect(() => {
    if (!accessGranted) return undefined
    let cancelled = false
    async function loadReport() {
      setStatus('loading')
      try {
        const response = await fetch(REPORT_URL, { cache: 'no-store' })
        if (!response.ok) throw new Error('missing report')
        const payload = await response.json()
        if (!cancelled) {
          setReport(payload)
          setStatus('ready')
          setSelectedId(payload.failures?.[0]?.id || payload.results?.[0]?.id || null)
        }
      } catch {
        if (!cancelled) setStatus('missing')
      }
    }
    loadReport()
    return () => {
      cancelled = true
    }
  }, [accessGranted])

  const categories = useMemo(() => {
    if (!report?.byCategory) return []
    return Object.entries(report.byCategory).map(([key, value]) => ({ key, ...value }))
  }, [report])

  const visibleResults = useMemo(() => {
    const results = report?.results || []
    const pool = activeCategory === 'all'
      ? results
      : results.filter((result) => result.category === activeCategory)
    return [...pool].sort((a, b) => Number(a.pass) - Number(b.pass)).slice(0, 24)
  }, [activeCategory, report])

  const selected = useMemo(() => {
    const results = report?.results || []
    return results.find((result) => result.id === selectedId) ||
      visibleResults[0] ||
      null
  }, [report, selectedId, visibleResults])

  const passRate = report?.total ? Math.round((report.passed / report.total) * 100) : 0

  return (
    <main className="bad-manners-page">
      <header className="bad-manners-topbar">
        <button type="button" className="icon-button" onClick={onBack} aria-label="Back to setup" title="Back">
          <ArrowLeft />
        </button>
        <div>
          <span className="eyebrow">Bad Manners Stockfish</span>
          <h1>KBNK Conversion Gauntlet</h1>
        </div>
        {accessGranted ? (
          <a className="gauntlet-report-link" href={REPORT_URL} target="_blank" rel="noreferrer">
            JSON
          </a>
        ) : (
          <span className="gauntlet-report-link locked">Locked</span>
        )}
      </header>

      {!accessGranted ? (
        <AccessPanel
          value={accessInput}
          error={accessError}
          onChange={setAccessInput}
          onSubmit={async () => {
            const normalized = accessInput.trim()
            const hash = await sha256(normalized)
            if (hash !== ACCESS_HASH) {
              setAccessError('Key rejected')
              return
            }
            localStorage.setItem(ACCESS_STORAGE_KEY, hash)
            setAccessError('')
            setAccessGranted(true)
          }}
        />
      ) : status === 'missing' ? (
        <section className="gauntlet-empty">
          <XCircle />
          <h2>No report found</h2>
          <code>npm run test:bad-manners</code>
        </section>
      ) : (
        <div className="gauntlet-layout">
          <section className="gauntlet-overview">
            <div className="gauntlet-score">
              <div className="score-ring" style={{ '--score': `${passRate}%` }}>
                <strong>{status === 'loading' ? '--' : `${passRate}%`}</strong>
              </div>
              <div>
                <h2>{status === 'loading' ? 'Loading' : `${report.passed}/${report.total}`}</h2>
                <p>{status === 'loading' ? 'Reading latest report' : `${report.failed} failed`}</p>
              </div>
            </div>
            <div className="gauntlet-meta">
              <Metric label="Depth" value={report?.depth ?? '--'} />
              <Metric label="Move time" value={report?.moveTime ? `${report.moveTime}ms` : '--'} />
              <Metric label="Engine" value={engineName(report?.enginePath)} />
            </div>
          </section>

          <section className="gauntlet-categories" aria-label="Gauntlet categories">
            <CategoryButton
              category={{ key: 'all', total: report?.total || 0, passed: report?.passed || 0, failed: report?.failed || 0 }}
              active={activeCategory === 'all'}
              label="All"
              onSelect={() => setActiveCategory('all')}
            />
            {categories.map((category) => (
              <CategoryButton
                key={category.key}
                category={category}
                active={activeCategory === category.key}
                label={CATEGORY_LABELS[category.key] || category.key}
                onSelect={() => setActiveCategory(category.key)}
              />
            ))}
          </section>

          <section className="gauntlet-detail">
            <div className="gauntlet-list" aria-label="Gauntlet positions">
              {visibleResults.map((result) => (
                <button
                  type="button"
                  key={result.id}
                  className={[
                    result.id === selected?.id ? 'selected' : '',
                    result.pass ? 'pass' : 'fail',
                  ].filter(Boolean).join(' ')}
                  onClick={() => setSelectedId(result.id)}
                >
                  {result.pass ? <CheckCircle2 /> : <XCircle />}
                  <span>
                    <strong>{result.id}</strong>
                    <small>{result.selectedSan || result.selectedUci || 'No move'}</small>
                  </span>
                  <em>{result.score ?? '--'}</em>
                </button>
              ))}
            </div>

            <article className="gauntlet-position">
              {selected ? (
                <>
                  <FenBoard result={selected} />
                  <div className="position-heading">
                    <div>
                      <span className="eyebrow">{CATEGORY_LABELS[selected.category] || selected.category}</span>
                      <h2>{selected.id}</h2>
                    </div>
                    <StatusPill pass={selected.pass} />
                  </div>
                  <dl>
                    <div>
                      <dt>Move</dt>
                      <dd>{selected.selectedSan || selected.selectedUci || 'None'}</dd>
                    </div>
                    <div>
                      <dt>Source</dt>
                      <dd>{selected.source || 'None'}</dd>
                    </div>
                    <div>
                      <dt>Score</dt>
                      <dd>{selected.score ?? 'None'}</dd>
                    </div>
                    <div>
                      <dt>Reason</dt>
                      <dd>{selected.reason}</dd>
                    </div>
                    <div>
                      <dt>FEN</dt>
                      <dd><code>{selected.fen}</code></dd>
                    </div>
                    <div>
                      <dt>Search moves</dt>
                      <dd>{selected.searchMoves?.length ? selected.searchMoves.join(' ') : 'Full legal move set'}</dd>
                    </div>
                  </dl>
                </>
              ) : (
                <div className="gauntlet-loading">
                  <RefreshCcw />
                  <span>Loading report</span>
                </div>
              )}
            </article>
          </section>
        </div>
      )}
    </main>
  )
}

function AccessPanel({ value, error, onChange, onSubmit }) {
  return (
    <section className="gauntlet-access" aria-label="Bad Manners dashboard access">
      <ShieldCheck />
      <div>
        <span className="eyebrow">Private report</span>
        <h2>Enter access key</h2>
      </div>
      <form
        onSubmit={(event) => {
          event.preventDefault()
          onSubmit()
        }}
      >
        <input
          type="password"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete="off"
          aria-label="Access key"
        />
        <button type="submit">Unlock</button>
      </form>
      {error ? <p>{error}</p> : null}
    </section>
  )
}

function FenBoard({ result }) {
  const move = parseUci(result.selectedUci)
  const squareStyles = move
    ? {
        [move.from]: highlight('#e5c04d99'),
        [move.to]: highlight('#79b84a99'),
      }
    : {}
  return (
    <div className="gauntlet-board-wrap" aria-label="Selected test board">
      <div className="gauntlet-board">
        <Chessboard options={{
          id: `bad-manners-${result.id}`,
          position: result.fen,
          boardOrientation: 'white',
          boardStyle: { borderRadius: 0 },
          lightSquareStyle: { backgroundColor: '#daba6d' },
          darkSquareStyle: { backgroundColor: '#a56f3d' },
          squareStyles,
          arrows: move ? [{ startSquare: move.from, endSquare: move.to, color: '#7baa43' }] : [],
          allowDrawingArrows: false,
          allowDragging: false,
          canDragPiece: () => false,
          animationDurationInMs: 0,
        }} />
      </div>
      <div>
        <span>{result.selectedSan || result.selectedUci || 'No move'}</span>
        <strong>{CATEGORY_LABELS[result.category] || result.category}</strong>
      </div>
    </div>
  )
}

function Metric({ label, value }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function CategoryButton({ category, active, label, onSelect }) {
  const Icon = CATEGORY_ICONS[category.key] || CheckCircle2
  return (
    <button type="button" className={active ? 'active' : ''} onClick={onSelect}>
      <Icon />
      <span>
        <strong>{label}</strong>
        <small>{category.passed}/{category.total}</small>
      </span>
      <em>{category.failed}</em>
    </button>
  )
}

function StatusPill({ pass }) {
  return (
    <span className={`status-pill ${pass ? 'pass' : 'fail'}`}>
      {pass ? <CheckCircle2 /> : <XCircle />}
      {pass ? 'Passed' : 'Failed'}
    </span>
  )
}

function engineName(enginePath) {
  if (!enginePath) return '--'
  return String(enginePath).split(/[\\/]/).pop()
}

function parseUci(uci) {
  if (!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(uci || '')) return null
  return { from: uci.slice(0, 2), to: uci.slice(2, 4) }
}

function highlight(color) {
  return { backgroundColor: color }
}

async function sha256(value) {
  const bytes = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

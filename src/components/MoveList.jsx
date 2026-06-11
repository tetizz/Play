import { ChevronLeft, ChevronRight } from 'lucide-react'

export function MoveList({ history, activePly, onSelect, onBack, onForward, title = 'Moves' }) {
  const rows = []
  for (let index = 0; index < history.length; index += 2) {
    rows.push({ number: index / 2 + 1, white: history[index], black: history[index + 1] })
  }
  return (
    <section className="move-panel">
      <div className="move-panel-header">
        <h2>{title}</h2>
        <div className="history-controls">
          <button type="button" aria-label="Previous move" onClick={onBack}><ChevronLeft /></button>
          <button type="button" aria-label="Next move" onClick={onForward}><ChevronRight /></button>
        </div>
      </div>
      <div className="move-table">
        {rows.length ? rows.map((row) => (
          <div className="move-row" key={row.number}>
            <span className="move-number">{row.number}.</span>
            <button className={activePly === row.number * 2 - 1 ? 'active' : ''} onClick={() => onSelect(row.number * 2 - 1)}>{row.white}</button>
            <button className={activePly === row.number * 2 ? 'active' : ''} onClick={() => onSelect(row.number * 2)}>{row.black}</button>
          </div>
        )) : <p className="empty-moves">The moves will appear here.</p>}
      </div>
    </section>
  )
}

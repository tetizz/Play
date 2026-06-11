export function buildSmoothPath(coordinates) {
  if (!coordinates.length) return ''
  let path = `M ${coordinates[0].x} ${coordinates[0].y}`
  for (let index = 1; index < coordinates.length; index += 1) {
    const previous = coordinates[index - 1]
    const current = coordinates[index]
    const controlDistance = (current.x - previous.x) * 0.42
    path += [
      ' C',
      previous.x + controlDistance,
      previous.y,
      current.x - controlDistance,
      current.y,
      current.x,
      current.y,
    ].join(' ')
  }
  return path
}

export function evaluationBarDisplay(point, result = '', isFinal = false) {
  if (isFinal && /white wins/i.test(result)) {
    return { percent: 100, label: '1-0', side: 'white' }
  }
  if (isFinal && /black wins/i.test(result)) {
    return { percent: 0, label: '0-1', side: 'black' }
  }
  if (isFinal && /draw/i.test(result)) {
    return { percent: 50, label: '½-½', side: 'white' }
  }

  const percent = point?.percent ?? 50
  if (Number.isFinite(point?.mate)) {
    return {
      percent,
      label: `M${Math.abs(point.mate)}`,
      side: point.mate > 0 ? 'white' : 'black',
    }
  }

  const score = Number(point?.score || 0) / 100
  return {
    percent,
    label: Math.abs(score).toFixed(1),
    side: score < 0 ? 'black' : 'white',
  }
}

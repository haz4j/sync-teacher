type Props = {
  bpm: number
  running: boolean
  legsOnly: boolean
  onBpmChange: (bpm: number) => void
  onToggle: () => void
  onReset: () => void
  onLegsOnlyChange: (value: boolean) => void
}

export function MetronomeControls({
  bpm,
  running,
  legsOnly,
  onBpmChange,
  onToggle,
  onReset,
  onLegsOnlyChange,
}: Props) {
  return (
    <div className="controls">
      <label className="bpm-control">
        <span className="bpm-label">BPM</span>
        <input
          type="range"
          min={60}
          max={140}
          step={1}
          value={bpm}
          onChange={(e) => onBpmChange(Number(e.target.value))}
        />
        <span className="bpm-value">{bpm}</span>
      </label>
      <label className="toggle-control">
        <input
          type="checkbox"
          checked={legsOnly}
          onChange={(e) => onLegsOnlyChange(e.target.checked)}
        />
        <span>Только ноги</span>
      </label>
      <button
        type="button"
        className={`btn-primary${running ? ' running' : ''}`}
        onClick={onToggle}
      >
        {running ? 'Стоп' : 'Старт'}
      </button>
      <button type="button" className="btn-secondary" onClick={onReset}>
        Сначала
      </button>
    </div>
  )
}

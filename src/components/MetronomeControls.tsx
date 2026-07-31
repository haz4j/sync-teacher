type Props = {
  bpm: number
  running: boolean
  windowMs: number
  latencyMs: number
  onBpmChange: (bpm: number) => void
  onToggle: () => void
  onReset: () => void
  onWindowMsChange: (value: number) => void
  onLatencyMsChange: (value: number) => void
}

export function MetronomeControls({
  bpm,
  running,
  windowMs,
  latencyMs,
  onBpmChange,
  onToggle,
  onReset,
  onWindowMsChange,
  onLatencyMsChange,
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
      <label className="bpm-control">
        <span className="bpm-label">Окно</span>
        <input
          type="range"
          min={80}
          max={350}
          step={10}
          value={windowMs}
          onChange={(e) => onWindowMsChange(Number(e.target.value))}
        />
        <span className="bpm-value">{windowMs} мс</span>
      </label>
      <label className="bpm-control">
        <span className="bpm-label">Задержка</span>
        <input
          type="range"
          min={0}
          max={250}
          step={10}
          value={latencyMs}
          onChange={(e) => onLatencyMsChange(Number(e.target.value))}
        />
        <span className="bpm-value">{latencyMs} мс</span>
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

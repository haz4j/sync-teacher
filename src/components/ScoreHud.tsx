import type { ScoreSnapshot } from '../lib/scorer'

type Props = {
  score: ScoreSnapshot
  feedback: 'hit' | 'miss' | null
  beatFlash: boolean
  stompFlash: boolean
}

function formatOffset(offsetMs: number | null): string {
  if (offsetMs === null) return ''
  if (Math.abs(offsetMs) < 25) return 'точно'
  return offsetMs < 0 ? `${Math.abs(offsetMs)} мс раньше` : `${offsetMs} мс позже`
}

export function ScoreHud({ score, feedback, beatFlash, stompFlash }: Props) {
  return (
    <div className="score-hud">
      <div className="hud-signals">
        <div
          className={`beat-pulse${beatFlash ? ' on' : ''}`}
          title="Бит метронома"
          aria-hidden
        />
        <div
          className={`detect-pulse${stompFlash ? ' on' : ''}`}
          title="Топ распознан камерой"
          aria-hidden
        />
      </div>
      <div className="score-main">
        <div className="score-stats">
          <div className="stat">
            <span className="stat-value">{score.accuracy}%</span>
            <span className="stat-label">точность</span>
          </div>
          <div className="stat">
            <span className="stat-value">{score.hits}</span>
            <span className="stat-label">попадания</span>
          </div>
          <div className="stat">
            <span className="stat-value">{score.misses}</span>
            <span className="stat-label">промахи</span>
          </div>
        </div>
        <div className="recent-row" aria-label="Последние результаты">
          {score.recent.length === 0 ? (
            <span className="recent-empty">лента пуста</span>
          ) : (
            score.recent.map((r, i) => (
              <span key={`${i}-${r}`} className={`recent-dot ${r}`} title={r === 'hit' ? 'попадание' : 'промах'} />
            ))
          )}
        </div>
        <div className="signal-legend">
          <span>оранжевый — бит</span>
          <span>бирюзовый — топ распознан</span>
        </div>
      </div>
      <div
        className={`feedback${feedback ? ` ${feedback}` : ''}`}
        aria-live="polite"
      >
        {feedback === 'hit' ? (
          <>
            В ритм!
            {score.lastOffsetMs !== null && (
              <span className="feedback-offset">
                {' '}
                ({formatOffset(score.lastOffsetMs)})
              </span>
            )}
          </>
        ) : feedback === 'miss' ? (
          'Мимо'
        ) : (
          '\u00a0'
        )}
      </div>
    </div>
  )
}

import type { ScoreSnapshot } from '../lib/scorer'

type Props = {
  score: ScoreSnapshot
  feedback: 'hit' | 'miss' | null
  beatFlash: boolean
}

function formatOffset(offsetMs: number | null): string {
  if (offsetMs === null) return ''
  if (Math.abs(offsetMs) < 25) return 'точно'
  return offsetMs < 0 ? `${Math.abs(offsetMs)} мс раньше` : `${offsetMs} мс позже`
}

export function ScoreHud({ score, feedback, beatFlash }: Props) {
  return (
    <div className="score-hud">
      <div className={`beat-pulse${beatFlash ? ' on' : ''}`} aria-hidden />
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

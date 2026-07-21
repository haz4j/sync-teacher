import type { ScoreSnapshot } from '../lib/scorer'

type Props = {
  score: ScoreSnapshot
  feedback: 'hit' | 'miss' | null
  beatFlash: boolean
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
        {feedback === 'hit' ? 'В ритм!' : feedback === 'miss' ? 'Мимо' : '\u00a0'}
      </div>
    </div>
  )
}

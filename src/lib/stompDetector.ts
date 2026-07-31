import type { Landmark } from './stickFigure'

const LEFT_ANKLE = 27
const RIGHT_ANKLE = 28
const LEFT_FOOT = 31
const RIGHT_FOOT = 32

export type StompEvent = {
  timeMs: number
  side: 'left' | 'right'
}

type FootState = {
  prevY: number | null
  prevT: number | null
  prevV: number | null
  startY: number | null
  rising: boolean
  cooldownUntil: number
}

/**
 * Detect foot stomps from ankle/foot landmark motion.
 * Triggers when the foot was moving down and then slows / reverses (impact).
 */
export class StompDetector {
  private left = this.fresh()
  private right = this.fresh()

  /** Normalized units / sec — permissive for webcam noise and small stomps. */
  private readonly minDownVelocity = 0.12
  private readonly impactVelocity = 0.08
  private readonly minDrop = 0.01
  private readonly cooldownMs = 220

  reset() {
    this.left = this.fresh()
    this.right = this.fresh()
  }

  update(landmarks: Landmark[] | null, timeMs: number): StompEvent | null {
    if (!landmarks) return null

    const leftY = this.footY(landmarks, LEFT_ANKLE, LEFT_FOOT)
    const rightY = this.footY(landmarks, RIGHT_ANKLE, RIGHT_FOOT)

    const leftHit = this.track(this.left, leftY, timeMs, 'left')
    if (leftHit) return leftHit

    return this.track(this.right, rightY, timeMs, 'right')
  }

  private fresh(): FootState {
    return {
      prevY: null,
      prevT: null,
      prevV: null,
      startY: null,
      rising: false,
      cooldownUntil: 0,
    }
  }

  private footY(
    landmarks: Landmark[],
    ankleIdx: number,
    footIdx: number,
  ): number | null {
    const ankle = landmarks[ankleIdx]
    const foot = landmarks[footIdx]
    const candidates = [ankle, foot].filter(
      (lm): lm is Landmark => !!lm && (lm.visibility ?? 1) >= 0.2,
    )
    if (!candidates.length) return null
    return Math.max(...candidates.map((lm) => lm.y))
  }

  private track(
    state: FootState,
    y: number | null,
    timeMs: number,
    side: 'left' | 'right',
  ): StompEvent | null {
    if (y === null) {
      state.prevY = null
      state.prevT = null
      state.prevV = null
      state.rising = false
      state.startY = null
      return null
    }

    let event: StompEvent | null = null

    if (state.prevY !== null && state.prevT !== null) {
      const dt = (timeMs - state.prevT) / 1000
      if (dt > 0.001 && dt < 0.25) {
        const v = (y - state.prevY) / dt

        if (v > this.minDownVelocity) {
          if (!state.rising) {
            state.rising = true
            state.startY = state.prevY
          }
        }

        const drop =
          state.startY !== null ? y - state.startY : 0
        const impact =
          state.rising &&
          state.prevV !== null &&
          state.prevV > this.minDownVelocity &&
          v < this.impactVelocity &&
          drop >= this.minDrop

        if (impact && timeMs >= state.cooldownUntil) {
          state.cooldownUntil = timeMs + this.cooldownMs
          state.rising = false
          state.startY = null
          event = { timeMs, side }
        }

        if (v < -0.05) {
          state.rising = false
          state.startY = null
        }

        state.prevV = v
      }
    }

    state.prevY = y
    state.prevT = timeMs
    return event
  }
}

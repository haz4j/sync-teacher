import type { Landmark } from './stickFigure'

const LEFT_ANKLE = 27
const RIGHT_ANKLE = 28

export type StompEvent = {
  timeMs: number
  side: 'left' | 'right' | 'either'
}

type AnkleState = {
  prevY: number | null
  prevT: number | null
  prevV: number | null
  cooldownUntil: number
}

/**
 * Detect foot stomps from ankle landmark motion.
 * A stomp = downward velocity followed by sharp deceleration (impact).
 */
export class StompDetector {
  private left: AnkleState = { prevY: null, prevT: null, prevV: null, cooldownUntil: 0 }
  private right: AnkleState = { prevY: null, prevT: null, prevV: null, cooldownUntil: 0 }

  private readonly minDownVelocity = 0.45 // normalized units / sec
  private readonly impactDecel = 1.2
  private readonly cooldownMs = 280

  reset() {
    this.left = { prevY: null, prevT: null, prevV: null, cooldownUntil: 0 }
    this.right = { prevY: null, prevT: null, prevV: null, cooldownUntil: 0 }
  }

  update(landmarks: Landmark[] | null, timeMs: number): StompEvent | null {
    if (!landmarks) return null

    const leftHit = this.track(this.left, landmarks[LEFT_ANKLE], timeMs, 'left')
    if (leftHit) return leftHit

    const rightHit = this.track(this.right, landmarks[RIGHT_ANKLE], timeMs, 'right')
    if (rightHit) return rightHit

    return null
  }

  private track(
    state: AnkleState,
    lm: Landmark | undefined,
    timeMs: number,
    side: 'left' | 'right',
  ): StompEvent | null {
    if (!lm || (lm.visibility ?? 1) < 0.5) {
      state.prevY = null
      state.prevT = null
      state.prevV = null
      return null
    }

    const y = lm.y
    let event: StompEvent | null = null

    if (state.prevY !== null && state.prevT !== null) {
      const dt = (timeMs - state.prevT) / 1000
      if (dt > 0.001 && dt < 0.2) {
        const v = (y - state.prevY) / dt // positive = moving down
        if (
          state.prevV !== null &&
          timeMs >= state.cooldownUntil &&
          state.prevV > this.minDownVelocity &&
          v < state.prevV - this.impactDecel
        ) {
          state.cooldownUntil = timeMs + this.cooldownMs
          event = { timeMs, side }
        }
        state.prevV = v
      }
    }

    state.prevY = y
    state.prevT = timeMs
    return event
  }
}

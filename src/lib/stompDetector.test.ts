import { describe, expect, it } from 'vitest'
import { StompDetector } from './stompDetector'
import type { Landmark } from './stickFigure'

function landmarksWithFeet(leftY: number, rightY = 0.5): Landmark[] {
  const points: Landmark[] = Array.from({ length: 33 }, () => ({
    x: 0.5,
    y: 0.5,
    visibility: 1,
  }))
  points[27] = { x: 0.4, y: leftY, visibility: 1 } // left ankle
  points[31] = { x: 0.4, y: leftY, visibility: 1 } // left foot
  points[28] = { x: 0.6, y: rightY, visibility: 1 }
  points[32] = { x: 0.6, y: rightY, visibility: 1 }
  return points
}

/** Downward swing then hard stop (impact). */
function runStompSwing(detector: StompDetector, baseT: number) {
  const frames: Array<[number, number]> = [
    [baseT, 0.7],
    [baseT + 16, 0.72],
    [baseT + 32, 0.75],
    [baseT + 48, 0.79],
    [baseT + 64, 0.82],
    [baseT + 80, 0.821], // near-stop after drop → impact
  ]
  let event = null
  for (const [t, y] of frames) {
    event = detector.update(landmarksWithFeet(y), t) ?? event
  }
  return event
}

describe('StompDetector', () => {
  it('emits a stomp when the foot drops then decelerates', () => {
    const detector = new StompDetector()
    const event = runStompSwing(detector, 0)
    expect(event).not.toBeNull()
    expect(event?.side).toBe('left')
  })

  it('ignores flat / noisy motion without a drop', () => {
    const detector = new StompDetector()
    let event = null
    for (let i = 0; i < 10; i++) {
      const y = 0.8 + (i % 2) * 0.001
      event = detector.update(landmarksWithFeet(y), i * 16) ?? event
    }
    expect(event).toBeNull()
  })

  it('returns null when landmarks are missing', () => {
    const detector = new StompDetector()
    expect(detector.update(null, 0)).toBeNull()
  })

  it('respects cooldown between stomps', () => {
    const detector = new StompDetector()
    expect(runStompSwing(detector, 0)).not.toBeNull()
    expect(runStompSwing(detector, 80)).toBeNull()
    expect(runStompSwing(detector, 400)).not.toBeNull()
  })
})

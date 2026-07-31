import { describe, expect, it } from 'vitest'
import { Scorer } from './scorer'

describe('Scorer', () => {
  it('counts a hit when stomp is within the window after latency compensation', () => {
    const scorer = new Scorer(220, 120)
    scorer.addBeat(1000, 0)

    // Detected at 1120 → compensated 1000 → exact hit
    const result = scorer.registerStomp(1120)
    expect(result).toEqual({ kind: 'hit', beatIndex: 0, offsetMs: 0 })

    const snap = scorer.snapshot()
    expect(snap.hits).toBe(1)
    expect(snap.misses).toBe(0)
    expect(snap.accuracy).toBe(100)
    expect(snap.recent).toEqual(['hit'])
  })

  it('treats windowMs as full span (half on each side of the beat)', () => {
    const scorer = new Scorer(100, 0)
    scorer.addBeat(1000, 0)
    // |offset| 49 <= 50 → hit
    expect(scorer.registerStomp(1049)?.kind).toBe('hit')
  })

  it('rejects stomps outside the timing window', () => {
    const scorer = new Scorer(100, 0)
    scorer.addBeat(1000, 0)
    // |offset| 300 > 50 → miss window
    expect(scorer.registerStomp(1300)).toBeNull()
    expect(scorer.snapshot().hits).toBe(0)
  })

  it('marks expired beats as misses at the late edge (+ latency)', () => {
    // full window 100 → half 50; latency 50 → miss after 1100
    const scorer = new Scorer(100, 50)
    scorer.addBeat(1000, 0)

    expect(scorer.tick(1099)).toBeNull()
    expect(scorer.tick(1101)).toEqual({ kind: 'miss', beatIndex: 0 })

    const snap = scorer.snapshot()
    expect(snap.misses).toBe(1)
    expect(snap.hits).toBe(0)
    expect(snap.accuracy).toBe(0)
    expect(snap.recent).toEqual(['miss'])
  })

  it('keeps only the last 8 results in recent history', () => {
    const scorer = new Scorer(200, 0)
    for (let i = 0; i < 10; i++) {
      scorer.addBeat(i * 1000, i)
      scorer.registerStomp(i * 1000)
    }
    expect(scorer.snapshot().recent).toHaveLength(8)
    expect(scorer.snapshot().hits).toBe(10)
  })

  it('reset clears stats and history', () => {
    const scorer = new Scorer(200, 0)
    scorer.addBeat(1000, 0)
    scorer.registerStomp(1000)
    scorer.reset()
    expect(scorer.snapshot()).toMatchObject({
      hits: 0,
      misses: 0,
      accuracy: 0,
      recent: [],
      lastResult: null,
    })
  })

  it('applies updated window and latency to later judgments', () => {
    const scorer = new Scorer(50, 0)
    scorer.setWindowMs(200) // half = 100
    scorer.setLatencyMs(100)
    scorer.addBeat(1000, 0)
    // detected 1150 → compensated 1050 → delta 50 within half 100
    expect(scorer.registerStomp(1150)?.kind).toBe('hit')
  })
})

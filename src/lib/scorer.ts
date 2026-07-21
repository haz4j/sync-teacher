export type BeatRecord = {
  timeMs: number
  index: number
  judged: boolean
  hit: boolean | null
}

export type ScoreSnapshot = {
  hits: number
  misses: number
  pending: number
  accuracy: number
  lastResult: 'hit' | 'miss' | null
}

/**
 * Matches stomps to beats within a timing window.
 * Late misses are finalized after the window closes.
 */
export class Scorer {
  private beats: BeatRecord[] = []
  private hits = 0
  private misses = 0
  private lastResult: 'hit' | 'miss' | null = null
  private readonly windowMs: number

  constructor(windowMs = 120) {
    this.windowMs = windowMs
  }

  reset() {
    this.beats = []
    this.hits = 0
    this.misses = 0
    this.lastResult = null
  }

  addBeat(timeMs: number, index: number) {
    this.beats.push({ timeMs, index, judged: false, hit: null })
  }

  registerStomp(timeMs: number): 'hit' | null {
    let best: BeatRecord | null = null
    let bestDelta = Infinity

    for (const beat of this.beats) {
      if (beat.judged) continue
      const delta = Math.abs(timeMs - beat.timeMs)
      if (delta <= this.windowMs && delta < bestDelta) {
        best = beat
        bestDelta = delta
      }
    }

    if (!best) return null

    best.judged = true
    best.hit = true
    this.hits += 1
    this.lastResult = 'hit'
    return 'hit'
  }

  /** Call periodically to mark beats whose window expired without a stomp. */
  tick(nowMs: number): 'miss' | null {
    let missed = false
    for (const beat of this.beats) {
      if (beat.judged) continue
      if (nowMs > beat.timeMs + this.windowMs) {
        beat.judged = true
        beat.hit = false
        this.misses += 1
        this.lastResult = 'miss'
        missed = true
      }
    }
    return missed ? 'miss' : null
  }

  snapshot(): ScoreSnapshot {
    const pending = this.beats.filter((b) => !b.judged).length
    const total = this.hits + this.misses
    return {
      hits: this.hits,
      misses: this.misses,
      pending,
      accuracy: total === 0 ? 0 : Math.round((this.hits / total) * 100),
      lastResult: this.lastResult,
    }
  }
}

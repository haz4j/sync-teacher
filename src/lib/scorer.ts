import { settings } from '../config'

export type BeatRecord = {
  timeMs: number
  index: number
  judged: boolean
  hit: boolean | null
  offsetMs: number | null
}

export type ScoreSnapshot = {
  hits: number
  misses: number
  pending: number
  accuracy: number
  lastResult: 'hit' | 'miss' | null
  lastOffsetMs: number | null
  recent: Array<'hit' | 'miss'>
}

export type HitResult = {
  kind: 'hit'
  beatIndex: number
  offsetMs: number
}

export type MissResult = {
  kind: 'miss'
  beatIndex: number
}

/**
 * Matches stomps to beats within a timing window.
 *
 * `windowMs` is the FULL valid span (same as beat-lane platform width):
 * earliest = beat - window/2, latest = beat + window/2.
 * Webcam delay is removed via latencyMs before comparing.
 */
export class Scorer {
  private beats: BeatRecord[] = []
  private hits = 0
  private misses = 0
  private lastResult: 'hit' | 'miss' | null = null
  private lastOffsetMs: number | null = null
  private recent: Array<'hit' | 'miss'> = []
  private windowMs: number
  private latencyMs: number
  private readonly recentLimit = 8

  constructor(
    windowMs = settings.windowMs.default,
    latencyMs = settings.latencyMs.default,
  ) {
    this.windowMs = windowMs
    this.latencyMs = latencyMs
  }

  setWindowMs(windowMs: number) {
    this.windowMs = Math.max(
      settings.windowMs.min,
      Math.min(settings.windowMs.max, windowMs),
    )
  }

  setLatencyMs(latencyMs: number) {
    this.latencyMs = Math.max(
      settings.latencyMs.min,
      Math.min(settings.latencyMs.max, latencyMs),
    )
  }

  getWindowMs() {
    return this.windowMs
  }

  getLatencyMs() {
    return this.latencyMs
  }

  /** Half of Окно — max |offset| from the beat center. */
  private halfWindowMs() {
    return this.windowMs / 2
  }

  reset() {
    this.beats = []
    this.hits = 0
    this.misses = 0
    this.lastResult = null
    this.lastOffsetMs = null
    this.recent = []
  }

  addBeat(timeMs: number, index: number) {
    this.beats.push({
      timeMs,
      index,
      judged: false,
      hit: null,
      offsetMs: null,
    })
  }

  registerStomp(detectedAtMs: number): HitResult | null {
    const timeMs = detectedAtMs - this.latencyMs
    const half = this.halfWindowMs()
    let best: BeatRecord | null = null
    let bestDelta = Infinity

    for (const beat of this.beats) {
      if (beat.judged) continue
      const delta = Math.abs(timeMs - beat.timeMs)
      if (delta <= half && delta < bestDelta) {
        best = beat
        bestDelta = delta
      }
    }

    if (!best) return null

    const offsetMs = Math.round(timeMs - best.timeMs)
    best.judged = true
    best.hit = true
    best.offsetMs = offsetMs
    this.hits += 1
    this.lastResult = 'hit'
    this.lastOffsetMs = offsetMs
    this.pushRecent('hit')
    return { kind: 'hit', beatIndex: best.index, offsetMs }
  }

  /**
   * Mark beats whose late edge has passed.
   * Late edge = beat + window/2; +latency waits for late camera frames.
   * That matches the arrow leaving the right side of the platform (+latency).
   */
  tick(nowMs: number): MissResult | null {
    let lastMiss: MissResult | null = null
    const half = this.halfWindowMs()
    for (const beat of this.beats) {
      if (beat.judged) continue
      if (nowMs > beat.timeMs + half + this.latencyMs) {
        beat.judged = true
        beat.hit = false
        this.misses += 1
        this.lastResult = 'miss'
        this.lastOffsetMs = null
        this.pushRecent('miss')
        lastMiss = { kind: 'miss', beatIndex: beat.index }
      }
    }
    return lastMiss
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
      lastOffsetMs: this.lastOffsetMs,
      recent: [...this.recent],
    }
  }

  private pushRecent(result: 'hit' | 'miss') {
    this.recent.push(result)
    if (this.recent.length > this.recentLimit) {
      this.recent.shift()
    }
  }
}

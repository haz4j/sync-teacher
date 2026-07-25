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
}

export type HitResult = {
  kind: 'hit'
  offsetMs: number
}

/**
 * Matches stomps to beats within a timing window.
 *
 * Webcam pose is delayed vs audio, so stomps are matched with a latency
 * compensation (treated as earlier than the detection timestamp).
 */
export class Scorer {
  private beats: BeatRecord[] = []
  private hits = 0
  private misses = 0
  private lastResult: 'hit' | 'miss' | null = null
  private lastOffsetMs: number | null = null
  private readonly windowMs: number
  private readonly latencyMs: number

  constructor(windowMs = 220, latencyMs = 120) {
    this.windowMs = windowMs
    this.latencyMs = latencyMs
  }

  reset() {
    this.beats = []
    this.hits = 0
    this.misses = 0
    this.lastResult = null
    this.lastOffsetMs = null
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
    // Compensate for camera + inference delay so matching aligns with the click.
    const timeMs = detectedAtMs - this.latencyMs
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

    const offsetMs = Math.round(timeMs - best.timeMs)
    best.judged = true
    best.hit = true
    best.offsetMs = offsetMs
    this.hits += 1
    this.lastResult = 'hit'
    this.lastOffsetMs = offsetMs
    return { kind: 'hit', offsetMs }
  }

  /** Call periodically to mark beats whose window expired without a stomp. */
  tick(nowMs: number): 'miss' | null {
    let missed = false
    for (const beat of this.beats) {
      if (beat.judged) continue
      // Allow full window after compensated time: beat + window + latency.
      if (nowMs > beat.timeMs + this.windowMs + this.latencyMs) {
        beat.judged = true
        beat.hit = false
        this.misses += 1
        this.lastResult = 'miss'
        this.lastOffsetMs = null
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
      lastOffsetMs: this.lastOffsetMs,
    }
  }
}

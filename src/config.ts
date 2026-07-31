/**
 * Default user-facing settings and allowed ranges.
 * Change values here — UI and scoring pick them up from this module.
 */
export const settings = {
  bpm: {
    default: 80,
    min: 10,
    max: 140,
  },
  /** Hit timing window: full valid span under the arrow (platform width). */
  windowMs: {
    default: 220,
    min: 80,
    max: 350,
    step: 10,
  },
  /** Camera / pose latency compensation. */
  latencyMs: {
    default: 120,
    min: 0,
    max: 250,
    step: 10,
  },
}

/** Metronome internal clamp (may allow wider than UI slider). */
export const metronomeBpm = {
  min: settings.bpm.min,
  max: 200,
}

/** Runner lane: base pixels spanned by one beat (may grow at low BPM for readability). */
export const beatLane = {
  pxPerBeat: 220,
}

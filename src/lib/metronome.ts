export type BeatCallback = (beatTimeMs: number, beatIndex: number) => void

/**
 * Precise metronome using Web Audio API lookahead scheduling.
 * Emits beat callbacks aligned to AudioContext time (converted to performance.now).
 */
export class Metronome {
  private ctx: AudioContext | null = null
  private nextBeatAt = 0
  private timerId: number | null = null
  private beatIndex = 0
  private running = false
  private bpm = 80
  private onBeat: BeatCallback | null = null

  private readonly lookaheadMs = 25
  private readonly scheduleAheadSec = 0.1

  setBpm(bpm: number) {
    this.bpm = Math.max(40, Math.min(200, bpm))
  }

  getBpm() {
    return this.bpm
  }

  isRunning() {
    return this.running
  }

  async start(onBeat: BeatCallback) {
    this.onBeat = onBeat
    if (!this.ctx) {
      this.ctx = new AudioContext()
    }
    if (this.ctx.state === 'suspended') {
      await this.ctx.resume()
    }

    this.running = true
    this.beatIndex = 0
    this.nextBeatAt = this.ctx.currentTime + 0.05
    this.scheduler()
  }

  stop() {
    this.running = false
    if (this.timerId !== null) {
      window.clearTimeout(this.timerId)
      this.timerId = null
    }
  }

  /** Map AudioContext time → performance.now for scoring against camera timestamps. */
  audioTimeToPerfMs(audioTime: number): number {
    if (!this.ctx) return performance.now()
    const elapsed = audioTime - this.ctx.currentTime
    return performance.now() + elapsed * 1000
  }

  private scheduler = () => {
    if (!this.running || !this.ctx) return

    while (this.nextBeatAt < this.ctx.currentTime + this.scheduleAheadSec) {
      this.scheduleClick(this.nextBeatAt)
      const beatPerfMs = this.audioTimeToPerfMs(this.nextBeatAt)
      const index = this.beatIndex
      const delay = Math.max(0, beatPerfMs - performance.now())
      window.setTimeout(() => {
        if (this.running) this.onBeat?.(beatPerfMs, index)
      }, delay)

      this.beatIndex += 1
      this.nextBeatAt += 60 / this.bpm
    }

    this.timerId = window.setTimeout(this.scheduler, this.lookaheadMs)
  }

  private scheduleClick(time: number) {
    if (!this.ctx) return
    const osc = this.ctx.createOscillator()
    const gain = this.ctx.createGain()
    osc.type = 'square'
    osc.frequency.value = this.beatIndex % 4 === 0 ? 1200 : 880
    gain.gain.setValueAtTime(0.0001, time)
    gain.gain.exponentialRampToValueAtTime(0.35, time + 0.001)
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.05)
    osc.connect(gain)
    gain.connect(this.ctx.destination)
    osc.start(time)
    osc.stop(time + 0.06)
  }
}

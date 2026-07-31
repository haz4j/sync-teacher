import { beatLane, settings } from '../config'
import { useEffect, useRef } from 'react'

type Props = {
  bpm: number
  windowMs: number
  latencyMs: number
  running: boolean
  /** performance.now() of the first scheduled click (beat 0). */
  laneOriginMs: number | null
  /** Actual beat times from the metronome (same clock as the teacher). */
  beatTimes: number[]
  feedback: 'hit' | 'miss' | null
}

function drawDownArrow(
  ctx: CanvasRenderingContext2D,
  cx: number,
  groundY: number,
  dpr: number,
) {
  const tipY = groundY - 2 * dpr
  const topY = tipY - 36 * dpr
  const head = 7 * dpr

  ctx.save()
  ctx.strokeStyle = '#1a1a1a'
  ctx.lineWidth = 1.5 * dpr
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  ctx.beginPath()
  ctx.moveTo(cx, topY)
  ctx.lineTo(cx, tipY)
  ctx.stroke()

  ctx.beginPath()
  ctx.moveTo(cx - head, tipY - head)
  ctx.lineTo(cx, tipY)
  ctx.lineTo(cx + head, tipY - head)
  ctx.stroke()

  ctx.restore()
}

/**
 * Confirmed metronome beats + future extrapolations from the last known beat.
 */
function visibleBeatTimes(
  origin: number | null,
  confirmed: number[],
  bpm: number,
  now: number,
): number[] {
  if (origin === null && confirmed.length === 0) return []
  const intervalMs = 60000 / Math.max(settings.bpm.min, bpm)
  const times = new Set<number>(confirmed)
  const anchor = confirmed.length > 0 ? confirmed[confirmed.length - 1]! : origin!
  if (origin !== null) times.add(origin)
  for (let k = 1; k <= 8; k++) {
    times.add(anchor + k * intervalMs)
  }
  const minT = now - 3 * intervalMs
  const maxT = now + 8 * intervalMs
  return [...times].filter((t) => t >= minT && t <= maxT).sort((a, b) => a - b)
}

export function BeatLane({
  bpm,
  windowMs,
  latencyMs,
  running,
  laneOriginMs,
  beatTimes,
  feedback,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef(0)
  const propsRef = useRef({
    bpm,
    windowMs,
    latencyMs,
    running,
    laneOriginMs,
    beatTimes,
    feedback,
  })
  propsRef.current = {
    bpm,
    windowMs,
    latencyMs,
    running,
    laneOriginMs,
    beatTimes,
    feedback,
  }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const draw = () => {
      const {
        bpm: b,
        windowMs: win,
        latencyMs: lat,
        running: isRun,
        laneOriginMs: origin,
        beatTimes: confirmed,
        feedback: fb,
      } = propsRef.current
      const dpr = window.devicePixelRatio || 1
      const rect = canvas.getBoundingClientRect()
      const w = Math.max(1, Math.floor(rect.width * dpr))
      const h = Math.max(1, Math.floor(rect.height * dpr))
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w
        canvas.height = h
      }

      const now = performance.now()
      const intervalMs = 60000 / Math.max(settings.bpm.min, b)
      // Keep Окно/Задержка readable even at low BPM: at least ~half a beat for max window.
      const pxPerBeat = Math.max(
        beatLane.pxPerBeat,
        (settings.windowMs.max / intervalMs) * beatLane.pxPerBeat * 2.5,
      )
      const pxPerMs = pxPerBeat / intervalMs
      const centerX = w * 0.5
      const groundY = h * 0.72

      ctx.clearRect(0, 0, w, h)

      ctx.strokeStyle = 'rgba(26, 26, 26, 0.2)'
      ctx.lineWidth = 2 * dpr
      ctx.beginPath()
      ctx.moveTo(0, groundY)
      ctx.lineTo(w, groundY)
      ctx.stroke()

      const scroll = isRun ? (now * pxPerMs) % (28 * dpr) : 0
      ctx.strokeStyle = 'rgba(26, 26, 26, 0.35)'
      ctx.lineWidth = 2 * dpr
      for (let x = -scroll; x < w + 40 * dpr; x += 28 * dpr) {
        ctx.beginPath()
        ctx.moveTo(x, groundY + 6 * dpr)
        ctx.lineTo(x + 14 * dpr, groundY + 6 * dpr)
        ctx.stroke()
      }

      const platformH = 12 * dpr
      // Окно = full valid span; Задержка = extension past the late edge (camera grace).
      const windowW = Math.max(2 * dpr, win * pxPerMs)
      const latencyW = Math.max(0, lat * pxPerMs)
      const halfWindow = windowW / 2

      // Idle preview: one platform under the arrow so sliders visibly resize it.
      const times =
        isRun && (origin !== null || confirmed.length > 0)
          ? visibleBeatTimes(origin, confirmed, b, now)
          : [now]

      const top = groundY - platformH

      for (const beatTime of times) {
        const beatX = centerX + (beatTime - now) * pxPerMs
        const left = beatX - halfWindow
        const midRight = beatX + halfWindow
        const right = midRight + latencyW
        if (right < -20 * dpr || left > w + 20 * dpr) continue

        const overWindow = centerX >= left && centerX <= midRight
        const overLatency = latencyW > 0 && centerX > midRight && centerX <= right

        // Main valid window (Окно)
        let windowFill = 'rgba(26, 26, 26, 0.5)'
        if (overWindow && fb === 'hit') windowFill = 'rgba(42, 157, 143, 0.9)'
        else if (overWindow && fb === 'miss') windowFill = 'rgba(193, 18, 31, 0.9)'
        else if (overWindow) windowFill = 'rgba(232, 93, 4, 0.8)'
        ctx.fillStyle = windowFill
        ctx.fillRect(left, top, windowW, platformH)

        // Latency tail after late edge (Задержка) — grows with the slider
        if (latencyW > 0.5 * dpr) {
          ctx.fillStyle = overLatency
            ? 'rgba(193, 18, 31, 0.45)'
            : 'rgba(193, 18, 31, 0.22)'
          ctx.fillRect(midRight, top, latencyW, platformH)
        }

        // Ideal beat mark (center of Окно)
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)'
        ctx.lineWidth = 1.5 * dpr
        ctx.beginPath()
        ctx.moveTo(beatX, top - 2 * dpr)
        ctx.lineTo(beatX, top + platformH + 2 * dpr)
        ctx.stroke()
      }

      drawDownArrow(ctx, centerX, groundY, dpr)

      rafRef.current = requestAnimationFrame(draw)
    }

    rafRef.current = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(rafRef.current)
  }, [])

  return (
    <div className="beat-lane" aria-label="Беговая дорожка ритма">
      <canvas ref={canvasRef} className="beat-lane-canvas" />
    </div>
  )
}

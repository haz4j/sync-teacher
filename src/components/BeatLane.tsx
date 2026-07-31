import { beatLane, settings } from '../config'
import { useEffect, useRef } from 'react'

type Props = {
  bpm: number
  windowMs: number
  running: boolean
  /** Absolute performance.now() of beat index 0 (first click). */
  laneOriginMs: number | null
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

  // shaft
  ctx.beginPath()
  ctx.moveTo(cx, topY)
  ctx.lineTo(cx, tipY)
  ctx.stroke()

  // arrow head
  ctx.beginPath()
  ctx.moveTo(cx - head, tipY - head)
  ctx.lineTo(cx, tipY)
  ctx.lineTo(cx + head, tipY - head)
  ctx.stroke()

  ctx.restore()
}

export function BeatLane({
  bpm,
  windowMs,
  running,
  laneOriginMs,
  feedback,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef(0)
  const propsRef = useRef({ bpm, windowMs, running, laneOriginMs, feedback })
  propsRef.current = { bpm, windowMs, running, laneOriginMs, feedback }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const draw = () => {
      const { bpm: b, windowMs: win, running: isRun, laneOriginMs: origin, feedback: fb } =
        propsRef.current
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
      const pxPerMs = beatLane.pxPerBeat / intervalMs
      const centerX = w * 0.5
      const groundY = h * 0.72

      ctx.clearRect(0, 0, w, h)

      // Panel background already from CSS; soft ground line
      ctx.strokeStyle = 'rgba(26, 26, 26, 0.2)'
      ctx.lineWidth = 2 * dpr
      ctx.beginPath()
      ctx.moveTo(0, groundY)
      ctx.lineTo(w, groundY)
      ctx.stroke()

      // Scrolling ground dashes (right → left)
      const scroll = isRun ? (now * pxPerMs) % (28 * dpr) : 0
      ctx.strokeStyle = 'rgba(26, 26, 26, 0.35)'
      ctx.lineWidth = 2 * dpr
      for (let x = -scroll; x < w + 40 * dpr; x += 28 * dpr) {
        ctx.beginPath()
        ctx.moveTo(x, groundY + 6 * dpr)
        ctx.lineTo(x + 14 * dpr, groundY + 6 * dpr)
        ctx.stroke()
      }

      // Platforms from beat timeline
      const platformH = 10 * dpr
      const platformW = Math.max(8 * dpr, win * pxPerMs)

      if (origin !== null) {
        const iCenter = Math.floor((now - origin) / intervalMs)
        for (let i = iCenter - 3; i <= iCenter + 8; i++) {
          if (i < 0) continue
          const beatTime = origin + i * intervalMs
          const x = centerX + (beatTime - now) * pxPerMs
          if (x < -platformW || x > w + platformW) continue

          const nearCenter = Math.abs(x - centerX) < platformW * 0.55
          let fill = 'rgba(26, 26, 26, 0.55)'
          if (nearCenter && fb === 'hit') fill = 'rgba(42, 157, 143, 0.9)'
          else if (nearCenter && fb === 'miss') fill = 'rgba(193, 18, 31, 0.9)'
          else if (nearCenter) fill = 'rgba(232, 93, 4, 0.75)'

          ctx.fillStyle = fill
          const left = x - platformW / 2
          const top = groundY - platformH
          ctx.fillRect(left, top, platformW, platformH)
        }
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

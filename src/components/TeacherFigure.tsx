import { useEffect, useRef } from 'react'
import {
  drawFootBurst,
  drawStickFigure,
  teacherPoseAt,
  type FootMarker,
} from '../lib/stickFigure'

type Props = {
  running: boolean
  bpm: number
  lastBeatMs: number | null
  beatIndex: number
  beatFlash: boolean
  footMarker: FootMarker | null
}

export function TeacherFigure({
  running,
  bpm,
  lastBeatMs,
  beatIndex,
  beatFlash,
  footMarker,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef(0)
  const markerRef = useRef(footMarker)
  markerRef.current = footMarker

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const draw = () => {
      const dpr = window.devicePixelRatio || 1
      const rect = canvas.getBoundingClientRect()
      const w = Math.max(1, Math.floor(rect.width * dpr))
      const h = Math.max(1, Math.floor(rect.height * dpr))
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w
        canvas.height = h
      }

      ctx.clearRect(0, 0, w, h)

      ctx.strokeStyle = 'rgba(26, 26, 26, 0.15)'
      ctx.lineWidth = 2 * dpr
      ctx.beginPath()
      ctx.moveTo(w * 0.15, h * 0.92)
      ctx.lineTo(w * 0.85, h * 0.92)
      ctx.stroke()

      const intervalMs = 60000 / bpm
      let progress = 0.5
      if (running && lastBeatMs !== null) {
        progress = Math.min(1, Math.max(0, (performance.now() - lastBeatMs) / intervalMs))
      }

      const pose = teacherPoseAt(progress, beatIndex)
      drawStickFigure(ctx, pose, w, h, {
        color: '#1a1a1a',
        lineWidth: 5 * dpr,
        headRadius: 0.048,
      })

      const marker = markerRef.current
      if (marker) {
        drawFootBurst(ctx, w, h, marker, performance.now(), dpr)
      }

      rafRef.current = requestAnimationFrame(draw)
    }

    rafRef.current = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(rafRef.current)
  }, [running, bpm, lastBeatMs, beatIndex, beatFlash])

  return (
    <div className={`stage teacher-stage${beatFlash ? ' beat-flash' : ''}`}>
      <div className="stage-label">Учитель</div>
      <canvas ref={canvasRef} className="stage-canvas" />
    </div>
  )
}

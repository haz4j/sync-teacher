import { useEffect, useRef, useState } from 'react'
import { createPoseLandmarker, detectPose } from '../lib/pose'
import { drawPoseLandmarks, type Landmark } from '../lib/stickFigure'
import type { PoseLandmarker } from '@mediapipe/tasks-vision'

type Props = {
  active: boolean
  stompFlash: boolean
  onLandmarks: (landmarks: Landmark[] | null, timeMs: number) => void
}

export function CameraStage({ active, stompFlash, onLandmarks }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const landmarkerRef = useRef<PoseLandmarker | null>(null)
  const rafRef = useRef(0)
  const lastTsRef = useRef(-1)
  const onLandmarksRef = useRef(onLandmarks)
  onLandmarksRef.current = onLandmarks

  const [error, setError] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  const [loadingPose, setLoadingPose] = useState(true)

  useEffect(() => {
    let stream: MediaStream | null = null
    let cancelled = false

    async function setup() {
      try {
        setLoadingPose(true)
        const [media, landmarker] = await Promise.all([
          navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
            audio: false,
          }),
          createPoseLandmarker(),
        ])
        if (cancelled) {
          media.getTracks().forEach((t) => t.stop())
          return
        }
        stream = media
        landmarkerRef.current = landmarker
        const video = videoRef.current
        if (video) {
          video.srcObject = media
          await video.play()
        }
        setReady(true)
        setError(null)
      } catch (e) {
        console.error(e)
        setError(
          e instanceof Error
            ? e.message
            : 'Не удалось получить доступ к камере или загрузить модель позы.',
        )
      } finally {
        if (!cancelled) setLoadingPose(false)
      }
    }

    void setup()

    return () => {
      cancelled = true
      stream?.getTracks().forEach((t) => t.stop())
      cancelAnimationFrame(rafRef.current)
    }
  }, [])

  useEffect(() => {
    if (!ready) return

    const loop = () => {
      const video = videoRef.current
      const canvas = canvasRef.current
      const landmarker = landmarkerRef.current

      if (video && canvas && landmarker && video.readyState >= 2) {
        const dpr = window.devicePixelRatio || 1
        const rect = canvas.getBoundingClientRect()
        const w = Math.max(1, Math.floor(rect.width * dpr))
        const h = Math.max(1, Math.floor(rect.height * dpr))
        if (canvas.width !== w || canvas.height !== h) {
          canvas.width = w
          canvas.height = h
        }

        const ctx = canvas.getContext('2d')
        if (ctx) {
          ctx.clearRect(0, 0, w, h)
          ctx.save()
          ctx.scale(-1, 1)
          ctx.drawImage(video, -w, 0, w, h)
          ctx.restore()

          let now = performance.now()
          if (now <= lastTsRef.current) {
            now = lastTsRef.current + 1
          }
          lastTsRef.current = now

          try {
            const frame = detectPose(landmarker, video, now)
            const lm = frame.landmarks as Landmark[] | null
            drawPoseLandmarks(ctx, lm ?? [], w, h, { mirror: true })
            if (active) {
              onLandmarksRef.current(lm, now)
            }
          } catch (err) {
            console.warn(err)
          }
        }
      }

      rafRef.current = requestAnimationFrame(loop)
    }

    rafRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafRef.current)
  }, [ready, active])

  return (
    <div className={`stage camera-stage${stompFlash ? ' stomp-flash' : ''}`}>
      <div className="stage-label">Вы</div>
      <video ref={videoRef} className="camera-video" playsInline muted />
      <canvas ref={canvasRef} className="stage-canvas camera-overlay" />
      {loadingPose && (
        <div className="stage-overlay-msg">Загрузка камеры и модели позы…</div>
      )}
      {error && <div className="stage-overlay-msg error">{error}</div>}
      {!loadingPose && !error && !active && (
        <div className="stage-hint">
          Ноги должны быть в кадре — можно снять только от пояса вниз. Бёдра и стопы
          лучше видно при хорошем освещении.
        </div>
      )}
    </div>
  )
}

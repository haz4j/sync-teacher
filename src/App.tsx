import { settings } from './config'
import { useCallback, useEffect, useRef, useState } from 'react'
import { BeatLane } from './components/BeatLane'
import { CameraStage } from './components/CameraStage'
import { MetronomeControls } from './components/MetronomeControls'
import { ScoreHud } from './components/ScoreHud'
import { TeacherFigure } from './components/TeacherFigure'
import { Metronome } from './lib/metronome'
import { Scorer, type ScoreSnapshot } from './lib/scorer'
import { StompDetector } from './lib/stompDetector'
import { FOOT_BURST_MS, teacherFootForBeat, teacherPoseAt, type FootMarker, type Landmark } from './lib/stickFigure'

const emptyScore: ScoreSnapshot = {
  hits: 0,
  misses: 0,
  pending: 0,
  accuracy: 0,
  lastResult: null,
  lastOffsetMs: null,
  recent: [],
}

export default function App() {
  const [bpm, setBpm] = useState(settings.bpm.default)
  const [windowMs, setWindowMs] = useState(settings.windowMs.default)
  const [latencyMs, setLatencyMs] = useState(settings.latencyMs.default)
  const [running, setRunning] = useState(false)
  const [lastBeatMs, setLastBeatMs] = useState<number | null>(null)
  const [beatIndex, setBeatIndex] = useState(0)
  const [beatFlash, setBeatFlash] = useState(false)
  const [stompFlash, setStompFlash] = useState(false)
  const [score, setScore] = useState<ScoreSnapshot>(emptyScore)
  const [feedback, setFeedback] = useState<'hit' | 'miss' | null>(null)
  const [footMarker, setFootMarker] = useState<FootMarker | null>(null)
  const [laneOriginMs, setLaneOriginMs] = useState<number | null>(null)
  const [beatTimes, setBeatTimes] = useState<number[]>([])

  const metronomeRef = useRef(new Metronome())
  const scorerRef = useRef(
    new Scorer(settings.windowMs.default, settings.latencyMs.default),
  )
  const stompRef = useRef(new StompDetector())
  const runningRef = useRef(false)
  const flashTimerRef = useRef(0)
  const feedbackTimerRef = useRef(0)
  const stompFlashTimerRef = useRef(0)
  const footMarkerTimerRef = useRef(0)

  useEffect(() => {
    metronomeRef.current.setBpm(bpm)
  }, [bpm])

  useEffect(() => {
    scorerRef.current.setWindowMs(windowMs)
  }, [windowMs])

  useEffect(() => {
    scorerRef.current.setLatencyMs(latencyMs)
  }, [latencyMs])

  useEffect(() => {
    runningRef.current = running
  }, [running])

  const showFootResult = useCallback((kind: 'hit' | 'miss', beatIdx: number) => {
    const side = teacherFootForBeat(beatIdx)
    const pose = teacherPoseAt(0, beatIdx)
    const ankle = side === 'left' ? pose.leftAnkle : pose.rightAnkle
    setFootMarker({
      side,
      kind,
      startedAt: performance.now(),
      x: ankle.x,
      y: ankle.y,
    })
    window.clearTimeout(footMarkerTimerRef.current)
    footMarkerTimerRef.current = window.setTimeout(
      () => setFootMarker(null),
      FOOT_BURST_MS + 20,
    )
  }, [])

  useEffect(() => {
    const id = window.setInterval(() => {
      if (!runningRef.current) return
      const miss = scorerRef.current.tick(performance.now())
      if (miss) {
        setFeedback('miss')
        showFootResult('miss', miss.beatIndex)
        window.clearTimeout(feedbackTimerRef.current)
        feedbackTimerRef.current = window.setTimeout(() => setFeedback(null), 450)
      }
      setScore(scorerRef.current.snapshot())
    }, 40)
    return () => window.clearInterval(id)
  }, [showFootResult])

  const flashBeat = useCallback(() => {
    setBeatFlash(true)
    window.clearTimeout(flashTimerRef.current)
    flashTimerRef.current = window.setTimeout(() => setBeatFlash(false), 120)
  }, [])

  const clearStats = useCallback(() => {
    scorerRef.current.reset()
    stompRef.current.reset()
    setScore(emptyScore)
    setFeedback(null)
    setStompFlash(false)
    setFootMarker(null)
    window.clearTimeout(footMarkerTimerRef.current)
  }, [])

  const handleReset = useCallback(() => {
    clearStats()
    setLastBeatMs(null)
    setBeatIndex(0)
  }, [clearStats])

  const handleToggle = useCallback(async () => {
    const metro = metronomeRef.current
    if (metro.isRunning()) {
      metro.stop()
      setRunning(false)
      setBeatFlash(false)
      setFootMarker(null)
      setLaneOriginMs(null)
      setBeatTimes([])
      return
    }

    clearStats()
    setBeatTimes([])
    metro.setBpm(bpm)
    scorerRef.current.setWindowMs(windowMs)
    scorerRef.current.setLatencyMs(latencyMs)

    const firstBeatMs = await metro.start((beatTimeMs, index) => {
      scorerRef.current.addBeat(beatTimeMs, index)
      setBeatTimes((prev) => [...prev, beatTimeMs])
      setLastBeatMs(beatTimeMs)
      setBeatIndex(index)
      flashBeat()
      setScore(scorerRef.current.snapshot())
    })
    setLaneOriginMs(firstBeatMs)
    setLastBeatMs(firstBeatMs - 60000 / bpm)
    setBeatIndex(0)
    setRunning(true)
  }, [bpm, windowMs, latencyMs, flashBeat, clearStats])

  const handleLandmarks = useCallback(
    (landmarks: Landmark[] | null, timeMs: number) => {
      if (!runningRef.current) return
      const stomp = stompRef.current.update(landmarks, timeMs)
      if (!stomp) return

      setStompFlash(true)
      window.clearTimeout(stompFlashTimerRef.current)
      stompFlashTimerRef.current = window.setTimeout(() => setStompFlash(false), 160)

      const result = scorerRef.current.registerStomp(stomp.timeMs)
      if (result) {
        setFeedback('hit')
        showFootResult('hit', result.beatIndex)
        window.clearTimeout(feedbackTimerRef.current)
        feedbackTimerRef.current = window.setTimeout(() => setFeedback(null), 500)
      }
      setScore(scorerRef.current.snapshot())
    },
    [showFootResult],
  )

  useEffect(() => {
    return () => {
      metronomeRef.current.stop()
      window.clearTimeout(flashTimerRef.current)
      window.clearTimeout(feedbackTimerRef.current)
      window.clearTimeout(stompFlashTimerRef.current)
      window.clearTimeout(footMarkerTimerRef.current)
    }
  }, [])

  return (
    <div
      className={`app${footMarker ? ` screen-tint-${footMarker.kind}` : ''}`}
    >
      <div
        className={`screen-tint${footMarker ? ` on ${footMarker.kind}` : ''}`}
        aria-hidden
      />
      <aside className="sidebar">
        <header className="header">
          <h1 className="brand">Rhythm Sync</h1>
          <p className="tagline">Топайте ногой в такт метроному</p>
        </header>

        <ScoreHud
          score={score}
          feedback={feedback}
          beatFlash={beatFlash}
          stompFlash={stompFlash}
        />

        <MetronomeControls
          bpm={bpm}
          running={running}
          windowMs={windowMs}
          latencyMs={latencyMs}
          onBpmChange={setBpm}
          onToggle={() => void handleToggle()}
          onReset={handleReset}
          onWindowMsChange={setWindowMs}
          onLatencyMsChange={setLatencyMs}
        />
      </aside>

      <main className="stages">
        <TeacherFigure
          running={running}
          bpm={bpm}
          lastBeatMs={lastBeatMs}
          beatIndex={beatIndex}
          beatFlash={beatFlash}
          footMarker={footMarker}
        />
        <CameraStage
          active={running}
          stompFlash={stompFlash}
          onLandmarks={handleLandmarks}
        />
      </main>

      <BeatLane
        bpm={bpm}
        windowMs={windowMs}
        latencyMs={latencyMs}
        running={running}
        laneOriginMs={laneOriginMs}
        beatTimes={beatTimes}
        feedback={feedback}
      />
    </div>
  )
}

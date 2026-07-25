import { useCallback, useEffect, useRef, useState } from 'react'
import { CameraStage } from './components/CameraStage'
import { MetronomeControls } from './components/MetronomeControls'
import { ScoreHud } from './components/ScoreHud'
import { TeacherFigure } from './components/TeacherFigure'
import { Metronome } from './lib/metronome'
import { Scorer, type ScoreSnapshot } from './lib/scorer'
import { StompDetector } from './lib/stompDetector'
import type { Landmark } from './lib/stickFigure'

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
  const [bpm, setBpm] = useState(80)
  const [windowMs, setWindowMs] = useState(220)
  const [latencyMs, setLatencyMs] = useState(120)
  const [running, setRunning] = useState(false)
  const [legsOnly, setLegsOnly] = useState(false)
  const [lastBeatMs, setLastBeatMs] = useState<number | null>(null)
  const [beatIndex, setBeatIndex] = useState(0)
  const [beatFlash, setBeatFlash] = useState(false)
  const [stompFlash, setStompFlash] = useState(false)
  const [score, setScore] = useState<ScoreSnapshot>(emptyScore)
  const [feedback, setFeedback] = useState<'hit' | 'miss' | null>(null)

  const metronomeRef = useRef(new Metronome())
  const scorerRef = useRef(new Scorer(220, 120))
  const stompRef = useRef(new StompDetector())
  const runningRef = useRef(false)
  const flashTimerRef = useRef(0)
  const feedbackTimerRef = useRef(0)
  const stompFlashTimerRef = useRef(0)

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

  useEffect(() => {
    const id = window.setInterval(() => {
      if (!runningRef.current) return
      const miss = scorerRef.current.tick(performance.now())
      if (miss) {
        setFeedback('miss')
        window.clearTimeout(feedbackTimerRef.current)
        feedbackTimerRef.current = window.setTimeout(() => setFeedback(null), 450)
      }
      setScore(scorerRef.current.snapshot())
    }, 40)
    return () => window.clearInterval(id)
  }, [])

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
      return
    }

    clearStats()
    setLastBeatMs(null)
    setBeatIndex(0)
    metro.setBpm(bpm)
    scorerRef.current.setWindowMs(windowMs)
    scorerRef.current.setLatencyMs(latencyMs)

    await metro.start((beatTimeMs, index) => {
      scorerRef.current.addBeat(beatTimeMs, index)
      setLastBeatMs(beatTimeMs)
      setBeatIndex(index)
      flashBeat()
      setScore(scorerRef.current.snapshot())
    })
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
        window.clearTimeout(feedbackTimerRef.current)
        feedbackTimerRef.current = window.setTimeout(() => setFeedback(null), 500)
      }
      setScore(scorerRef.current.snapshot())
    },
    [],
  )

  useEffect(() => {
    return () => {
      metronomeRef.current.stop()
      window.clearTimeout(flashTimerRef.current)
      window.clearTimeout(feedbackTimerRef.current)
      window.clearTimeout(stompFlashTimerRef.current)
    }
  }, [])

  return (
    <div className="app">
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
        legsOnly={legsOnly}
        windowMs={windowMs}
        latencyMs={latencyMs}
        onBpmChange={setBpm}
        onToggle={() => void handleToggle()}
        onReset={handleReset}
        onLegsOnlyChange={setLegsOnly}
        onWindowMsChange={setWindowMs}
        onLatencyMsChange={setLatencyMs}
      />

      <main className="stages">
        <TeacherFigure
          running={running}
          bpm={bpm}
          lastBeatMs={lastBeatMs}
          beatIndex={beatIndex}
          beatFlash={beatFlash}
        />
        <CameraStage
          active={running}
          legsOnly={legsOnly}
          stompFlash={stompFlash}
          onLandmarks={handleLandmarks}
        />
      </main>
    </div>
  )
}

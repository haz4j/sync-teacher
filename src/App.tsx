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
}

export default function App() {
  const [bpm, setBpm] = useState(80)
  const [running, setRunning] = useState(false)
  const [lastBeatMs, setLastBeatMs] = useState<number | null>(null)
  const [beatIndex, setBeatIndex] = useState(0)
  const [beatFlash, setBeatFlash] = useState(false)
  const [score, setScore] = useState<ScoreSnapshot>(emptyScore)
  const [feedback, setFeedback] = useState<'hit' | 'miss' | null>(null)

  const metronomeRef = useRef(new Metronome())
  const scorerRef = useRef(new Scorer(120))
  const stompRef = useRef(new StompDetector())
  const flashTimerRef = useRef(0)
  const feedbackTimerRef = useRef(0)

  useEffect(() => {
    metronomeRef.current.setBpm(bpm)
  }, [bpm])

  useEffect(() => {
    const id = window.setInterval(() => {
      if (!running) return
      const miss = scorerRef.current.tick(performance.now())
      if (miss) {
        setFeedback('miss')
        window.clearTimeout(feedbackTimerRef.current)
        feedbackTimerRef.current = window.setTimeout(() => setFeedback(null), 400)
      }
      setScore(scorerRef.current.snapshot())
    }, 50)
    return () => window.clearInterval(id)
  }, [running])

  const flashBeat = useCallback(() => {
    setBeatFlash(true)
    window.clearTimeout(flashTimerRef.current)
    flashTimerRef.current = window.setTimeout(() => setBeatFlash(false), 120)
  }, [])

  const handleToggle = useCallback(async () => {
    const metro = metronomeRef.current
    if (metro.isRunning()) {
      metro.stop()
      setRunning(false)
      setBeatFlash(false)
      return
    }

    scorerRef.current.reset()
    stompRef.current.reset()
    setScore(emptyScore)
    setFeedback(null)
    setLastBeatMs(null)
    setBeatIndex(0)
    metro.setBpm(bpm)

    await metro.start((beatTimeMs, index) => {
      scorerRef.current.addBeat(beatTimeMs, index)
      setLastBeatMs(beatTimeMs)
      setBeatIndex(index)
      flashBeat()
      setScore(scorerRef.current.snapshot())
    })
    setRunning(true)
  }, [bpm, flashBeat])

  const handleLandmarks = useCallback(
    (landmarks: Landmark[] | null, timeMs: number) => {
      if (!running) return
      const stomp = stompRef.current.update(landmarks, timeMs)
      if (!stomp) return
      const result = scorerRef.current.registerStomp(stomp.timeMs)
      if (result === 'hit') {
        setFeedback('hit')
        window.clearTimeout(feedbackTimerRef.current)
        feedbackTimerRef.current = window.setTimeout(() => setFeedback(null), 400)
        setScore(scorerRef.current.snapshot())
      }
    },
    [running],
  )

  useEffect(() => {
    return () => {
      metronomeRef.current.stop()
      window.clearTimeout(flashTimerRef.current)
      window.clearTimeout(feedbackTimerRef.current)
    }
  }, [])

  return (
    <div className="app">
      <header className="header">
        <h1 className="brand">Rhythm Sync</h1>
        <p className="tagline">Топайте ногой в такт метроному</p>
      </header>

      <ScoreHud score={score} feedback={feedback} beatFlash={beatFlash} />

      <MetronomeControls
        bpm={bpm}
        running={running}
        onBpmChange={setBpm}
        onToggle={() => void handleToggle()}
      />

      <main className="stages">
        <TeacherFigure
          running={running}
          bpm={bpm}
          lastBeatMs={lastBeatMs}
          beatIndex={beatIndex}
          beatFlash={beatFlash}
        />
        <CameraStage active={running} onLandmarks={handleLandmarks} />
      </main>
    </div>
  )
}

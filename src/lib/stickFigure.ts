export type Point = { x: number; y: number }

/** Normalized teacher pose keypoints (0–1 space, origin top-left). */
export type StickPose = {
  head: Point
  neck: Point
  leftShoulder: Point
  rightShoulder: Point
  leftElbow: Point
  rightElbow: Point
  leftWrist: Point
  rightWrist: Point
  hip: Point
  leftHip: Point
  rightHip: Point
  leftKnee: Point
  rightKnee: Point
  leftAnkle: Point
  rightAnkle: Point
}

const BASE: StickPose = {
  head: { x: 0.5, y: 0.12 },
  neck: { x: 0.5, y: 0.22 },
  leftShoulder: { x: 0.38, y: 0.26 },
  rightShoulder: { x: 0.62, y: 0.26 },
  leftElbow: { x: 0.3, y: 0.4 },
  rightElbow: { x: 0.7, y: 0.4 },
  leftWrist: { x: 0.28, y: 0.54 },
  rightWrist: { x: 0.72, y: 0.54 },
  hip: { x: 0.5, y: 0.52 },
  leftHip: { x: 0.42, y: 0.52 },
  rightHip: { x: 0.58, y: 0.52 },
  leftKnee: { x: 0.42, y: 0.72 },
  rightKnee: { x: 0.58, y: 0.72 },
  leftAnkle: { x: 0.42, y: 0.92 },
  rightAnkle: { x: 0.58, y: 0.92 },
}

/**
 * Stomp animation phase: 0 = standing, 1 = foot fully down at beat.
 * Uses alternating feet; phase derived from progress within the beat interval.
 */
export function teacherFootForBeat(beatIndex: number): 'left' | 'right' {
  return beatIndex % 2 === 0 ? 'left' : 'right'
}

export function teacherPoseAt(beatProgress: number, beatIndex: number): StickPose {
  const pose: StickPose = structuredClone(BASE)
  const leftFoot = teacherFootForBeat(beatIndex) === 'left'
  const groundY = BASE.leftAnkle.y

  // beatProgress is 0 at beat, increases toward 1 until next beat.
  // Lift the foot between beats; at the beat it plants exactly on the ground (never below).
  const strike = Math.max(0, 1 - beatProgress * 4)
  const lift = Math.sin(Math.min(1, beatProgress) * Math.PI) * 0.08

  if (leftFoot) {
    pose.leftKnee.y = BASE.leftKnee.y - lift * 0.6
    pose.leftAnkle.y = Math.min(groundY, BASE.leftAnkle.y - lift)
  } else {
    pose.rightKnee.y = BASE.rightKnee.y - lift * 0.6
    pose.rightAnkle.y = Math.min(groundY, BASE.rightAnkle.y - lift)
  }

  // Subtle body bounce on strike (compress down, feet stay on floor)
  const bounce = strike * 0.012
  pose.head.y += bounce
  pose.neck.y += bounce
  pose.hip.y += bounce
  pose.leftHip.y += bounce
  pose.rightHip.y += bounce
  pose.leftShoulder.y += bounce
  pose.rightShoulder.y += bounce

  return pose
}

const BONES: Array<[keyof StickPose, keyof StickPose]> = [
  ['neck', 'leftShoulder'],
  ['neck', 'rightShoulder'],
  ['leftShoulder', 'leftElbow'],
  ['leftElbow', 'leftWrist'],
  ['rightShoulder', 'rightElbow'],
  ['rightElbow', 'rightWrist'],
  ['neck', 'hip'],
  ['hip', 'leftHip'],
  ['hip', 'rightHip'],
  ['leftHip', 'leftKnee'],
  ['leftKnee', 'leftAnkle'],
  ['rightHip', 'rightKnee'],
  ['rightKnee', 'rightAnkle'],
]

export function drawStickFigure(
  ctx: CanvasRenderingContext2D,
  pose: StickPose,
  width: number,
  height: number,
  options: { color?: string; lineWidth?: number; headRadius?: number } = {},
) {
  const color = options.color ?? '#1a1a1a'
  const lineWidth = options.lineWidth ?? 4
  const to = (p: Point) => ({ x: p.x * width, y: p.y * height })

  ctx.save()
  ctx.strokeStyle = color
  ctx.fillStyle = color
  ctx.lineWidth = lineWidth
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  for (const [a, b] of BONES) {
    const pa = to(pose[a])
    const pb = to(pose[b])
    ctx.beginPath()
    ctx.moveTo(pa.x, pa.y)
    ctx.lineTo(pb.x, pb.y)
    ctx.stroke()
  }

  const head = to(pose.head)
  const r = (options.headRadius ?? 0.045) * Math.min(width, height)
  ctx.beginPath()
  ctx.arc(head.x, head.y, r, 0, Math.PI * 2)
  ctx.stroke()

  ctx.restore()
}

export type FootMarker = {
  side: 'left' | 'right'
  kind: 'hit' | 'miss'
  /** performance.now() when the burst started */
  startedAt: number
  /** Fixed normalized position — does not follow the animated ankle. */
  x: number
  y: number
}

export const FOOT_BURST_MS = 450

/**
 * Small instant burst at a fixed foot spot.
 * Starts at full (small) size, then shrinks + fades. Center never moves.
 */
export function drawFootBurst(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  marker: FootMarker,
  nowMs: number,
  dpr = 1,
) {
  const age = nowMs - marker.startedAt
  if (age < 0 || age > FOOT_BURST_MS) return

  const t = age / FOOT_BURST_MS
  const fade = 1 - t
  const shrink = Math.pow(1 - t, 1.2)
  const x = marker.x * width
  const y = marker.y * height
  const color = marker.kind === 'hit' ? '42, 157, 143' : '193, 18, 31'
  // Compact burst around the stomp point
  const maxR = 18 * dpr
  const r = Math.max(1, maxR * shrink)

  ctx.save()

  const glow = ctx.createRadialGradient(x, y, 0, x, y, r)
  glow.addColorStop(0, `rgba(${color}, ${0.95 * fade})`)
  glow.addColorStop(0.55, `rgba(${color}, ${0.45 * fade})`)
  glow.addColorStop(1, `rgba(${color}, 0)`)
  ctx.fillStyle = glow
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.fill()

  ctx.strokeStyle = `rgba(${color}, ${0.9 * fade})`
  ctx.lineWidth = Math.max(1.2 * dpr, 2.5 * dpr * fade)
  ctx.beginPath()
  ctx.arc(x, y, r * 0.85, 0, Math.PI * 2)
  ctx.stroke()

  const sparks = 8
  for (let i = 0; i < sparks; i++) {
    const angle = (i / sparks) * Math.PI * 2
    const dist = r * 0.55
    const px = x + Math.cos(angle) * dist
    const py = y + Math.sin(angle) * dist
    ctx.fillStyle = `rgba(${color}, ${0.9 * fade})`
    ctx.beginPath()
    ctx.arc(px, py, Math.max(0.7 * dpr, 2 * dpr * shrink), 0, Math.PI * 2)
    ctx.fill()
  }

  ctx.restore()
}

export function isFootBurstActive(marker: FootMarker, nowMs: number) {
  return nowMs - marker.startedAt <= FOOT_BURST_MS
}

/** MediaPipe Pose landmark indices used for overlay. */
export const POSE_CONNECTIONS: Array<[number, number]> = [
  [11, 12], // shoulders
  [11, 13],
  [13, 15],
  [12, 14],
  [14, 16],
  [11, 23],
  [12, 24],
  [23, 24],
  [23, 25],
  [25, 27],
  [27, 31],
  [24, 26],
  [26, 28],
  [28, 32],
]

export type Landmark = { x: number; y: number; z?: number; visibility?: number }

export type DrawPoseOptions = {
  mirror?: boolean
}

export function drawPoseLandmarks(
  ctx: CanvasRenderingContext2D,
  landmarks: Landmark[],
  width: number,
  height: number,
  options: DrawPoseOptions | boolean = {},
) {
  if (!landmarks.length) return

  const opts: DrawPoseOptions =
    typeof options === 'boolean' ? { mirror: options } : options
  const mirror = opts.mirror ?? true

  const map = (lm: Landmark) => ({
    x: (mirror ? 1 - lm.x : lm.x) * width,
    y: lm.y * height,
  })

  ctx.save()
  ctx.strokeStyle = 'rgba(46, 196, 182, 0.9)'
  ctx.fillStyle = 'rgba(46, 196, 182, 0.95)'
  ctx.lineWidth = 3
  ctx.lineCap = 'round'

  for (const [i, j] of POSE_CONNECTIONS) {
    const a = landmarks[i]
    const b = landmarks[j]
    if (!a || !b) continue
    // Soft threshold: partial body (legs only) still draws.
    if ((a.visibility ?? 1) < 0.2 || (b.visibility ?? 1) < 0.2) continue
    const pa = map(a)
    const pb = map(b)
    ctx.beginPath()
    ctx.moveTo(pa.x, pa.y)
    ctx.lineTo(pb.x, pb.y)
    ctx.stroke()
  }

  for (const lm of landmarks) {
    if ((lm.visibility ?? 1) < 0.2) continue
    const p = map(lm)
    ctx.beginPath()
    ctx.arc(p.x, p.y, 4, 0, Math.PI * 2)
    ctx.fill()
  }

  ctx.restore()
}

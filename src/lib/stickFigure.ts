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
export function teacherPoseAt(beatProgress: number, beatIndex: number): StickPose {
  const pose: StickPose = structuredClone(BASE)
  const leftFoot = beatIndex % 2 === 0

  // Ease: lift before beat, strike at beat (progress≈0), settle after.
  // beatProgress is 0 at beat, increases toward 1 until next beat.
  const strike = Math.max(0, 1 - beatProgress * 4) // sharp down near beat
  const lift = Math.sin(Math.min(1, beatProgress) * Math.PI) * 0.08

  if (leftFoot) {
    pose.leftKnee.y = BASE.leftKnee.y - lift * 0.6 + strike * 0.02
    pose.leftAnkle.y = BASE.leftAnkle.y - lift + strike * 0.04
    pose.leftAnkle.x = BASE.leftAnkle.x - strike * 0.01
  } else {
    pose.rightKnee.y = BASE.rightKnee.y - lift * 0.6 + strike * 0.02
    pose.rightAnkle.y = BASE.rightAnkle.y - lift + strike * 0.04
    pose.rightAnkle.x = BASE.rightAnkle.x + strike * 0.01
  }

  // Subtle body bounce on strike
  const bounce = strike * 0.015
  pose.head.y += bounce
  pose.neck.y += bounce
  pose.hip.y += bounce
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

/** Lower body only (hips → feet). */
export const LEGS_CONNECTIONS: Array<[number, number]> = [
  [23, 24],
  [23, 25],
  [25, 27],
  [27, 31],
  [24, 26],
  [26, 28],
  [28, 32],
]

const LEG_LANDMARK_INDEXES = new Set([23, 24, 25, 26, 27, 28, 29, 30, 31, 32])

export type Landmark = { x: number; y: number; z?: number; visibility?: number }

export type DrawPoseOptions = {
  mirror?: boolean
  /** Crop normalized image Y range [y0, y1] into the full canvas (legs-only zoom). */
  cropY?: [number, number]
  legsOnly?: boolean
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
  const cropY = opts.cropY
  const connections = opts.legsOnly ? LEGS_CONNECTIONS : POSE_CONNECTIONS

  const map = (lm: Landmark) => {
    let y = lm.y
    if (cropY) {
      const [y0, y1] = cropY
      y = (lm.y - y0) / (y1 - y0)
    }
    return {
      x: (mirror ? 1 - lm.x : lm.x) * width,
      y: y * height,
    }
  }

  ctx.save()
  ctx.strokeStyle = 'rgba(46, 196, 182, 0.9)'
  ctx.fillStyle = 'rgba(46, 196, 182, 0.95)'
  ctx.lineWidth = 3
  ctx.lineCap = 'round'

  for (const [i, j] of connections) {
    const a = landmarks[i]
    const b = landmarks[j]
    if (!a || !b) continue
    if ((a.visibility ?? 1) < 0.35 || (b.visibility ?? 1) < 0.35) continue
    const pa = map(a)
    const pb = map(b)
    if (cropY && (pa.y < -20 || pa.y > height + 20 || pb.y < -20 || pb.y > height + 20)) {
      continue
    }
    ctx.beginPath()
    ctx.moveTo(pa.x, pa.y)
    ctx.lineTo(pb.x, pb.y)
    ctx.stroke()
  }

  landmarks.forEach((lm, index) => {
    if ((lm.visibility ?? 1) < 0.35) return
    if (opts.legsOnly && !LEG_LANDMARK_INDEXES.has(index)) return
    const p = map(lm)
    if (cropY && (p.y < -10 || p.y > height + 10)) return
    ctx.beginPath()
    ctx.arc(p.x, p.y, 4, 0, Math.PI * 2)
    ctx.fill()
  })

  ctx.restore()
}

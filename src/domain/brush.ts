export type BrushPoint = {
  readonly x: number
  readonly y: number
}

export type BrushStroke = {
  readonly points: readonly BrushPoint[]
  readonly radius: number
}

type RasterSize = {
  readonly width: number
  readonly height: number
}

type Segment = {
  readonly start: BrushPoint
  readonly end: BrushPoint
}

export function rasterizeStroke(stroke: BrushStroke, size: RasterSize): Uint8Array {
  const mask = new Uint8Array(size.width * size.height)
  const first = stroke.points[0]
  if (first === undefined || size.width === 0 || size.height === 0) return mask
  const radius = Math.max(0.5, stroke.radius * Math.min(size.width, size.height))
  const points = stroke.points.map(({ x, y }) => ({
    x: Math.min(1, Math.max(0, x)) * (size.width - 1),
    y: Math.min(1, Math.max(0, y)) * (size.height - 1),
  }))
  const segments: readonly Segment[] =
    points.length === 1
      ? [{ start: points[0] ?? first, end: points[0] ?? first }]
      : points.slice(1).map((point, index) => ({ start: points[index] ?? first, end: point }))
  for (const { start, end } of segments) {
    if (start === undefined || end === undefined) continue
    const left = Math.max(0, Math.floor(Math.min(start.x, end.x) - radius))
    const right = Math.min(size.width - 1, Math.ceil(Math.max(start.x, end.x) + radius))
    const top = Math.max(0, Math.floor(Math.min(start.y, end.y) - radius))
    const bottom = Math.min(size.height - 1, Math.ceil(Math.max(start.y, end.y) + radius))
    for (let y = top; y <= bottom; y += 1) {
      for (let x = left; x <= right; x += 1) {
        if (distanceToSegment(x, y, { start, end }) <= radius) mask[y * size.width + x] = 1
      }
    }
  }
  return mask
}

function distanceToSegment(x: number, y: number, segment: Segment): number {
  const { start, end } = segment
  const dx = end.x - start.x
  const dy = end.y - start.y
  const lengthSquared = dx * dx + dy * dy
  if (lengthSquared === 0) return Math.hypot(x - start.x, y - start.y)
  const position = Math.min(
    1,
    Math.max(0, ((x - start.x) * dx + (y - start.y) * dy) / lengthSquared),
  )
  return Math.hypot(x - (start.x + position * dx), y - (start.y + position * dy))
}

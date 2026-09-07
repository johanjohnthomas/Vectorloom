import type { KeyboardEvent, PointerEvent } from "react"
import { useEffect, useId, useRef, useState } from "react"
import type { BrushStroke } from "../domain/brush"
import "./brush-surface.css"

type BrushPoint = BrushStroke["points"][number]

type BrushMark = {
  readonly stroke: BrushStroke
  readonly kind: "keep" | "remove"
}

type BrushSurfaceProps = {
  readonly sourceUrl: string
  readonly width: number
  readonly height: number
  readonly radius: number
  readonly active: boolean
  readonly label: string
  readonly onStroke: (stroke: BrushStroke) => void
  readonly marks?: readonly BrushMark[]
}

function pointFromPointer(event: PointerEvent<SVGSVGElement>): BrushPoint {
  const bounds = event.currentTarget.getBoundingClientRect()
  return {
    x: Math.min(1, Math.max(0, (event.clientX - bounds.left) / bounds.width)),
    y: Math.min(1, Math.max(0, (event.clientY - bounds.top) / bounds.height)),
  }
}

function appendPoint(
  points: readonly BrushPoint[],
  point: BrushPoint,
  radius: number,
  force = false,
): readonly BrushPoint[] {
  const previous = points.at(-1)
  if (previous === undefined) return [point]
  const minimumDistance = Math.max(0.002, radius * 0.28)
  const distance = Math.hypot(point.x - previous.x, point.y - previous.y)
  if (!force && distance < minimumDistance) return points
  if (points.length < 240) return [...points, point]
  return [...points.filter((_, index) => index % 2 === 0), point]
}

function strokePath(stroke: BrushStroke, width: number, height: number): string | undefined {
  if (stroke.points.length < 2) return undefined
  return stroke.points
    .map((point, index) => `${index === 0 ? "M" : "L"}${point.x * width} ${point.y * height}`)
    .join(" ")
}

function StrokeMark({
  stroke,
  color,
  width,
  height,
}: {
  readonly stroke: BrushStroke
  readonly color: string
  readonly width: number
  readonly height: number
}) {
  const path = strokePath(stroke, width, height)
  const strokeWidth = stroke.radius * Math.min(width, height) * 2
  const point = stroke.points[0]
  if (path === undefined && point !== undefined) {
    return <circle cx={point.x * width} cy={point.y * height} r={strokeWidth / 2} fill={color} />
  }
  return path === undefined ? undefined : (
    <path
      d={path}
      fill="none"
      stroke={color}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={strokeWidth}
    />
  )
}

export function BrushSurface({
  sourceUrl,
  width,
  height,
  radius,
  active,
  label,
  onStroke,
  marks = [],
}: BrushSurfaceProps) {
  const [inProgress, setInProgress] = useState<BrushStroke | undefined>(undefined)
  const [cursor, setCursor] = useState<BrushPoint>({ x: 0.5, y: 0.5 })
  const pointer = useRef<(BrushStroke & { readonly id: number }) | undefined>(undefined)
  const keyboardStroke = useRef<BrushStroke | undefined>(undefined)
  const helpId = useId()
  const [safeWidth, safeHeight] = [Math.max(1, width), Math.max(1, height)]
  const keepCount = marks.filter((mark) => mark.kind === "keep").length
  const removeCount = marks.length - keepCount

  const clearStrokes = (): void => {
    pointer.current = undefined
    keyboardStroke.current = undefined
    setInProgress(undefined)
  }

  useEffect(clearStrokes, [active, label, sourceUrl])

  const discardPointerStroke = (): void => {
    pointer.current = undefined
    setInProgress(undefined)
  }

  const addKeyboardPoint = (point: BrushPoint): void => {
    const stroke = keyboardStroke.current
    if (stroke === undefined) return
    const nextStroke = { ...stroke, points: appendPoint(stroke.points, point, radius, true) }
    keyboardStroke.current = nextStroke
    setInProgress(nextStroke)
  }

  const moveKeyboardCursor = (event: KeyboardEvent<SVGSVGElement>): void => {
    const horizontal = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0
    const vertical = event.key === "ArrowDown" ? 1 : event.key === "ArrowUp" ? -1 : 0
    if (horizontal === 0 && vertical === 0) return
    event.preventDefault()
    const nextCursor = {
      x: Math.min(1, Math.max(0, cursor.x + horizontal * 0.02)),
      y: Math.min(1, Math.max(0, cursor.y + vertical * 0.02)),
    }
    setCursor(nextCursor)
    addKeyboardPoint(nextCursor)
  }

  return (
    <div className="brush-surface" data-active={active}>
      <div className="brush-surface-frame" style={{ aspectRatio: `${safeWidth} / ${safeHeight}` }}>
        <img
          className="brush-surface-image"
          src={sourceUrl}
          alt=""
          aria-hidden="true"
          draggable={false}
        />
        <svg
          className="brush-surface-canvas"
          viewBox={`0 0 ${safeWidth} ${safeHeight}`}
          preserveAspectRatio="none"
          role="application"
          aria-label={label}
          aria-describedby={helpId}
          aria-disabled={!active}
          aria-keyshortcuts="ArrowUp ArrowDown ArrowLeft ArrowRight Space"
          tabIndex={active ? 0 : -1}
          onPointerDown={(event) => {
            if (!active || event.button !== 0) return
            const point = pointFromPointer(event)
            const stroke = { points: [point], radius }
            pointer.current = { id: event.pointerId, points: stroke.points, radius }
            setCursor(point)
            setInProgress(stroke)
            event.currentTarget.setPointerCapture(event.pointerId)
            event.currentTarget.focus({ preventScroll: true })
          }}
          onPointerMove={(event) => {
            const currentPointer = pointer.current
            if (!active) return
            const point = pointFromPointer(event)
            setCursor(point)
            if (currentPointer?.id !== event.pointerId) return
            const points = appendPoint(currentPointer.points, point, radius)
            if (points === currentPointer.points) return
            pointer.current = { ...currentPointer, points }
            setInProgress({ points, radius })
          }}
          onPointerUp={(event) => {
            const currentPointer = pointer.current
            if (!active || currentPointer?.id !== event.pointerId) return
            const point = pointFromPointer(event)
            const points = appendPoint(currentPointer.points, point, radius, true)
            pointer.current = undefined
            setCursor(point)
            setInProgress(undefined)
            onStroke({ points, radius })
          }}
          onPointerCancel={(event) => {
            if (pointer.current?.id === event.pointerId) discardPointerStroke()
          }}
          onLostPointerCapture={(event) => {
            if (pointer.current?.id === event.pointerId) discardPointerStroke()
          }}
          onBlur={clearStrokes}
          onKeyDown={(event) => {
            if (!active) return
            if (event.key === " ") {
              event.preventDefault()
              if (!event.repeat && keyboardStroke.current === undefined) {
                const stroke = { points: [cursor], radius }
                keyboardStroke.current = stroke
                setInProgress(stroke)
              }
              return
            }
            moveKeyboardCursor(event)
          }}
          onKeyUp={(event) => {
            if (event.key !== " ") return
            event.preventDefault()
            const stroke = keyboardStroke.current
            if (stroke === undefined) return
            keyboardStroke.current = undefined
            setInProgress(undefined)
            onStroke(stroke)
          }}
        >
          <g className="brush-surface-marks" aria-hidden="true">
            {marks.map((mark, index) => (
              <StrokeMark
                key={`${mark.kind}-${index}`}
                stroke={mark.stroke}
                color={mark.kind === "keep" ? "var(--cyan)" : "var(--danger)"}
                width={safeWidth}
                height={safeHeight}
              />
            ))}
            {inProgress && (
              <StrokeMark
                stroke={inProgress}
                color="var(--cyan)"
                width={safeWidth}
                height={safeHeight}
              />
            )}
          </g>
          {active && (
            <circle
              className="brush-surface-cursor"
              cx={cursor.x * safeWidth}
              cy={cursor.y * safeHeight}
              r={radius * Math.min(safeWidth, safeHeight)}
              aria-hidden="true"
            />
          )}
        </svg>
      </div>
      <p className="brush-surface-help" id={helpId}>
        {active
          ? "Drag to paint. Arrow keys move the brush; hold Space to paint."
          : "Select a repair tool to paint."}
      </p>
      {marks.length > 0 && (
        <p className="brush-surface-mark-summary" aria-live="polite">
          {keepCount > 0 && `${keepCount} keep ${keepCount === 1 ? "mark" : "marks"}`}
          {keepCount > 0 && removeCount > 0 && " · "}
          {removeCount > 0 && `${removeCount} remove ${removeCount === 1 ? "mark" : "marks"}`}
        </p>
      )}
    </div>
  )
}

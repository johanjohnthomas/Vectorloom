import { ImagePlus, LocateFixed, MousePointer2, RotateCcw } from "lucide-react"
import { AnimatePresence, m } from "motion/react"
import { type ReactNode, useEffect, useId, useRef } from "react"
import type { Selection } from "../services/image"

type Status = { readonly kind: "info" | "success" | "error"; readonly message: string }

type CanvasWorkspaceProps = {
  readonly image: ImageBitmap | undefined
  readonly selection: Selection
  readonly status: Status
  readonly isProcessing: boolean
  readonly svgUrl: string | undefined
  readonly previewControls?: ReactNode
  readonly previewLabel?: string
  readonly onFile: (input: unknown) => void
  readonly onSelectionChange: (selection: Selection) => void
  readonly onCustomSelection: () => void
  readonly onResetSelection: () => void
}

function pointerPosition(event: React.PointerEvent<HTMLCanvasElement>) {
  const rect = event.currentTarget.getBoundingClientRect()
  return {
    x: Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)),
    y: Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height)),
  }
}

function keyboardSelection(selection: Selection, key: string, resize: boolean): Selection {
  const step = 0.01
  if (resize) {
    const widthDelta = key === "ArrowRight" ? step : key === "ArrowLeft" ? -step : 0
    const heightDelta = key === "ArrowDown" ? step : key === "ArrowUp" ? -step : 0
    return {
      ...selection,
      width: Math.min(1 - selection.x, Math.max(step, selection.width + widthDelta)),
      height: Math.min(1 - selection.y, Math.max(step, selection.height + heightDelta)),
    }
  }
  const xDelta = key === "ArrowRight" ? step : key === "ArrowLeft" ? -step : 0
  const yDelta = key === "ArrowDown" ? step : key === "ArrowUp" ? -step : 0
  return {
    ...selection,
    x: Math.min(1 - selection.width, Math.max(0, selection.x + xDelta)),
    y: Math.min(1 - selection.height, Math.max(0, selection.y + yDelta)),
  }
}

export function CanvasWorkspace(props: CanvasWorkspaceProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const dragStart = useRef<{ readonly x: number; readonly y: number } | undefined>(undefined)
  const selectionHelpId = useId()

  useEffect(() => {
    const canvas = canvasRef.current
    if (canvas === null) return
    const context = canvas.getContext("2d")
    if (context === null) return
    const width = props.image?.width ?? 1200
    const height = props.image?.height ?? 760
    canvas.width = width
    canvas.height = height
    context.clearRect(0, 0, width, height)
    if (props.image) context.drawImage(props.image, 0, 0)
    else drawEmptyAtlas(context, width, height)
    if (props.image) drawSelection(context, props.selection, width, height)
  }, [props.image, props.selection])

  return (
    <div className="canvas-frame">
      <div className="canvas-toolbar">
        <span id={selectionHelpId}>
          <MousePointer2 aria-hidden="true" />
          Draw around your subject. Focus the canvas and use arrows to move, Shift + arrows to
          resize.
        </span>
        <button type="button" onClick={props.onResetSelection} disabled={!props.image}>
          <RotateCcw aria-hidden="true" />
          Reset selection
        </button>
      </div>
      <div className="canvas-stage">
        <canvas
          ref={canvasRef}
          aria-label="Subject selection canvas"
          aria-describedby={selectionHelpId}
          tabIndex={props.image ? 0 : -1}
          onPointerDown={(event) => {
            if (!props.image) return
            const point = pointerPosition(event)
            dragStart.current = point
            event.currentTarget.setPointerCapture(event.pointerId)
            props.onSelectionChange({ x: point.x, y: point.y, width: 0.01, height: 0.01 })
          }}
          onPointerMove={(event) => {
            const start = dragStart.current
            if (start === undefined) return
            const point = pointerPosition(event)
            props.onCustomSelection()
            props.onSelectionChange({
              x: Math.min(start.x, point.x),
              y: Math.min(start.y, point.y),
              width: Math.max(0.01, Math.abs(point.x - start.x)),
              height: Math.max(0.01, Math.abs(point.y - start.y)),
            })
          }}
          onPointerUp={() => {
            dragStart.current = undefined
          }}
          onPointerCancel={() => {
            dragStart.current = undefined
          }}
          onLostPointerCapture={() => {
            dragStart.current = undefined
          }}
          onKeyDown={(event) => {
            if (!event.key.startsWith("Arrow")) return
            event.preventDefault()
            props.onCustomSelection()
            props.onSelectionChange(keyboardSelection(props.selection, event.key, event.shiftKey))
          }}
        />
        {!props.image && <UploadField onFile={props.onFile} />}
        <AnimatePresence>
          {props.isProcessing && (
            <m.div
              className="processing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <LocateFixed aria-hidden="true" />
              <strong>Observing subject</strong>
              <span>The first smart isolation may download a model.</span>
            </m.div>
          )}
        </AnimatePresence>
        {props.svgUrl && (
          <m.div
            className="vector-preview"
            initial={{ opacity: 0, filter: "blur(8px)" }}
            animate={{ opacity: 1, filter: "blur(0px)" }}
          >
            <span className="coordinate">CUT PREVIEW</span>
            {props.previewControls}
            <img src={props.svgUrl} alt={`Cut preview: ${props.previewLabel ?? "All layers"}`} />
          </m.div>
        )}
      </div>
      <output className="status-line" data-kind={props.status.kind} aria-live="polite">
        <span />
        {props.status.message}
        {props.image && (
          <label className="replace-file">
            Replace image
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(event) => props.onFile(event.currentTarget.files?.item(0))}
            />
          </label>
        )}
      </output>
    </div>
  )
}

function UploadField({ onFile }: { readonly onFile: (input: unknown) => void }) {
  return (
    <label className="upload-card">
      <ImagePlus aria-hidden="true" />
      <strong>Bring an image into view</strong>
      <span>PNG, JPEG, or WebP · up to 20 MB</span>
      <input
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={(event) => onFile(event.currentTarget.files?.item(0))}
      />
    </label>
  )
}

function drawEmptyAtlas(context: CanvasRenderingContext2D, width: number, height: number): void {
  context.fillStyle = "#081725"
  context.fillRect(0, 0, width, height)
  context.strokeStyle = "rgba(255,107,74,.14)"
  context.lineWidth = 1
  for (let x = 0; x <= width; x += 80) {
    context.beginPath()
    context.moveTo(x, 0)
    context.lineTo(x, height)
    context.stroke()
  }
  for (let y = 0; y <= height; y += 80) {
    context.beginPath()
    context.moveTo(0, y)
    context.lineTo(width, y)
    context.stroke()
  }
}

function drawSelection(
  context: CanvasRenderingContext2D,
  selection: Selection,
  width: number,
  height: number,
): void {
  const x = selection.x * width
  const y = selection.y * height
  const boxWidth = selection.width * width
  const boxHeight = selection.height * height
  context.save()
  context.fillStyle = "rgba(6,17,31,.46)"
  context.fillRect(0, 0, width, y)
  context.fillRect(0, y + boxHeight, width, height - y - boxHeight)
  context.fillRect(0, y, x, boxHeight)
  context.fillRect(x + boxWidth, y, width - x - boxWidth, boxHeight)
  context.strokeStyle = "#41d7e8"
  context.lineWidth = Math.max(2, width / 500)
  context.setLineDash([12, 8])
  context.strokeRect(x, y, boxWidth, boxHeight)
  context.restore()
}

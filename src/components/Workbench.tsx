import { ShieldCheck } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import type { SvgAnalysis } from "../domain/vectorize"
import { applyAlphaMask, makeEdgeMask, makeSilhouettePixels } from "../domain/vectorize"
import type { Selection } from "../services/image"
import {
  assertSafeDimensions,
  assertSafeImageFile,
  ImageInputError,
  parseImageFile,
  prepareSelection,
} from "../services/image"
import { SegmentationError, segmentSubject } from "../services/segment"
import { traceImage } from "../services/trace"
import { CanvasWorkspace } from "./CanvasWorkspace"
import type { CutMode } from "./Inspector"
import { Inspector } from "./Inspector"
import { StageRail } from "./StageRail"

const DEFAULT_SELECTION: Selection = { x: 0.08, y: 0.08, width: 0.84, height: 0.84 }

type Status = { readonly kind: "info" | "success" | "error"; readonly message: string }

export function Workbench() {
  const operationId = useRef(0)
  const [image, setImage] = useState<ImageBitmap>()
  const [fileName, setFileName] = useState("Untitled artwork")
  const [selection, setSelection] = useState<Selection>(DEFAULT_SELECTION)
  const [cutMode, setCutMode] = useState<CutMode>("silhouette")
  const [colors, setColors] = useState(4)
  const [detail, setDetail] = useState(0.58)
  const [smoothing, setSmoothing] = useState(0.42)
  const [tolerance, setTolerance] = useState(40)
  const [selectionInset, setSelectionInset] = useState(8)
  const [isProcessing, setIsProcessing] = useState(false)
  const [status, setStatus] = useState<Status>({
    kind: "info",
    message: "Choose an image, then draw a box around the subject.",
  })
  const [svg, setSvg] = useState<string>()
  const [svgUrl, setSvgUrl] = useState<string>()
  const [analysis, setAnalysis] = useState<SvgAnalysis>()

  useEffect(() => {
    if (svg === undefined) {
      setSvgUrl(undefined)
      return
    }
    const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }))
    setSvgUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [svg])

  useEffect(() => () => image?.close(), [image])

  async function handleFile(input: unknown): Promise<void> {
    try {
      const file = parseImageFile(input)
      await assertSafeImageFile(file)
      const bitmap = await createImageBitmap(file)
      try {
        assertSafeDimensions(bitmap.width, bitmap.height)
      } catch (error) {
        bitmap.close()
        throw error
      }
      operationId.current += 1
      setImage(bitmap)
      setFileName(file.name.replace(/\.[^.]+$/u, ""))
      setSelection(DEFAULT_SELECTION)
      setSelectionInset(8)
      setSvg(undefined)
      setAnalysis(undefined)
      setStatus({
        kind: "success",
        message: "Image ready. Draw tightly around the subject you want to keep.",
      })
    } catch (error) {
      if (error instanceof ImageInputError) {
        setStatus({ kind: "error", message: error.reason })
        return
      }
      throw error
    }
  }

  async function vectorize(): Promise<void> {
    if (image === undefined) return
    const activeOperation = operationId.current + 1
    operationId.current = activeOperation
    setIsProcessing(true)
    setStatus({ kind: "info", message: "Finding the subject and mapping cut paths…" })
    try {
      const prepared = prepareSelection(image, image.width, image.height, selection)
      let mask: Float32Array
      let usedFallback = false
      try {
        mask = await segmentSubject(prepared.canvas)
      } catch (error) {
        if (!(error instanceof SegmentationError)) throw error
        mask = makeEdgeMask(prepared.imageData, tolerance)
        usedFallback = true
      }
      const tracedImage =
        cutMode === "silhouette"
          ? new ImageData(
              Uint8ClampedArray.from(makeSilhouettePixels(prepared.imageData.data, mask, 0.42)),
              prepared.imageData.width,
              prepared.imageData.height,
            )
          : applyAlphaMask(prepared.imageData, mask, 0.42)
      const result = traceImage(tracedImage, {
        colors: cutMode === "silhouette" ? 2 : colors,
        detail,
        smoothing,
      })
      if (operationId.current !== activeOperation) return
      setSvg(result.svg)
      setAnalysis(result.analysis)
      setStatus({
        kind: "success",
        message: usedFallback
          ? "Cut paths created with edge isolation. Smart isolation was unavailable."
          : "Subject isolated and cut paths created.",
      })
    } catch (error) {
      if (error instanceof Error) {
        setStatus({
          kind: "error",
          message: "Vectorization failed. Try a smaller selection or lower detail.",
        })
        return
      }
      throw error
    } finally {
      setIsProcessing(false)
    }
  }

  function download(): void {
    if (svg === undefined) return
    const link = document.createElement("a")
    const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }))
    link.href = url
    link.download = `${fileName || "vectorloom"}-cut.svg`
    link.click()
    URL.revokeObjectURL(url)
  }

  const currentStage = isProcessing ? 2 : analysis ? 3 : image ? 1 : 0

  return (
    <main className="app-shell">
      <StageRail current={currentStage} />
      <section className="workspace">
        <header className="workspace-header">
          <div>
            <p className="coordinate">VECTORLOOM / LOCAL WORKSPACE</p>
            <h1>{fileName}</h1>
          </div>
          <span className="privacy">
            <ShieldCheck aria-hidden="true" />
            Your image stays here
          </span>
        </header>
        <CanvasWorkspace
          image={image}
          selection={selection}
          status={status}
          isProcessing={isProcessing}
          svgUrl={svgUrl}
          onFile={(input) => void handleFile(input)}
          onSelectionChange={setSelection}
          onCustomSelection={() => setSelectionInset(0)}
          onResetSelection={() => {
            setSelection(DEFAULT_SELECTION)
            setSelectionInset(8)
          }}
        />
      </section>
      <Inspector
        hasImage={image !== undefined}
        isProcessing={isProcessing}
        cutMode={cutMode}
        colors={colors}
        detail={detail}
        smoothing={smoothing}
        tolerance={tolerance}
        selectionInset={selectionInset}
        analysis={analysis}
        onCutModeChange={setCutMode}
        onColorsChange={setColors}
        onDetailChange={setDetail}
        onSmoothingChange={setSmoothing}
        onToleranceChange={setTolerance}
        onSelectionInsetChange={(value) => {
          const inset = value / 100
          setSelectionInset(value)
          setSelection({ x: inset, y: inset, width: 1 - inset * 2, height: 1 - inset * 2 })
        }}
        onVectorize={() => void vectorize()}
        onDownload={download}
      />
    </main>
  )
}

import { useEffect, useRef, useState } from "react"
import type { BrushStroke } from "../domain/brush"
import type { SelectionMark } from "../domain/selection-marks"
import { generateArtwork, traceSettings } from "../services/generate-artwork"
import {
  assertSafeDimensions,
  assertSafeImageFile,
  ImageInputError,
  parseImageFile,
  prepareSelection,
  type Selection,
} from "../services/image"
import {
  DEFAULT_SETTINGS,
  loadSavedSettings,
  type SavedSettings,
  saveSavedSettings,
} from "../services/saved-settings"
import { useLayerRepairs } from "./useLayerRepairs"

export const FULL_SELECTION: Selection = { x: 0, y: 0, width: 1, height: 1 }
export type SelectionTool = "keep" | "remove" | "box"
type Status = { readonly kind: "info" | "success" | "error"; readonly message: string }

export function useVectorProject() {
  const operation = useRef(0)
  const [preferences, setPreferences] = useState<SavedSettings>(
    () => loadSavedSettings() ?? DEFAULT_SETTINGS,
  )
  const [source, setSource] = useState<{
    readonly image: ImageBitmap
    readonly url: string
    readonly name: string
  }>()
  const [selection, setSelection] = useState(FULL_SELECTION)
  const [selectionTool, setSelectionTool] = useState<SelectionTool>("keep")
  const [marks, setMarks] = useState<readonly SelectionMark[]>([])
  const [radius, setRadius] = useState(0.025)
  const [isProcessing, setIsProcessing] = useState(false)
  const [status, setStatus] = useState<Status>({
    kind: "info",
    message: "Choose an image. Brush the subject if it needs a little guidance.",
  })
  const [originalUrl, setOriginalUrl] = useState("")
  const [generatedKey, setGeneratedKey] = useState("")
  const output = useLayerRepairs(traceSettings(preferences))
  const settingsKey = JSON.stringify({ preferences, selection, marks })
  const isStale = output.result !== undefined && settingsKey !== generatedKey
  const canDownload =
    !isStale &&
    !isProcessing &&
    (output.result?.layers.some((layer) => layer.paths.length > 0) ?? false)

  useEffect(() => () => source?.image.close(), [source])

  async function handleFile(input: unknown): Promise<void> {
    const active = ++operation.current
    setIsProcessing(false)
    try {
      const file = parseImageFile(input)
      await assertSafeImageFile(file)
      const image = await createImageBitmap(file)
      if (operation.current !== active) {
        image.close()
        return
      }
      try {
        assertSafeDimensions(image.width, image.height)
        const preview = prepareSelection(image, image.width, image.height, FULL_SELECTION)
        setSource({
          image,
          name: file.name.replace(/\.[^.]+$/u, ""),
          url: preview.canvas.toDataURL("image/png"),
        })
      } catch (error) {
        image.close()
        throw error
      }
      setSelection(FULL_SELECTION)
      setSelectionTool("keep")
      setMarks([])
      output.reset()
      setStatus({
        kind: "success",
        message:
          "Image ready. Brush over the subject, or create cut paths with automatic isolation.",
      })
    } catch (error) {
      if (active !== operation.current) return
      if (error instanceof Error) {
        setStatus({
          kind: "error",
          message:
            error instanceof ImageInputError
              ? error.reason
              : "That image could not be opened. Try another PNG, JPEG, or WebP.",
        })
        return
      }
      throw error
    }
  }

  function chooseSelectionTool(tool: SelectionTool): void {
    if ((tool === "box") !== (selectionTool === "box")) {
      setMarks([])
      setSelection(FULL_SELECTION)
    }
    setSelectionTool(tool)
  }

  function mark(stroke: BrushStroke): void {
    if (selectionTool === "box" || isProcessing) return
    setMarks((previous) => [...previous, { kind: selectionTool, stroke }])
  }

  function changeSelection(next: Selection): void {
    setSelection(next)
    setMarks([])
    setSelectionTool("box")
  }

  async function vectorize(): Promise<void> {
    if (source === undefined) return
    const active = ++operation.current
    setIsProcessing(true)
    setStatus({ kind: "info", message: "Finding the subject and preparing your layers…" })
    try {
      const generated = await generateArtwork(source.image, {
        selection,
        marks,
        settings: preferences,
      })
      if (operation.current !== active) return
      output.reset(generated.result)
      setOriginalUrl(generated.originalUrl)
      setGeneratedKey(settingsKey)
      setStatus({
        kind: "success",
        message: generated.usedFallback
          ? "Cut paths created with edge isolation and your brush marks. Smart isolation was unavailable."
          : "Cut paths created. Compare the original and repair any missing details.",
      })
    } catch (error) {
      if (operation.current !== active) return
      if (error instanceof Error)
        setStatus({
          kind: "error",
          message:
            "Could not create paths. Try marking the subject or adjusting Advanced settings.",
        })
      else throw error
    } finally {
      if (operation.current === active) setIsProcessing(false)
    }
  }

  function repair(stroke: BrushStroke): void {
    if (isStale || isProcessing) return
    const changed = output.repair(stroke)
    setStatus({
      kind: changed ? "success" : "info",
      message: changed
        ? "Layer repaired. Your SVG download includes this change."
        : output.tool === "new"
          ? "Brush a visible part of the original to sample its color."
          : output.tool === "erase"
            ? "No paths changed. Brush over a filled area to erase it."
            : "No paths changed. To add in All layers, start on a color in the cut preview, or select a layer to paint freely.",
    })
  }

  function download(): void {
    if (!canDownload || output.result === undefined) return
    const link = document.createElement("a")
    const url = URL.createObjectURL(new Blob([output.result.svg], { type: "image/svg+xml" }))
    link.href = url
    link.download = `${source?.name || "vectorloom"}-cut.svg`
    link.click()
    URL.revokeObjectURL(url)
    const saved = saveSavedSettings(preferences)
    setStatus({
      kind: "success",
      message: saved
        ? "SVG downloaded. Your cut settings were saved for next time."
        : "SVG downloaded. Your browser could not save cut settings.",
    })
  }

  return {
    source,
    selection,
    selectionTool,
    chooseSelectionTool,
    changeSelection,
    marks,
    mark,
    clearMarks: () => setMarks([]),
    undoMark: () => setMarks((previous) => previous.slice(0, -1)),
    radius,
    setRadius,
    preferences,
    changeSettings: (patch: Partial<SavedSettings>) =>
      setPreferences((previous) => ({ ...previous, ...patch })),
    resetSettings: () => setPreferences(DEFAULT_SETTINGS),
    isProcessing,
    status,
    output,
    originalUrl,
    isStale,
    canDownload,
    handleFile,
    vectorize,
    repair,
    download,
  }
}

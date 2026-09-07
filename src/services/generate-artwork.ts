import { applySelectionMarks, type SelectionMark } from "../domain/selection-marks"
import { applyAlphaMask, makeEdgeMask, makeSilhouettePixels } from "../domain/vectorize"
import { prepareSelection, type Selection } from "./image"
import type { SavedSettings } from "./saved-settings"
import { SegmentationError, segmentSubject } from "./segment"
import { type TraceSettings, traceImage } from "./trace"

export function traceSettings(settings: SavedSettings): TraceSettings {
  return {
    ...settings,
    colors: settings.cutMode === "silhouette" ? 1 : settings.colors,
    mergeShades: settings.cutMode === "silhouette" ? 0 : settings.mergeShades,
    filledBacking: settings.cutMode === "layered" && settings.filledBacking,
  }
}

type GenerationOptions = {
  readonly selection: Selection
  readonly marks: readonly SelectionMark[]
  readonly settings: SavedSettings
}

export async function generateArtwork(image: ImageBitmap, options: GenerationOptions) {
  const prepared = prepareSelection(image, image.width, image.height, options.selection)
  const original = prepared.imageData
  let mask: Float32Array
  let usedFallback = false
  const hasTransparency = original.data.some((value, index) => index % 4 === 3 && value < 255)
  if (hasTransparency && options.marks.length === 0) {
    mask = Float32Array.from(
      { length: original.width * original.height },
      (_, index) => (original.data[index * 4 + 3] ?? 0) / 255,
    )
  } else {
    try {
      mask = await segmentSubject(prepared.canvas, options.marks)
    } catch (error) {
      if (!(error instanceof SegmentationError)) throw error
      mask = makeEdgeMask(original, options.settings.tolerance)
      usedFallback = true
    }
  }
  mask = applySelectionMarks(mask, options.marks, original)
  const isolated =
    options.settings.cutMode === "silhouette"
      ? new ImageData(
          Uint8ClampedArray.from(makeSilhouettePixels(original.data, mask, 0.42)),
          original.width,
          original.height,
        )
      : applyAlphaMask(original, mask, 0.42)
  return {
    result: traceImage(isolated, traceSettings(options.settings), original),
    originalUrl: prepared.canvas.toDataURL("image/png"),
    usedFallback,
  }
}

import type { InteractiveSegmenter } from "@mediapipe/tasks-vision"
import type { SelectionMark } from "../domain/selection-marks"

const WASM_ROOT = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm"
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/interactive_segmenter_v2/magic_touch/int8/1/interactive_segmentation.task"

export class SegmentationError extends Error {
  public readonly detail: string

  public constructor(detail: string) {
    super("The smart isolation model could not run.")
    this.name = "SegmentationError"
    this.detail = detail
  }
}

let segmenterPromise: Promise<InteractiveSegmenter> | undefined

function loadSegmenter(): Promise<InteractiveSegmenter> {
  if (segmenterPromise === undefined) {
    segmenterPromise = import("@mediapipe/tasks-vision").then(async (vision) => {
      const fileset = await vision.FilesetResolver.forVisionTasks(WASM_ROOT)
      return vision.InteractiveSegmenter.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: MODEL_URL },
      })
    })
  }
  return segmenterPromise
}

export async function segmentSubject(
  image: HTMLCanvasElement,
  marks: readonly SelectionMark[] = [],
): Promise<Float32Array> {
  try {
    const segmenter = await loadSegmenter()
    segmenter.setImage(image)
    const strokes = marks.map(({ kind, stroke }) => ({
      brushMode: kind === "keep" ? 1 : 2,
      point: stroke.points.map(({ x, y }) => ({ x, y })),
      isCompleted: true,
    }))
    const result = segmenter.segment(
      strokes.some((stroke) => stroke.brushMode === 1)
        ? strokes
        : [
            {
              brushMode: 1,
              point: [{ x: 0.5, y: 0.5 }],
              isCompleted: true,
            },
            ...strokes,
          ],
    )
    const pixels = result.getAsFloat32Array().slice()
    result.close()
    return pixels
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown segmentation failure"
    segmenterPromise = undefined
    throw new SegmentationError(detail)
  }
}

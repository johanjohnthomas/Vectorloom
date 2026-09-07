import { type BrushStroke, rasterizeStroke } from "./brush"

export type SelectionMark = {
  readonly kind: "keep" | "remove"
  readonly stroke: BrushStroke
}

export function applySelectionMarks(
  mask: Float32Array,
  marks: readonly SelectionMark[],
  size: { readonly width: number; readonly height: number },
): Float32Array {
  const output = new Float32Array(mask)
  for (const mark of marks) {
    const pixels = rasterizeStroke(mark.stroke, size)
    for (let index = 0; index < pixels.length; index += 1) {
      if (pixels[index] === 1) output[index] = mark.kind === "keep" ? 1 : 0
    }
  }
  return output
}

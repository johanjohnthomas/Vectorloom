import { describe, expect, it } from "vitest"
import { applySelectionMarks, type SelectionMark } from "./selection-marks"

describe("selection brush guidance", () => {
  it("keeps a missed subject region without mutating the model mask", () => {
    const mask = new Float32Array(100)
    const marks: readonly SelectionMark[] = [
      { kind: "keep", stroke: { points: [{ x: 0.5, y: 0.5 }], radius: 0.2 } },
    ]
    const result = applySelectionMarks(mask, marks, { width: 10, height: 10 })
    expect(result[55]).toBe(1)
    expect(result[0]).toBe(0)
    expect(mask[55]).toBe(0)
  })

  it("applies keep and remove strokes in the user's order", () => {
    const mask = new Float32Array(100).fill(1)
    const stroke = { points: [{ x: 0.5, y: 0.5 }], radius: 0.2 }
    const removed = applySelectionMarks(mask, [{ kind: "remove", stroke }], {
      width: 10,
      height: 10,
    })
    const restored = applySelectionMarks(
      mask,
      [
        { kind: "remove", stroke },
        { kind: "keep", stroke },
      ],
      { width: 10, height: 10 },
    )
    expect(removed[55]).toBe(0)
    expect(removed[0]).toBe(1)
    expect(restored[55]).toBe(1)
  })
})

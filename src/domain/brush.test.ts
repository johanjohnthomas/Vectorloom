import { describe, expect, it } from "vitest"
import { rasterizeStroke } from "./brush"

describe("rasterizeStroke", () => {
  it("draws one continuous round stroke between distant points", () => {
    // Given
    const stroke = {
      points: [
        { x: 0.1, y: 0.5 },
        { x: 0.9, y: 0.5 },
      ],
      radius: 0.08,
    }

    // When
    const mask = rasterizeStroke(stroke, { width: 20, height: 10 })

    // Then
    expect(Array.from(mask.slice(5 * 20 + 2, 5 * 20 + 18))).toEqual(Array(16).fill(1))
  })

  it("stamps a single point without wrapping across rows", () => {
    // Given
    const stroke = { points: [{ x: 0, y: 0.5 }], radius: 0.2 }

    // When
    const mask = rasterizeStroke(stroke, { width: 5, height: 5 })

    // Then
    expect(mask[2 * 5]).toBe(1)
    expect(mask[1 * 5 + 4]).toBe(0)
    expect(mask[2 * 5 + 4]).toBe(0)
  })
})

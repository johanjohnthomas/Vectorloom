import { describe, expect, it } from "vitest"
import { preparePalette } from "./palette"

function imageFromPixels(pixels: readonly number[]): ImageData {
  const width = pixels.length / 4
  return {
    data: new Uint8ClampedArray(pixels),
    width,
    height: 1,
    colorSpace: "srgb",
  }
}

describe("preparePalette", () => {
  it("consolidates related red shades while retaining red, blue, black, and white", () => {
    // Given
    const image = imageFromPixels([
      190, 28, 25, 255, 205, 38, 30, 255, 142, 20, 18, 255, 235, 74, 62, 255, 10, 10, 10, 255, 250,
      250, 250, 255, 35, 80, 210, 255,
    ])

    // When
    const result = preparePalette(image, { colors: 4, mergeShades: 0.6 })

    // Then
    expect(result.palette).toHaveLength(4)
    expect(result.palette.some((color) => color.r > color.g * 2 && color.r > color.b * 2)).toBe(
      true,
    )
    expect(result.palette.some((color) => color.b > color.r * 1.5)).toBe(true)
    expect(result.palette.some((color) => color.r < 30 && color.g < 30 && color.b < 30)).toBe(true)
    expect(result.palette.some((color) => color.r > 230 && color.g > 230 && color.b > 230)).toBe(
      true,
    )
  })

  it("makes alpha binary and ignores transparent colors when choosing the palette", () => {
    // Given
    const image = imageFromPixels([
      210, 30, 20, 255, 205, 35, 25, 255, 0, 255, 0, 0, 0, 0, 255, 127, 0, 255, 255, 128,
    ])

    // When
    const result = preparePalette(image, { colors: 2, mergeShades: 0.6 })

    // Then
    expect(result.palette).toHaveLength(2)
    expect(result.palette.some((color) => color.r > color.g * 2 && color.r > color.b * 2)).toBe(
      true,
    )
    expect(result.palette.some((color) => color.g > color.r)).toBe(true)
    expect(Array.from(result.pixels.filter((_, index) => index % 4 === 3))).toEqual([
      255, 255, 0, 0, 255,
    ])
  })

  it("is deterministic and never exceeds the requested color cap", () => {
    // Given
    const image = imageFromPixels([
      200, 30, 25, 255, 150, 20, 15, 255, 25, 80, 210, 255, 20, 160, 80, 255, 250, 250, 250, 255, 5,
      5, 5, 255,
    ])

    // When
    const first = preparePalette(image, { colors: 3, mergeShades: 0.6 })
    const second = preparePalette(image, { colors: 3, mergeShades: 0.6 })

    // Then
    expect(first.palette).toEqual(second.palette)
    expect(Array.from(first.pixels)).toEqual(Array.from(second.pixels))
    expect(first.palette.length).toBeLessThanOrEqual(3)
  })

  it("preserves more red shade variation at a lower merge strength", () => {
    // Given
    const image = imageFromPixels([
      105, 12, 10, 255, 145, 20, 17, 255, 185, 28, 23, 255, 225, 48, 38, 255,
    ])

    // When
    const merged = preparePalette(image, { colors: 4, mergeShades: 0.6 })
    const preserved = preparePalette(image, { colors: 4, mergeShades: 0.05 })

    // Then
    expect(preserved.palette.length).toBeGreaterThan(merged.palette.length)
  })
})

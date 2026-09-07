import { describe, expect, it } from "vitest"
import { buildLayerMasks } from "./layer-masks"

const TRANSPARENT = [0, 0, 0, 0] as const

function image(rows: readonly (readonly (readonly [number, number, number, number])[])[]) {
  const height = rows.length
  const width = rows[0]?.length ?? 0
  return {
    width,
    height,
    data: new Uint8ClampedArray(rows.flat(2)),
  }
}

const black = [0, 0, 0, 255] as const
const blue = [0, 0, 255, 255] as const
const red = [255, 0, 0, 255] as const
const white = [255, 255, 255, 255] as const

describe("buildLayerMasks", () => {
  it("fills an eye ring beneath its pupil regardless of palette encounter order", () => {
    // Given
    const source = image([
      [black, white, white, white],
      [TRANSPARENT, white, black, white],
      [TRANSPARENT, white, white, white],
    ])

    // When
    const result = buildLayerMasks(source, { filledBacking: true, smoothing: 0 })

    // Then
    expect(result.layers.map(({ color }) => color)).toEqual(["#ffffff", "#000000"])
    expect(Array.from(result.layers[0]?.mask ?? [])).toEqual([0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1])
  })

  it("keeps the pupil knocked out when filled backing is disabled", () => {
    // Given
    const source = image([
      [white, white, white],
      [white, black, white],
      [white, white, white],
    ])

    // When
    const result = buildLayerMasks(source, { filledBacking: false, smoothing: 0 })

    // Then
    expect(Array.from(result.layers.find(({ color }) => color === "#ffffff")?.mask ?? [])).toEqual([
      1, 1, 1, 1, 0, 1, 1, 1, 1,
    ])
  })

  it("retains a transparent hole in a subject", () => {
    // Given
    const source = image([
      [red, red, red],
      [red, TRANSPARENT, red],
      [red, red, red],
    ])

    // When
    const result = buildLayerMasks(source, { filledBacking: true, smoothing: 0 })

    // Then
    expect(result.layers[0]?.pixelCount).toBe(8)
    expect(result.layers[0]?.mask[4]).toBe(0)
  })

  it("orders and fills nested colors from outermost to innermost", () => {
    // Given
    const source = image([
      [red, red, red, red, red],
      [red, white, white, white, red],
      [red, white, black, white, red],
      [red, white, white, white, red],
      [red, red, red, red, red],
    ])

    // When
    const result = buildLayerMasks(source, { filledBacking: true, smoothing: 0 })

    // Then
    expect(result.layers.map(({ color, pixelCount }) => [color, pixelCount])).toEqual([
      ["#ff0000", 25],
      ["#ffffff", 9],
      ["#000000", 1],
    ])
  })

  it("falls back to knockout masks when color containment is cyclic", () => {
    // Given
    const source = image([
      [red, red, red, TRANSPARENT, blue, blue, blue],
      [red, blue, red, TRANSPARENT, blue, red, blue],
      [red, red, red, TRANSPARENT, blue, blue, blue],
    ])

    // When
    const result = buildLayerMasks(source, { filledBacking: true, smoothing: 0 })

    // Then
    expect(result.warnings).toHaveLength(1)
    expect(
      result.layers.map(({ pixelCount }) => pixelCount).sort((left, right) => left - right),
    ).toEqual([9, 9])
  })

  it("returns no layers for an empty image", () => {
    // Given
    const source = { data: new Uint8ClampedArray(), width: 0, height: 0 }

    // When
    const result = buildLayerMasks(source, { filledBacking: true, smoothing: 0 })

    // Then
    expect(result).toEqual({ layers: [], warnings: [] })
  })

  it("removes an isolated interior color when smoothing is enabled", () => {
    // Given
    const source = image([
      [red, red, red, red, red],
      [red, red, red, red, red],
      [red, red, blue, red, red],
      [red, red, red, red, red],
      [red, red, red, red, red],
    ])

    // When
    const result = buildLayerMasks(source, { filledBacking: false, smoothing: 0.5 })

    // Then
    expect(result.layers.map(({ color, pixelCount }) => [color, pixelCount])).toEqual([
      ["#ff0000", 25],
    ])
  })
})

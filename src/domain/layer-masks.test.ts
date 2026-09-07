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
  it("joins separated color panels with backing hidden beneath an upper stripe", () => {
    const source = image([
      [red, red, blue, red, red],
      [red, red, blue, red, red],
      [red, red, blue, red, red],
    ])

    const result = buildLayerMasks(source, { filledBacking: true, smoothing: 0 })

    expect(result.layers.map(({ color, pixelCount }) => [color, pixelCount])).toEqual([
      ["#ff0000", 15],
      ["#0000ff", 3],
    ])
  })

  it("does not bridge transparent space between separate subjects", () => {
    const source = image([[red, blue, TRANSPARENT, red, blue]])

    const result = buildLayerMasks(source, { filledBacking: true, smoothing: 0 })

    for (const layer of result.layers) expect(layer.mask[2]).toBe(0)
  })

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
    expect(Array.from(result.layers[0]?.mask ?? [])).toEqual([1, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1])
    expect(result.layers[1]?.mask[0]).toBe(1)
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

  it("adds safe backing while retaining necessary cut-outs when color containment is cyclic", () => {
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
    ).toEqual([9, 18])
  })

  it("returns no layers for an empty image", () => {
    // Given
    const source = { data: new Uint8ClampedArray(), width: 0, height: 0 }

    // When
    const result = buildLayerMasks(source, { filledBacking: true, smoothing: 0 })

    // Then
    expect(result).toEqual({ layers: [], warnings: [] })
  })

  it("preserves every assembled pixel with filled backing on mixed-color artwork", () => {
    const palette = [red, blue, black, white, TRANSPARENT]
    for (let seed = 1; seed <= 20; seed += 1) {
      let state = seed
      const rows = Array.from({ length: 12 }, () =>
        Array.from({ length: 12 }, () => {
          state = (Math.imul(state, 1664525) + 1013904223) >>> 0
          return palette[state % palette.length] ?? TRANSPARENT
        }),
      )
      const source = image(rows)

      const result = buildLayerMasks(source, { filledBacking: true, smoothing: 0 })

      for (let index = 0; index < 144; index += 1) {
        const pixel = rows[Math.floor(index / 12)]?.[index % 12] ?? TRANSPARENT
        const top = [...result.layers].reverse().find((layer) => layer.mask[index] === 1)
        const expected =
          pixel[3] === 0
            ? undefined
            : `#${pixel
                .slice(0, 3)
                .map((channel) => channel.toString(16).padStart(2, "0"))
                .join("")}`
        expect(top?.color).toBe(expected)
      }
    }
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

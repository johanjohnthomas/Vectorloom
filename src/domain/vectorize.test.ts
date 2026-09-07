import { describe, expect, it } from "vitest"
import { analyzeSvg, assessComplexity, makeSilhouettePixels, sanitizeSvg } from "./vectorize"

describe("makeSilhouettePixels", () => {
  it("makes opaque dark pixels cuttable when they are inside the subject mask", () => {
    // Given
    const source = new Uint8ClampedArray([20, 30, 40, 255, 230, 230, 230, 255])

    // When
    const result = makeSilhouettePixels(source, new Float32Array([1, 0]), 0.5)

    // Then
    expect(Array.from(result)).toEqual([6, 17, 31, 255, 255, 255, 255, 0])
  })
})

describe("sanitizeSvg", () => {
  it("keeps flat paths and removes Cricut-unsupported embedded content", () => {
    // Given
    const source =
      '<svg width="10" height="10"><defs><linearGradient id="g"/></defs><image href="x.png"/><path d="M0 0L10 0Z" fill="#000"/><path d="M1 1Z" fill="#fff" opacity="0"/></svg>'

    // When
    const result = sanitizeSvg(source, 10, 10)

    // Then
    expect(result).toContain('viewBox="0 0 10 10"')
    expect(result).toContain("<path")
    expect(result).not.toContain("<image")
    expect(result).not.toContain("linearGradient")
    expect(result).not.toContain('opacity="0"')
  })
})

describe("assessComplexity", () => {
  it("rates a compact three-layer trace as ready to cut", () => {
    // Given
    const pathCount = 24
    const layerCount = 3

    // When
    const result = assessComplexity(pathCount, layerCount)

    // Then
    expect(result.rating).toBe("ready")
    expect(result.score).toBeLessThanOrEqual(35)
  })

  it("counts ImageTracer rgb fills as distinct layers", () => {
    // Given
    const svg = '<svg><path fill="rgb(6,17,31)"/><path fill="rgb(255,107,74)"/></svg>'

    // When
    const analysis = analyzeSvg(sanitizeSvg(svg, 10, 10)).complexity

    // Then
    expect(analysis.score).toBe(8)
  })

  it("rates a thousand-path trace as dense", () => {
    // Given
    const pathCount = 1_000
    const layerCount = 8

    // When
    const result = assessComplexity(pathCount, layerCount)

    // Then
    expect(result.rating).toBe("dense")
    expect(result.score).toBe(100)
  })
})

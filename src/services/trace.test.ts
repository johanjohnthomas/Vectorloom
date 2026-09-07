import { describe, expect, it } from "vitest"
import { type TraceSettings, traceImage } from "./trace"

const settings: TraceSettings = {
  colors: 4,
  mergeShades: 0.6,
  filledBacking: false,
  smoothing: 0,
  detail: 0.95,
}

function eyeImage(): ImageData {
  const width = 64
  const data = new Uint8ClampedArray(width * width * 4)
  for (let y = 8; y < 56; y += 1) {
    for (let x = 8; x < 56; x += 1) {
      const pupil = x >= 24 && x < 40 && y >= 24 && y < 40
      data.set(pupil ? [0, 0, 0, 255] : [255, 255, 255, 255], (y * width + x) * 4)
    }
  }
  return { data, width, height: width, colorSpace: "srgb" }
}

describe("craft SVG export", () => {
  it("fills the white eye beneath its pupil and exports assembly order", () => {
    const knockout = traceImage(eyeImage(), settings)
    const stacked = traceImage(eyeImage(), { ...settings, filledBacking: true })
    const whiteCutout = knockout.layers.find((layer) => layer.color === "#ffffff")
    const whiteBacking = stacked.layers.find((layer) => layer.color === "#ffffff")
    expect(whiteCutout?.paths.join("").match(/M/gu)).toHaveLength(2)
    expect(whiteBacking?.paths.join("").match(/M/gu)).toHaveLength(1)
    expect(stacked.layers.map((layer) => layer.color)).toEqual(["#ffffff", "#000000"])
    const svg = new DOMParser().parseFromString(stacked.svg, "image/svg+xml")
    expect(svg.querySelectorAll("g")).toHaveLength(2)
    expect(svg.querySelector("g")?.getAttribute("fill")).toBe("#ffffff")
    expect(svg.querySelectorAll("image, mask, filter, [stroke], [opacity]")).toHaveLength(0)
    expect(stacked.analysis.layerCount).toBe(2)
  })

  it("returns no fake layer for an empty mask", () => {
    const image = eyeImage()
    image.data.fill(0)
    const result = traceImage(image, settings)
    expect(result.layers).toHaveLength(0)
    expect(result.analysis.layerCount).toBe(0)
    expect(result.warnings).toHaveLength(1)
  })

  it("reduces curve segments on a jagged silhouette at higher smoothing", () => {
    const image = eyeImage()
    image.data.fill(0)
    for (let y = 0; y < 64; y += 1) {
      for (let x = 0; x < 64; x += 1) {
        const radius = 20 + (y % 3 === 0 ? 1 : -1)
        if (Math.hypot(x - 32, y - 32) < radius) image.data.set([6, 17, 31, 255], (y * 64 + x) * 4)
      }
    }
    const detailed = traceImage(image, settings)
    const smooth = traceImage(image, { ...settings, smoothing: 0.9 })
    const count = (svg: string) => svg.match(/[LQ]/gu)?.length ?? 0
    expect(count(smooth.svg)).toBeLessThan(count(detailed.svg))
    expect(smooth.layers).toHaveLength(1)
    expect(smooth.svg).toContain("Q")
  })
})

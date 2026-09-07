import { describe, expect, it } from "vitest"
import { editLayer } from "../domain/layer-editing"
import { type TraceSettings, traceDocument, traceImage } from "./trace"

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

  it("keeps a thin manual bridge across transparent source pixels", () => {
    // Given
    const source = eyeImage()
    source.data.fill(0)
    const mask = new Uint8Array(64 * 64)
    for (let y = 24; y < 40; y += 1) {
      for (let x = 8; x < 24; x += 1) mask[y * 64 + x] = 1
      for (let x = 40; x < 56; x += 1) mask[y * 64 + x] = 1
    }
    for (let x = 24; x < 40; x += 1) mask[32 * 64 + x] = 1
    const document = {
      source,
      width: 64,
      height: 64,
      layers: [{ id: "repair-layer", color: "#ffffff", mask }],
    }

    // When
    const repaired = traceDocument(document, { ...settings, smoothing: 1, filledBacking: true })

    // Then
    expect(repaired.document).toBe(document)
    expect(repaired.layers[0]?.paths.join("").match(/M/gu)).toHaveLength(1)
    expect(repaired.svg).toContain('id="repair-layer"')
  })

  it("keeps a manually erased hole instead of refilling it", () => {
    // Given
    const source = eyeImage()
    const mask = new Uint8Array(64 * 64)
    for (let y = 8; y < 56; y += 1) {
      for (let x = 8; x < 56; x += 1) mask[y * 64 + x] = 1
    }
    mask[32 * 64 + 32] = 0
    const document = {
      source,
      width: 64,
      height: 64,
      layers: [{ id: "repair-layer", color: "#ffffff", mask }],
    }

    // When
    const repaired = traceDocument(document, { ...settings, smoothing: 1, filledBacking: true })

    // Then
    expect(repaired.layers[0]?.paths.join("").match(/M/gu)).toHaveLength(2)
  })

  it("stores the uncut original source in the editable document", () => {
    // Given
    const cut = eyeImage()
    const original = eyeImage()
    original.data.set([17, 99, 201, 255], 0)

    // When
    const result = traceImage(cut, settings, original)

    // Then
    expect(result.document.source).toBe(original)
    expect(result.document.layers.map(({ id }) => id)).toEqual(result.layers.map(({ id }) => id))
  })

  it("retains an erased layer record so it can be painted again", () => {
    // Given
    const source = eyeImage()
    const document = {
      source,
      width: 64,
      height: 64,
      layers: [{ id: "empty-layer", color: "#ffffff", mask: new Uint8Array(64 * 64) }],
    }

    // When
    const result = traceDocument(document, settings)

    // Then
    expect(result.layers).toEqual([{ id: "empty-layer", color: "#ffffff", paths: [] }])
    expect(result.svg).toContain('<g id="empty-layer" fill="#ffffff"></g>')
  })

  it("does not resurrect omitted regions in untouched layers after a manual edit", () => {
    // Given
    const source = eyeImage()
    source.data.fill(0)
    for (let y = 8; y < 28; y += 1) {
      for (let x = 8; x < 28; x += 1) source.data.set([255, 0, 0, 255], (y * 64 + x) * 4)
      for (let x = 36; x < 56; x += 1) source.data.set([0, 0, 255, 255], (y * 64 + x) * 4)
    }
    source.data.set([0, 0, 255, 255], (55 * 64 + 55) * 4)
    const simple = { ...settings, colors: 2, detail: 0.15, mergeShades: 0 }
    const initial = traceImage(source, simple)
    const red = initial.document.layers.find(({ color }) => color === "#ff0000")
    const priorRed = initial.layers.find(({ color }) => color === "#ff0000")
    const priorBlue = initial.layers.find(({ color }) => color === "#0000ff")
    if (red === undefined || priorRed === undefined || priorBlue === undefined)
      throw new RangeError("Expected red and blue fixture layers")
    const edited = editLayer(initial.document, {
      kind: "add",
      layerId: red.id,
      stroke: { points: [{ x: 0.5, y: 0.28 }], radius: 0.05 },
    })

    // When
    const repaired = traceDocument(edited, simple, initial)

    // Then
    expect(repaired.layers.find(({ color }) => color === "#0000ff")).toBe(priorBlue)
    expect(repaired.layers.find(({ color }) => color === "#ff0000")).not.toBe(priorRed)
    expect(priorBlue.paths.join("").match(/M/gu)).toHaveLength(1)
  })
})

import imageTracer from "imagetracerjs"
import { buildLayerMasks } from "../domain/layer-masks"
import { preparePalette } from "../domain/palette"
import { smoothMask } from "../domain/smooth-mask"
import { composeSvg, type SvgLayer } from "../domain/svg-layers"
import { analyzeSvg, type SvgAnalysis } from "../domain/vectorize"

export type TraceSettings = {
  readonly colors: number
  readonly detail: number
  readonly smoothing: number
  readonly mergeShades: number
  readonly filledBacking: boolean
}

export type TraceResult = {
  readonly svg: string
  readonly analysis: SvgAnalysis
  readonly layers: readonly SvgLayer[]
  readonly width: number
  readonly height: number
  readonly warnings: readonly string[]
}

export function traceImage(image: ImageData, settings: TraceSettings): TraceResult {
  const prepared = preparePalette(image, settings)
  const masks = buildLayerMasks(
    { data: prepared.pixels, width: image.width, height: image.height },
    settings,
  )
  const layers: SvgLayer[] = []
  for (const layer of masks.layers) {
    const mask = smoothMask(layer.mask, image, settings.smoothing)
    const pixels = new Uint8ClampedArray(image.width * image.height * 4)
    for (let index = 0; index < mask.length; index += 1) {
      pixels[index * 4 + 3] = mask[index] === 1 && prepared.pixels[index * 4 + 3] === 255 ? 255 : 0
    }
    const raw = imageTracer.imagedataToSVG(
      { data: pixels, width: image.width, height: image.height, colorSpace: "srgb" },
      {
        ltres: 0.2 + settings.smoothing * 1.8,
        qtres: 0.2 + settings.smoothing * 3.8,
        pathomit: Math.round(2 + (1 - settings.detail) ** 2 * 80),
        rightangleenhance: settings.smoothing < 0.2,
        colorsampling: 0,
        colorquantcycles: 1,
        pal: [
          { r: 0, g: 0, b: 0, a: 0 },
          { r: 0, g: 0, b: 0, a: 255 },
        ],
        strokewidth: 0,
        roundcoords: 2,
        viewbox: true,
        desc: false,
      },
    )
    const parsed = new DOMParser().parseFromString(raw, "image/svg+xml")
    const paths = Array.from(parsed.querySelectorAll("path"))
      .filter((path) => Number(path.getAttribute("opacity") ?? 1) === 1)
      .map((path) => path.getAttribute("d") ?? "")
      .filter((path) => path.length > 0)
    if (paths.length > 0)
      layers.push({ id: `layer-${layers.length + 1}`, color: layer.color, paths })
  }
  const svg = composeSvg(layers, image)
  const warnings = [...masks.warnings]
  if (layers.length === 0)
    warnings.push("No cut paths survived. Increase detail or select a larger subject.")
  else if (layers.length < masks.layers.length)
    warnings.push("Tiny color regions were removed. Increase detail to retain them.")
  return {
    svg,
    analysis: analyzeSvg(svg),
    layers,
    width: image.width,
    height: image.height,
    warnings,
  }
}

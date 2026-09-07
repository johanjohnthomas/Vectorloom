import imageTracer from "imagetracerjs"
import type { EditableLayer, LayerDocument } from "../domain/layer-editing"
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
  readonly document: LayerDocument
  readonly width: number
  readonly height: number
  readonly warnings: readonly string[]
}

export function traceImage(
  image: ImageData,
  settings: TraceSettings,
  originalSource: ImageData = image,
): TraceResult {
  const prepared = preparePalette(image, settings)
  const masks = buildLayerMasks(
    { data: prepared.pixels, width: image.width, height: image.height },
    settings,
  )
  const layers: EditableLayer[] = masks.layers.map((layer, index) => {
    const smoothed = smoothMask(layer.mask, image, settings.smoothing)
    const mask = new Uint8Array(smoothed.length)
    for (let pixelIndex = 0; pixelIndex < mask.length; pixelIndex += 1) {
      mask[pixelIndex] =
        prepared.pixels[pixelIndex * 4 + 3] === 255 &&
        (smoothed[pixelIndex] === 1 || (settings.filledBacking && layer.mask[pixelIndex] === 1))
          ? 1
          : 0
    }
    return { id: `layer-${index + 1}`, color: layer.color, mask }
  })
  const document = {
    source: originalSource,
    layers,
    width: image.width,
    height: image.height,
  }
  return vectorizeDocument(document, settings, {
    pathomit: Math.round(2 + (1 - settings.detail) ** 2 * 80),
    warnings: masks.warnings,
    initialLayerCount: masks.layers.length,
    previous: undefined,
  })
}

export function traceDocument(
  document: LayerDocument,
  settings: TraceSettings,
  previous?: TraceResult,
): TraceResult {
  return vectorizeDocument(document, settings, {
    pathomit: 0,
    warnings: [],
    initialLayerCount: 0,
    previous,
  })
}

type VectorizeOptions = {
  readonly pathomit: number
  readonly warnings: readonly string[]
  readonly initialLayerCount: number
  readonly previous: TraceResult | undefined
}

function vectorizeDocument(
  document: LayerDocument,
  settings: TraceSettings,
  options: VectorizeOptions,
): TraceResult {
  const previousMasks = new Map(
    options.previous?.document.layers.map((layer) => [layer.id, layer]) ?? [],
  )
  const previousLayers = new Map(options.previous?.layers.map((layer) => [layer.id, layer]) ?? [])
  const canReuse =
    options.previous?.width === document.width && options.previous.height === document.height
  const layers = document.layers.map((layer) => {
    const previousMask = previousMasks.get(layer.id)
    const previousLayer = previousLayers.get(layer.id)
    if (
      canReuse &&
      previousMask?.mask === layer.mask &&
      previousMask.color === layer.color &&
      previousLayer?.color === layer.color
    )
      return previousLayer
    return traceLayer(layer, document, settings, options.pathomit)
  })
  const svg = composeSvg(layers, document)
  const warnings = [...options.warnings]
  const visibleLayerCount = layers.filter(({ paths }) => paths.length > 0).length
  if (visibleLayerCount === 0)
    warnings.push("No cut paths survived. Increase detail or select a larger subject.")
  else if (options.initialLayerCount > visibleLayerCount)
    warnings.push("Tiny color regions were removed. Increase detail to retain them.")
  return {
    svg,
    analysis: analyzeSvg(svg),
    layers,
    document,
    width: document.width,
    height: document.height,
    warnings,
  }
}

function traceLayer(
  layer: EditableLayer,
  size: { readonly width: number; readonly height: number },
  settings: TraceSettings,
  pathomit: number,
): SvgLayer {
  const pixels = new Uint8ClampedArray(size.width * size.height * 4)
  for (let index = 0; index < layer.mask.length; index += 1) {
    pixels[index * 4 + 3] = layer.mask[index] === 1 ? 255 : 0
  }
  const raw = imageTracer.imagedataToSVG(
    { data: pixels, width: size.width, height: size.height, colorSpace: "srgb" },
    {
      ltres: 0.2 + settings.smoothing * 1.8,
      qtres: 0.2 + settings.smoothing * 3.8,
      pathomit,
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
  return { id: layer.id, color: layer.color, paths }
}

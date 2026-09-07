import imageTracer from "imagetracerjs"
import type { SvgAnalysis } from "../domain/vectorize"
import { analyzeSvg, sanitizeSvg } from "../domain/vectorize"

export type TraceSettings = {
  readonly colors: number
  readonly detail: number
  readonly smoothing: number
}

export type TraceResult = {
  readonly svg: string
  readonly analysis: SvgAnalysis
}

export function traceImage(image: ImageData, settings: TraceSettings): TraceResult {
  const rawSvg = imageTracer.imagedataToSVG(image, {
    ltres: 0.1 + settings.smoothing * 0.45,
    qtres: 0.1 + settings.smoothing * 0.45,
    pathomit: Math.round(2 + (1 - settings.detail) * 24),
    rightangleenhance: true,
    colorsampling: 2,
    numberofcolors: settings.colors,
    colorquantcycles: 2,
    roundcoords: 1,
    viewbox: true,
    desc: false,
  })
  const svg = sanitizeSvg(rawSvg, image.width, image.height)
  return { svg, analysis: analyzeSvg(svg) }
}

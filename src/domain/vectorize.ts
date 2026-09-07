export type Complexity = {
  readonly score: number
  readonly rating: "ready" | "moderate" | "dense"
  readonly advice: string
}

export type SvgAnalysis = {
  readonly pathCount: number
  readonly layerCount: number
  readonly complexity: Complexity
}

const INK_RGB = [6, 17, 31] as const

export function makeSilhouettePixels(
  source: Uint8ClampedArray,
  mask: Float32Array,
  threshold: number,
): Uint8ClampedArray {
  const output: Uint8ClampedArray<ArrayBuffer> = new Uint8ClampedArray(source.length)
  for (let pixelIndex = 0; pixelIndex < mask.length; pixelIndex += 1) {
    const sourceIndex = pixelIndex * 4
    const sourceAlpha = source[sourceIndex + 3] ?? 0
    const isSubject = (mask[pixelIndex] ?? 0) >= threshold
    output[sourceIndex] = isSubject ? INK_RGB[0] : 255
    output[sourceIndex + 1] = isSubject ? INK_RGB[1] : 255
    output[sourceIndex + 2] = isSubject ? INK_RGB[2] : 255
    output[sourceIndex + 3] = isSubject ? sourceAlpha : 0
  }
  return output
}

export function applyAlphaMask(
  source: ImageData,
  mask: Float32Array,
  threshold: number,
): ImageData {
  const output = new Uint8ClampedArray(source.data)
  for (let pixelIndex = 0; pixelIndex < mask.length; pixelIndex += 1) {
    const alphaIndex = pixelIndex * 4 + 3
    const sourceAlpha = source.data[alphaIndex] ?? 0
    output[alphaIndex] = (mask[pixelIndex] ?? 0) >= threshold ? sourceAlpha : 0
  }
  return new ImageData(output, source.width, source.height)
}

export function makeEdgeMask(source: ImageData, tolerance: number): Float32Array {
  const { data, width, height } = source
  const perimeterPixels: number[] = []
  for (let x = 0; x < width; x += 1) {
    perimeterPixels.push(x, (height - 1) * width + x)
  }
  for (let y = 1; y < height - 1; y += 1) {
    perimeterPixels.push(y * width, y * width + width - 1)
  }
  const redSamples: number[] = []
  const greenSamples: number[] = []
  const blueSamples: number[] = []
  for (const pixelIndex of perimeterPixels) {
    const dataIndex = pixelIndex * 4
    redSamples.push(data[dataIndex] ?? 0)
    greenSamples.push(data[dataIndex + 1] ?? 0)
    blueSamples.push(data[dataIndex + 2] ?? 0)
  }
  const backgroundRgb = [median(redSamples), median(greenSamples), median(blueSamples)] as const
  const backgroundRadius = 18 + tolerance * 1.2
  const visited = new Uint8Array(width * height)
  const queue = new Int32Array(width * height)
  let queueStart = 0
  let queueEnd = 0

  function enqueueBackground(pixelIndex: number): void {
    if ((visited[pixelIndex] ?? 0) === 1) return
    const dataIndex = pixelIndex * 4
    const red = (data[dataIndex] ?? 0) - backgroundRgb[0]
    const green = (data[dataIndex + 1] ?? 0) - backgroundRgb[1]
    const blue = (data[dataIndex + 2] ?? 0) - backgroundRgb[2]
    if (Math.sqrt(red * red + green * green + blue * blue) > backgroundRadius) return
    visited[pixelIndex] = 1
    queue[queueEnd] = pixelIndex
    queueEnd += 1
  }

  for (const pixelIndex of perimeterPixels) enqueueBackground(pixelIndex)
  while (queueStart < queueEnd) {
    const pixelIndex = queue[queueStart] ?? 0
    queueStart += 1
    const x = pixelIndex % width
    const y = Math.floor(pixelIndex / width)
    if (x > 0) enqueueBackground(pixelIndex - 1)
    if (x + 1 < width) enqueueBackground(pixelIndex + 1)
    if (y > 0) enqueueBackground(pixelIndex - width)
    if (y + 1 < height) enqueueBackground(pixelIndex + width)
  }
  const mask = new Float32Array(width * height)
  for (let pixelIndex = 0; pixelIndex < mask.length; pixelIndex += 1) {
    mask[pixelIndex] = (visited[pixelIndex] ?? 0) === 1 ? 0 : 1
  }
  return mask
}

function median(values: number[]): number {
  values.sort((left, right) => left - right)
  return values[Math.floor(values.length / 2)] ?? 0
}

export function sanitizeSvg(source: string, width: number, height: number): string {
  const parsed = new DOMParser().parseFromString(source, "image/svg+xml")
  const root = parsed.documentElement
  root
    .querySelectorAll(
      'image, pattern, linearGradient, radialGradient, filter, text, script, path[opacity="0"], path[fill-opacity="0"]',
    )
    .forEach((node) => {
      node.remove()
    })
  root.querySelectorAll("path[opacity], path[fill-opacity]").forEach((node) => {
    const opacity = Number(node.getAttribute("opacity") ?? node.getAttribute("fill-opacity") ?? "1")
    if (opacity < 1) {
      node.remove()
      return
    }
    node.removeAttribute("opacity")
    node.removeAttribute("fill-opacity")
  })
  root.setAttribute("xmlns", "http://www.w3.org/2000/svg")
  root.setAttribute("viewBox", `0 0 ${width} ${height}`)
  root.removeAttribute("width")
  root.removeAttribute("height")
  root.setAttribute("role", "img")
  root.setAttribute("aria-label", "Vectorloom cut-ready artwork")
  return new XMLSerializer().serializeToString(root)
}

export function analyzeSvg(svg: string): SvgAnalysis {
  const pathCount = svg.match(/<path\b/gu)?.length ?? 0
  const fills = new Set(svg.match(/fill="(?:#[0-9a-f]{3,8}|rgb\([^)]+\))"/giu) ?? [])
  const layerCount = fills.size
  return { pathCount, layerCount, complexity: assessComplexity(pathCount, layerCount) }
}

export function assessComplexity(pathCount: number, layerCount: number): Complexity {
  const score = Math.min(100, Math.round(pathCount / 12 + layerCount * 4))
  if (score <= 35) {
    return { score, rating: "ready", advice: "Clean shapes with manageable weeding." }
  }
  if (score <= 70) {
    return { score, rating: "moderate", advice: "Reduce detail for easier cutting and weeding." }
  }
  return { score, rating: "dense", advice: "Too many small paths. Lower colors or detail." }
}

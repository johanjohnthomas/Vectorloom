export type PaletteColor = {
  readonly r: number
  readonly g: number
  readonly b: number
  readonly a: number
}

export type PaletteOptions = {
  readonly colors: number
  readonly mergeShades: number
}

export type PreparedPalette = {
  readonly pixels: Uint8ClampedArray<ArrayBuffer>
  readonly palette: readonly PaletteColor[]
}

type LabColor = {
  readonly l: number
  readonly a: number
  readonly b: number
}

type ColorBin = {
  readonly key: number
  readonly count: number
  readonly r: number
  readonly g: number
  readonly b: number
  readonly lab: LabColor
}

type PaletteCluster = {
  readonly seed: ColorBin
  redSum: number
  greenSum: number
  blueSum: number
  count: number
}

const BIN_COUNT = 32 * 32 * 32
const OPAQUE_ALPHA = 255
const TRANSPARENT_ALPHA = 0
const ALPHA_THRESHOLD = 128

export function preparePalette(image: ImageData, options: PaletteOptions): PreparedPalette {
  const colorCap = Math.max(2, Math.min(8, Math.round(options.colors)))
  const mergeShades = Math.max(0, Math.min(1, options.mergeShades))
  const binCounts = new Uint32Array(BIN_COUNT)
  const redSums = new Uint32Array(BIN_COUNT)
  const greenSums = new Uint32Array(BIN_COUNT)
  const blueSums = new Uint32Array(BIN_COUNT)
  const { data } = image

  for (let offset = 0; offset < data.length; offset += 4) {
    if ((data[offset + 3] ?? TRANSPARENT_ALPHA) < ALPHA_THRESHOLD) continue
    const red = data[offset] ?? 0
    const green = data[offset + 1] ?? 0
    const blue = data[offset + 2] ?? 0
    const key = colorKey(red, green, blue)
    binCounts[key] = (binCounts[key] ?? 0) + 1
    redSums[key] = (redSums[key] ?? 0) + red
    greenSums[key] = (greenSums[key] ?? 0) + green
    blueSums[key] = (blueSums[key] ?? 0) + blue
  }

  const bins = collectBins(binCounts, redSums, greenSums, blueSums)
  const clusters = createClusters(bins, colorCap, mergeShades)
  const palette = clusters.map(toPaletteColor)
  const assignments = assignBins(bins, clusters)
  const pixels = new Uint8ClampedArray(data.length)

  for (let offset = 0; offset < data.length; offset += 4) {
    if ((data[offset + 3] ?? TRANSPARENT_ALPHA) < ALPHA_THRESHOLD) continue
    const clusterIndex =
      assignments[colorKey(data[offset] ?? 0, data[offset + 1] ?? 0, data[offset + 2] ?? 0)] ?? -1
    const color = palette[clusterIndex]
    if (color === undefined) continue
    pixels[offset] = color.r
    pixels[offset + 1] = color.g
    pixels[offset + 2] = color.b
    pixels[offset + 3] = OPAQUE_ALPHA
  }

  return { pixels, palette }
}

function collectBins(
  binCounts: Uint32Array,
  redSums: Uint32Array,
  greenSums: Uint32Array,
  blueSums: Uint32Array,
): ColorBin[] {
  const bins: ColorBin[] = []
  for (let key = 0; key < BIN_COUNT; key += 1) {
    const count = binCounts[key] ?? 0
    if (count === 0) continue
    const red = Math.round((redSums[key] ?? 0) / count)
    const green = Math.round((greenSums[key] ?? 0) / count)
    const blue = Math.round((blueSums[key] ?? 0) / count)
    bins.push({ key, count, r: red, g: green, b: blue, lab: toOklab(red, green, blue) })
  }
  return bins.sort((left, right) => right.count - left.count || left.key - right.key)
}

function createClusters(
  bins: readonly ColorBin[],
  colorCap: number,
  mergeShades: number,
): PaletteCluster[] {
  const threshold = 0.045 + mergeShades * 0.305
  const clusters: PaletteCluster[] = []
  for (const bin of bins) {
    if (clusters.some((cluster) => colorDistance(bin.lab, cluster.seed.lab) <= threshold)) continue
    if (clusters.length === colorCap) break
    clusters.push({
      seed: bin,
      redSum: 0,
      greenSum: 0,
      blueSum: 0,
      count: 0,
    })
  }

  for (const bin of bins) {
    const cluster = nearestCluster(bin, clusters)
    cluster.redSum += bin.r * bin.count
    cluster.greenSum += bin.g * bin.count
    cluster.blueSum += bin.b * bin.count
    cluster.count += bin.count
  }
  return clusters
}

function assignBins(bins: readonly ColorBin[], clusters: readonly PaletteCluster[]): Int16Array {
  const assignments = new Int16Array(BIN_COUNT)
  assignments.fill(-1)
  for (const bin of bins) {
    assignments[bin.key] = clusters.indexOf(nearestCluster(bin, clusters))
  }
  return assignments
}

function nearestCluster(bin: ColorBin, clusters: readonly PaletteCluster[]): PaletteCluster {
  let nearest = clusters[0]
  if (nearest === undefined) throw new RangeError("Cannot assign a palette without opaque colors.")
  let nearestDistance = colorDistance(bin.lab, nearest.seed.lab)
  for (let index = 1; index < clusters.length; index += 1) {
    const cluster = clusters[index]
    if (cluster === undefined) continue
    const distance = colorDistance(bin.lab, cluster.seed.lab)
    if (distance < nearestDistance) {
      nearest = cluster
      nearestDistance = distance
    }
  }
  return nearest
}

function toPaletteColor(cluster: PaletteCluster): PaletteColor {
  return {
    r: Math.round(cluster.redSum / cluster.count),
    g: Math.round(cluster.greenSum / cluster.count),
    b: Math.round(cluster.blueSum / cluster.count),
    a: OPAQUE_ALPHA,
  }
}

function colorKey(red: number, green: number, blue: number): number {
  return (red >> 3) * 1024 + (green >> 3) * 32 + (blue >> 3)
}

function colorDistance(left: LabColor, right: LabColor): number {
  return Math.hypot(left.l - right.l, left.a - right.a, left.b - right.b)
}

function toOklab(red: number, green: number, blue: number): LabColor {
  const redLinear = toLinear(red)
  const greenLinear = toLinear(green)
  const blueLinear = toLinear(blue)
  const l = Math.cbrt(
    0.4122214708 * redLinear + 0.5363325363 * greenLinear + 0.0514459929 * blueLinear,
  )
  const m = Math.cbrt(
    0.2119034982 * redLinear + 0.6806995451 * greenLinear + 0.1073969566 * blueLinear,
  )
  const s = Math.cbrt(
    0.0883024619 * redLinear + 0.2817188376 * greenLinear + 0.6299787005 * blueLinear,
  )
  return {
    l: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    a: 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    b: 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  }
}

function toLinear(channel: number): number {
  const normalized = channel / 255
  return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4
}

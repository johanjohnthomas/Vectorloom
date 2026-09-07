import { connectBackingLayers } from "./connected-backing"
import { findCyclicIds, topologicalOrder } from "./layer-order"

export type LayerMask = {
  readonly color: string
  readonly mask: Uint8Array
  readonly pixelCount: number
}

export type LayerMaskResult = {
  readonly layers: readonly LayerMask[]
  readonly warnings: readonly string[]
}

type RasterImage = {
  readonly data: Uint8ClampedArray
  readonly width: number
  readonly height: number
}

type LayerMaskOptions = {
  readonly filledBacking: boolean
  readonly smoothing: number
}

type LabelRaster = {
  readonly labels: Int16Array
  readonly colors: readonly string[]
}

const TRANSPARENT_LABEL = -1

export function buildLayerMasks(image: RasterImage, options: LayerMaskOptions): LayerMaskResult {
  const size = image.width * image.height
  if (size === 0) return { layers: [], warnings: [] }

  const raster = labelPixels(image, options.smoothing)
  const activeColors = raster.colors
    .map((color, id) => ({
      color,
      id,
      area: raster.labels.reduce((sum, value) => sum + Number(value === id), 0),
    }))
    .filter(({ area }) => area > 0)
  if (activeColors.length === 0) return { layers: [], warnings: [] }

  const exactMasks = new Map<number, Uint8Array>()
  const masks = new Map<number, Uint8Array>()
  const dependencies = new Map<number, Set<number>>()
  for (const { id } of activeColors) {
    const exact = new Uint8Array(size)
    for (let pixelIndex = 0; pixelIndex < size; pixelIndex += 1) {
      exact[pixelIndex] = (raster.labels[pixelIndex] ?? TRANSPARENT_LABEL) === id ? 1 : 0
    }
    exactMasks.set(id, exact)
    masks.set(id, new Uint8Array(exact))
    dependencies.set(id, new Set())
  }

  if (options.filledBacking) {
    for (const { id } of activeColors) {
      fillEnclosedHoles(id, raster.labels, image.width, image.height, masks, dependencies)
    }
  }

  const cyclicIds = findCyclicIds(
    activeColors.map(({ id }) => id),
    dependencies,
  )
  const warnings: string[] = []
  if (cyclicIds.size > 0) {
    warnings.push(
      "Some colors nest in both directions. Backing connects them where the stacking order allows; remaining cut-outs preserve the design.",
    )
    const brightnessById = new Map(
      activeColors.map(({ color, id }) => {
        const rgb = Number.parseInt(color.slice(1), 16)
        return [
          id,
          ((rgb >> 16) & 255) * 299 + ((rgb >> 8) & 255) * 587 + (rgb & 255) * 114,
        ] as const
      }),
    )
    const cyclicRank = new Map(
      [...cyclicIds]
        .sort(
          (left, right) =>
            (brightnessById.get(right) ?? 0) - (brightnessById.get(left) ?? 0) || left - right,
        )
        .map((id, rank) => [id, rank]),
    )
    for (const id of cyclicIds) {
      const exact = exactMasks.get(id)
      if (exact !== undefined) masks.set(id, exact)
      const sourceRank = cyclicRank.get(id)
      const targets = dependencies.get(id)
      if (sourceRank === undefined || targets === undefined) continue
      for (const target of targets) {
        const targetRank = cyclicRank.get(target)
        if (targetRank !== undefined && sourceRank > targetRank) targets.delete(target)
      }
    }
  }

  const orderedIds = topologicalOrder(activeColors, dependencies)
  const layers: LayerMask[] = []
  for (const id of orderedIds) {
    const mask = masks.get(id)
    const color = raster.colors[id]
    if (mask === undefined || color === undefined) continue
    let pixelCount = 0
    for (const value of mask) pixelCount += value
    layers.push({ color, mask, pixelCount })
  }
  return {
    layers: options.filledBacking
      ? connectBackingLayers({ width: image.width, height: image.height, layers })
      : layers,
    warnings,
  }
}

function labelPixels(image: RasterImage, smoothing: number): LabelRaster {
  const labels = new Int16Array(image.width * image.height)
  labels.fill(TRANSPARENT_LABEL)
  const colorIds = new Map<number, number>()
  const colors: string[] = []
  for (let pixelIndex = 0; pixelIndex < labels.length; pixelIndex += 1) {
    const dataIndex = pixelIndex * 4
    if ((image.data[dataIndex + 3] ?? 0) === 0) continue
    const red = image.data[dataIndex] ?? 0
    const green = image.data[dataIndex + 1] ?? 0
    const blue = image.data[dataIndex + 2] ?? 0
    const rgb = red * 65_536 + green * 256 + blue
    let id = colorIds.get(rgb)
    if (id === undefined) {
      id = colors.length
      colorIds.set(rgb, id)
      colors.push(`#${rgb.toString(16).padStart(6, "0")}`)
    }
    labels[pixelIndex] = id
  }

  const passes = smoothing > 0.75 ? 2 : smoothing > 0.35 ? 1 : 0
  let smoothed: Int16Array = labels
  for (let pass = 0; pass < passes; pass += 1) {
    smoothed = smoothInteriorLabels(smoothed, image.width, image.height, colors.length)
  }
  return { labels: smoothed, colors }
}

function smoothInteriorLabels(
  labels: Int16Array,
  width: number,
  height: number,
  colorCount: number,
): Int16Array {
  const output = new Int16Array(labels)
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const pixelIndex = y * width + x
      if ((labels[pixelIndex] ?? TRANSPARENT_LABEL) === TRANSPARENT_LABEL) continue
      const counts = new Uint8Array(colorCount)
      let opaqueNeighbors = 0
      for (let yOffset = -1; yOffset <= 1; yOffset += 1) {
        for (let xOffset = -1; xOffset <= 1; xOffset += 1) {
          const label = labels[pixelIndex + yOffset * width + xOffset] ?? TRANSPARENT_LABEL
          if (label === TRANSPARENT_LABEL) continue
          counts[label] = (counts[label] ?? 0) + 1
          if (xOffset !== 0 || yOffset !== 0) opaqueNeighbors += 1
        }
      }
      if (opaqueNeighbors !== 8) continue
      let winner = labels[pixelIndex] ?? TRANSPARENT_LABEL
      for (let candidate = 0; candidate < counts.length; candidate += 1) {
        if ((counts[candidate] ?? 0) > (counts[winner] ?? 0)) winner = candidate
      }
      if ((counts[winner] ?? 0) >= 6) output[pixelIndex] = winner
    }
  }
  return output
}

function fillEnclosedHoles(
  colorId: number,
  labels: Int16Array,
  width: number,
  height: number,
  masks: Map<number, Uint8Array>,
  dependencies: Map<number, Set<number>>,
): void {
  const mask = masks.get(colorId)
  const colorDependencies = dependencies.get(colorId)
  if (mask === undefined || colorDependencies === undefined) return
  const visited = new Uint8Array(labels.length)
  const queue = new Int32Array(labels.length)
  for (let seed = 0; seed < labels.length; seed += 1) {
    if ((mask[seed] ?? 0) === 1 || (visited[seed] ?? 0) === 1) continue
    let start = 0
    let end = 1
    let touchesBoundary = false
    let containsTransparency = false
    const enclosedColors = new Set<number>()
    queue[0] = seed
    visited[seed] = 1
    while (start < end) {
      const pixelIndex = queue[start] ?? 0
      start += 1
      const x = pixelIndex % width
      const y = Math.floor(pixelIndex / width)
      touchesBoundary ||= x === 0 || x === width - 1 || y === 0 || y === height - 1
      const label = labels[pixelIndex] ?? TRANSPARENT_LABEL
      containsTransparency ||= label === TRANSPARENT_LABEL
      if (label !== TRANSPARENT_LABEL && label !== colorId) enclosedColors.add(label)
      if (x > 0) end = enqueueComplement(pixelIndex - 1, mask, visited, queue, end)
      if (x + 1 < width) end = enqueueComplement(pixelIndex + 1, mask, visited, queue, end)
      if (y > 0) end = enqueueComplement(pixelIndex - width, mask, visited, queue, end)
      if (y + 1 < height) end = enqueueComplement(pixelIndex + width, mask, visited, queue, end)
    }
    if (!touchesBoundary && !containsTransparency) {
      for (let queueIndex = 0; queueIndex < end; queueIndex += 1) {
        mask[queue[queueIndex] ?? 0] = 1
      }
      for (const enclosedColor of enclosedColors) colorDependencies.add(enclosedColor)
    }
  }
}

function enqueueComplement(
  pixelIndex: number,
  mask: Uint8Array,
  visited: Uint8Array,
  queue: Int32Array,
  end: number,
): number {
  if ((mask[pixelIndex] ?? 0) === 1 || (visited[pixelIndex] ?? 0) === 1) return end
  visited[pixelIndex] = 1
  queue[end] = pixelIndex
  return end + 1
}

import type { LayerMask } from "./layer-masks"

type BackingRaster = {
  readonly width: number
  readonly height: number
  readonly layers: readonly LayerMask[]
}

/** Extend each plate only beneath later plates, never into transparency or lower colors. */
export function connectBackingLayers(raster: BackingRaster): readonly LayerMask[] {
  const size = raster.width * raster.height
  const covered = new Uint8Array(size)
  const queue = new Int32Array(size)
  const layers: LayerMask[] = []
  for (let index = raster.layers.length - 1; index >= 0; index -= 1) {
    const layer = raster.layers[index]
    if (layer === undefined) continue
    const mask = new Uint8Array(layer.mask)
    let count = 0
    for (let pixel = 0; pixel < size; pixel += 1) {
      if (mask[pixel] === 1) queue[count++] = pixel
    }
    for (let head = 0; head < count; head += 1) {
      const pixel = queue[head] ?? 0
      const x = pixel % raster.width
      const neighbors = [
        x > 0 ? pixel - 1 : -1,
        x + 1 < raster.width ? pixel + 1 : -1,
        pixel - raster.width,
        pixel + raster.width,
      ]
      for (const next of neighbors) {
        if (next < 0 || next >= size || covered[next] !== 1 || mask[next] === 1) continue
        mask[next] = 1
        queue[count++] = next
      }
    }
    for (let pixel = 0; pixel < size; pixel += 1) {
      if (mask[pixel] === 1) covered[pixel] = 1
    }
    layers.unshift({ color: layer.color, mask, pixelCount: count })
  }
  return layers
}

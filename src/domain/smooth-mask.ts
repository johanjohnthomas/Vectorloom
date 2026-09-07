export function smoothMask(
  mask: Uint8Array,
  size: { readonly width: number; readonly height: number },
  strength: number,
): Uint8Array {
  if (strength < 0.35) return mask
  const radius = strength > 0.7 ? 2 : 1
  const result = new Uint8Array(mask.length)
  for (let y = 0; y < size.height; y += 1) {
    for (let x = 0; x < size.width; x += 1) {
      let total = 0
      let weight = 0
      for (let dy = -radius; dy <= radius; dy += 1) {
        for (let dx = -radius; dx <= radius; dx += 1) {
          const nx = Math.min(size.width - 1, Math.max(0, x + dx))
          const ny = Math.min(size.height - 1, Math.max(0, y + dy))
          const w = (radius + 1 - Math.abs(dx)) * (radius + 1 - Math.abs(dy))
          total += (mask[ny * size.width + nx] ?? 0) * w
          weight += w
        }
      }
      result[y * size.width + x] = total >= weight / 2 ? 1 : 0
    }
  }
  return result
}

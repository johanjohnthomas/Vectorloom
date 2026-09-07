export type SvgLayer = {
  readonly id: string
  readonly color: string
  readonly paths: readonly string[]
}

export function composeSvg(
  layers: readonly SvgLayer[],
  size: { readonly width: number; readonly height: number },
): string {
  const groups = layers.map(
    (layer) =>
      `<g id="${layer.id}" fill="${layer.color}">${layer.paths.map((d) => `<path fill="${layer.color}" d="${d}"/>`).join("")}</g>`,
  )
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size.width} ${size.height}" role="img" aria-label="Vectorloom cut-ready artwork">${groups.join("")}</svg>`
}

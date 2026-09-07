import { type BrushStroke, rasterizeStroke } from "./brush"

export type EditableLayer = {
  readonly id: string
  readonly color: string
  readonly mask: Uint8Array
}

export type LayerDocument = {
  readonly source: ImageData
  readonly layers: readonly EditableLayer[]
  readonly width: number
  readonly height: number
}

export type LayerEdit =
  | {
      readonly kind: "add" | "erase"
      readonly layerId: string | undefined
      readonly stroke: BrushStroke
    }
  | { readonly kind: "new"; readonly stroke: BrushStroke }

export function editLayer(document: LayerDocument, edit: LayerEdit): LayerDocument {
  const strokeMask = rasterizeStroke(edit.stroke, document)
  switch (edit.kind) {
    case "add":
    case "erase":
      return editExistingLayers(document, edit, strokeMask)
    case "new":
      return createLayer(document, strokeMask)
    default:
      return assertNever(edit)
  }
}

function editExistingLayers(
  document: LayerDocument,
  edit: Extract<LayerEdit, { readonly kind: "add" | "erase" }>,
  strokeMask: Uint8Array,
): LayerDocument {
  const layerId =
    edit.layerId ?? (edit.kind === "add" ? colorAtStart(document, edit.stroke) : undefined)
  if (edit.kind === "add" && layerId === undefined) return document
  const value = edit.kind === "add" ? 1 : 0
  let changed = false
  const layers = document.layers.map((layer) => {
    if (layerId !== undefined && layer.id !== layerId) return layer
    let mask: Uint8Array | undefined
    for (let index = 0; index < layer.mask.length; index += 1) {
      if (strokeMask[index] !== 1 || layer.mask[index] === value) continue
      mask ??= new Uint8Array(layer.mask)
      mask[index] = value
    }
    if (mask === undefined) return layer
    changed = true
    return { ...layer, mask }
  })
  return changed ? { ...document, layers } : document
}

function colorAtStart(document: LayerDocument, stroke: BrushStroke): string | undefined {
  const point = stroke.points[0]
  if (point === undefined) return undefined
  const x = Math.round(Math.min(1, Math.max(0, point.x)) * (document.width - 1))
  const y = Math.round(Math.min(1, Math.max(0, point.y)) * (document.height - 1))
  const pixel = y * document.width + x
  for (let index = document.layers.length - 1; index >= 0; index -= 1) {
    const layer = document.layers[index]
    if (layer?.mask[pixel] === 1) return layer.id
  }
  return undefined
}

function createLayer(document: LayerDocument, strokeMask: Uint8Array): LayerDocument {
  const red: number[] = []
  const green: number[] = []
  const blue: number[] = []
  const mask = new Uint8Array(strokeMask.length)
  for (let index = 0; index < strokeMask.length; index += 1) {
    const dataIndex = index * 4
    if ((strokeMask[index] ?? 0) === 0 || (document.source.data[dataIndex + 3] ?? 0) === 0) continue
    red.push(document.source.data[dataIndex] ?? 0)
    green.push(document.source.data[dataIndex + 1] ?? 0)
    blue.push(document.source.data[dataIndex + 2] ?? 0)
    mask[index] = 1
  }
  if (red.length === 0) return document
  const color = `#${[red, green, blue]
    .map((channels) => median(channels).toString(16).padStart(2, "0"))
    .join("")}`
  const ids = new Set(document.layers.map(({ id }) => id))
  let sequence = document.layers.length + 1
  while (ids.has(`layer-${sequence}`)) sequence += 1
  return {
    ...document,
    layers: [...document.layers, { id: `layer-${sequence}`, color, mask }],
  }
}

function median(values: number[]): number {
  values.sort((left, right) => left - right)
  return values[Math.floor(values.length / 2)] ?? 0
}

function assertNever(value: never): never {
  throw new TypeError(`Unhandled layer edit: ${String(value)}`)
}

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
  | { readonly kind: "add" | "erase"; readonly layerId: string; readonly stroke: BrushStroke }
  | { readonly kind: "new"; readonly stroke: BrushStroke }

export function editLayer(document: LayerDocument, edit: LayerEdit): LayerDocument {
  const strokeMask = rasterizeStroke(edit.stroke, document)
  switch (edit.kind) {
    case "add":
      return editExistingLayer(document, edit.layerId, strokeMask, 1)
    case "erase":
      return editExistingLayer(document, edit.layerId, strokeMask, 0)
    case "new":
      return createLayer(document, strokeMask)
    default:
      return assertNever(edit)
  }
}

function editExistingLayer(
  document: LayerDocument,
  layerId: string,
  strokeMask: Uint8Array,
  value: 0 | 1,
): LayerDocument {
  const selected = document.layers.find(({ id }) => id === layerId)
  if (selected === undefined) return document
  const mask = new Uint8Array(selected.mask)
  for (let index = 0; index < mask.length; index += 1) {
    if ((strokeMask[index] ?? 0) === 1) mask[index] = value
  }
  return {
    ...document,
    layers: document.layers.map((layer) => (layer.id === layerId ? { ...layer, mask } : layer)),
  }
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

import { describe, expect, it } from "vitest"
import { editLayer, type LayerDocument } from "./layer-editing"

function document(): LayerDocument {
  return {
    width: 5,
    height: 3,
    source: {
      width: 5,
      height: 3,
      colorSpace: "srgb",
      data: new Uint8ClampedArray([
        0, 0, 0, 0, 0, 0, 0, 0, 220, 20, 30, 255, 0, 0, 0, 0, 0, 0, 0, 0, 20, 40, 220, 255, 20, 40,
        220, 255, 220, 20, 30, 255, 20, 40, 220, 255, 20, 40, 220, 255, 0, 0, 0, 0, 0, 0, 0, 0, 220,
        20, 30, 255, 0, 0, 0, 0, 0, 0, 0, 0,
      ]),
    },
    layers: [
      {
        id: "layer-1",
        color: "#1428dc",
        mask: new Uint8Array([0, 0, 0, 0, 0, 1, 1, 0, 1, 1, 0, 0, 0, 0, 0]),
      },
    ],
  }
}

describe("editLayer", () => {
  it("adds a bridge to only the selected layer, including transparent source pixels", () => {
    // Given
    const original = document()
    const originalMask = Array.from(original.layers[0]?.mask ?? [])

    // When
    const edited = editLayer(original, {
      kind: "add",
      layerId: "layer-1",
      stroke: { points: [{ x: 0.5, y: 0 }], radius: 0.2 },
    })

    // Then
    expect(edited.layers[0]?.mask[2]).toBe(1)
    expect(Array.from(original.layers[0]?.mask ?? [])).toEqual(originalMask)
    expect(edited.source).toBe(original.source)
  })

  it("erases only the selected layer", () => {
    // Given
    const original = document()
    const second = { id: "layer-2", color: "#dc141e", mask: new Uint8Array(15).fill(1) }
    const withTwo = { ...original, layers: [...original.layers, second] }

    // When
    const edited = editLayer(withTwo, {
      kind: "erase",
      layerId: "layer-1",
      stroke: { points: [{ x: 0, y: 0.5 }], radius: 0.2 },
    })

    // Then
    expect(edited.layers[0]?.mask[5]).toBe(0)
    expect(edited.layers[1]).toBe(second)
  })

  it("creates a top layer from the missing source color under the brush", () => {
    // Given
    const original = document()

    // When
    const edited = editLayer(original, {
      kind: "new",
      stroke: { points: [{ x: 0.5, y: 0.5 }], radius: 0.38 },
    })

    // Then
    expect(edited.layers[1]?.id).toBe("layer-2")
    expect(edited.layers[1]?.color).toBe("#dc141e")
    expect(edited.layers[1]?.mask[7]).toBe(1)
    expect(edited.layers[1]?.mask[2]).toBe(1)
    expect(edited.layers[1]?.mask[6]).toBe(1)
  })

  it("returns the same document when a new-layer stroke samples only transparency", () => {
    // Given
    const original = document()

    // When
    const edited = editLayer(original, {
      kind: "new",
      stroke: { points: [{ x: 0, y: 0 }], radius: 0.05 },
    })

    // Then
    expect(edited).toBe(original)
  })
})

import { act, renderHook } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { traceImage } from "../services/trace"
import { useLayerRepairs } from "./useLayerRepairs"

const settings = { colors: 4, mergeShades: 0, filledBacking: true, smoothing: 0, detail: 1 }

function artwork() {
  const data = new Uint8ClampedArray(32 * 32 * 4)
  for (let y = 2; y < 30; y += 1)
    for (let x = 2; x < 30; x += 1)
      data.set(
        x >= 12 && x < 20 && y >= 12 && y < 20 ? [0, 0, 0, 255] : [255, 255, 255, 255],
        (y * 32 + x) * 4,
      )
  return traceImage({ data, width: 32, height: 32, colorSpace: "srgb" }, settings)
}

describe("combined-view repairs", () => {
  it("keeps the combined view when choosing a repair tool", () => {
    const { result } = renderHook(() => useLayerRepairs(settings))
    act(() => result.current.reset(artwork()))

    act(() => result.current.chooseTool("erase"))

    expect(result.current.selected).toBeUndefined()
    expect(result.current.tool).toBe("erase")
  })

  it("erases through every overlapping layer and restores them in one undo", () => {
    const initial = artwork()
    const { result } = renderHook(() => useLayerRepairs(settings))
    act(() => result.current.reset(initial))
    act(() => result.current.chooseTool("erase"))

    act(() => result.current.repair({ points: [{ x: 0.5, y: 0.5 }], radius: 0.05 }))

    expect(
      result.current.result?.document.layers.every((layer) => layer.mask[16 * 32 + 16] === 0),
    ).toBe(true)
    act(() => result.current.undo())
    expect(result.current.result?.svg).toBe(initial.svg)
  })

  it("adds to the topmost color at stroke start without switching out of All layers", () => {
    const initial = artwork()
    const { result } = renderHook(() => useLayerRepairs(settings))
    act(() => result.current.reset(initial))
    act(() => result.current.chooseTool("add"))

    act(() =>
      result.current.repair({
        points: [
          { x: 0.5, y: 0.5 },
          { x: 0.8, y: 0.5 },
        ],
        radius: 0.04,
      }),
    )

    expect(result.current.selected).toBeUndefined()
    expect(
      result.current.result?.document.layers.find((layer) => layer.color === "#000000")?.mask[
        16 * 32 + 24
      ],
    ).toBe(1)
    expect(result.current.result?.document.layers[0]).toBe(initial.document.layers[0])
  })

  it("keeps the combined view when creating an inferred-color layer", () => {
    const { result } = renderHook(() => useLayerRepairs(settings))
    act(() => result.current.reset(artwork()))
    act(() => result.current.chooseTool("new"))

    act(() => result.current.repair({ points: [{ x: 0.5, y: 0.5 }], radius: 0.05 }))

    expect(result.current.selected).toBeUndefined()
    expect(result.current.result?.layers.at(-1)?.color).toBe("#000000")
    expect(result.current.tool).toBe("add")
  })
})

import { useState } from "react"
import type { BrushStroke } from "../domain/brush"
import { editLayer } from "../domain/layer-editing"
import { type TraceResult, type TraceSettings, traceDocument } from "../services/trace"

export type RepairTool = "inspect" | "add" | "erase" | "new"

export function useLayerRepairs(settings: TraceSettings) {
  const [result, setResult] = useState<TraceResult>()
  const [selected, setSelected] = useState<number>()
  const [tool, setTool] = useState<RepairTool>("inspect")
  const [history, setHistory] = useState<readonly TraceResult[]>([])

  function reset(next?: TraceResult): void {
    setResult(next)
    setSelected(undefined)
    setHistory([])
    setTool("inspect")
  }

  function chooseTool(next: RepairTool): void {
    setTool(next)
    if ((next === "add" || next === "erase") && selected === undefined) setSelected(0)
  }

  function repair(stroke: BrushStroke): boolean {
    if (result === undefined || tool === "inspect") return false
    const layer = result.layers[selected ?? 0]
    if (tool !== "new" && layer === undefined) return false
    const document =
      tool === "new"
        ? editLayer(result.document, { kind: "new", stroke })
        : editLayer(result.document, { kind: tool, layerId: layer?.id ?? "", stroke })
    if (document === result.document) return false
    const next = traceDocument(document, settings, result)
    setHistory((previous) => [...previous.slice(-11), result])
    setResult(next)
    if (tool === "new") {
      setSelected(next.layers.length - 1)
      setTool("add")
    }
    return true
  }

  function undo(): void {
    const previous = history[history.length - 1]
    if (previous === undefined) return
    setResult(previous)
    setHistory(history.slice(0, -1))
    setSelected(undefined)
    setTool("inspect")
  }

  return {
    result,
    selected,
    setSelected,
    tool,
    chooseTool,
    reset,
    repair,
    undo,
    hasRepairs: history.length > 0,
  }
}

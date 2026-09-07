import { Brush, Eraser, MousePointer2, Pipette, Undo2 } from "lucide-react"
import { useEffect, useState } from "react"
import { composeSvg } from "../domain/svg-layers"
import { BrushSurface } from "./BrushSurface"
import { LayerReview } from "./LayerReview"
import { BrushSize, ProjectStatus } from "./SelectionWorkspace"
import type { useVectorProject } from "./useVectorProject"

export function LayerEditor({
  project,
  onReselect,
}: {
  readonly project: ReturnType<typeof useVectorProject>
  readonly onReselect: () => void
}) {
  const { result, selected, setSelected, tool, chooseTool, hasRepairs, undo } = project.output
  const [svgUrl, setSvgUrl] = useState("")
  const layer = selected === undefined ? undefined : result?.layers[selected]
  const svg = result && (layer ? composeSvg([layer], result) : result.svg)
  useEffect(() => {
    if (svg === undefined) return
    const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }))
    setSvgUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [svg])
  if (result === undefined) return undefined
  const active = tool !== "inspect" && !project.isStale && !project.isProcessing
  return (
    <section className="layer-editor" aria-label="Layer repair workspace">
      <div className="editor-heading">
        <h2>Compare & repair</h2>
        <button type="button" onClick={onReselect}>
          Refine subject selection
        </button>
      </div>
      <div className="layer-panel">
        <LayerReview layers={result.layers} selected={selected} onSelect={setSelected} />
      </div>
      <div className="brush-toolbar" aria-label="Repair tools">
        <button
          type="button"
          aria-pressed={tool === "inspect"}
          onClick={() => chooseTool("inspect")}
        >
          <MousePointer2 aria-hidden="true" />
          Inspect
        </button>
        <button
          type="button"
          aria-pressed={tool === "add"}
          disabled={project.isStale || project.isProcessing}
          onClick={() => chooseTool("add")}
        >
          <Brush aria-hidden="true" />
          Add / connect
        </button>
        <button
          type="button"
          aria-pressed={tool === "erase"}
          disabled={project.isStale || project.isProcessing}
          onClick={() => chooseTool("erase")}
        >
          <Eraser aria-hidden="true" />
          Erase
        </button>
        <button
          type="button"
          aria-pressed={tool === "new"}
          disabled={project.isStale || project.isProcessing}
          onClick={() => chooseTool("new")}
        >
          <Pipette aria-hidden="true" />
          New color
        </button>
        <button type="button" onClick={undo} disabled={!hasRepairs || project.isProcessing}>
          <Undo2 aria-hidden="true" />
          Undo repair
        </button>
      </div>
      <p className="tool-help">
        {tool === "new"
          ? "Brush either view to create a layer using the original image’s color at that spot."
          : tool === "erase"
            ? selected === undefined
              ? "All layers: erase through every layer under your brush, including hidden backing. Undo restores the whole stroke."
              : "Erase from the selected layer. Other layers are unchanged."
            : tool === "add"
              ? selected === undefined
                ? "All layers: start on a color in the cut preview, then brush to extend or connect it. That color is used for the whole stroke."
                : "Paint on either view to restore this layer or draw a solid connection. Your brush can cross transparent gaps."
              : "Compare the original with all layers or inspect one layer. Choose a brush to repair the actual cut paths."}
      </p>
      {tool !== "inspect" && <BrushSize radius={project.radius} onChange={project.setRadius} />}
      <div className="image-comparison">
        <div className="comparison-pane">
          <h3>Original</h3>
          <BrushSurface
            sourceUrl={project.originalUrl}
            width={result.width}
            height={result.height}
            radius={project.radius}
            active={active}
            label="Original repair brush"
            onStroke={project.repair}
          />
        </div>
        <div className="comparison-pane">
          <h3>{layer ? `Layer ${(selected ?? 0) + 1} · ${layer.color}` : "All layers"}</h3>
          {svgUrl && (
            <BrushSurface
              sourceUrl={svgUrl}
              width={result.width}
              height={result.height}
              radius={project.radius}
              active={active}
              label="Layer repair brush"
              onStroke={project.repair}
            />
          )}
        </div>
      </div>
      <ProjectStatus project={project} />
    </section>
  )
}

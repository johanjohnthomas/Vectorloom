import { Brush, Eraser, SquareDashed, Undo2 } from "lucide-react"
import { BrushSurface } from "./BrushSurface"
import { CanvasWorkspace } from "./CanvasWorkspace"
import { FULL_SELECTION, type useVectorProject } from "./useVectorProject"

type Project = ReturnType<typeof useVectorProject>

export function SelectionWorkspace({ project }: { readonly project: Project }) {
  const { source } = project
  if (source === undefined)
    return (
      <CanvasWorkspace
        image={undefined}
        selection={FULL_SELECTION}
        status={project.status}
        isProcessing={false}
        svgUrl={undefined}
        onFile={(input) => void project.handleFile(input)}
        onSelectionChange={project.changeSelection}
        onCustomSelection={() => undefined}
        onResetSelection={() => project.changeSelection(FULL_SELECTION)}
      />
    )
  return (
    <section className="selection-workspace" aria-label="Subject selection">
      <div className="brush-toolbar" aria-label="Selection tools">
        <button
          type="button"
          aria-pressed={project.selectionTool === "keep"}
          onClick={() => project.chooseSelectionTool("keep")}
          disabled={project.isProcessing}
        >
          <Brush aria-hidden="true" />
          Keep subject
        </button>
        <button
          type="button"
          aria-pressed={project.selectionTool === "remove"}
          onClick={() => project.chooseSelectionTool("remove")}
          disabled={project.isProcessing}
        >
          <Eraser aria-hidden="true" />
          Remove background
        </button>
        <button
          type="button"
          aria-pressed={project.selectionTool === "box"}
          onClick={() => project.chooseSelectionTool("box")}
          disabled={project.isProcessing}
        >
          <SquareDashed aria-hidden="true" />
          Box selection
        </button>
      </div>
      {project.selectionTool === "box" ? (
        <CanvasWorkspace
          image={source.image}
          selection={project.selection}
          status={project.status}
          isProcessing={project.isProcessing}
          svgUrl={undefined}
          onFile={(input) => void project.handleFile(input)}
          onSelectionChange={project.changeSelection}
          onCustomSelection={() => undefined}
          onResetSelection={() => project.changeSelection(FULL_SELECTION)}
        />
      ) : (
        <>
          <p className="tool-help">
            Mark a few parts of the subject. Use Remove background for anything that should stay
            out.
          </p>
          <div className="brush-toolbar">
            <BrushSize radius={project.radius} onChange={project.setRadius} />
            <button
              type="button"
              disabled={project.marks.length === 0 || project.isProcessing}
              onClick={project.undoMark}
            >
              <Undo2 aria-hidden="true" />
              Undo mark
            </button>
            <button
              type="button"
              disabled={project.marks.length === 0 || project.isProcessing}
              onClick={project.clearMarks}
            >
              Clear marks
            </button>
          </div>
          <BrushSurface
            sourceUrl={source.url}
            width={source.image.width}
            height={source.image.height}
            radius={project.radius}
            active={!project.isProcessing}
            label="Subject brush"
            marks={project.marks}
            onStroke={project.mark}
          />
          <ProjectStatus project={project} />
        </>
      )}
    </section>
  )
}

export function BrushSize({
  radius,
  onChange,
}: {
  readonly radius: number
  readonly onChange: (value: number) => void
}) {
  return (
    <label className="brush-size">
      Brush size
      <input
        type="range"
        min={0.005}
        max={0.12}
        step={0.005}
        value={radius}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  )
}

export function ProjectStatus({ project }: { readonly project: Project }) {
  return (
    <div className="project-status">
      <p role="status" data-kind={project.status.kind}>
        {project.status.message}
      </p>
      <label className="replace-file">
        Replace image
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={(event) => void project.handleFile(event.currentTarget.files?.item(0))}
        />
      </label>
    </div>
  )
}

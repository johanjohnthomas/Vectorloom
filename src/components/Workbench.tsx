import { ShieldCheck } from "lucide-react"
import { useState } from "react"
import { Inspector } from "./Inspector"
import { LayerEditor } from "./LayerEditor"
import { SelectionWorkspace } from "./SelectionWorkspace"
import { StageRail } from "./StageRail"
import { useVectorProject } from "./useVectorProject"
import "./editor.css"

export function Workbench() {
  const project = useVectorProject()
  const [reselecting, setReselecting] = useState(false)
  const result = project.output.result
  const currentStage = project.isProcessing ? 2 : result ? 3 : project.source ? 1 : 0
  const showEditor = result !== undefined && !reselecting
  return (
    <main className="app-shell workbench-flow">
      <StageRail current={currentStage} />
      <section className="workspace">
        <header className="workspace-header">
          <div>
            <p className="coordinate">VECTORLOOM / LOCAL WORKSPACE</p>
            <h1>{project.source?.name ?? "Untitled artwork"}</h1>
          </div>
          <span className="privacy">
            <ShieldCheck aria-hidden="true" />
            Your image stays here
          </span>
        </header>
        {showEditor ? (
          <LayerEditor project={project} onReselect={() => setReselecting(true)} />
        ) : (
          <>
            <SelectionWorkspace project={project} />
            {result && (
              <button
                type="button"
                className="back-to-layers"
                onClick={() => setReselecting(false)}
              >
                Back to layers
              </button>
            )}
          </>
        )}
      </section>
      <Inspector
        {...project.preferences}
        hasImage={project.source !== undefined}
        isProcessing={project.isProcessing}
        selectionInset={Math.round(project.selection.x * 100)}
        analysis={result?.analysis}
        isStale={project.isStale}
        warnings={result?.warnings ?? []}
        canDownload={project.canDownload}
        hasRepairs={project.output.hasRepairs}
        onResetSettings={project.resetSettings}
        onCutModeChange={(cutMode) => project.changeSettings({ cutMode })}
        onColorsChange={(colors) => project.changeSettings({ colors })}
        onDetailChange={(detail) => project.changeSettings({ detail })}
        onSmoothingChange={(smoothing) => project.changeSettings({ smoothing })}
        onMergeShadesChange={(mergeShades) => project.changeSettings({ mergeShades })}
        onFilledBackingChange={(filledBacking) => project.changeSettings({ filledBacking })}
        onToleranceChange={(tolerance) => project.changeSettings({ tolerance })}
        onSelectionInsetChange={(value) => {
          const inset = value / 100
          project.changeSelection({
            x: inset,
            y: inset,
            width: 1 - inset * 2,
            height: 1 - inset * 2,
          })
        }}
        onVectorize={() => {
          setReselecting(false)
          void project.vectorize()
        }}
        onDownload={project.download}
      />
    </main>
  )
}

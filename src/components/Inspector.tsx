import { Download, Layers3, Scissors, Sparkles } from "lucide-react"
import { m } from "motion/react"
import type { SvgAnalysis } from "../domain/vectorize"

export type CutMode = "silhouette" | "layered"

type InspectorProps = {
  readonly hasImage: boolean
  readonly isProcessing: boolean
  readonly cutMode: CutMode
  readonly colors: number
  readonly detail: number
  readonly smoothing: number
  readonly tolerance: number
  readonly selectionInset: number
  readonly analysis: SvgAnalysis | undefined
  readonly onCutModeChange: (mode: CutMode) => void
  readonly onColorsChange: (value: number) => void
  readonly onDetailChange: (value: number) => void
  readonly onSmoothingChange: (value: number) => void
  readonly onToleranceChange: (value: number) => void
  readonly onSelectionInsetChange: (value: number) => void
  readonly onVectorize: () => void
  readonly onDownload: () => void
}

export function Inspector(props: InspectorProps) {
  const { analysis } = props
  return (
    <aside className="inspector" aria-label="Vector settings">
      <header className="inspector-header">
        <div>
          <span className="coordinate">RA 05 35 · DEC +22</span>
          <h2>Cut observatory</h2>
        </div>
        <Sparkles aria-hidden="true" />
      </header>

      <section className="control-section">
        <h3>Cut style</h3>
        <div className="mode-picker">
          <button
            type="button"
            data-active={props.cutMode === "silhouette"}
            onClick={() => props.onCutModeChange("silhouette")}
          >
            <Scissors aria-hidden="true" />
            <strong>Silhouette</strong>
            <span>One reliable vinyl layer</span>
          </button>
          <button
            type="button"
            data-active={props.cutMode === "layered"}
            onClick={() => props.onCutModeChange("layered")}
          >
            <Layers3 aria-hidden="true" />
            <strong>Layered</strong>
            <span>Flat-color stacked cuts</span>
          </button>
        </div>
      </section>

      <Control
        label="Subject frame inset"
        value={props.selectionInset}
        min={0}
        max={40}
        suffix="%"
        onChange={props.onSelectionInsetChange}
      />
      <Control
        label="Background tolerance"
        value={props.tolerance}
        min={5}
        max={90}
        suffix="%"
        onChange={props.onToleranceChange}
      />
      {props.cutMode === "layered" && (
        <Control
          label="Color layers"
          value={props.colors}
          min={2}
          max={8}
          onChange={props.onColorsChange}
        />
      )}
      <Control
        label="Detail kept"
        value={Math.round(props.detail * 100)}
        min={15}
        max={95}
        suffix="%"
        onChange={(value) => props.onDetailChange(value / 100)}
      />
      <Control
        label="Curve smoothing"
        value={Math.round(props.smoothing * 100)}
        min={5}
        max={90}
        suffix="%"
        onChange={(value) => props.onSmoothingChange(value / 100)}
      />

      {analysis && (
        <m.section
          className="complexity"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          aria-live="polite"
        >
          <div className="score" data-rating={analysis.complexity.rating}>
            {analysis.complexity.score}
          </div>
          <div>
            <span className="coordinate">CUT COMPLEXITY / 100</span>
            <h3>{analysis.complexity.rating}</h3>
            <p>{analysis.complexity.advice}</p>
          </div>
          <dl>
            <div>
              <dt>Paths</dt>
              <dd>{analysis.pathCount}</dd>
            </div>
            <div>
              <dt>Layers</dt>
              <dd>{analysis.layerCount}</dd>
            </div>
          </dl>
        </m.section>
      )}

      <div className="inspector-actions">
        <m.button
          type="button"
          className="primary-action"
          disabled={!props.hasImage || props.isProcessing}
          onClick={props.onVectorize}
          whileTap={{ scale: 0.98 }}
        >
          <Sparkles aria-hidden="true" />
          {props.isProcessing ? "Mapping subject…" : "Create cut paths"}
        </m.button>
        <button
          type="button"
          className="download-action"
          disabled={!analysis}
          onClick={props.onDownload}
        >
          <Download aria-hidden="true" />
          Download SVG
        </button>
      </div>
    </aside>
  )
}

type ControlProps = {
  readonly label: string
  readonly value: number
  readonly min: number
  readonly max: number
  readonly suffix?: string
  readonly onChange: (value: number) => void
}

function Control({ label, value, min, max, suffix = "", onChange }: ControlProps) {
  const id = label.toLowerCase().replaceAll(" ", "-")
  return (
    <div className="range-control">
      <div className="range-control-head">
        <label htmlFor={id}>{label}</label>
        <output htmlFor={id}>
          {value}
          {suffix}
        </output>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(event) => onChange(event.currentTarget.valueAsNumber)}
      />
    </div>
  )
}

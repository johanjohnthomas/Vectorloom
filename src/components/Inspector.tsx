import { Download, Layers3, Scissors, Spline } from "lucide-react"
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
  readonly mergeShades: number
  readonly filledBacking: boolean
  readonly onMergeShadesChange: (value: number) => void
  readonly onFilledBackingChange: (value: boolean) => void
  readonly isStale: boolean
  readonly canDownload: boolean
  readonly warnings: readonly string[]
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
  readonly onResetSettings: () => void
  readonly hasRepairs: boolean
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
        <Spline aria-hidden="true" />
      </header>

      <p className="settings-summary">
        {props.cutMode === "layered"
          ? `Layered cut · up to ${props.colors} colors`
          : "Single-color silhouette"}
        {props.cutMode === "layered" && props.filledBacking ? " · filled backing" : ""}
      </p>
      <details className="advanced-settings">
        <summary>Advanced settings</summary>
        <button type="button" className="reset-defaults" onClick={props.onResetSettings}>
          Use recommended defaults
        </button>
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
          <>
            <Control
              label="Maximum colors"
              value={props.colors}
              min={2}
              max={8}
              onChange={props.onColorsChange}
            />
            <Control
              label="Merge similar shades"
              value={Math.round(props.mergeShades * 100)}
              min={0}
              max={100}
              suffix="%"
              onChange={(value) => props.onMergeShadesChange(value / 100)}
            />
            <div className="backing-control control-section">
              <label>
                <input
                  type="checkbox"
                  checked={props.filledBacking}
                  onChange={(event) => props.onFilledBackingChange(event.target.checked)}
                />
                Filled backing layers
              </label>
              <p>
                Connect pieces with solid backing beneath upper colors. Transparent gaps stay open;
                pieces that cannot be joined invisibly stay separate.
              </p>
            </div>
          </>
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
      </details>

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
        {props.hasRepairs && (
          <p className="result-notice">Creating paths again replaces your brush repairs.</p>
        )}
        {props.isStale && (
          <p className="result-notice" role="status">
            Settings changed. Create cut paths to update the preview and export.
          </p>
        )}
        {props.warnings.map((warning) => (
          <p className="result-notice" key={warning} role="status">
            {warning}
          </p>
        ))}
        <m.button
          type="button"
          className="primary-action"
          disabled={!props.hasImage || props.isProcessing}
          onClick={props.onVectorize}
          whileTap={{ scale: 0.98 }}
        >
          <Spline aria-hidden="true" />
          {props.isProcessing ? "Mapping subject…" : "Create cut paths"}
        </m.button>
        <button
          type="button"
          className="download-action"
          disabled={!props.canDownload}
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

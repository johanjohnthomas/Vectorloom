import { ChevronLeft, ChevronRight } from "lucide-react"
import type { SvgLayer } from "../domain/svg-layers"

type LayerReviewProps = {
  readonly layers: readonly SvgLayer[]
  readonly selected: number | undefined
  readonly onSelect: (index: number | undefined) => void
}

export function LayerReview({ layers, selected, onSelect }: LayerReviewProps) {
  const active = selected === undefined ? undefined : layers[selected]
  return (
    <div className="layer-review" aria-label="Layer review">
      <div className="layer-review-controls">
        <button
          type="button"
          aria-pressed={selected === undefined}
          onClick={() => onSelect(undefined)}
        >
          All layers
        </button>
        <button
          type="button"
          aria-label="Previous layer"
          disabled={layers.length === 0}
          onClick={() =>
            onSelect(
              selected === undefined
                ? layers.length - 1
                : (selected + layers.length - 1) % layers.length,
            )
          }
        >
          <ChevronLeft aria-hidden="true" />
        </button>
        <select
          aria-label="Preview layer"
          value={selected ?? "all"}
          onChange={(event) =>
            onSelect(event.target.value === "all" ? undefined : Number(event.target.value))
          }
        >
          <option value="all">Combined artwork</option>
          {layers.map((layer, index) => (
            <option key={layer.id} value={index}>
              Layer {index + 1} · {layer.color}
            </option>
          ))}
        </select>
        <button
          type="button"
          aria-label="Next layer"
          disabled={layers.length === 0}
          onClick={() => onSelect(selected === undefined ? 0 : (selected + 1) % layers.length)}
        >
          <ChevronRight aria-hidden="true" />
        </button>
      </div>
      <div className="layer-swatches" aria-label="Color layers, bottom to top">
        {layers.map((layer, index) => (
          <button
            key={layer.id}
            type="button"
            aria-label={`Preview layer ${index + 1}: ${layer.color}`}
            aria-pressed={selected === index}
            onClick={() => onSelect(index)}
          >
            <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
              <rect
                x="1"
                y="1"
                width="18"
                height="18"
                rx="3"
                fill={layer.color}
                stroke="currentColor"
              />
            </svg>
            {index + 1}
          </button>
        ))}
      </div>
      <p aria-live="polite">
        {active
          ? `Layer ${(selected ?? 0) + 1} of ${layers.length} · ${active.paths.length} ${active.paths.length === 1 ? "shape" : "shapes"}`
          : `${layers.length} color layers · bottom to top`}
        . Download includes all layers.
      </p>
    </div>
  )
}

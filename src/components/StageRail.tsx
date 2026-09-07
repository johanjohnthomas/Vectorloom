import { Check, Crop, Download, Spline, Upload } from "lucide-react"
import { m } from "motion/react"

const STAGES = [
  { label: "Upload", icon: Upload },
  { label: "Isolate", icon: Crop },
  { label: "Vectorize", icon: Spline },
  { label: "Export", icon: Download },
] as const

type StageRailProps = {
  readonly current: number
}

export function StageRail({ current }: StageRailProps) {
  return (
    <aside className="stage-rail" aria-label="Conversion progress">
      <svg className="mark" viewBox="0 0 64 64" role="img" aria-label="Vectorloom">
        <path className="mark-field" d="M0 0h64v64H0z" />
        <path className="mark-frame" d="M32 6 58 32 32 58 6 32Z" />
        <path className="mark-weave" d="m20 22 10 24 4-12 10-12h-7l-5 7-3-7Z" />
      </svg>
      <ol>
        {STAGES.map(({ label, icon: Icon }, index) => {
          const isCurrent = index === current
          const isComplete = index < current
          const status = isCurrent ? "Current" : isComplete ? "Done" : "Next"
          return (
            <li
              key={label}
              data-complete={isComplete}
              aria-current={isCurrent ? "step" : undefined}
            >
              <div className="stage-step" data-current={isCurrent} data-complete={isComplete}>
                <span className="stage-icon" aria-hidden="true">
                  {isCurrent && <m.span className="stage-orbit" layoutId="stage-orbit" />}
                  {isComplete ? <Check /> : <Icon />}
                </span>
                <span className="stage-copy">
                  <span className="stage-label">{label}</span>
                  <span className="stage-status">{status}</span>
                </span>
              </div>
            </li>
          )
        })}
      </ol>
      <p className="local-note">
        Local only
        <br />
        No uploads
      </p>
    </aside>
  )
}

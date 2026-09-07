import { Check, Crop, Download, Sparkles, Upload } from "lucide-react"
import { m } from "motion/react"

const STAGES = [
  { label: "Upload", icon: Upload },
  { label: "Isolate", icon: Crop },
  { label: "Vectorize", icon: Sparkles },
  { label: "Export", icon: Download },
] as const

type StageRailProps = {
  readonly current: number
}

export function StageRail({ current }: StageRailProps) {
  return (
    <nav className="stage-rail" aria-label="Conversion stages">
      <div className="mark">VL</div>
      <ol>
        {STAGES.map(({ label, icon: Icon }, index) => {
          const isCurrent = index === current
          const isComplete = index < current
          return (
            <li key={label}>
              <div className="stage-step" data-current={isCurrent} data-complete={isComplete}>
                {isCurrent && <m.span className="stage-orbit" layoutId="stage-orbit" />}
                {isComplete ? <Check aria-hidden="true" /> : <Icon aria-hidden="true" />}
                <span>{label}</span>
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
    </nav>
  )
}

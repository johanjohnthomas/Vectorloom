import { domAnimation, LazyMotion, MotionConfig } from "motion/react"
import { Workbench } from "./components/Workbench"

export function App() {
  return (
    <MotionConfig
      reducedMotion="user"
      transition={{ type: "spring", stiffness: 340, damping: 32, mass: 0.8 }}
    >
      <LazyMotion features={domAnimation} strict>
        <Workbench />
      </LazyMotion>
    </MotionConfig>
  )
}

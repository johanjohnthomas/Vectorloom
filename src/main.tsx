import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { App } from "./App"
import "./styles.css"

if (import.meta.env.DEV) {
  void import("react-grab")
  void import("react-scan")
}

const root = document.getElementById("root")
if (root === null) {
  throw new TypeError("Vectorloom requires a root element")
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

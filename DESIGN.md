# Vectorloom Design System

## 0. Research Log

- Embedded references: shortlisted Figma, Linear, and Miro for creative-tool clarity; selected Figma for monochrome editor chrome, content-owned color, compact tool controls, and dashed selection focus.
- Impeccable direction roll: seven grounded worlds were cutting mat, letterpress proof, garment pattern table, celestial atlas, botanical plate, screen-print carousel, and conservation lightbox. The assigned fourth direction, celestial atlas, became the product world.
- Lazyweb: searched “design editor image background removal workspace” and viewed Krea AI, Adobe Express, and PhotoRoom. Harvested a dominant central canvas, shallow tool rails, contextual inspector, immediate progress feedback, and a persistent export action.
- Concept drafts: generated a three-direction board at `/Users/johan.thomas/.codex/generated_images/01a07b4a-5da3-7c10-8ae5-06582958aa48/exec-551e47e1-0963-4db1-a8c9-f7cab31fe188.png`; chose the dark drafting-console composition and raised it with the celestial atlas’s hierarchy, coordinate language, and focused amber observation state.
- Interaction source: use Motion for React’s shared-layout/state transitions, with reduced-motion handled globally. No decorative continuous animation.

## 1. Direction and Atmosphere

Vectorloom is a maker’s star atlas: a quiet midnight drafting surface where the uploaded subject is the brightest object and each generated cut layer becomes an observable plate. The interface feels precise, tactile, and patient rather than “AI magical.”

The memorable moment is the subject-selection rectangle resolving into a clean constellation of vector layers while the complexity reading changes from “dense sky” to “ready to cut.”

## 2. Color Tokens

All product code uses semantic custom properties.

- `--ink`: #06111f, night-chart background.
- `--ink-raised`: #0c1b2c, raised work surfaces.
- `--ink-soft`: #13263a, selected or hovered surface.
- `--paper`: #f3ead8, primary foreground and canvas paper.
- `--paper-muted`: #b9b09f, secondary copy.
- `--fog`: #7f8a94, quiet technical copy.
- `--amber`: #ff6b4a, active observation, focus, and primary action.
- `--amber-bright`: #ffb36b, warm highlight and success detail.
- `--cyan`: #41d7e8, vector path and selection preview.
- `--lime`: #b9df69, cut-ready status.
- `--warning`: #f4be55, complexity warning.
- `--danger`: #ff746c, invalid file or failed processing.

Flat SVG layers may use colors derived from the uploaded image. Interface status never depends on color alone.

## 3. Typography

- Display: “Cormorant Garamond”, self-hosted or loaded from Google Fonts, 600 italic where the atlas voice is used.
- UI/body: “Manrope”, 400–700.
- Coordinates/data: “IBM Plex Mono”, 400–600, only for measurements, stages, and path counts.
- Scale: 12, 14, 16, 18, 24, 36, 56 pixels with fluid display clamped below 56 pixels.
- Body line height is 1.5–1.7; display line height is 0.95–1.05. Tracking never goes tighter than -0.03em.

## 4. Spacing and Layout

- Base unit: 4 pixels.
- Scale: 4, 8, 12, 16, 24, 32, 48, 64.
- Desktop editor: 152px passive progress rail, flexible canvas, 320px inspector.
- Tablet: compact horizontal stage strip, canvas, inspector below.
- Mobile: single-column flow with the canvas first and controls grouped in a bottom workbench.
- Interactive targets are at least 44 by 44 pixels. The central work surface owns scrolling; controls never overlap the artwork.

## 5. Reusable Primitives and States

- `AtlasButton`: primary amber filled, secondary ink-raised, ghost. States: default, hover, pressed, focus-visible, disabled, busy.
- `StageRail`: a non-interactive four-step progress indicator with connected icon nodes, explicit Done/Current/Next state copy, and a compact horizontal responsive form.
- `ToolSurface`: raised inspector/canvas surface with 14px radius and one elevation treatment.
- `UploadField`: drop target, file input, empty/dragging/loaded/error states.
- `SegmentCanvas`: source image, crop/subject rectangle, drag handles, keyboard-adjustable selection, loading overlay, and vector preview.
- `ControlGroup`: label, plain-language help, native range/select control, and value output.
- `CutModePicker`: silhouette and layered options with icon plus explanatory text.
- Layered controls: maximum colors, adjustable shade merging, and an opt-in filled backing checkbox. Filled backing covers enclosed color details while preserving transparent openings; exported groups follow bottom-to-top assembly order.
- `LayerReview`: preview toolbar with all-layers view, previous/next controls, a native layer selector, and color swatches. Selected layers keep the full artwork coordinate frame. Reviewing a layer does not remove other layers from the export. Controls use existing 44px targets, 4/8/12/16px spacing, ink/paper/amber tokens and visible focus treatment.
- Updated settings require creating cut paths again; stale previews are labeled and their export disabled until rebuilt. Layer warnings appear with the generated result.
- `ComplexityMeter`: score, verbal rating, path/layer counts, and corrective advice. Must expose the same information as text.
- `StatusToast`: short success/error feedback with icon and recovery action when applicable.

Primitive showcase is the editor’s initial empty state: every button, upload, stage, surface, focus style, control group, and status treatment is visible before an image is selected.

## 6. Motion and Interaction

- Motion library: `motion`, imported from `motion/react`.
- Spatial spring: stiffness 340, damping 32, mass 0.8.
- Soft reveal: 180ms, `[0.16, 1, 0.3, 1]`, opacity plus no more than 8px translation.
- Stage changes use shared-layout movement so the user sees continuity.
- Processing swaps content through a short opacity/blur crossfade and announces progress in an ARIA live region.
- Canvas selection responds immediately to pointer/touch drag; no animation trails the pointer.
- `prefers-reduced-motion` disables transform/layout animation through `MotionConfig reducedMotion="user"` and CSS overrides.

## 7. Depth and Material

- Depth comes from nested navy tones, faint coordinate rules, and wide soft shadows with vertical offset.
- Canvas paper uses a checker/coordinate texture because transparency and measurement are functional to the subject.
- One shadow recipe: `0 20px 60px rgba(0, 0, 0, 0.28)` on the primary workbench only.
- Controls use tonal shifts, not borders plus shadows. Hairline coordinate rules may use translucent amber or paper.

## 8. Accessibility Constraints and Accepted Debt

- WCAG AA contrast for text and controls.
- Full keyboard path: upload, choose mode, adjust values, move/resize selection, process, download.
- Visible dashed 2px focus ring with 3px offset, echoing a selection marquee.
- Error and readiness states include text and icon, not color alone.
- Canvas selection has an equivalent numeric inset control and reset action.
- At 200 percent zoom the editor becomes document flow; no two-dimensional pan is required to reach controls.
- Accepted MVP debt: interactive segmentation depends on downloading a MediaPipe model at first use; when unavailable, the manual rectangular isolation and image-alpha fallback remain functional and are disclosed rather than hidden.
- Accepted MVP debt: complex manual mask painting and true multi-object SAM selection are roadmap capabilities, not simulated in the first release.

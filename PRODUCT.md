# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

React, Vite, and TypeScript, deployed as a static GitHub Pages application at https://johanjohnthomas.github.io/Vectorloom/. Image processing runs locally in the browser.

## Users

Primary users are Cricut owners, crafters, and small creative businesses who have raster artwork but need a clean, cut-ready SVG without learning a professional vector editor.

## Product Purpose

Vectorloom turns a user-selected subject in a PNG, JPEG, or WebP image into a simplified SVG suitable for craft cutting. Success means a user can isolate the intended subject, understand the trade-off between detail and cutability, preview the result, and download an SVG without uploading the source image to a server.

## Positioning

Vectorloom treats subject isolation and cut-file preparation as one guided workflow. It does not merely wrap a generic image trace: it helps the user select the subject, removes the background, reduces photographic complexity, and reports whether the output is practical to cut.

## Operating Context

Users arrive with personal artwork, photographs, product images, or character art. They work on desktop, tablet, or phone using touch, a mouse, a trackpad, or keyboard controls, and import the downloaded SVG into Cricut Design Space or another cutting workflow.

## Capabilities and Constraints

- Upload PNG, JPEG, or WebP images.
- Isolate a subject automatically or guide MediaPipe with keep/remove brush marks; retain rectangular selection as an alternative.
- Preserve existing transparency for unmarked transparent artwork, and provide an explicitly reported edge-isolation fallback when smart isolation is unavailable.
- Create single-color silhouettes or layered traces with automatic-first defaults and advanced tuning.
- Consolidate related shades while protecting neutral near-black details from colored shadows.
- Fill and connect backing beneath upper colors where the stacking order allows, while preserving transparent openings.
- Compare the original with combined or individual layers and repair actual export paths using Add / connect, Erase, New color, and bounded undo.
- Support combined-view erasure through all layers and stroke-start color targeting for combined-view additions.
- Export path-only SVG with flat fills and a valid `viewBox`.
- Keep image processing in the browser for privacy and GitHub Pages compatibility.
- Clearly warn that detailed photographs, shadows, gradients, and tiny islands require simplification for reliable cutting.
- Remember downloaded cut settings in a cookie without storing images or repair history.
- Require users to download their SVG before leaving; persistent projects, material simulation, and automatic recognition of every shadow are outside the product's current capabilities.

## Brand Commitments

The product name is Vectorloom. Its maker-focused visual system follows Impeccable design craft and uses purposeful Motion transitions. Existing reusable controls take precedence over adding component libraries. KokonutUI and Bklit remain eligible sources when a feature genuinely benefits from them, not dependencies claimed by the current application.

## Evidence on Hand

The repository includes automated domain and integration tests plus browser scenarios for isolation, repairs, palette handling, export, saved preferences, and responsive layouts. These checks do not constitute physical Cricut or material certification. Do not invent testimonials, usage metrics, endorsements, or rights to third-party artwork. Vectorloom is independent of Cricut.

## Product Principles

1. Local by default: source images stay on the device.
2. Cutability over false fidelity: simplify honestly for physical materials.
3. Show the transformation: every major stage has a clear visual preview.
4. Keep control with the maker: automatic results remain adjustable.
5. Explain complexity in craft language, not computer-vision jargon.

## Accessibility & Inclusion

Core flows must be keyboard-operable, touch-friendly, readable at 200 percent zoom, respectful of reduced motion, and not depend on color alone to communicate selection, layers, warnings, or progress.

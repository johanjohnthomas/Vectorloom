# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Inferred from the explicit brief: React, Vite, and TypeScript, deployed as a static GitHub Pages application. Image processing is local-first and runs in the browser.

## Users

Primary users are Cricut owners, crafters, and small creative businesses who have raster artwork but need a clean, cut-ready SVG without learning a professional vector editor.

## Product Purpose

Vectorloom turns a user-selected subject in a PNG, JPEG, or WebP image into a simplified SVG suitable for craft cutting. Success means a user can isolate the intended subject, understand the trade-off between detail and cutability, preview the result, and download an SVG without uploading the source image to a server.

## Positioning

Vectorloom treats subject isolation and cut-file preparation as one guided workflow. It does not merely wrap a generic image trace: it helps the user select the subject, removes the background, reduces photographic complexity, and reports whether the output is practical to cut.

## Operating Context

Users arrive with personal artwork, photographs, product images, or character art. They work on desktop or tablet, may use touch or a trackpad, and ultimately upload the downloaded SVG into Cricut Design Space or another cutting workflow.

## Capabilities and Constraints

- Upload PNG, JPEG, or WebP images.
- Identify a subject from a user-selected region or focal point and remove the background.
- Offer a dependable single-color silhouette and a multi-color layered trace.
- Let users tune palette size, detail, smoothing, and background-removal tolerance.
- Export path-only SVG with flat fills and a valid `viewBox`.
- Keep image processing in the browser for privacy and GitHub Pages compatibility.
- Clearly warn that detailed photographs, shadows, gradients, and tiny islands require simplification for reliable cutting.
- Advanced foundation: swap the lightweight selection engine for MediaPipe Interactive Segmenter or SAM-class models without replacing the editor workflow.

## Brand Commitments

The product name is Vectorloom. The interface should use Impeccable design craft and purposeful Motion interactions. KokonutUI patterns may be adapted as source material; Bklit methodology applies when a genuine data visualization is needed, but neither should force unrelated dependencies.

## Evidence on Hand

No customer testimonials, usage metrics, logos, or proprietary image assets were supplied. The product must not fabricate them. The user's Lightning McQueen example is a use case, not a license to ship copyrighted character imagery.

## Product Principles

1. Local by default: source images stay on the device.
2. Cutability over false fidelity: simplify honestly for physical materials.
3. Show the transformation: every major stage has a clear visual preview.
4. Keep control with the maker: automatic results remain adjustable.
5. Explain complexity in craft language, not computer-vision jargon.

## Accessibility & Inclusion

Core flows must be keyboard-operable, touch-friendly, readable at 200 percent zoom, respectful of reduced motion, and not depend on color alone to communicate selection, layers, warnings, or progress.

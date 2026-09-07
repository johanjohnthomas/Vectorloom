# Vectorloom

Vectorloom is a private, browser-first image-to-SVG workbench for craft cutting. It guides a maker through subject selection, background isolation, vector simplification, cut-complexity review, and path-only SVG download.

## Run locally

```bash
bun install
bun run dev
```

Open the local URL, choose a PNG/JPEG/WebP image, draw a tight box around the subject, choose a silhouette or layered cut, and create the cut paths.

In layered mode, **Maximum colors** caps the palette and **Merge similar shades** combines related shades before tracing. **Filled backing layers** makes enclosed details stack on solid backing pieces, such as a white eye below a separate pupil. Transparent subject openings remain open; mutually overlapping colors retain cut-outs with a warning.

After creating paths, use the color swatches, layer selector, or previous/next buttons to inspect individual pieces. **All layers** restores the composite. Download always includes every layer in assembly order, even while viewing just one. Changing tracing settings requires recreating paths before export.

Curve smoothing now cleans interior color noise and smooths mask contours before fitting curves. Higher values simplify pixel zigzags; lower detail removes tiny regions. Review small lettering and fine details before cutting.

## Quality checks

```bash
bun run check
```

## GitHub Pages

The workflow in `.github/workflows/deploy.yml` builds and deploys `dist` whenever `main` is pushed. In the GitHub repository settings, set Pages source to **GitHub Actions**.

## Architecture

- MediaPipe Interactive Segmenter runs on-device when its model is available.
- A border-color edge isolation fallback keeps the core demo functional if the model cannot load.
- ImageTracerJS traces the isolated bitmap into flat SVG paths.
- The export sanitizer removes embedded raster images, gradients, filters, scripts, and text before download.

The first version intentionally favors clean craft cuts over photo-real fidelity. Pixel brush masking, multi-object selection, bridge/gap analysis, and SAM-class models are documented roadmap items in `PRODUCT.md`.

The architecture choices and source evidence are documented in [`docs/RESEARCH.md`](docs/RESEARCH.md).

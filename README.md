# Vectorloom

Vectorloom is a private, browser-first image-to-SVG workbench for craft cutting. It guides a maker through subject selection, background isolation, vector simplification, cut-complexity review, and path-only SVG download.

## Run locally

```bash
bun install
bun run dev
```

Open the local URL and choose a PNG/JPEG/WebP image. Start with automatic isolation, or brush **Keep subject** and **Remove background** marks to guide the model. **Box selection** is still available. Undo or clear marks before generating. Transparent artwork uses its existing alpha when no marks are present.

Recommended defaults create layered cuts with up to six colors, strong shade consolidation, smoother curves, and filled backing. Numeric tuning and silhouette mode are under **Advanced settings**, closed by default. Saved preferences are respected; **Use recommended defaults** resets them.

In layered mode, **Maximum colors** caps the palette and **Merge similar shades** combines related shades before tracing. **Filled backing layers** extends lower pieces beneath upper colors to join disconnected panels and fill enclosed details, such as a white eye below a separate pupil. Larger color regions are preferred as backing where containment allows. Transparent openings remain open. Pieces that cannot be connected without changing the visible design stay separate; conflicting color orders retain necessary cut-outs with a warning. This reduces separate pieces where possible, but does not guarantee the fewest cuts for every image.

After creating paths, use the color swatches, layer selector, or previous/next buttons to inspect individual pieces. **All layers** restores the composite. Download always includes every layer in assembly order, even while viewing just one. Changing tracing settings requires recreating paths before export.

**Compare & repair** shows the original selection beside the combined SVG or an individual layer (stacked on phones). **Add / connect** paints solid material onto the selected layer, including deliberate bridges across transparent gaps; **Erase** removes only from that layer. **New color** samples the original under your brush and creates a new layer, then switches to adding to it. There is no color-picker step. Brush edits change exported SVG paths, preserve untouched layers, and support the last 12 edits through **Undo repair**. Keyboard users can move the brush with arrow keys and hold Space to paint. Creating paths again replaces manual repairs, with a visible warning.

Downloading an SVG remembers the cut style, palette, detail, smoothing, shade merging, backing, and background tolerance in an app-scoped preference cookie for up to one year. Your last downloaded settings are restored on your next visit; unsaved edits do not replace them. Images, filenames, selections, and repair history are never stored in the cookie. Save the SVG before leaving; this is not persistent project storage. Blocking cookies does not prevent SVG downloads.

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

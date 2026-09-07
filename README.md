# Vectorloom

Turn images into layered SVGs for craft cutting. Isolate a subject, simplify its colors, repair individual pieces, and export clean vector paths from your browser.

[Open Vectorloom](https://johanjohnthomas.github.io/Vectorloom/) · [Technical guide](docs/RESEARCH.md) · [Report an issue](https://github.com/johanjohnthomas/Vectorloom/issues)

[![Checks and deployment](https://github.com/johanjohnthomas/Vectorloom/actions/workflows/deploy.yml/badge.svg)](https://github.com/johanjohnthomas/Vectorloom/actions/workflows/deploy.yml)

## Made for makers

Vectorloom brings subject isolation, color simplification, and layer repair into one workspace for Cricut owners and other craft-cutting workflows. Your images are processed on your device, without an account or an image-upload service.

- **Brush-guided isolation:** mark the subject to keep and the background to remove, or use a rectangular selection. Transparent artwork can retain its existing alpha.
- **Automatic-first tracing:** start with layered output, up to six colors, shade consolidation, smooth curves, and filled backing. Fine-tune the result in **Advanced settings**, or choose a single-color silhouette.
- **Simpler color layers:** consolidate related shades while protecting near-black details from colored shadows.
- **Connected backing:** extend lower pieces beneath upper colors, fill enclosed details such as an eye beneath its pupil, and preserve thin backing connections through smoothing.
- **Original-to-vector comparison:** inspect the combined artwork or navigate individual layers without losing their alignment.
- **Editable cut paths:** add material, connect pieces, erase unwanted regions, or brush a missing color to create a layer sampled from the original. Undo the last 12 repairs.
- **Desktop, tablet, and phone support:** responsive comparison views, touch painting, and keyboard brush controls.
- **SVG export and saved preferences:** download flat-filled vector paths in assembly order and reuse the settings from your last download.

## Use Vectorloom

1. **Open an image.** Upload a PNG, JPEG, or WebP in the [live application](https://johanjohnthomas.github.io/Vectorloom/).
2. **Isolate and generate.** Brush **Keep subject** or **Remove background** marks where needed, then choose **Create cut paths**. You can also start with automatic isolation or use **Box selection**.
3. **Review, repair, and export.** Compare the original with your layers, make any corrections, and choose **Download SVG**. Import the SVG into your cutting software and review its size and details before cutting.

### Repair tools

| Tool | All layers | Individual layer |
| --- | --- | --- |
| **Add / connect** | Start on a color in the cut preview to extend that layer for the whole stroke. | Paint anywhere on the selected layer, including across transparent gaps. |
| **Erase** | Remove material through every layer under the brush, including hidden backing. | Remove material only from the selected layer. |
| **New color** | Brush either view to create a layer using the original image's color at that location. | Create a new layer from the original, then continue painting that layer. |
| **Undo repair** | Restore the previous repair state, including all layers affected by a stroke. | Restore the previous repair state. |

Starting **Add / connect** on transparency in **All layers** makes no change; select a layer if you want to paint freely. Keyboard users can move the brush with arrow keys and hold Space to paint.

Download includes every layer, even when you are viewing just one. Changing tracing settings requires creating paths again, which replaces manual repairs; the workspace warns you before regeneration.

### Advanced settings

Control the cut style, maximum colors, shade merging, detail, smoothing, filled backing, selection inset, and background tolerance. **Use recommended defaults** restores the automatic-first configuration. Existing saved preferences are respected.

## Privacy and storage

- Source images, selections, and layer repairs are processed locally in the browser and are not uploaded for processing.
- Smart isolation downloads its MediaPipe model and runtime on first use. Loading the app and external assets requires network access; local image processing does not mean a guaranteed offline application.
- Downloading an SVG stores only your cut settings in an app-scoped cookie for up to one year. Blocking cookies does not prevent export.
- Images, filenames, selections, and undo history are not saved in that cookie. **Download your SVG before leaving**; the workspace is not persistent project storage.

## Preparing a reliable cut

Vectorloom prioritizes simpler craft geometry over photographic fidelity. Review small lettering, delicate connections, and isolated pieces at your intended physical size. The complexity indicator is guidance, not machine or material certification.

Filled backing preserves transparent openings and only adds automatic connections where upper layers can hide them. Some pieces must remain separate to preserve the design. Conflicting color nesting can require cut-outs; Vectorloom reports these cases.

Near-black protection is a color-based heuristic, not semantic shadow recognition. Very dark, low-chroma shadows may still resemble black artwork. Difficult subjects may need brush corrections. If smart isolation is unavailable, the app uses edge-based isolation and your brush marks and explains the fallback.

Vectorloom is an independent project and is not affiliated with Cricut. Physical machine and material results are not guaranteed. Use artwork you own or have permission to reproduce.

## Development

Install [Bun](https://bun.sh/), then run:

```bash
git clone https://github.com/johanjohnthomas/Vectorloom.git
cd Vectorloom
bun install --frozen-lockfile
bun run dev
```

For a production build and local preview:

```bash
bun run build
bun run preview -- --host 127.0.0.1 --port 4180 --strictPort
```

### Verification

```bash
bun run check
```

This runs Biome, strict TypeScript checking, Vitest regression tests, and the production build. Browser scenarios cover isolation, palette consolidation, filled backing, combined and individual layer repairs, SVG downloads, settings persistence, and responsive layouts.

With the production preview running on port 4180 and Chrome installed, run:

```bash
node scripts/composite-qa.mjs
node scripts/cut-quality-qa.mjs
```

For WebKit coverage, install its Playwright browser and run:

```bash
bunx playwright install webkit
VECTORLOOM_BROWSER=webkit node scripts/composite-qa.mjs
```

Set `VECTORLOOM_BASE_URL` to test another deployment. Browser evidence is written under `.omo/evidence/` and is not included in the published application.

## Technology and deployment

React, TypeScript, and Vite power the workspace. MediaPipe performs on-device subject isolation; perceptual palette grouping and editable raster masks prepare the color layers; ImageTracerJS produces flat SVG paths. Motion handles interface transitions, with the visual system documented in [DESIGN.md](DESIGN.md).

[GitHub Actions](.github/workflows/deploy.yml) runs the project checks, builds `dist`, and publishes the application to GitHub Pages on pushes to `main`. No application backend is required. Forks can use the same workflow by configuring Pages to deploy through GitHub Actions.

See the [technical guide](docs/RESEARCH.md) for the processing pipeline and design decisions. To report a problem, include your browser, the settings used, expected and actual results, and a non-sensitive sample image you have permission to share.

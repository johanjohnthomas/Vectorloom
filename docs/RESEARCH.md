# Vectorloom Technical Guide

Vectorloom separates three tasks: identifying the intended subject, simplifying raster colors, and producing editable geometry for craft cutting. The application runs in the browser and is deployed as static assets on GitHub Pages.

## Processing pipeline

1. **Prepare the image.** Validate the uploaded PNG, JPEG, or WebP and prepare the selected region. The default region is the full image; rectangular cropping is optional.
2. **Isolate the subject.** Unmarked transparent artwork uses its existing alpha. Otherwise, MediaPipe Interactive Segmenter receives positive and negative brush strokes, with a center foreground point when no keep stroke is supplied. Inference runs locally. If the model cannot run, perimeter-based edge isolation provides an explicitly reported fallback.
3. **Apply brush guidance.** Keep/remove footprints correct the isolation mask in stroke order. The original image is retained for comparison and later color sampling.
4. **Simplify the palette.** Perceptual color grouping consolidates related shades within the chosen color limit. A neutral near-black family gets a protected slot so chromatic shadows cannot absorb those details.
5. **Build the layers.** Color masks represent each plate. Filled backing covers enclosed opaque details and extends lower plates beneath upper ones. Ordering constraints maintain the assembled design; conflicting nesting uses deterministic light-to-dark ordering within cycles and reports remaining cut-outs.
6. **Trace the geometry.** Interior label cleanup and mask smoothing reduce noise. Established filled backing survives spatial smoothing. ImageTracerJS fits vector paths, and the detail control filters tiny regions.
7. **Repair and export.** Brush repairs update editable masks and retrace changed layers while reusing untouched layer paths. Export assembles named groups with flat-filled paths and a shared `viewBox`, rather than embedding the uploaded image.

## Repair model

Each editable document contains the original raster, its dimensions, and ordered color-layer masks. Both comparison panels use the same coordinates.

- In **All layers**, Erase modifies every mask under the brush. Add / connect chooses the topmost cut color at the start of the stroke and keeps that target throughout.
- In an individual layer, Add and Erase modify only that layer. Add can deliberately cross transparent gaps.
- New color samples the original under the brush, creates a top layer using the median sampled RGB channels, and can be used from either preview.
- One completed repair adds one undo state; history retains the last 12 repairs.
- Manual repairs are not automatically refilled or clipped back to the source alpha. This preserves deliberate erasures and added connections.
- Changing tracing settings makes the result stale. Regeneration replaces repairs; export remains disabled until the settings and generated result agree.

## Implementation choices

**MediaPipe** supplies interactive subject isolation without an image-upload service. The implementation uses the installed `@mediapipe/tasks-vision` API and a MagicTouch model downloaded on demand.

**ImageTracerJS** converts binary color masks into SVG paths. Palette preparation, backing, edit history, and export composition remain separate application responsibilities.

**React, TypeScript, and Vite** provide the workspace and static build. **Motion** handles interface transitions. Processing and export do not require an application backend.

The export is constructed from flat color groups and path data. Raster images, filters, gradients, editable text, and decorative strokes are not added to the output.

## Quality and operating limits

- Palette grouping is deterministic for a given input raster and settings. Browser image decoding and antialiasing can produce small differences in raster input.
- Near-black protection uses a bounded RGB heuristic: the brightest channel is at most 32 and the channel spread is at most 12. This is not semantic recognition of objects or shadows.
- Automatic connections stay beneath upper plates and preserve transparency. The algorithm does not guarantee a single physical piece per color or the minimum possible cut count.
- Complexity is estimated from SVG structure, not calibrated to a machine, blade, material, or physical scale. The maker should inspect delicate features before cutting.
- Smart isolation needs its downloaded model and runtime. Local processing is not a guarantee of offline availability.
- Cookies retain downloaded cut settings only. Images, selections, and repair history are session-local, not persistent projects.

## Verification

`bun run check` runs formatting/lint checks, strict TypeScript, the Vitest suite, and the production build. Regression tests cover palette limits, black/shadow separation, mask filling, nesting order, thin connections, selected and combined edits, undo, and SVG structure.

Executable browser checks under `scripts/` drive the application through upload, selection, tracing, repair, and download. They inspect exported SVG paths and rendered pixel alpha as well as interaction state. Chrome and WebKit scenarios cover responsive comparison views and keyboard input; Chrome scenarios additionally exercise emulated touch. These checks are not physical-device or cutting-machine certification.

## Source map

- [Image preparation and generation](../src/services/generate-artwork.ts)
- [Interactive segmentation](../src/services/segment.ts)
- [Palette grouping](../src/domain/palette.ts)
- [Layer masks and ordering](../src/domain/layer-masks.ts)
- [Backing connections](../src/domain/connected-backing.ts)
- [Layer editing](../src/domain/layer-editing.ts)
- [Tracing and export](../src/services/trace.ts)
- [Project state](../src/components/useVectorProject.ts)
- [Repair state](../src/components/useLayerRepairs.ts)
- [Saved settings](../src/services/saved-settings.ts)

## Upstream references

- [MediaPipe Interactive Segmenter for Web](https://ai.google.dev/edge/mediapipe/solutions/vision/interactive_segmenter/web_js)
- [MediaPipe interactive segmenter sample](https://github.com/google-ai-edge/mediapipe-samples-web/blob/bbb8974ffd450650ad5a1e7c1656c9debb8e38bf/src/tasks/interactive-segmenter.ts#L590-L604)
- [ImageTracerJS documentation](https://github.com/jankovicsandras/imagetracerjs/blob/cb0c84a309df5e75614d3b5166cdc77a56f12a98/README.md)
- [Cricut image-upload guidance](https://help.cricut.com/hc/en-us/articles/360009553213-Image-uploads-unsupported-items)

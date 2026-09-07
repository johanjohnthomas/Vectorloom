# Vectorloom Technical Research

Vectorloom separates three problems that generic “image to SVG” tools often collapse: identifying the intended subject, simplifying photographic color, and producing geometry that is practical for a cutting machine.

## Chosen browser pipeline

1. The maker crops a region around the desired subject.
2. MediaPipe Interactive Segmenter receives that crop and a foreground point at its center. Feature extraction and segmentation run locally in WebAssembly.
3. A perimeter flood-fill fallback removes a near-uniform connected background if the model cannot load.
4. The isolated raster becomes either one silhouette or a small posterized palette.
5. ImageTracerJS converts the prepared pixels into paths.
6. Vectorloom removes non-opaque geometry and Cricut-unsupported images, patterns, gradients, filters, scripts, and text before export.

## Why these choices

- [MediaPipe Interactive Segmenter for Web](https://ai.google.dev/edge/mediapipe/solutions/vision/interactive_segmenter/web_js) provides interactive browser segmentation without an image-upload service. The [official web sample](https://github.com/google-ai-edge/mediapipe-samples-web/blob/bbb8974ffd450650ad5a1e7c1656c9debb8e38bf/src/tasks/interactive-segmenter.ts#L590-L604) demonstrates the v2 MagicTouch model used here.
- [ImageTracerJS](https://github.com/jankovicsandras/imagetracerjs/blob/cb0c84a309df5e75614d3b5166cdc77a56f12a98/README.md#L79-L96) supports synchronous `ImageData` to SVG conversion in the browser and is released under the Unlicense.
- [SVGO](https://svgo.dev/docs/usage/browser/) remains a candidate for deeper optimization, but the MVP uses a small purpose-built sanitizer so it can enforce Cricut-specific restrictions without adding another runtime dependency.
- Cricut states that SVG uploads cannot contain embedded raster images, pattern/gradient fills, photographs, or editable text. Vectorloom therefore exports paths with flat fills and a `viewBox`: [Cricut unsupported SVG items](https://help.cricut.com/hc/en-us/articles/360009553213-Image-uploads-unsupported-items).
- [ONNX Runtime Web’s WebGPU guidance](https://onnxruntime.ai/docs/tutorials/web/ep-webgpu.html) supports a later SAM-class advanced mode, but those models are substantially larger and WebGPU availability varies. They are not required for this static MVP.

## Honest limits

The MediaPipe crop-and-point flow is materially stronger than color-key background removal, but it is not a full Photoshop-style mask editor. Complex overlaps may still need a future positive/negative brush. ImageTracer preserves visible regions; it cannot infer good physical bridges, minimum feature size, or weeding strategy. The complexity score is a useful warning based on path and layer counts, not a machine certification.

## Roadmap

### Implemented layered-cut improvements

- Deterministic perceptual palette clustering merges similar shades before tracing, with a separate maximum-color limit. Transparent pixels do not consume color slots.
- Each color produces its own mask and named SVG group. Enclosed opaque details can be filled beneath their upper layers; dependency ordering preserves compositing. Conflicting color orders retain cut-outs with a visible warning.
- Local majority cleanup reduces interior color speckles. Weighted mask smoothing and more permissive quadratic fitting reduce jagged contours. Stroke-free export avoids a decorative outline changing the physical cut shape. Settings follow the upstream [ImageTracer options](https://github.com/jankovicsandras/imagetracerjs/blob/master/options.md).
- A layer browser isolates pieces using the original viewBox, so registration stays consistent. Reviewing a piece does not filter the download.

### Further work

- Positive/negative brush refinement and multiple subject points.
- Web Worker execution and model caching for a more responsive first run.
- SAM2/WebGPU mode for difficult multi-object scenes.
- Editable color-layer ordering and visibility.
- Minimum-island removal, bridge/gap detection, and material-aware cutability scoring.
- A Cricut Design Space compatibility fixture suite across silhouette and layered exports.

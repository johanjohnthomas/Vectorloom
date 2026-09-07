declare module "imagetracerjs" {
  type TraceOptions = {
    readonly ltres?: number
    readonly qtres?: number
    readonly pathomit?: number
    readonly rightangleenhance?: boolean
    readonly colorsampling?: number
    readonly numberofcolors?: number
    readonly colorquantcycles?: number
    readonly scale?: number
    readonly strokewidth?: number
    readonly linefilter?: boolean
    readonly roundcoords?: number
    readonly viewbox?: boolean
    readonly desc?: boolean
  }

  type ImageTracerApi = {
    readonly imagedataToSVG: (imageData: ImageData, options?: TraceOptions | string) => string
  }

  const imageTracer: ImageTracerApi
  export default imageTracer
}

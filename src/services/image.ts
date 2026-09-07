import { z } from "zod"

export type Selection = {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

export type PreparedImage = {
  readonly canvas: HTMLCanvasElement
  readonly imageData: ImageData
}

export class ImageInputError extends Error {
  public readonly reason: string

  public constructor(reason: string) {
    super(reason)
    this.name = "ImageInputError"
    this.reason = reason
  }
}

const imageFileSchema = z
  .instanceof(File)
  .refine((file) => ["image/png", "image/jpeg", "image/webp"].includes(file.type), {
    message: "Choose a PNG, JPEG, or WebP image.",
  })
  .refine((file) => file.size <= 20 * 1024 * 1024, {
    message: "Choose an image smaller than 20 MB.",
  })

export function parseImageFile(input: unknown): File {
  const parsed = imageFileSchema.safeParse(input)
  if (!parsed.success) {
    throw new ImageInputError(parsed.error.issues[0]?.message ?? "That image could not be read.")
  }
  return parsed.data
}

export function assertSafeDimensions(width: number, height: number): void {
  if (width > 8_192 || height > 8_192 || width * height > 40_000_000) {
    throw new ImageInputError("This image expands beyond the safe 40-megapixel workspace limit.")
  }
}

function readJpegDimensions(bytes: Uint8Array): readonly [number, number] | undefined {
  let offset = 2
  while (offset + 8 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1
      continue
    }
    const marker = bytes[offset + 1]
    if (marker === undefined || marker === 0xd9 || marker === 0xda) return undefined
    const length = (bytes[offset + 2] ?? 0) * 256 + (bytes[offset + 3] ?? 0)
    if (length < 2) return undefined
    if (
      (marker >= 0xc0 && marker <= 0xc3) ||
      (marker >= 0xc5 && marker <= 0xc7) ||
      (marker >= 0xc9 && marker <= 0xcb) ||
      (marker >= 0xcd && marker <= 0xcf)
    ) {
      const height = (bytes[offset + 5] ?? 0) * 256 + (bytes[offset + 6] ?? 0)
      const width = (bytes[offset + 7] ?? 0) * 256 + (bytes[offset + 8] ?? 0)
      return [width, height]
    }
    offset += length + 2
  }
  return undefined
}

function readWebpDimensions(bytes: Uint8Array): readonly [number, number] | undefined {
  const chunk = String.fromCharCode(...bytes.slice(12, 16))
  if (chunk === "VP8X" && bytes.length >= 30) {
    const width = 1 + (bytes[24] ?? 0) + ((bytes[25] ?? 0) << 8) + ((bytes[26] ?? 0) << 16)
    const height = 1 + (bytes[27] ?? 0) + ((bytes[28] ?? 0) << 8) + ((bytes[29] ?? 0) << 16)
    return [width, height]
  }
  if (chunk === "VP8 " && bytes.length >= 30) {
    const width = ((bytes[26] ?? 0) + ((bytes[27] ?? 0) << 8)) & 0x3fff
    const height = ((bytes[28] ?? 0) + ((bytes[29] ?? 0) << 8)) & 0x3fff
    return [width, height]
  }
  if (chunk === "VP8L" && bytes.length >= 25 && bytes[20] === 0x2f) {
    const width = 1 + (bytes[21] ?? 0) + (((bytes[22] ?? 0) & 0x3f) << 8)
    const height = 1 + ((bytes[22] ?? 0) >> 6) + ((bytes[23] ?? 0) << 2) + ((bytes[24] ?? 0) << 10)
    return [width, height]
  }
  return undefined
}

export async function assertSafeImageFile(file: File): Promise<void> {
  const header = file.slice(0, 512 * 1024)
  const buffer = await new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader()
    reader.addEventListener("load", () => {
      if (reader.result instanceof ArrayBuffer) resolve(reader.result)
      else reject(new ImageInputError("That image could not be read."))
    })
    reader.addEventListener("error", () =>
      reject(new ImageInputError("That image could not be read.")),
    )
    reader.readAsArrayBuffer(header)
  })
  const bytes = new Uint8Array(buffer)
  let dimensions: readonly [number, number] | undefined
  if (
    file.type === "image/png" &&
    bytes.length >= 24 &&
    bytes[0] === 0x89 &&
    String.fromCharCode(...bytes.slice(1, 4)) === "PNG"
  ) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
    dimensions = [view.getUint32(16), view.getUint32(20)]
  } else if (file.type === "image/jpeg" && bytes[0] === 0xff && bytes[1] === 0xd8) {
    dimensions = readJpegDimensions(bytes)
  } else if (
    file.type === "image/webp" &&
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
  ) {
    dimensions = readWebpDimensions(bytes)
  }
  if (dimensions === undefined || dimensions[0] < 1 || dimensions[1] < 1) {
    throw new ImageInputError("That image has an invalid or unsupported file header.")
  }
  assertSafeDimensions(dimensions[0], dimensions[1])
}

export function prepareSelection(
  source: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
  selection: Selection,
): PreparedImage {
  const sourceX = Math.round(selection.x * sourceWidth)
  const sourceY = Math.round(selection.y * sourceHeight)
  const sourceCropWidth = Math.max(1, Math.round(selection.width * sourceWidth))
  const sourceCropHeight = Math.max(1, Math.round(selection.height * sourceHeight))
  const scale = Math.min(1, 720 / Math.max(sourceCropWidth, sourceCropHeight))
  const width = Math.max(1, Math.round(sourceCropWidth * scale))
  const height = Math.max(1, Math.round(sourceCropHeight * scale))
  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext("2d", { willReadFrequently: true })
  if (context === null) {
    throw new ImageInputError("Your browser could not open the image canvas.")
  }
  context.drawImage(
    source,
    sourceX,
    sourceY,
    sourceCropWidth,
    sourceCropHeight,
    0,
    0,
    width,
    height,
  )
  return { canvas, imageData: context.getImageData(0, 0, width, height) }
}

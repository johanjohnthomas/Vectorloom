import { describe, expect, it } from "vitest"
import { assertSafeDimensions, assertSafeImageFile, ImageInputError } from "./image"

describe("assertSafeDimensions", () => {
  it("rejects a decoded raster that would consume excessive canvas memory", () => {
    // Given
    const width = 12_000
    const height = 12_000

    // When
    const action = () => assertSafeDimensions(width, height)

    // Then
    expect(action).toThrow(ImageInputError)
  })

  it("accepts a normal high-resolution photograph", () => {
    // Given
    const width = 4_000
    const height = 3_000

    // When
    const action = () => assertSafeDimensions(width, height)

    // Then
    expect(action).not.toThrow()
  })
})

describe("assertSafeImageFile", () => {
  it("rejects oversized PNG dimensions before image decoding", async () => {
    const bytes = new Uint8Array(24)
    bytes.set([0x89, 0x50, 0x4e, 0x47], 0)
    const view = new DataView(bytes.buffer)
    view.setUint32(16, 12_000)
    view.setUint32(20, 12_000)
    const file = new File([bytes], "oversized.png", { type: "image/png" })

    await expect(assertSafeImageFile(file)).rejects.toThrow(ImageInputError)
  })

  it("accepts safe JPEG dimensions from a start-of-frame marker", async () => {
    const bytes = new Uint8Array([
      0xff, 0xd8, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x0b, 0xb8, 0x0f, 0xa0, 0x03, 0x01, 0x11, 0x00,
      0x02, 0x11, 0x00, 0x03, 0x11, 0x00,
    ])
    const file = new File([bytes], "photo.jpg", { type: "image/jpeg" })

    await expect(assertSafeImageFile(file)).resolves.toBeUndefined()
  })

  it("rejects a file whose declared type does not match its header", async () => {
    const file = new File([new Uint8Array(32)], "fake.webp", { type: "image/webp" })

    await expect(assertSafeImageFile(file)).rejects.toThrow(
      "That image has an invalid or unsupported file header.",
    )
  })
})

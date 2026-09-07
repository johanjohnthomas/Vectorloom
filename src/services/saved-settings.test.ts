import { afterEach, beforeEach, describe, expect, it } from "vitest"
import {
  cookiePathForBase,
  loadSavedSettings,
  type SavedSettings,
  saveSavedSettings,
} from "./saved-settings"

const settings: SavedSettings = {
  cutMode: "layered",
  colors: 6,
  detail: 0.72,
  smoothing: 0.48,
  mergeShades: 0.61,
  filledBacking: true,
  tolerance: 36,
}

class RecordingCookieDocument {
  public lastWrite = ""

  public get cookie(): string {
    return document.cookie
  }

  public set cookie(value: string) {
    this.lastWrite = value
    document.cookie = value
  }
}

class ReadBlockedCookieDocument {
  public get cookie(): string {
    throw new DOMException("Cookies are disabled.", "SecurityError")
  }

  public set cookie(_value: string) {}
}

class WriteBlockedCookieDocument {
  public get cookie(): string {
    return ""
  }

  public set cookie(_value: string) {
    throw new DOMException("Cookies are disabled.", "SecurityError")
  }
}

class IgnoredWriteCookieDocument {
  public get cookie(): string {
    return ""
  }

  public set cookie(_value: string) {}
}

function setCookie(value: string): void {
  document.cookie = `vectorloom-settings=${encodeURIComponent(value)}; Path=/`
}

function clearCookie(): void {
  document.cookie = "vectorloom-settings=; Max-Age=0; Path=/"
}

describe("saved settings", () => {
  beforeEach(clearCookie)
  afterEach(clearCookie)

  it("restores a complete version-one preference cookie through the browser cookie jar", () => {
    // Given
    const cookieDocument = new RecordingCookieDocument()
    saveSavedSettings(settings, cookieDocument, "/")

    // When
    const restored = loadSavedSettings(cookieDocument)

    // Then
    expect(restored).toEqual(settings)
    expect(cookieDocument.lastWrite).toContain("Max-Age=31536000")
    expect(cookieDocument.lastWrite).toContain("Path=/")
    expect(cookieDocument.lastWrite).toContain("SameSite=Lax")
  })

  it("does not restore malformed, unsupported, or out-of-range cookies", () => {
    // Given
    setCookie("{")

    // When
    const malformed = loadSavedSettings()
    setCookie(JSON.stringify({ version: 2, ...settings }))
    const unsupported = loadSavedSettings()
    setCookie(JSON.stringify({ version: 1, ...settings, colors: 99 }))
    const outOfRange = loadSavedSettings()

    // Then
    expect(malformed).toBeUndefined()
    expect(unsupported).toBeUndefined()
    expect(outOfRange).toBeUndefined()
  })

  it("treats blocked cookie reads as absent preferences", () => {
    // Given
    const cookieDocument = new ReadBlockedCookieDocument()

    // When
    const restored = loadSavedSettings(cookieDocument)

    // Then
    expect(restored).toBeUndefined()
  })

  it("keeps export persistence non-blocking when writes throw", () => {
    // Given
    const cookieDocument = new WriteBlockedCookieDocument()

    // When
    const saved = saveSavedSettings(settings, cookieDocument, "/Vectorloom/")

    // Then
    expect(saved).toBe(false)
  })

  it("reports a failed save when the browser silently ignores its cookie write", () => {
    // Given
    const cookieDocument = new IgnoredWriteCookieDocument()

    // When
    const saved = saveSavedSettings(settings, cookieDocument, "/Vectorloom/")

    // Then
    expect(saved).toBe(false)
  })

  it("uses the deployed app path for a relative Vite base", () => {
    // Given
    const baseUrl = "./"
    const currentUrl = "https://johanjohnthomas.github.io/Vectorloom/?version=1"

    // When
    const path = cookiePathForBase(baseUrl, currentUrl)

    // Then
    expect(path).toBe("/Vectorloom/")
  })
})

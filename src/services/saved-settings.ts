import { z } from "zod"

const COOKIE_NAME = "vectorloom-settings"
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365

const savedSettingsSchema = z
  .object({
    cutMode: z.union([z.literal("silhouette"), z.literal("layered")]),
    colors: z.number().int().min(2).max(8),
    detail: z.number().min(0.15).max(0.95),
    smoothing: z.number().min(0.05).max(0.9),
    mergeShades: z.number().min(0).max(1),
    filledBacking: z.boolean(),
    tolerance: z.number().int().min(5).max(90),
  })
  .strict()

const storedSettingsSchema = savedSettingsSchema.extend({ version: z.literal(1) }).strict()

export type SavedSettings = z.infer<typeof savedSettingsSchema>

export const DEFAULT_SETTINGS = {
  cutMode: "layered",
  colors: 6,
  detail: 0.5,
  smoothing: 0.7,
  mergeShades: 0.72,
  filledBacking: true,
  tolerance: 40,
} satisfies SavedSettings

type CookieDocument = {
  cookie: string
}

function browserCookieDocument(): CookieDocument | undefined {
  return typeof document === "undefined" ? undefined : document
}

function browserHref(): string {
  return typeof location === "undefined" ? "https://vectorloom.local/" : location.href
}

export function cookiePathForBase(baseUrl: string, currentUrl = browserHref()): string {
  const path = new URL(baseUrl, currentUrl).pathname
  return path.endsWith("/") ? path : `${path}/`
}

function cookieValue(cookie: string): string | undefined {
  const prefix = `${COOKIE_NAME}=`
  return cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix))
    ?.slice(prefix.length)
}

export function loadSavedSettings(
  cookieDocument = browserCookieDocument(),
): SavedSettings | undefined {
  if (cookieDocument === undefined) return undefined
  try {
    const encoded = cookieValue(cookieDocument.cookie)
    if (encoded === undefined) return undefined
    const parsed = storedSettingsSchema.safeParse(JSON.parse(decodeURIComponent(encoded)))
    if (!parsed.success) return undefined
    const { version: _version, ...settings } = parsed.data
    return settings
  } catch (error) {
    if (error instanceof Error || error instanceof DOMException) return undefined
    throw error
  }
}

export function saveSavedSettings(
  settings: SavedSettings,
  cookieDocument = browserCookieDocument(),
  baseUrl = import.meta.env.BASE_URL,
): boolean {
  if (cookieDocument === undefined) return false
  const stored = { version: 1, ...settings } satisfies z.input<typeof storedSettingsSchema>
  const secure = typeof location !== "undefined" && location.protocol === "https:" ? "; Secure" : ""
  const cookie = `${COOKIE_NAME}=${encodeURIComponent(JSON.stringify(stored))}; Max-Age=${COOKIE_MAX_AGE_SECONDS}; Path=${cookiePathForBase(baseUrl)}; SameSite=Lax${secure}`
  try {
    cookieDocument.cookie = cookie
    return cookieValue(cookieDocument.cookie) === cookieValue(cookie)
  } catch (error) {
    if (error instanceof Error || error instanceof DOMException) return false
    throw error
  }
}

import assert from "node:assert/strict"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import { chromium, webkit } from "playwright"

const url = process.env.VECTORLOOM_BASE_URL ?? "http://127.0.0.1:4180/"
const safari = process.env.VECTORLOOM_BROWSER === "webkit"
const directory = `.omo/evidence/connected-${safari ? "webkit" : "chrome"}`
await mkdir(directory, { recursive: true })
const browser = safari ? await webkit.launch() : await chromium.launch({ channel: "chrome" })
try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 1000 } })
  const page = await context.newPage()
  const errors = []
  page.on("pageerror", (error) => errors.push(error.message))
  await page.route("**/interactive_segmentation.task", (route) => route.abort())
  await page.goto(url, { waitUntil: "networkidle" })
  const fixture = await page.evaluate(() => {
    const canvas = document.createElement("canvas")
    canvas.width = canvas.height = 240
    const ctx = canvas.getContext("2d")
    if (!ctx) throw new Error("Canvas unavailable")
    ctx.fillStyle = "#ff0000"
    ctx.fillRect(20, 20, 200, 200)
    ctx.fillStyle = "#0000ff"
    ctx.fillRect(100, 20, 40, 200)
    return canvas.toDataURL("image/png").split(",")[1]
  })
  await page.setInputFiles('input[type="file"]', {
    name: "connected-panels.png",
    mimeType: "image/png",
    buffer: Buffer.from(fixture, "base64"),
  })
  await page.getByText("Image ready", { exact: false }).waitFor()
  await page.getByText("Advanced settings", { exact: true }).click()
  async function range(label, value) {
    await page.getByLabel(label, { exact: true }).fill(String(value))
  }
  await page.getByRole("button", { name: "Layered", exact: false }).click()
  await range("Maximum colors", 6)
  await range("Merge similar shades", 37)
  await range("Detail kept", 71)
  await range("Curve smoothing", 56)
  await range("Background tolerance", 33)
  await page.getByLabel("Filled backing layers").uncheck()
  assert.equal(
    (await context.cookies()).filter((cookie) => cookie.name.includes("vectorloom")).length,
    0,
  )
  async function create() {
    await page.getByRole("button", { name: "Create cut paths" }).click()
    await page.getByRole("region", { name: "Layer repair workspace" }).waitFor({ timeout: 120000 })
    await page.getByText(/Cut paths created/u).waitFor({ timeout: 120000 })
    assert.equal(await page.getByRole("button", { name: "Download SVG" }).isEnabled(), true)
  }
  async function download(name) {
    const pending = page.waitForEvent("download")
    await page.getByRole("button", { name: "Download SVG" }).click()
    const file = await pending
    await file.saveAs(`${directory}/${name}.svg`)
    return readFile(`${directory}/${name}.svg`, "utf8")
  }
  async function inspect(source) {
    return page.evaluate(async (svg) => {
      const root = new DOMParser().parseFromString(svg, "image/svg+xml").documentElement
      const groups = Array.from(root.querySelectorAll("g"))
      const red = groups.find((group) => group.getAttribute("fill") === "#ff0000")
      const paths = red?.querySelectorAll("path").length ?? 0
      for (const group of groups) if (group !== red) group.remove()
      root.setAttribute("width", "240")
      root.setAttribute("height", "240")
      const image = new Image()
      const blob = URL.createObjectURL(
        new Blob([new XMLSerializer().serializeToString(root)], { type: "image/svg+xml" }),
      )
      image.src = blob
      await image.decode()
      const canvas = document.createElement("canvas")
      canvas.width = canvas.height = 240
      const ctx = canvas.getContext("2d")
      if (!ctx) throw new Error("Canvas unavailable")
      ctx.drawImage(image, 0, 0)
      URL.revokeObjectURL(blob)
      return {
        paths,
        bridgeAlpha: ctx.getImageData(120, 120, 1, 1).data[3],
        outsideAlpha: ctx.getImageData(5, 5, 1, 1).data[3],
      }
    }, source)
  }
  await create()
  const knockout = await inspect(await download("knockout"))
  await page.getByLabel("Filled backing layers").check()
  assert.equal(await page.getByRole("button", { name: "Download SVG" }).isDisabled(), true)
  await create()
  await page.getByLabel("Preview layer", { exact: true }).selectOption("0")
  const backing = await inspect(await download("connected"))
  assert.deepEqual(knockout, { paths: 2, bridgeAlpha: 0, outsideAlpha: 0 })
  assert.deepEqual(backing, { paths: 1, bridgeAlpha: 255, outsideAlpha: 0 })
  for (const width of [1280, 768, 375]) {
    await page.setViewportSize({ width, height: 1000 })
    await page.getByLabel("Preview layer", { exact: true }).scrollIntoViewIfNeeded()
    const contained = await page.evaluate(() => {
      const panes = [...document.querySelectorAll(".comparison-pane")]
      const artwork = [...document.querySelectorAll(".image-comparison .brush-surface-image")]
      if (panes.length !== 2 || artwork.length !== 2) return false
      const [original, layer] = artwork.map((image) => image.getBoundingClientRect())
      const [originalPane, layerPane] = panes.map((pane) => pane.getBoundingClientRect())
      return (
        original.width === layer.width &&
        original.height === layer.height &&
        original.left >= originalPane.left &&
        original.right <= originalPane.right &&
        layer.left >= layerPane.left &&
        layer.right <= layerPane.right
      )
    })
    assert.equal(contained, true, `${width}: original and layer previews must align in their panes`)
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
      false,
    )
    await page.screenshot({ path: `${directory}/${width}-backing.png`, fullPage: true })
  }
  const cookie = (await context.cookies()).find((item) => item.name.includes("vectorloom"))
  assert.ok(cookie)
  assert.equal(cookie.sameSite, "Lax")
  assert.equal(cookie.secure, url.startsWith("https:"))
  assert.equal(cookie.path, new URL("./", url).pathname)
  assert.ok(cookie.expires > Date.now() / 1000 + 300 * 86400)
  assert.ok(!cookie.value.includes("connected-panels"))
  await range("Detail kept", 22)
  await page.reload({ waitUntil: "networkidle" })
  await page.getByText("Advanced settings", { exact: true }).click()
  const restored = {}
  for (const [label, expected] of Object.entries({
    "Maximum colors": "6",
    "Merge similar shades": "37",
    "Detail kept": "71",
    "Curve smoothing": "56",
    "Background tolerance": "33",
  })) {
    restored[label] = await page.getByLabel(label, { exact: true }).inputValue()
    assert.equal(restored[label], expected)
  }
  assert.equal(await page.getByLabel("Filled backing layers").isChecked(), true)
  assert.equal(await page.getByRole("button", { name: "Download SVG" }).isDisabled(), true)
  await page.addInitScript(() => {
    Object.defineProperty(document, "cookie", {
      get() {
        throw new DOMException("Cookies blocked", "SecurityError")
      },
      set() {
        throw new DOMException("Cookies blocked", "SecurityError")
      },
      configurable: true,
    })
  })
  await page.reload({ waitUntil: "networkidle" })
  await page.getByText("Advanced settings", { exact: true }).click()
  assert.equal(await page.getByLabel("Detail kept").inputValue(), "50")
  await page.setInputFiles('input[type="file"]', {
    name: "blocked-cookie.png",
    mimeType: "image/png",
    buffer: Buffer.from(fixture, "base64"),
  })
  await page.getByText("Image ready", { exact: false }).waitFor()
  await create()
  await download("blocked-cookie")
  await page.getByText("SVG downloaded. Your browser could not save cut settings.").waitFor()
  await page.screenshot({ path: `${directory}/375-blocked-cookie.png`, fullPage: true })
  assert.deepEqual(errors, [])
  const result = {
    url,
    knockout,
    backing,
    restored,
    errors,
    cookie: { path: cookie.path, secure: cookie.secure, sameSite: cookie.sameSite },
  }
  await writeFile(`${directory}/results.json`, JSON.stringify(result, null, 2))
  console.log(JSON.stringify(result, null, 2))
} finally {
  await browser.close()
}

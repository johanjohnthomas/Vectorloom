import assert from "node:assert/strict"
import { mkdir, writeFile } from "node:fs/promises"
import { chromium, webkit } from "playwright"

const url = process.env.VECTORLOOM_BASE_URL ?? "https://johanjohnthomas.github.io/Vectorloom/"
const safari = process.env.VECTORLOOM_BROWSER === "webkit"
const directory = safari ? ".omo/evidence/mobile-layers-webkit" : ".omo/evidence/mobile-layers"
await mkdir(directory, { recursive: true })
const browser = safari ? await webkit.launch() : await chromium.launch({ channel: "chrome" })
try {
  const page = await browser.newPage({
    viewport: { width: 320, height: 740 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 2,
  })
  const errors = []
  page.on("pageerror", (error) => errors.push(error.message))
  await page.route("**/interactive_segmentation.task", (route) => route.abort())
  await page.goto(url, { waitUntil: "networkidle" })
  const image = await page.evaluate(() => {
    const canvas = document.createElement("canvas")
    canvas.width = canvas.height = 240
    const ctx = canvas.getContext("2d")
    if (!ctx) throw new Error("Canvas unavailable")
    const colors = [
      "#ff0000",
      "#00ff00",
      "#0000ff",
      "#ffffff",
      "#555555",
      "#ffff00",
      "#ff00ff",
      "#00ffff",
    ]
    colors.forEach((color, index) => {
      ctx.fillStyle = color
      ctx.fillRect(20 + (index % 4) * 50, 20 + Math.floor(index / 4) * 100, 50, 100)
    })
    return canvas.toDataURL("image/png").split(",")[1]
  })
  await page.setInputFiles('input[type="file"]', {
    name: "mobile-colors.png",
    mimeType: "image/png",
    buffer: Buffer.from(image, "base64"),
  })
  await page.getByText("Image ready", { exact: false }).waitFor()
  const canvas = page.locator("canvas")
  await canvas.scrollIntoViewIfNeeded()
  const bounds = await canvas.boundingBox()
  assert.ok(bounds)
  if (!safari) {
    const cdp = await page.context().newCDPSession(page)
    const start = { x: bounds.x + bounds.width * 0.15, y: bounds.y + bounds.height * 0.15 }
    const end = { x: bounds.x + bounds.width * 0.85, y: bounds.y + bounds.height * 0.85 }
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [start] })
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [end] })
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] })
    assert.equal(await page.getByLabel("Subject frame inset").inputValue(), "0")
  }
  await page.getByRole("button", { name: "Layered", exact: false }).tap()
  await page.getByRole("button", { name: "Reset selection" }).tap()
  async function rangeTap(label, right) {
    const input = page.getByLabel(label, { exact: true })
    await input.scrollIntoViewIfNeeded()
    const box = await input.boundingBox()
    assert.ok(box)
    await page.touchscreen.tap(box.x + (right ? box.width - 2 : 2), box.y + box.height / 2)
  }
  await rangeTap("Subject frame inset", false)
  await rangeTap("Maximum colors", true)
  await rangeTap("Merge similar shades", false)
  assert.equal(await page.getByLabel("Maximum colors").inputValue(), "8")
  assert.equal(await page.getByLabel("Merge similar shades").inputValue(), "0")
  await page.getByLabel("Filled backing layers").tap()
  await page.getByRole("button", { name: "Create cut paths" }).tap()
  await page.locator(".processing").waitFor({ state: "detached", timeout: 120000 })
  await page.getByLabel("Layer review", { exact: true }).waitFor()
  assert.equal(await page.locator(".layer-swatches button").count(), 8)
  const views = []
  for (const viewport of [
    { width: 320, height: 740 },
    { width: 375, height: 812 },
    { width: 430, height: 932 },
    { width: 844, height: 390 },
  ]) {
    await page.setViewportSize(viewport)
    await page.getByRole("button", { name: "Next layer", exact: true }).tap()
    await page.getByRole("button", { name: "Previous layer", exact: true }).tap()
    await page.getByLabel("Preview layer", { exact: true }).selectOption("7")
    assert.equal(await page.getByLabel("Preview layer", { exact: true }).inputValue(), "7")
    await page.getByRole("button", { name: "All layers", exact: true }).tap()
    await page.locator(".vector-preview").scrollIntoViewIfNeeded()
    const geometry = await page.evaluate(() => {
      const selector = document.querySelector(".layer-review select")?.getBoundingClientRect()
      const image = document.querySelector(".vector-preview img")?.getBoundingClientRect()
      return {
        overflow: document.documentElement.scrollWidth - innerWidth,
        selectorWidth: selector?.width ?? 0,
        imageHeight: image?.height ?? 0,
      }
    })
    await page.screenshot({ path: `${directory}/${viewport.width}-layers.png`, fullPage: true })
    views.push({ ...viewport, ...geometry })
  }
  const pending = page.waitForEvent("download")
  await page.getByRole("button", { name: "Download SVG" }).tap()
  const download = await pending
  await download.saveAs(`${directory}/mobile-export.svg`)
  const evidence = {
    url,
    views,
    errors,
    touchSelection: !safari,
    touchSliders: true,
    layerBrowsing: true,
    download: download.suggestedFilename(),
  }
  await writeFile(`${directory}/results.json`, JSON.stringify(evidence, null, 2))
  console.log(JSON.stringify(evidence, null, 2))
  assert.deepEqual(errors, [])
  for (const view of views) {
    assert.equal(view.overflow, 0)
    assert.ok(view.selectorWidth >= 140, `${view.width}: layer selector is too cramped`)
    assert.ok(view.imageHeight >= 200, `${view.width}: artwork is squeezed by eight layer controls`)
  }
} finally {
  await browser.close()
}

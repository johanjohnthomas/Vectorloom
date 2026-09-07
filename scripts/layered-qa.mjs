import assert from "node:assert/strict"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import { chromium } from "playwright"

const baseUrl = process.env.VECTORLOOM_BASE_URL ?? "http://127.0.0.1:4180/"
const directory = ".omo/evidence/layered-cuts"
await mkdir(directory, { recursive: true })
const browser = await chromium.launch({ channel: "chrome" })
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } })
  const pageErrors = []
  page.on("pageerror", (error) => pageErrors.push(error.message))
  await page.route("**/interactive_segmentation.task", (route) => route.abort())
  await page.goto(baseUrl, { waitUntil: "networkidle" })
  const fixture = await page.evaluate(() => {
    const canvas = document.createElement("canvas")
    canvas.width = canvas.height = 200
    const ctx = canvas.getContext("2d")
    if (!ctx) throw new Error("Canvas unavailable")
    const gradient = ctx.createLinearGradient(20, 0, 180, 0)
    gradient.addColorStop(0, "#a21b16")
    gradient.addColorStop(1, "#e94d36")
    ctx.fillStyle = gradient
    ctx.fillRect(20, 20, 160, 160)
    ctx.fillStyle = "#ffffff"
    ctx.fillRect(60, 60, 80, 80)
    ctx.fillStyle = "#000000"
    ctx.fillRect(90, 90, 20, 20)
    ctx.clearRect(145, 145, 12, 12)
    return canvas.toDataURL("image/png").split(",")[1]
  })
  await page.setInputFiles('input[type="file"]', {
    name: "layered-eye.png",
    mimeType: "image/png",
    buffer: Buffer.from(fixture, "base64"),
  })
  await page.getByText("Image ready", { exact: false }).waitFor()
  await page.getByLabel("Subject frame inset").focus()
  await page.keyboard.press("Home")
  await page.getByRole("button", { name: "Layered", exact: false }).click()
  await page.getByLabel("Maximum colors").focus()
  await page.keyboard.press("End")

  async function create() {
    await page.getByRole("button", { name: "Create cut paths" }).click()
    await page.locator(".processing").waitFor({ state: "detached", timeout: 120000 })
    await page.getByRole("button", { name: "Download SVG" }).waitFor()
    assert.equal(await page.getByRole("button", { name: "Download SVG" }).isEnabled(), true)
    await page.locator(".inspector").evaluate((node) => {
      node.scrollTop = 0
    })
  }
  async function exportSvg(name) {
    const pending = page.waitForEvent("download")
    await page.getByRole("button", { name: "Download SVG" }).click()
    const file = await pending
    await file.saveAs(`${directory}/${name}.svg`)
    return readFile(`${directory}/${name}.svg`, "utf8")
  }
  async function inspect(svg) {
    return page.evaluate(async (source) => {
      const root = new DOMParser().parseFromString(source, "image/svg+xml").documentElement
      const groups = Array.from(root.querySelectorAll("g"))
      const colors = groups.map((group) => group.getAttribute("fill"))
      const white = groups.find((group) => group.getAttribute("fill") === "#ffffff")
      for (const group of groups) if (group !== white) group.remove()
      const url = URL.createObjectURL(
        new Blob(
          [
            new XMLSerializer()
              .serializeToString(root)
              .replace('viewBox="0 0 200 200"', 'width="200" height="200" viewBox="0 0 200 200"'),
          ],
          { type: "image/svg+xml" },
        ),
      )
      const bitmap = new Image()
      bitmap.src = url
      await bitmap.decode()
      const canvas = document.createElement("canvas")
      canvas.width = canvas.height = 200
      const ctx = canvas.getContext("2d")
      if (!ctx) throw new Error("Canvas unavailable")
      ctx.drawImage(bitmap, 0, 0)
      URL.revokeObjectURL(url)
      return { colors, pupilAlphaInWhite: ctx.getImageData(100, 100, 1, 1).data[3] }
    }, svg)
  }

  await create()
  const knockout = await inspect(await exportSvg("knockout"))
  assert.equal(
    knockout.colors.length,
    3,
    "Red gradient must consolidate to one red plus white and black",
  )
  assert.equal(knockout.pupilAlphaInWhite, 0)
  await page.screenshot({ path: `${directory}/desktop-knockout.png`, fullPage: true })
  await page.getByLabel("Filled backing layers").check()
  assert.equal(await page.getByRole("button", { name: "Download SVG" }).isDisabled(), true)
  await create()
  await page.screenshot({ path: `${directory}/desktop-stacked.png`, fullPage: true })
  const options = await page
    .getByLabel("Preview layer", { exact: true })
    .locator("option")
    .allTextContents()
  const whiteIndex = options.findIndex((option) => option.includes("#ffffff")) - 1
  assert.ok(whiteIndex >= 0)
  await page.getByLabel("Preview layer", { exact: true }).selectOption(String(whiteIndex))
  await page.screenshot({ path: `${directory}/desktop-white-layer.png`, fullPage: true })
  await page.getByRole("button", { name: "Next layer", exact: true }).click()
  assert.notEqual(
    await page.getByLabel("Preview layer", { exact: true }).inputValue(),
    String(whiteIndex),
  )
  await page.getByRole("button", { name: "Previous layer", exact: true }).click()
  assert.equal(
    await page.getByLabel("Preview layer", { exact: true }).inputValue(),
    String(whiteIndex),
  )
  const stacked = await inspect(await exportSvg("stacked-from-solo"))
  assert.equal(stacked.colors.length, 3, "Solo preview must still export every layer")
  assert.equal(stacked.pupilAlphaInWhite, 255)
  assert.ok(stacked.colors.indexOf("#ffffff") < stacked.colors.indexOf("#000000"))
  for (const width of [768, 375]) {
    await page.setViewportSize({ width, height: 900 })
    await page.getByLabel("Preview layer", { exact: true }).scrollIntoViewIfNeeded()
    await page.screenshot({ path: `${directory}/${width}-solo.png`, fullPage: true })
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
      false,
    )
  }
  await page.setViewportSize({ width: 1280, height: 1000 })
  await page.getByRole("button", { name: "All layers", exact: true }).click()
  await page.getByLabel("Merge similar shades").focus()
  await page.keyboard.press("Home")
  await create()
  const detailedColors =
    (await page.getByLabel("Preview layer", { exact: true }).locator("option").count()) - 1
  assert.ok(detailedColors > 3, "Lower merging must retain more red shades")
  assert.deepEqual(pageErrors, [])
  const evidence = {
    knockout,
    stacked,
    detailedColors,
    pageErrors,
    url: baseUrl,
    checks:
      "shade merge; backing hole; export order; solo/combined navigation; full export from solo; stale-export guard; responsive",
  }
  await writeFile(`${directory}/results.json`, JSON.stringify(evidence, null, 2))
  console.log(JSON.stringify(evidence, null, 2))
} finally {
  await browser.close()
}

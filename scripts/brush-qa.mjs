import assert from "node:assert/strict"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import { chromium, webkit } from "playwright"

const url = process.env.VECTORLOOM_BASE_URL ?? "http://127.0.0.1:4180/"
const safari = process.env.VECTORLOOM_BROWSER === "webkit"
const directory = `.omo/evidence/brush-${safari ? "webkit" : "chrome"}`
await mkdir(directory, { recursive: true })
const browser = safari ? await webkit.launch() : await chromium.launch({ channel: "chrome" })
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 }, hasTouch: true })
  const errors = []
  page.on("pageerror", (error) => errors.push(error.message))
  await page.route("**/interactive_segmentation.task", (route) => route.abort())
  await page.goto(url, { waitUntil: "networkidle" })
  assert.equal(await page.locator("details").evaluate((node) => node.open), false)
  assert.equal(await page.getByLabel("Maximum colors").inputValue(), "6")
  assert.equal(await page.getByLabel("Filled backing layers").isChecked(), true)
  await page.screenshot({ path: `${directory}/1280-empty.png`, fullPage: true })
  const fixture = await page.evaluate(() => {
    const canvas = document.createElement("canvas")
    canvas.width = 300
    canvas.height = 200
    const ctx = canvas.getContext("2d")
    if (!ctx) throw new Error("Canvas unavailable")
    ctx.fillStyle = "#e23324"
    ctx.fillRect(20, 30, 100, 140)
    ctx.fillRect(180, 30, 100, 140)
    ctx.fillStyle = "#ffd400"
    ctx.beginPath()
    ctx.arc(70, 60, 16, 0, Math.PI * 2)
    ctx.fill()
    return canvas.toDataURL("image/png").split(",")[1]
  })
  await page.setInputFiles('input[type="file"]', {
    name: "brush-panels.png",
    mimeType: "image/png",
    buffer: Buffer.from(fixture, "base64"),
  })
  await page.getByRole("application", { name: "Subject brush", exact: true }).waitFor()
  async function stroke(label, from, to = from, touch = false) {
    const target = page.getByRole("application", { name: label, exact: true })
    await target.scrollIntoViewIfNeeded()
    const box = await target.boundingBox()
    assert.ok(box)
    const point = (relative) => ({
      x: box.x + relative[0] * box.width,
      y: box.y + relative[1] * box.height,
    })
    const start = point(from),
      end = point(to)
    if (touch && !safari) {
      const cdp = await page.context().newCDPSession(page)
      await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [start] })
      await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [end] })
      await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] })
      await cdp.detach()
    } else {
      await page.mouse.move(start.x, start.y)
      await page.mouse.down()
      await page.mouse.move(end.x, end.y, { steps: 16 })
      await page.mouse.up()
    }
  }
  await stroke("Subject brush", [0.2, 0.6], [0.3, 0.7])
  await page.getByRole("button", { name: "Remove background", exact: true }).click()
  await page.getByLabel("Brush size").fill("0.12")
  await stroke("Subject brush", [70 / 300, 0.3])
  await page.screenshot({ path: `${directory}/1280-selection.png`, fullPage: true })
  await page.getByRole("button", { name: "Create cut paths" }).click()
  await page.getByRole("region", { name: "Layer repair workspace" }).waitFor({ timeout: 120000 })
  async function download(name) {
    const pending = page.waitForEvent("download")
    await page.getByRole("button", { name: "Download SVG" }).click()
    const file = await pending
    await file.saveAs(`${directory}/${name}.svg`)
    return readFile(`${directory}/${name}.svg`, "utf8")
  }
  async function inspect(svg) {
    return page.evaluate(async (source) => {
      const root = new DOMParser().parseFromString(source, "image/svg+xml").documentElement
      const groups = [...root.querySelectorAll("g")]
      const red = groups.find((group) => group.getAttribute("fill") === "#e23324")
      const colors = groups.map((group) => group.getAttribute("fill"))
      const redPaths = red?.querySelectorAll("path").length ?? 0
      root.setAttribute("width", "300")
      root.setAttribute("height", "200")
      const img = new Image()
      img.src = `data:image/svg+xml,${encodeURIComponent(new XMLSerializer().serializeToString(root))}`
      await img.decode()
      const canvas = document.createElement("canvas")
      canvas.width = 300
      canvas.height = 200
      const ctx = canvas.getContext("2d")
      if (!ctx) throw new Error("Canvas unavailable")
      ctx.drawImage(img, 0, 0)
      const pixel = (x, y) => [...ctx.getImageData(x, y, 1, 1).data]
      return {
        colors,
        redPaths,
        yellow: pixel(70, 60),
        bridge: pixel(150, 140),
        right: pixel(260, 140),
        touchPoint: pixel(150, 110),
        keyboardPoint: pixel(150, 70),
      }
    }, svg)
  }
  const before = await inspect(await download("before"))
  assert.deepEqual(before.colors, ["#e23324"])
  assert.equal(before.redPaths, 2)
  assert.equal(before.yellow[3], 0)
  await page.getByRole("button", { name: "New color", exact: true }).click()
  await page.getByLabel("Brush size").fill("0.045")
  await stroke("Original repair brush", [70 / 300, 0.3])
  const restored = await inspect(await download("restored"))
  assert.deepEqual(restored.colors, ["#e23324", "#ffd400"])
  assert.deepEqual(restored.yellow, [255, 212, 0, 255])
  assert.equal(restored.redPaths, 2)
  await page.screenshot({ path: `${directory}/1280-new-layer.png`, fullPage: true })
  await page.getByLabel("Preview layer", { exact: true }).selectOption("0")
  await page.getByRole("button", { name: "Add / connect", exact: true }).click()
  await stroke("Layer repair brush", [0.3, 0.7], [0.7, 0.7])
  const connected = await inspect(await download("connected"))
  assert.equal(connected.redPaths, 1)
  assert.deepEqual(connected.bridge, [226, 51, 36, 255])
  await page.getByRole("button", { name: "Erase", exact: true }).click()
  await stroke("Layer repair brush", [260 / 300, 0.7])
  const erased = await inspect(await download("erased"))
  assert.equal(erased.right[3], 0)
  assert.deepEqual(erased.yellow, restored.yellow)
  await page.getByRole("button", { name: "Undo repair" }).click()
  const undone = await inspect(await download("undone"))
  assert.deepEqual(undone, connected)
  for (const width of [1280, 768, 375]) {
    await page.setViewportSize({ width, height: 1000 })
    await page.getByRole("button", { name: "All layers", exact: true }).click()
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
      false,
    )
    await page.screenshot({ path: `${directory}/${width}-repair.png`, fullPage: true })
  }
  await page.getByRole("button", { name: "Add / connect", exact: true }).click()
  await stroke("Layer repair brush", [0.3, 0.55], [0.7, 0.55], true)
  const touchEdited = await inspect(await download("touch-edited"))
  assert.equal(connected.touchPoint[3], 0)
  assert.deepEqual(touchEdited.touchPoint, [226, 51, 36, 255])
  // All-layers Add intentionally no-ops when the stroke starts on the blank
  // preview. Select a concrete layer before the keyboard regression so that
  // keyboard painting still exercises the original single-layer behavior.
  await page.getByLabel("Preview layer", { exact: true }).selectOption("0")
  assert.equal(await page.getByLabel("Preview layer", { exact: true }).inputValue(), "0")
  await page.getByRole("application", { name: "Layer repair brush", exact: true }).focus()
  for (let step = 0; step < 10; step += 1) {
    await page.keyboard.press("ArrowLeft")
    await page.keyboard.press("ArrowUp")
  }
  await page.keyboard.press("Space")
  const keyboardEdited = await inspect(await download("keyboard-edited"))
  assert.equal(touchEdited.keyboardPoint[3], 0)
  assert.deepEqual(keyboardEdited.keyboardPoint, [226, 51, 36, 255])
  await page.screenshot({ path: `${directory}/375-brush-active.png`, fullPage: true })
  await page.getByText("Advanced settings", { exact: true }).click()
  await page.getByLabel("Detail kept").fill("64")
  assert.equal(await page.getByRole("button", { name: "Download SVG" }).isDisabled(), true)
  assert.equal(
    await page.getByRole("button", { name: "New color", exact: true }).isDisabled(),
    true,
  )
  await page.screenshot({ path: `${directory}/375-advanced.png`, fullPage: true })
  await page.getByRole("button", { name: "Use recommended defaults" }).click()
  assert.equal(await page.getByRole("button", { name: "Download SVG" }).isEnabled(), true)
  await download("final")
  await page.reload({ waitUntil: "networkidle" })
  assert.equal(await page.locator("details").evaluate((node) => node.open), false)
  assert.equal(await page.getByLabel("Maximum colors").inputValue(), "6")
  assert.deepEqual(errors, [])
  const result = {
    url,
    before,
    restored,
    connected,
    erased,
    undo: "exact prior export restored",
    keyboard: true,
    touch: !safari,
    errors,
  }
  await writeFile(`${directory}/results.json`, JSON.stringify(result, null, 2))
  console.log(JSON.stringify(result, null, 2))
} finally {
  await browser.close()
}

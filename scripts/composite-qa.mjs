import assert from "node:assert/strict"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import { chromium, webkit } from "playwright"

const url = process.env.VECTORLOOM_BASE_URL ?? "http://127.0.0.1:4180/"
const safari = process.env.VECTORLOOM_BROWSER === "webkit"
const directory = `.omo/evidence/composite-${safari ? "webkit" : "chrome"}`
const headless = process.env.VECTORLOOM_HEADLESS === "1"
await mkdir(directory, { recursive: true })

const browser = safari
  ? await webkit.launch({ headless })
  : await chromium.launch({ channel: "chrome", headless })
const context = await browser.newContext({
  viewport: { width: 1280, height: 1000 },
  hasTouch: true,
})
const page = await context.newPage()
const pageErrors = []
page.on("pageerror", (error) => pageErrors.push(error.message))
await page.route("**/interactive_segmentation.task", (route) => route.abort())

function pointFor(box, relative) {
  return { x: box.x + relative[0] * box.width, y: box.y + relative[1] * box.height }
}

async function stroke(label, from, to = from, { touch = false } = {}) {
  const target = page.getByRole("application", { name: label, exact: true })
  await target.scrollIntoViewIfNeeded()
  const box = await target.boundingBox()
  assert.ok(box, `${label} must have a visible drawing surface`)
  const start = pointFor(box, from)
  const end = pointFor(box, to)
  if (touch && !safari) {
    const cdp = await context.newCDPSession(page)
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [start] })
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [end] })
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] })
    await cdp.detach()
    return
  }
  await page.mouse.move(start.x, start.y)
  await page.mouse.down()
  await page.mouse.move(end.x, end.y, { steps: 16 })
  await page.mouse.up()
}

async function download(name) {
  const pending = page.waitForEvent("download")
  await page.getByRole("button", { name: "Download SVG", exact: true }).click()
  const file = await pending
  await file.saveAs(`${directory}/${name}.svg`)
  return readFile(`${directory}/${name}.svg`, "utf8")
}

async function renderGroup(group, width, height) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${group}</svg>`
  return page.evaluate(async (source) => {
    const image = new Image()
    const blob = URL.createObjectURL(new Blob([source], { type: "image/svg+xml" }))
    image.src = blob
    await image.decode()
    const canvas = document.createElement("canvas")
    canvas.width = image.width
    canvas.height = image.height
    const context = canvas.getContext("2d")
    if (!context) throw new Error("Canvas unavailable")
    context.drawImage(image, 0, 0)
    const pixel = (x, y) => [...context.getImageData(x, y, 1, 1).data]
    URL.revokeObjectURL(blob)
    return {
      center: pixel(120, 90),
      blank: pixel(8, 8),
      endpoint: pixel(189, 90),
      glint: pixel(135, 72),
      keyboard: pixel(72, 54),
    }
  }, svg)
}

async function inspectSvg(source) {
  return page.evaluate((svg) => {
    const root = new DOMParser().parseFromString(svg, "image/svg+xml").documentElement
    return [...root.querySelectorAll(":scope > g")].map((group) => ({
      id: group.getAttribute("id"),
      color: group.getAttribute("fill"),
      paths: group.querySelectorAll("path").length,
    }))
  }, source)
}

async function inspectGroups(source) {
  const groups = await page.evaluate((svg) => {
    const root = new DOMParser().parseFromString(svg, "image/svg+xml").documentElement
    return [...root.querySelectorAll(":scope > g")].map((group) => ({
      id: group.getAttribute("id"),
      color: group.getAttribute("fill"),
      markup: new XMLSerializer().serializeToString(group),
    }))
  }, source)
  const values = []
  for (const group of groups) {
    values.push({
      id: group.id,
      color: group.color,
      ...(await renderGroup(group.markup, 240, 180)),
    })
  }
  return values
}

async function screenshotState(width, state) {
  await page.setViewportSize({ width, height: 1000 })
  const button = page.getByRole("button", { name: state, exact: true })
  await button.click()
  assert.equal(await button.getAttribute("aria-pressed"), "true", `${state} must be active`)
  assert.equal(
    await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
    false,
    `${width}: no horizontal overflow in ${state}`,
  )
  await page.screenshot({
    path: `${directory}/${width}-${state
      .toLowerCase()
      .replaceAll(/[^a-z0-9]+/gi, "-")
      .replace(/^-|-$/gu, "")}.png`,
    fullPage: true,
  })
}

try {
  await page.goto(url, { waitUntil: "networkidle" })
  // Chromium's classic scrollbar otherwise shrinks full-page PNGs by 15px at
  // tablet/mobile widths. Hide only the capture chrome so requested viewport
  // dimensions remain literal in the evidence files.
  if (!safari) {
    await page.addStyleTag({
      content: "html { scrollbar-width: none; } html::-webkit-scrollbar { display: none; }",
    })
  }
  assert.equal(await page.locator("details").evaluate((node) => node.open), false)

  const fixture = await page.evaluate(() => {
    const canvas = document.createElement("canvas")
    canvas.width = 240
    canvas.height = 180
    const context = canvas.getContext("2d")
    if (!context) throw new Error("Canvas unavailable")
    context.clearRect(0, 0, canvas.width, canvas.height)
    context.fillStyle = "#d62f3f"
    context.beginPath()
    context.ellipse(120, 90, 100, 55, 0, 0, Math.PI * 2)
    context.fill()
    context.fillStyle = "#f5f7fb"
    context.beginPath()
    context.ellipse(120, 90, 82, 42, 0, 0, Math.PI * 2)
    context.fill()
    context.fillStyle = "#2b6cb0"
    context.beginPath()
    context.arc(120, 90, 28, 0, Math.PI * 2)
    context.fill()
    context.fillStyle = "#111111"
    context.beginPath()
    context.arc(120, 90, 12, 0, Math.PI * 2)
    context.fill()
    context.fillStyle = "#f8c24a"
    context.beginPath()
    context.arc(135, 72, 12, 0, Math.PI * 2)
    context.fill()
    return canvas.toDataURL("image/png").split(",")[1]
  })
  await page.setInputFiles('input[type="file"]', {
    name: "transparent-eye.png",
    mimeType: "image/png",
    buffer: Buffer.from(fixture, "base64"),
  })
  await page.getByText("Image ready", { exact: false }).waitFor()
  await page.getByText("Advanced settings", { exact: true }).click()
  await page.getByRole("button", { name: "Layered", exact: false }).click()
  await page.getByLabel("Maximum colors", { exact: true }).fill("6")
  await page.getByLabel("Merge similar shades", { exact: true }).fill("0")
  await page.getByLabel("Filled backing layers", { exact: true }).check()
  await page.getByRole("button", { name: "Create cut paths", exact: true }).click()
  await page.getByRole("region", { name: "Layer repair workspace" }).waitFor({ timeout: 120000 })
  await page.getByText(/Cut paths created/u).waitFor({ timeout: 120000 })
  assert.equal(
    await page.getByRole("button", { name: "Download SVG", exact: true }).isEnabled(),
    true,
  )
  await page.getByLabel("Preview layer", { exact: true }).selectOption("all")
  assert.equal(await page.getByLabel("Preview layer", { exact: true }).inputValue(), "all")

  const initialSource = await download("initial")
  const initialLayers = await inspectSvg(initialSource)
  const initialGroups = await inspectGroups(initialSource)
  assert.ok(initialLayers.length >= 4, "eye fixture must generate at least four color layers")
  assert.ok(
    initialGroups.filter(({ center }) => center[3] > 0).length >= 3,
    "filled backing must overlap at the pupil center",
  )
  assert.ok(
    initialGroups.every(({ blank }) => blank[3] === 0),
    "transparent background must remain transparent in every layer",
  )

  await screenshotState(1280, "Inspect")
  await screenshotState(768, "Inspect")
  await screenshotState(375, "Inspect")

  await page.getByRole("button", { name: "Erase", exact: true }).click()
  assert.match(await page.locator(".tool-help").textContent(), /every layer under your brush/u)
  await screenshotState(1280, "Erase")
  await screenshotState(768, "Erase")
  await screenshotState(375, "Erase")
  // Keep the viewport wide for deterministic brush coordinates and use a
  // short center stroke that removes the visible pupil plus all backing.
  await page.setViewportSize({ width: 1280, height: 1000 })
  await page.getByRole("button", { name: "Erase", exact: true }).click()
  await stroke("Layer repair brush", [0.5, 0.5], [0.51, 0.5], { touch: true })
  const erasedSource = await download("all-erase")
  const erasedGroups = await inspectGroups(erasedSource)
  assert.ok(
    erasedGroups.filter(({ center }) => center[3] > 0).length <
      initialGroups.filter(({ center }) => center[3] > 0).length,
    "All erase must remove center pixels from multiple layers",
  )
  assert.ok(
    erasedGroups.every(({ center }) => center[3] === 0),
    "All erase must remove the shared pupil center from every layer",
  )
  const erasedForUndo = erasedGroups
  await page.getByRole("button", { name: "Undo repair", exact: true }).click()
  const undoneGroups = await inspectGroups(await download("all-erase-undo"))
  assert.deepEqual(
    undoneGroups,
    initialGroups,
    "Undo must restore the whole All-layers erase stroke",
  )

  await page.getByRole("button", { name: "Add / connect", exact: true }).click()
  assert.match(
    await page.locator(".tool-help").textContent(),
    /topmost|whole stroke|start on a color/u,
  )
  const beforeNoop = await download("all-add-before-noop")
  await stroke("Layer repair brush", [0.05, 0.5], [0.08, 0.5], { touch: true })
  assert.match(
    await page.getByRole("status").first().textContent(),
    /No paths changed|start on a color/u,
  )
  const afterNoop = await download("all-add-blank-noop")
  assert.equal(afterNoop, beforeNoop, "All Add from transparent blank must be an explicit no-op")
  const beforeAddGroups = await inspectGroups(beforeNoop)
  await stroke("Layer repair brush", [0.5, 0.5], [0.79, 0.5], { touch: true })
  const addedSource = await download("all-add-topmost")
  const addedGroups = await inspectGroups(addedSource)
  const changed = addedGroups.filter(
    (layer, index) => JSON.stringify(layer) !== JSON.stringify(beforeAddGroups[index]),
  )
  assert.equal(changed.length, 1, "All Add must change only the layer sampled at stroke start")
  const topmostAtStart = initialGroups.toReversed().find(({ center }) => center[3] > 0)?.id
  assert.equal(
    changed[0]?.id,
    topmostAtStart,
    "All Add must keep the topmost start color for the whole stroke",
  )
  assert.ok(
    (changed[0]?.endpoint[3] ?? 0) > 0,
    "topmost sampled layer must extend to the stroke endpoint",
  )

  await page.getByRole("button", { name: "New color", exact: true }).click()
  assert.match(await page.locator(".tool-help").textContent(), /original image.*color/u)
  await page.getByLabel("Preview layer", { exact: true }).selectOption("all")
  await stroke("Layer repair brush", [135 / 240, 72 / 180], [140 / 240, 72 / 180], {
    touch: true,
  })
  const newSource = await download("new-color-combined")
  assert.equal(
    await page.getByLabel("Preview layer", { exact: true }).inputValue(),
    "all",
    "New from combined must keep the combined preview",
  )
  assert.equal(
    await page.locator(".comparison-pane").nth(1).getByRole("heading").textContent(),
    "All layers",
  )
  const newLayers = await inspectSvg(newSource)
  assert.equal(
    newLayers.length,
    initialLayers.length + 1,
    "New color on the combined cut preview must append a layer",
  )
  assert.equal(newLayers.at(-1)?.color, "#f8c24a", "New color must sample the original image color")
  await screenshotState(1280, "Add / connect")
  await screenshotState(768, "Add / connect")
  await screenshotState(375, "Add / connect")
  await screenshotState(1280, "New color")
  await screenshotState(768, "New color")
  await screenshotState(375, "New color")

  // Keyboard interaction remains a single-layer contract: select a concrete
  // layer before starting from the cursor's post-touch position.
  await page.setViewportSize({ width: 1280, height: 1000 })
  const keyboardLayerIndex = initialGroups.findIndex(
    ({ center, keyboard }) => center[3] > 0 && keyboard[3] === 0,
  )
  assert.ok(keyboardLayerIndex >= 0, "keyboard regression needs a layer with a blank endpoint")
  await page.getByLabel("Preview layer", { exact: true }).selectOption(String(keyboardLayerIndex))
  await page.getByRole("button", { name: "Add / connect", exact: true }).click()
  const keyboardSurface = page.getByRole("application", { name: "Layer repair brush", exact: true })
  await keyboardSurface.focus()
  for (let index = 0; index < 10; index += 1) {
    await page.keyboard.press("ArrowLeft")
    await page.keyboard.press("ArrowUp")
  }
  await page.keyboard.down("Space")
  await page.keyboard.up("Space")
  const keyboardSource = await download("single-layer-keyboard")
  assert.notEqual(
    keyboardSource,
    newSource,
    "single-layer keyboard stroke must remain an editable regression path",
  )
  await screenshotState(1280, "Inspect")

  for (const width of [1280, 768, 375]) {
    await page.setViewportSize({ width, height: 1000 })
    await page.getByLabel("Preview layer", { exact: true }).selectOption("all")
    for (const tool of ["Inspect", "Add / connect", "Erase", "New color"]) {
      await screenshotState(width, tool)
    }
  }

  const result = {
    url,
    browser: safari ? "webkit" : "chrome",
    headed: !headless,
    fixture: "240x180 transparent concentric eye with red, white, blue, black, and yellow layers",
    initialLayers,
    initialGroups,
    erasedForUndo,
    addedLayer: changed[0]?.id,
    addedEndpointAlpha: changed[0]?.endpoint[3],
    newLayer: newLayers.at(-1),
    viewportStates: [1280, 768, 375].flatMap((width) =>
      ["inspect", "add-connect", "erase", "new-color"].map((tool) => `${width}-${tool}.png`),
    ),
    touch: !safari,
    keyboard: true,
    pageErrors,
  }
  await writeFile(`${directory}/results.json`, JSON.stringify(result, null, 2))
  console.log(JSON.stringify(result, null, 2))
  assert.deepEqual(pageErrors, [])
} finally {
  await browser.close()
}

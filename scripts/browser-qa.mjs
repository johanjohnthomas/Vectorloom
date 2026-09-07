import assert from "node:assert/strict"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import { chromium } from "playwright"

const evidenceDirectory = ".omo/evidence/vectorloom-browser"
const baseUrl = process.env.VECTORLOOM_BASE_URL ?? "http://127.0.0.1:4180/"
await mkdir(evidenceDirectory, { recursive: true })

const browser = await chromium.launch({ channel: "chrome" })
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
const consoleErrors = []
const mediaPipeDiagnostics = []
page.on("console", (message) => {
  if (message.type() !== "error") return
  const text = message.text()
  if (/^(I|W)\d{4}|^INFO: Created TensorFlow Lite/u.test(text)) {
    mediaPipeDiagnostics.push(text)
    return
  }
  consoleErrors.push(text)
})
await page.goto(baseUrl, { waitUntil: "networkidle" })
await page.screenshot({ path: `${evidenceDirectory}/desktop-empty.png`, fullPage: true })

const raceCar = await readFile("tests/fixtures/vintage-race-car.png")
await page.setInputFiles('input[type="file"]', {
  name: "vintage-race-car.png",
  mimeType: "image/png",
  buffer: raceCar,
})
const subjectBrush = page.getByRole("application", { name: "Subject brush", exact: true })
await subjectBrush.waitFor()
await subjectBrush.focus()
await page.keyboard.down("Space")
await page.keyboard.press("ArrowRight")
await page.keyboard.press("ArrowDown")
await page.keyboard.up("Space")
await page.getByText(/1 keep mark/u).waitFor()
await page.screenshot({ path: `${evidenceDirectory}/desktop-selected.png`, fullPage: true })

await page.getByRole("button", { name: "Create cut paths" }).click()
await page.screenshot({ path: `${evidenceDirectory}/desktop-processing.png`, fullPage: true })
await page.getByRole("region", { name: "Layer repair workspace" }).waitFor({ timeout: 120_000 })
const status = page.locator(".project-status p")
await status.filter({ hasText: /Cut paths created/u }).waitFor({ timeout: 120_000 })
const generatedStatus = await status.textContent()
await page.screenshot({ path: `${evidenceDirectory}/desktop-vector.png`, fullPage: true })

const downloadPromise = page.waitForEvent("download")
await page.getByRole("button", { name: "Download SVG" }).click()
const download = await downloadPromise
await download.saveAs(`${evidenceDirectory}/vectorloom-cut.svg`)

await page.emulateMedia({ reducedMotion: "reduce" })
await page.setViewportSize({ width: 768, height: 900 })
await page.screenshot({ path: `${evidenceDirectory}/tablet-vector.png`, fullPage: true })
await page.setViewportSize({ width: 375, height: 812 })
await page.screenshot({ path: `${evidenceDirectory}/mobile-vector.png`, fullPage: true })

const keyboardOrder = []
await page.keyboard.press("Home")
for (let index = 0; index < 8; index += 1) {
  await page.keyboard.press("Tab")
  const focused = await page.evaluate(() => document.activeElement?.textContent?.trim() ?? "input")
  keyboardOrder.push(focused.slice(0, 60))
}

const qaResult = {
  consoleErrors,
  mediaPipeDiagnostics,
  keyboardOrder,
  download: download.suggestedFilename(),
  status: generatedStatus,
  usedFallback: /Smart isolation was unavailable/u.test(generatedStatus ?? ""),
}
await writeFile(`${evidenceDirectory}/qa-result.json`, JSON.stringify(qaResult, null, 2))
console.log(JSON.stringify(qaResult, null, 2))
assert.deepEqual(consoleErrors, [])
assert.match(generatedStatus ?? "", /Cut paths created/u)
await browser.close()

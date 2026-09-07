import assert from "node:assert/strict"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import { chromium } from "playwright"

const url = process.env.VECTORLOOM_BASE_URL ?? "http://127.0.0.1:4180/"
const directory = ".omo/evidence/cut-quality"
await mkdir(directory, { recursive: true })
const browser = await chromium.launch({ channel: "chrome" })
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } })
  const errors = []
  page.on("pageerror", (error) => errors.push(error.message))
  await page.goto(url, { waitUntil: "networkidle" })
  const evidence = []
  for (const scenario of ["thin-backing", "black-shadow"]) {
    const fixture = await page.evaluate((name) => {
      const canvas = document.createElement("canvas")
      canvas.width = canvas.height = 64
      const ctx = canvas.getContext("2d")
      if (!ctx) throw new Error("Canvas unavailable")
      if (name === "thin-backing") {
        ctx.fillStyle = "#ffffff"
        ctx.fillRect(6, 22, 16, 20)
        ctx.fillRect(42, 22, 16, 20)
        ctx.fillStyle = "#000000"
        ctx.fillRect(22, 32, 20, 1)
      } else {
        ctx.fillStyle = "#cd261e"
        ctx.fillRect(4, 4, 56, 56)
        ctx.fillStyle = "#340505"
        ctx.fillRect(4, 30, 56, 14)
        ctx.fillStyle = "#000000"
        ctx.fillRect(28, 12, 8, 8)
      }
      return canvas.toDataURL("image/png").split(",")[1]
    }, scenario)
    await page.setInputFiles('input[type="file"]', {
      name: `${scenario}.png`,
      mimeType: "image/png",
      buffer: Buffer.from(fixture, "base64"),
    })
    await page.getByRole("application", { name: "Subject brush", exact: true }).waitFor()
    if (!(await page.locator("details").evaluate((node) => node.open)))
      await page.getByText("Advanced settings", { exact: true }).click()
    await page.getByLabel("Maximum colors", { exact: true }).fill("2")
    await page.getByLabel("Curve smoothing", { exact: true }).fill("90")
    await page.getByLabel("Detail kept", { exact: true }).fill("95")
    await page.getByLabel("Merge similar shades", { exact: true }).fill("60")
    await page.getByLabel("Filled backing layers", { exact: true }).check()
    await page.getByRole("button", { name: "Create cut paths", exact: true }).click()
    await page.getByRole("region", { name: "Layer repair workspace" }).waitFor()
    const pending = page.waitForEvent("download")
    await page.getByRole("button", { name: "Download SVG", exact: true }).click()
    const download = await pending
    await download.saveAs(`${directory}/${scenario}.svg`)
    const svg = await readFile(`${directory}/${scenario}.svg`, "utf8")
    const result = await page.evaluate(
      async ({ svg, scenario }) => {
        const root = new DOMParser().parseFromString(svg, "image/svg+xml").documentElement
        const groups = [...root.querySelectorAll("g")]
        const colors = groups.map((group) => group.getAttribute("fill"))
        const white = groups.find((group) => group.getAttribute("fill") === "#ffffff")
        if (scenario === "thin-backing") root.replaceChildren(...(white ? [white] : []))
        const img = new Image()
        img.src = `data:image/svg+xml,${encodeURIComponent(new XMLSerializer().serializeToString(root))}`
        await img.decode()
        const canvas = document.createElement("canvas")
        canvas.width = canvas.height = 64
        const ctx = canvas.getContext("2d")
        if (!ctx) throw new Error("Canvas unavailable")
        ctx.drawImage(img, 0, 0, 64, 64)
        const pixel = (x, y) => [...ctx.getImageData(x, y, 1, 1).data]
        return {
          colors,
          whitePaths: white?.querySelectorAll("path").length,
          bridge: pixel(32, 32),
          adjacent: pixel(32, 29),
          black: pixel(32, 16),
          shadow: pixel(10, 36),
          red: pixel(10, 12),
        }
      },
      { svg, scenario },
    )
    if (scenario === "thin-backing") {
      assert.equal(result.whitePaths, 1)
      assert.ok(result.bridge[3] > 0)
      assert.equal(result.adjacent[3], 0)
    } else {
      assert.equal(result.colors.length, 2)
      assert.deepEqual(result.black, [0, 0, 0, 255])
      assert.deepEqual(result.shadow, result.red)
      assert.ok(result.red[0] > result.red[1] * 2)
    }
    evidence.push({ scenario, ...result })
  }
  assert.deepEqual(errors, [])
  const result = { url, evidence, errors }
  await writeFile(`${directory}/results.json`, JSON.stringify(result, null, 2))
  console.log(JSON.stringify(result, null, 2))
} finally {
  await browser.close()
}

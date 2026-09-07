import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { StageRail } from "./StageRail"

describe("StageRail", () => {
  it("exposes passive progress semantics instead of navigation", () => {
    // Given / When
    render(<StageRail current={0} />)

    // Then
    expect(screen.queryByRole("navigation")).toBeNull()
    expect(screen.getByRole("complementary", { name: "Conversion progress" })).toBeDefined()
    expect(screen.getByText("Upload").closest("li")?.getAttribute("aria-current")).toBe("step")
  })
})

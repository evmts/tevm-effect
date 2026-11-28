import { readFileSync } from "node:fs"
import { expect, test } from "vitest"

test("Smithers Runs can select the repository Uphill audit once", () => {
  const manifest = JSON.parse(readFileSync(new URL("../.smithers/factory.json", import.meta.url), "utf8"))
  expect(manifest.apiVersion).toBe(1)
  expect(manifest.contributes.triggers.filter((row: { flow: string; on: string }) =>
    row.flow === "uphill" && row.on === "manual")).toEqual([
    { on: "manual", flow: "uphill", title: "Run Uphill audit" },
  ])
})

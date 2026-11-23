// Real native ZEVM integration test helper: locates the sibling ../zevm checkout
// when present on a developer machine without hard-coding a dependency in package.json.

import { existsSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

/** @throws {never} */
export function findLocalZevmModulePath(): string | undefined {
  const fromEnv = process.env["ZEVM_MODULE_PATH"]
  if (fromEnv && existsSync(fromEnv)) return fromEnv

  const here = dirname(fileURLToPath(import.meta.url))
  const sibling = resolve(here, "..", "..", "..", "zevm", "npm", "zevm", "src", "index.js")
  if (existsSync(sibling)) return sibling
  return undefined
}

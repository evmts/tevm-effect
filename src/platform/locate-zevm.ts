// Native ZEVM resolution helper for tests:
// prefers explicit ZEVM_MODULE_PATH override, then the installed `@evmts/zevm`
// package (0.1.0+ from npm), and finally a sibling ../zevm dev checkout.

import { existsSync } from "node:fs"
import { createRequire } from "node:module"
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

/** @throws {never} */
export function hasInstalledZevmPackage(): boolean {
  try {
    const req = createRequire(import.meta.url)
    req.resolve("@evmts/zevm")
    return true
  } catch {
    return false
  }
}

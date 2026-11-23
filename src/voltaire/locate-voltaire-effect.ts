// Locates sibling ../voltaire/packages/voltaire-effect/dist/index.js for live
// cross-repo integration tests without hardcoding a local file: dependency in package.json.

import { existsSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

/** @throws {never} */
export function findLocalVoltaireEffectPath(): string | undefined {
  const fromEnv = process.env["VOLTAIRE_EFFECT_PATH"]
  if (fromEnv && existsSync(fromEnv)) return fromEnv

  const here = dirname(fileURLToPath(import.meta.url))
  const sibling = resolve(
    here,
    "..",
    "..",
    "..",
    "voltaire",
    "packages",
    "voltaire-effect",
    "dist",
    "index.js",
  )
  if (existsSync(sibling)) return sibling
  return undefined
}

export async function loadVoltaireEffect(modulePath: string): Promise<Record<string, unknown>> {
  return (await import(pathToFileURL(modulePath).href)) as Record<string, unknown>
}

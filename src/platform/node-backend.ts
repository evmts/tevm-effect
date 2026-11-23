// Node.js platform adapter for @evmts/zevm native Node-API bindings.
// Kept strictly in a .ts platform module so core .vibe modules remain 100% platform-agnostic.

import { existsSync } from "node:fs"
import { createRequire } from "node:module"
import { pathToFileURL } from "node:url"

export interface RawZevmNativeNode {
  rpc(request: string): string | null
  close(): void
}

export interface RawZevmLightClient {
  syncStep(): number
  status(): number
  lastError(): string | null
  getBalance(address: string, blockNumber?: number): string
  getTransactionCount(address: string, blockNumber?: number): string
  getCode(address: string, blockNumber?: number): string
  getStorage(address: string, slot: string, blockNumber?: number): string
  close(): void
}

export interface RawZevmModule {
  readonly version: () => string
  readonly abiVersion: () => number
  readonly NativeNode: new (config?: { chain_id?: number; hardfork?: string }) => RawZevmNativeNode
  readonly LightClient: new (
    network: number,
    beaconRpcUrl: string,
    executionRpcUrl: string,
  ) => RawZevmLightClient
}

export interface NodeZevmBackendOptions {
  /** Explicit path to an ESM @evmts/zevm entry module (e.g. "../zevm/npm/zevm/src/index.js"). */
  readonly modulePath?: string
  /** Explicit path to a compiled zevm.node native addon (sets ZEVM_NATIVE_PATH before import). */
  readonly addonPath?: string
}

const LIGHT_NETWORK_CODES: Record<string, number> = {
  mainnet: 0,
  sepolia: 1,
  holesky: 2,
  hoodi: 3,
}

/** @throws {never} */
export function networkNameToCode(network: string): number {
  return LIGHT_NETWORK_CODES[network] ?? 0
}

/** @throws {never} */
export function lightStatusCodeToName(code: number): "not_synced" | "syncing" | "synced" {
  if (code === 2) return "synced"
  if (code === 1) return "syncing"
  return "not_synced"
}

/**
 * Load the @evmts/zevm module dynamically.
 * Resolution order:
 *   1. Explicit `options.modulePath`
 *   2. `process.env.ZEVM_MODULE_PATH`
 *   3. Installed `@evmts/zevm` package
 */
export async function loadZevmModule(options: NodeZevmBackendOptions = {}): Promise<RawZevmModule> {
  if (options.addonPath !== undefined) {
    process.env["ZEVM_NATIVE_PATH"] = options.addonPath
  }

  const explicitPath = options.modulePath ?? process.env["ZEVM_MODULE_PATH"]
  if (explicitPath !== undefined && explicitPath.length > 0) {
    if (!existsSync(explicitPath)) {
      throw new Error(`ZEVM module not found at "${explicitPath}"`)
    }
    const mod = (await import(pathToFileURL(explicitPath).href)) as Partial<RawZevmModule>
    assertValidZevmModule(mod, explicitPath)
    return mod
  }

  try {
    const mod = (await import("@evmts/zevm")) as unknown as Partial<RawZevmModule>
    assertValidZevmModule(mod, "@evmts/zevm")
    return mod
  } catch (esmErr) {
    try {
      const req = createRequire(import.meta.url)
      const mod = req("@evmts/zevm") as unknown as Partial<RawZevmModule>
      assertValidZevmModule(mod, "@evmts/zevm")
      return mod
    } catch {
      const detail = esmErr instanceof Error ? esmErr.message : String(esmErr)
      throw new Error(
        `Failed to load @evmts/zevm native bindings (${detail}). Install @evmts/zevm or pass { modulePath } / ZEVM_MODULE_PATH.`,
      )
    }
  }
}

function assertValidZevmModule(mod: Partial<RawZevmModule>, source: string): asserts mod is RawZevmModule {
  if (typeof mod.NativeNode !== "function") {
    throw new Error(`Module loaded from "${source}" does not export NativeNode`)
  }
}

export function resolveEnvPath(name: string): string | undefined {
  const value = process.env[name]
  return value !== undefined && value.length > 0 ? value : undefined
}

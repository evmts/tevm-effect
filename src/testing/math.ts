// Non-throwing BigInt conversion helpers for the in-memory test backend.

/** @throws {never} */
export function safeBigInt(value: number): bigint {
  if (!Number.isFinite(value)) return 0n
  return BigInt(Math.trunc(value))
}

/** @throws {never} */
export function parseHexToBigInt(input: unknown, fallback: bigint = 0n): bigint {
  if (typeof input === "bigint") return input
  if (typeof input === "number") {
    return Number.isSafeInteger(input) && input >= 0 ? BigInt(input) : fallback
  }
  if (typeof input === "string" && /^0x[0-9a-fA-F]+$/.test(input)) {
    try {
      return BigInt(input)
    } catch {
      return fallback
    }
  }
  return fallback
}

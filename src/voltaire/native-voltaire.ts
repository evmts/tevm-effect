// Direct @tevm/voltaire adapter helpers for ABI encoding/decoding, Keccak-256,
// Solidity revert decoding, and local Secp256k1 signing.
// Isolated in a .ts boundary module so VibeLang files track every potential throw
// cleanly through Effect.try.

import * as VoltaireAbi from "@tevm/voltaire/Abi"
import { Address as VoltaireAddress } from "@tevm/voltaire/Address"
import * as VoltaireHash from "@tevm/voltaire/Hash"
import * as VoltaireHex from "@tevm/voltaire/Hex"
import * as VoltaireKeccak from "@tevm/voltaire/Keccak256"
import * as VoltaireSecp256k1 from "@tevm/voltaire/Secp256k1"
import type { Abi, Address, Hash32, Hex, LogObject } from "../types.vibe"

interface AbiItemLike {
  readonly type: string
  readonly name?: string
  readonly inputs?: readonly { readonly type: string; readonly name?: string; readonly indexed?: boolean }[]
  readonly outputs?: readonly { readonly type: string; readonly name?: string }[]
}

export function voltaireEncodeFunctionData(
  abi: Abi,
  functionName: string,
  args: readonly unknown[] = [],
): Hex {
  const encoded = VoltaireAbi.encodeFunction(abi as never, functionName, [...args])
  return (typeof encoded === "string" ? encoded : VoltaireHex.fromBytes(encoded)) as Hex
}

export function voltaireDecodeFunctionResult(
  abi: Abi,
  functionName: string,
  data: Hex,
): unknown {
  const fn = (abi as unknown as readonly AbiItemLike[]).find(
    (item) => item.type === "function" && item.name === functionName,
  )
  if (!fn) {
    throw new Error(`Function "${functionName}" not found in ABI`)
  }
  const bytes = VoltaireHex.toBytes(data as never)
  const decoded = VoltaireAbi.Function.decodeResult(fn as never, bytes) as readonly unknown[]
  const outputCount = fn.outputs?.length ?? 0
  if (outputCount === 0) return undefined
  if (outputCount === 1) return decoded[0]
  return decoded
}

export function voltaireEncodeDeployData(
  abi: Abi,
  bytecode: Hex,
  args: readonly unknown[] = [],
): Hex {
  const ctor = (abi as unknown as readonly AbiItemLike[]).find((item) => item.type === "constructor")
  const inputs = ctor?.inputs ?? []
  if (inputs.length === 0) {
    if (args.length > 0) {
      throw new Error(`Constructor takes 0 arguments, got ${args.length}`)
    }
    return bytecode
  }
  const encoded = VoltaireAbi.encodeParameters(inputs as never, [...args] as never)
  const suffix = VoltaireHex.fromBytes(encoded).slice(2)
  return `${bytecode}${suffix}` as Hex
}

export function voltaireDecodeEventLog(
  abi: Abi,
  log: LogObject,
): { readonly eventName: string; readonly args: Readonly<Record<string, unknown>> } {
  if (log.topics.length === 0) {
    throw new Error("Cannot decode anonymous event log with no topics")
  }
  const topic0 = log.topics[0].toLowerCase()
  const dataBytes = VoltaireHex.toBytes(log.data as never)
  const topicHashes = log.topics.map((t) => VoltaireHash.fromHex(t as never))

  for (const raw of abi as unknown as readonly AbiItemLike[]) {
    if (raw.type !== "event" || !raw.name) continue
    const selector = VoltaireAbi.Event.getSelector(raw as never)
    const eventTopic = VoltaireHash.toHex(selector as never).toLowerCase()
    if (eventTopic !== topic0) continue
    const decoded = VoltaireAbi.Event.decodeLog(
      raw as never,
      dataBytes,
      topicHashes as never,
    ) as Record<string, unknown>
    return { eventName: raw.name, args: decoded }
  }
  throw new Error(`No matching event found in ABI for topic0 ${topic0}`)
}

export function voltaireKeccak256(data: Hex): Hash32 {
  const hash = VoltaireKeccak.hashHex(data)
  return VoltaireHash.toHex(hash as never) as Hash32
}

export function voltaireDecodeParameters(
  types: readonly { readonly type: string }[],
  data: Hex,
): readonly unknown[] {
  const bytes = VoltaireHex.toBytes(data as never)
  return VoltaireAbi.decodeParameters(types as never, bytes) as readonly unknown[]
}

export function voltaireDecodeCustomError(
  abi: Abi,
  data: Hex,
): { readonly name: string; readonly signature: string; readonly args: readonly unknown[] } | undefined {
  const selector = data.slice(0, 10).toLowerCase()
  const fullBytes = VoltaireHex.toBytes(data as never)
  for (const item of abi as unknown as readonly AbiItemLike[]) {
    if (item.type !== "error" || !item.name) continue
    const errSel = VoltaireHex.fromBytes(VoltaireAbi.Error.getSelector(item as never)).toLowerCase()
    if (errSel !== selector) continue
    const signature = VoltaireAbi.Error.getSignature(item as never)
    const args = VoltaireAbi.Error.decodeParams(item as never, fullBytes) as readonly unknown[]
    return { name: item.name, signature, args }
  }
  return undefined
}

export function voltaireAddressFromPrivateKey(privateKeyHex: Hex): Address {
  const keyBytes = VoltaireHex.toBytes(privateKeyHex as never)
  const addr = VoltaireAddress.fromPrivateKey(keyBytes)
  return VoltaireAddress.toHex(addr) as Address
}

/** Sign an EIP-191 personal message using @tevm/voltaire Secp256k1 + Keccak256. */
export function voltaireSignPersonalMessage(privateKeyHex: Hex, messageHex: Hex): Hex {
  const msgBytes = VoltaireHex.toBytes(messageHex as never)
  const prefix = new TextEncoder().encode(`\x19Ethereum Signed Message:\n${msgBytes.length}`)
  const payload = new Uint8Array(prefix.length + msgBytes.length)
  payload.set(prefix, 0)
  payload.set(msgBytes, prefix.length)
  const digest = VoltaireKeccak.hash(payload)
  const keyBytes = VoltaireHex.toBytes(privateKeyHex as never)
  const sig = VoltaireSecp256k1.sign(digest as never, keyBytes as never)
  const rHex = VoltaireHex.fromBytes(sig.r as Uint8Array).slice(2).padStart(64, "0")
  const sHex = VoltaireHex.fromBytes(sig.s as Uint8Array).slice(2).padStart(64, "0")
  const vByte = (sig.v >= 27 ? sig.v : sig.v + 27).toString(16).padStart(2, "0")
  return `0x${rHex}${sHex}${vByte}` as Hex
}

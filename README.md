# tevm-effect (`@tevm/effect`)

An Effect-native, aggressively dependency-injected Ethereum execution & developer node powered by **[ZEVM](https://github.com/evmts/zevm)** and built to compose directly with **[voltaire-effect v2](https://github.com/evmts/voltaire)**, written in **[VibeLang](https://vibelang.sh)** targeting **Effect 4** (emitting standard ESM JavaScript + `.d.ts` declarations for both VibeLang and Effect 4 TypeScript consumers).

## Design Principles

1. **Aggressive Dependency Injection Everywhere** — Every subsystem is an Effect `service` wired through `Layer`:
   - `Common` — chain ID, hardfork (`frontier` .. `osaka`), gas limit, mining policy, and fork configuration (with presets and combinators like `withChainId`, `withHardfork`, `withMining`, `withFork`).
   - `ZevmBackend` — platform-agnostic low-level engine & light-client boundary. Core `@tevm/effect` has **zero** `node:*` imports.
     - `@tevm/effect/platform/node` (`ZevmBackendNode`) — native Zig Node-API bindings (`@evmts/zevm`) with `acquireRelease` scoped cleanup so native memory cannot leak.
     - `@tevm/effect/testing` (`ZevmBackendMemory`) — pure in-memory ZEVM backend that runs deterministically on Node, Bun, Deno, browsers, and Cloudflare Workers.
     - `ZevmBackendFromTransport` — mount any `Transport` (such as `HttpTransport`) as a `ZevmBackend` for browsers and edge workers.
   - `Evm` — serialized (Effect `Semaphore`), scoped (`Scope` + `acquireRelease`), observable (`PubSub` + `Stream<EngineEvent>`) execution engine.
   - `Transport` — dependency-injected JSON-RPC transport (`TransportFromEvm`, `HttpTransport` over Effect `HttpClient`, `testTransport`) with composable Layer decorators (`withTransportRetry`, `withTransportTimeout`, `withTransportLogging`, `fallbackTransport`).
   - `StateStorage` — dependency-injected state checkpoint storage (`StateStorageMemory` via Effect `Ref`, `StateStorageFileSystem` via Effect `FileSystem` + `Path`).
   - `AbiCodec` — dependency-injected ABI & Keccak-256 codec (`AbiCodecZevm` built-in over `web3_sha3`, or `VoltaireAbiCodec` from `@tevm/effect/voltaire` once `voltaire-effect` v2 lands).
   - `LightClient` — scoped ZEVM proof-backed light client with reactive `syncStream`.

2. **Effect Streams as First-Class Data Structures** — No `EventEmitter`, no raw `setInterval`:
   - `blockStream` (historical backfill + live tailing)
   - `transactionStream`
   - `logStream` (chunked backfill + live watching)
   - `contractEventStream` (decoded via injected `AbiCodec`)
   - `receiptStream` (concurrent receipt resolution)
   - `accountBalanceStream` (deduplicated via `Stream.changesWith`)
   - `stateAccountStream`
   - `Evm.events` (`PubSub`-backed live `EngineEvent` stream)

3. **Effect-Native Superpowers & Typed Errors**:
   - `withSnapshot(effect)` — Effect-scoped automatic `zevm_snapshot` / `zevm_revert` rollback even on typed failure or fiber interruption.
   - `withImpersonation(address, effect)` — Effect-scoped automatic impersonation cleanup.
   - Exhaustive tagged Effect errors (`RpcError`, `ExecutionRevertedError`, `ModeUnsupportedError`, `LightNotReadyError`, `GasCapExceededError`, `TransportError`, `StorageError`, `CodecError`, `SnapshotNotFoundError`, `ReceiptTimeoutError`, `ZevmBindingError`, etc.).
   - Platform-agnostic Effect HTTP JSON-RPC server (`makeJsonRpcHttpRouter`) built on `effect/http` — testable without opening a socket via `HttpRouter.toHttpEffect`.

## Quick Example (VibeLang)

```vibe
import {
  AnvilCommon,
  blockStream,
  ethCall,
  getBalance,
  tevmMineDetailed,
  tevmSetAccount,
  TevmCoreLive,
  withSnapshot,
} from "@tevm/effect"
import { ZevmBackendNode } from "@tevm/effect/platform/node"

const NativeTevm = Layer.provideMerge(
  TevmCoreLive,
  Layer.merge(AnvilCommon, ZevmBackendNode()),
)

export effect function main() {
  provide NativeTevm {
    const addr = "0x000000000000000000000000000000000000c0de" as const
    try tevmSetAccount({
      address: addr,
      balance: 10n ** 18n,
      code: "0x602a60005260206000f3",
    })

    // Speculative execution with guaranteed automatic state rollback
    const result = try withSnapshot(effect {
      return try ethCall({ to: addr })
    })
    try Console.log("eth_call result:", result)

    // Mine blocks and consume them as a backpressure-aware Effect Stream
    try tevmMineDetailed({ blocks: 2 })
    for try (const block of blockStream({ fromBlock: 0n, toBlock: 2n })) {
      try Console.log("block:", block.number, block.hash)
    }
  }
}
```

## Voltaire Integration Seam

`@tevm/effect/voltaire` exposes two adapters designed to plug directly into `voltaire-effect` v2:

- `VoltaireAbiCodec(adapter)` — replaces `AbiCodecZevm` with Voltaire's full ABI + Keccak-256 implementation without changing any action or stream call site.
- `toVoltaireTransport()` — exports any injected `@tevm/effect` `Transport` (including in-process native ZEVM) with the `voltaire-effect` `TransportService` shape.

## Development

```bash
pnpm install
pnpm run build
pnpm run typecheck
pnpm run lint
pnpm test
```

If a local `../zevm` checkout (or `ZEVM_MODULE_PATH`) is present, `src/platform/zevm-native.test.vibe` automatically runs end-to-end integration tests against the real compiled Zig `zevm.node` binary.

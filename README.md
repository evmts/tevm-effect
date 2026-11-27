# tevm-effect (`@tevm/effect`)

An Effect-native, aggressively dependency-injected Ethereum execution & developer node powered by **[ZEVM](https://github.com/evmts/zevm)** and **[Voltaire](https://github.com/evmts/voltaire)** (`@tevm/voltaire`), written in **[VibeLang](https://vibelang.sh)** targeting **Effect 4** (emitting standard ESM JavaScript + `.d.ts` declarations + `"vibelang-source"` conditions for both VibeLang and Effect 4 TypeScript consumers).

## Upgrading from the legacy package

Version 2 introduces a new public API built on Effect 4. Applications using the legacy utilities can pin their existing 1.x prerelease while migrating. Import the Node backend from `@tevm/effect/platform/node` and the in-memory backend from `@tevm/effect/testing`.

## Architecture — Everything Is a Composable Effect Service

Core `@tevm/effect` has **zero `node:*` imports** and runs identically on Node, Bun, Deno, browsers, and Cloudflare Workers by swapping Layers:

| Service | Purpose | Built-in Layers |
| --- | --- | --- |
| `Common` | Chain ID, hardfork (`frontier`..`osaka`), gas limit, mining & fork config | `TevmLocalCommon`, `AnvilCommon`, `MainnetCommon`, `SepoliaCommon`, `HoleskyCommon`, `HoodiCommon`, `OptimismCommon`, `BaseCommon`, `ArbitrumCommon`, `makeCommonLayer`, combinators `withChainId`, `withHardfork`, `withMining`, `withFork` |
| `ZevmBackend` | Platform-agnostic low-level engine & light-client boundary | `ZevmBackendNode` (`@tevm/effect/platform/node`), `ZevmBackendMemory` (`@tevm/effect/testing`), `ZevmBackendFromTransport` (remote HTTP/browser/Worker) |
| `Evm` | Serialized (`Semaphore`), scoped (`acquireRelease`), observable (`PubSub` + `Stream<EngineEvent>`) execution engine | `EvmLive` |
| `Transport` | Dependency-injected JSON-RPC transport | `TransportFromEvm`, `HttpTransport` (Effect `HttpClient`), `testTransport`, `fallbackTransport`, decorators `withTransportRetry`, `withTransportTimeout`, `withTransportLogging`, `withTransportCache`, `withTransportRateLimit`, `withTransportHooks`, `TransportWithPredeploys` |
| `StateStorage` | State dump & checkpoint persistence | `StateStorageMemory` (Effect `Ref`), `StateStorageFileSystem` (Effect `FileSystem` + `Path`) |
| `AbiCodec` | ABI encoding/decoding & Keccak-256 | `AbiCodecZevm` (zero-dep `web3_sha3`), `VoltaireAbiCodecLive` (`@tevm/effect/voltaire`, full dynamic Solidity ABI + local Keccak-256), `VoltaireAbiCodec(adapter)` |
| `Signer` | Transaction & EIP-191 message signing | `SignerManagedAccount`, scoped `SignerImpersonated` (auto-revokes on Scope exit), `SignerLocalVoltaire` (`@tevm/effect/voltaire`, Secp256k1) |
| `NonceManager` | Fiber-safe concurrent monotonic nonce tracking | `NonceManagerLive` (`Semaphore` + `Ref`) |
| `Predeploys` | Declarative Layer-composed contract predeployment | `makePredeploysLayer`, `withPredeploy`, `withPredeploys`, `installPredeploys`, `TransportWithPredeploys` |
| `LightClient` | Proof-backed, consensus-anchored ZEVM light client | `LightClientLive` + reactive `syncStream` |
| `SubscriptionManager` | Platform-agnostic `eth_subscribe` / `eth_unsubscribe` multiplexer | `SubscriptionManagerLive` (`PubSub` + `Stream` + scoped fibers) |
| Ambient `Context.Reference` | Effect 4 zero-plumbing config | `RpcTimeout`, `RpcTracing`, `BlockPollInterval`, `DefaultGasLimit` (`withRpcTimeout`, `withRpcTracing`, `withBlockPollInterval`, `withDefaultGasLimit`) |

## Effect Streams as First-Class Data Structures

- `blockStream` — historical backfill + live watching (TestClock-friendly, backpressure-aware)
- `transactionStream` — flat stream of `TransactionObject`s across blocks
- `logStream` — chunked historical backfill + live watching
- `contractEventStream` — decoded event stream via injected `AbiCodec`
- `receiptStream` — concurrent receipt resolution
- `accountBalanceStream` — reactive balance watcher deduplicated via `Stream.changesWith`
- `stateAccountStream` — stream over all accounts in `zevm_dumpState`
- `Evm.events` & `SubscriptionManager.notifications` — live `PubSub`-backed streams

## Effect-Native Superpowers & Typed Errors

- **`withSnapshot(effect)`**: Takes a ZEVM snapshot and guarantees `zevm_revert` on normal completion, typed error, or fiber interruption.
- **`withImpersonation(address, effect)`** & **`SignerImpersonated(address)`**: Automatically stops impersonating on Scope exit.
- **Bound Contracts**: `bindContract({ address, abi })` returns `{ read, write, events }` as pure Effects over `Transport | AbiCodec`.
- **Revert Decoding**: `decodeRevertReason` + `formatRevertReason` (`ErrorString`, `Panic`, ABI `Custom`, `Raw`) powered by `@tevm/voltaire/Abi`.
- **Platform-Agnostic HTTP JSON-RPC Server**: `makeJsonRpcHttpRouter` (`effect/http`) testable without a socket via `HttpRouter.toHttpEffect`, plus `serveJsonRpcNode` in `@tevm/effect/platform/node`.
- **Complete ZEVM RPC Coverage**: `eth_*`, `zevm_*` (state, mining, snapshots, impersonation, time, fork, txpool, metadata), `debug_*`, `engine_*` (V1–V6), and `zevm_lightSyncStatus`.

## Voltaire & `voltaire-effect` v2 Integration (`@tevm/effect/voltaire`)

- `VoltaireAbiCodecLive` — drop-in `AbiCodec` Layer powered by `@tevm/voltaire/Abi` + `Keccak256`.
- `toVoltaireTransport()` — matches `voltaire-effect` v2's `Transport` contract (`request` + `requestBatch`).
- `toEip1193Provider()` — plug directly into `voltaire-effect` v2's `CustomTransport(provider)` so `voltaire-effect`'s `getChainId`, `getBalance`, `Contract`, `Multicall`, `Ens`, and `Streams` execute directly against in-process ZEVM!
- `SignerLocalVoltaire(privateKey)` — local Secp256k1 signer powered by `@tevm/voltaire`.

## Quick Example (VibeLang)

```vibe
import {
  AnvilCommon,
  bindContract,
  blockStream,
  makePredeploysLayer,
  tevmMineDetailed,
  TevmEngineLayer,
  TransportWithPredeploys,
  withSnapshot,
} from "@tevm/effect"
import { ZevmBackendNode } from "@tevm/effect/platform/node"
import { VoltaireAbiCodecLive } from "@tevm/effect/voltaire"

const contractAddr = "0x0000000000000000000000000000000000004242" as const
const abi = [{ type: "function", name: "answer", inputs: [], outputs: [{ name: "", type: "uint256" }] }] as const

const Stack = Layer.merge(
  Layer.provide(
    TransportWithPredeploys,
    Layer.merge(
      Layer.provide(TevmEngineLayer, Layer.merge(AnvilCommon, ZevmBackendNode())),
      makePredeploysLayer([
        { name: "Answer", address: contractAddr, deployedBytecode: "0x602a60005260206000f3" },
      ]),
    ),
  ),
  VoltaireAbiCodecLive,
)

export effect function main() {
  provide Stack {
    const answer = try withSnapshot(bindContract({ address: contractAddr, abi }).read<bigint>("answer"))
    try Console.log("Answer from native Zig ZEVM + Voltaire ABI:", answer)

    try tevmMineDetailed({ blocks: 2 })
    for try (const block of blockStream({ fromBlock: 0n, toBlock: 2n })) {
      try Console.log("block:", block.number, block.hash)
    }
  }
}
```

## Development

```bash
pnpm install
pnpm run build
pnpm run typecheck
pnpm run lint
pnpm test
```

When sibling checkouts `../zevm` and/or `../voltaire/packages/voltaire-effect` are present, integration tests automatically exercise both the real compiled Zig `zevm.node` binary and live `voltaire-effect` v2 cross-repo interop.

# tevm-effect Contributor & Agent Guide

- **Language & Runtime**: Written in VibeLang (`.vibe`) targeting Effect `4.1.1` (`vibelang@0.0.13`), compiling to standard ESM JS + `.d.ts` declarations.
- **Version Control**: Use Jujutsu (`jj`) for all repository operations.
- **Aggressive Dependency Injection**:
  - Core modules under `src/` (outside `src/platform/`) must NEVER import `node:*` or touch Node/browser globals directly.
  - Every external boundary (chain config, native/remote engine, transport, state persistence, ABI/crypto codec, clock, filesystem, HTTP) must be an Effect `service` composed via `Layer`.
  - Use Effect `Stream` for reactive/collections data structures and `Scope`/`acquireRelease` for every resource handle and reversible EVM mutation.
  - Use typed VibeLang `error` declarations (`Data.TaggedError`) for every expected failure.
- **Validation**:
  - `pnpm run build`
  - `pnpm run typecheck`
  - `pnpm run lint`
  - `pnpm test`

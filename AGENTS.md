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
- **Smithers (incremental CI)**: `PACKAGE.ts` mirrors the scripts above as cached targets; `.smithers/WORKSPACE.ts` declares the workspace and remote cache (`https://build.smithers.sh`).
  - `pnpm exec smthrs ci '//...'` runs build, typecheck, lint, format, test, and factory drift; unchanged targets replay from `.smithers/cache`.
  - `pnpm exec smthrs run //:test-native` runs the native ZEVM / voltaire-effect suites against sibling `../zevm` and `../voltaire` checkouts (excluded from the cached `//:test`).
  - After editing `.smithers/FACTORY.ts` or `.smithers/flows/**`, regenerate with `pnpm exec smthrs target //:factory-write --write`.

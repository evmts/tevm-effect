# Rules

Uphill writes these rules from each metric's `description`. Write code that meets them. `uphill` scores each metric against its target, and `uphill --compare HEAD --compact` lists what a change made worse.

## Footprint

Keep each public export surface lean and every VibeLang module compact.

- Keep each package export surface small and modular; split unrelated RPC domains or adapters rather than growing a single entry surface. At most 12 kB.
- Keep every source module under 250 lines by decomposing large backends and RPC namespaces into focused files. At most 250.
- Keep production runtime dependencies minimal (Effect + VibeLang runtime only); push vendor bindings to optional peerDependencies.

## Quality

Enforce aggressive Effect DI, typed VibeLang errors, strict types, and TigerStyle function limits.

- Keep core src/ modules 100% platform-agnostic (zero node:* imports or Node-only globals outside src/platform/).
- Model every failure as a typed VibeLang error (Data.TaggedError) instead of raw `throw new Error(...)`.
- Avoid `any`, double casts (`as unknown as`), and `@ts-ignore`/`@ts-expect-error`; decode external payloads with schemas or type guards.
- Keep every function at or under 70 lines (TigerStyle); extract cohesive helpers for complex state or RPC handlers.
- Never call `Effect.runSync`, `Effect.runPromise`, or `Effect.runFork` inside library modules; return Effects and compose Layers.
- Keep source files free of stray `console.*` calls, `TODO`/`FIXME` comments, and lines over 120 characters.

## Architecture & Testing

Maintain colocated test depth across every subsystem and keep public docs synchronized with exports.

- Every subsystem under src/ must ship colocated `.test.vibe` or `.test.ts` suites exercising its Layers and error paths.
- Maintain at least a 60% test-to-source line ratio in every subsystem under src/. At least 60.
- Keep package.json export source paths and local Markdown links in README.md and AGENTS.md valid.

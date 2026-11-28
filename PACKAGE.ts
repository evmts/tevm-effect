import { Smithers as S } from "@smthrs/targets"

// tevm-effect's targets. `.smithers/WORKSPACE.ts` declares the workspace; this
// root package mirrors the package.json scripts (build, typecheck, lint,
// format:check, test) as cached targets plus the factory projection.
//
// Input closures: every check reads the VibeLang/TS sources plus the compiler,
// test, and install configuration that shapes their output, so editing README,
// AGENTS.md, flows, or CI never reruns build, typecheck, lint, or tests.
const config = S.Filegroup({
  srcs: [
    S.file("package.json"),
    S.file("pnpm-lock.yaml"),
    S.file("pnpm-workspace.yaml"),
    S.file("tsconfig.json"),
    S.file("tsconfig.test.json")
  ]
})

// Library sources (published entry points under ./dist) and their tests.
const sources = S.Filegroup({
  srcs: [S.glob("src/**/*.{vibe,vibex,ts}", { exclude: ["src/**/*.test.vibe", "src/**/*.test.vibex", "src/**/*.test.ts"] })]
})
const tests = S.Filegroup({
  srcs: [S.glob("src/**/*.test.{vibe,vibex,ts}"), S.file("vitest.config.ts")]
})

const vibelang = S.NodeModule.Bin("vibelang")
const common = {
  tools: [S.Host.bin("node"), S.Host.bin("sh")],
  timeout: "10m" as const
}

// `pnpm run build`: VibeLang emits ESM + .d.ts for every package.json export.
const build = S.Shell.Build({
  ...common,
  summary: "Compile src/**/*.vibe to dist/ (ESM, .d.ts, source maps) with vibelang.",
  bin: vibelang,
  args: [],
  data: [config, sources],
  outDirs: ["dist", ".vibe"]
})

// `pnpm run typecheck`: whole program including tests (tsconfig.test.json).
// Gated on build: vibelang writes .vibe/declarations sidecars even under
// --noEmit, and two concurrent compiles with different tsconfigs race on that
// shared directory (TS5055, about 1 in 6 runs). Remove the gate once VibeLang
// makes concurrent sidecar writes safe.
const typecheck = S.Shell.Test({
  ...common,
  sandbox: "none",
  summary: "Typecheck library and test sources with vibelang --noEmit -p tsconfig.test.json.",
  bin: vibelang,
  args: ["--noEmit", "-p", "tsconfig.test.json"],
  data: [config, sources, tests],
  gates: [build]
})

// `pnpm run lint`: VibeLang lint rules, including the Effect language service.
const lint = S.Shell.Test({
  ...common,
  summary: "Lint library and test sources with vibelang lint -p tsconfig.test.json.",
  bin: vibelang,
  args: ["lint", "-p", "tsconfig.test.json"],
  data: [config, sources, tests]
})

// `pnpm run format:check`: canonical VibeLang formatting. The formatter walks
// the whole package, so the Smithers declarations are inputs too. Unconfined:
// vibelang format fetches its dprint plugin into the host's dprint cache.
const declarations = S.Filegroup({
  srcs: [S.file("PACKAGE.ts"), S.glob(".smithers/*.ts")]
})
const format = S.Shell.Test({
  ...common,
  sandbox: "none",
  summary: "Check canonical VibeLang formatting with vibelang format --check.",
  bin: vibelang,
  args: ["format", "--check"],
  data: [config, sources, tests, declarations]
})

// Suites that still load sibling checkouts outside the repository (e.g.
// voltaire-effect v2 via VOLTAIRE_EFFECT_PATH until published to npm).
// Native ZEVM tests run hermetically via the installed `@evmts/zevm@^0.1.0`
// devDependency inside the cached `//:test` target!
const externalSuites = ["src/voltaire/voltaire-effect-interop.test.vibe"]

// `pnpm test` minus external sibling suites: vitest through vibelang-vite.
// Unconfined: vite writes its bundled config to node_modules/.vite-temp.
const test = S.Shell.Test({
  ...common,
  sandbox: "none",
  summary: "Run the hermetic vitest suite (including native @evmts/zevm@0.1.0) through vibelang-vite.",
  bin: S.NodeModule.Bin("vitest"),
  args: ["run", ...externalSuites.flatMap((suite) => ["--exclude", suite])],
  data: [config, sources, tests, S.file(".smithers/factory.json")]
})

// Sibling-checkout interop tests (e.g. voltaire-effect v2 before npm publish).
// Manual and uncached: `smthrs run //:test-native`.
const testNative = S.Shell.Run({
  ...common,
  sandbox: "none",
  summary: "Run the native ZEVM and voltaire-effect interop suites.",
  bin: S.NodeModule.Bin("vitest"),
  args: ["run", "src/platform/zevm-native.test.vibe", ...externalSuites],
  data: [config, sources, tests],
  manual: true
})

export const Package = S.Package({
  targets: {
    config,
    sources,
    tests,
    declarations,
    // .smithers/FACTORY.ts -> .smithers/factory.json + home.json. smthrs plans
    // the verb's mode over the declared one: `smthrs ci` checks drift, and
    // `smthrs target //:factory-write --write` regenerates both files.
    "factory-write": S.FactoryProjection({ mode: "write" }),
    "factory-check": S.FactoryProjection({ mode: "check" }),
    build,
    typecheck,
    lint,
    format,
    test,
    "test-native": testNative
  }
})

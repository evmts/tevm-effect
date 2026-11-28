/**
 * The factory that develops evmts/tevm-effect (https://smithers.sh/evmts/tevm-effect):
 * featured flows, Dispatcher rules, GitHub policy, and the app home. Projected
 * into .smithers/factory.json and .smithers/home.json by //.smithers:factory-write
 * and checked by //.smithers:factory-check.
 */
import { Smithers as S } from "@smthrs/targets"

export const review = S.Flow({
  flow: "checks/review",
  featured: true,
  summary: "Review Effect Layer DI, scoped EVM resources, JSON-RPC correctness, Voltaire interop, and package output."
})

export const issueRepro = S.Flow({
  flow: "issue/repro",
  featured: true,
  summary: "Reproduce a service, action, stream, or Voltaire defect as a deterministic in-memory vitest."
})

export const issuePoc = S.Flow({
  flow: "issue/poc",
  featured: true,
  summary: "Implement a bounded fix as a service or Layer change with a failing-then-passing regression."
})

export const prTriage = S.Flow({
  flow: "pr-triage",
  featured: true,
  summary: "Assess pull request readiness from its diff and CI evidence without executing untrusted PR code."
})

export const upstreamProbe = S.Flow({
  flow: "upstream-probe",
  featured: true,
  summary: "Probe new Effect, VibeLang, and Voltaire releases in a scratch workspace and report drift."
})

export const factory = S.Factory({
  triggers: {
    "manual-uphill": { _tag: "TriggerBinding", flow: "uphill", on: { _tag: "Manual" }, title: "Run Uphill audit" }
  },
  summary: "tevm-effect: incremental VibeLang CI, Effect Layer DI and EVM correctness review, and weekly Effect/VibeLang/Voltaire drift probes.",
  flows: [review, issueRepro, issuePoc, prTriage, upstreamProbe],
  on: {
    "schedule:0 14 * * 1": {
      flow: "upstream-probe",
      description: "Weekly Monday probe of new Effect, VibeLang, and Voltaire releases"
    }
  },
  github: S.Github.Policy({
    mirror: "pull",
    issues: "read",
    changes: "send-upstream",
    maintainers: ["roninjin10"],
    protectedPaths: [
      "package.json",
      "pnpm-lock.yaml",
      "src/services/evm.vibe",
      "src/services/backend.vibe",
      "src/actions/engine.vibe",
      "src/platform",
      ".smithers",
      ".github/workflows"
    ]
  })
})

export const home = S.Factory.Home({
  blocks: [
    {
      type: "text",
      title: "tevm-effect factory",
      text: "Effect-native, aggressively dependency-injected TEVM powered by ZEVM and Voltaire, written in VibeLang for Effect 4. Incremental build, typecheck, lint, format, and vitest targets replay from the Smithers cache; reviews enforce Layer DI, scoped EVM mutations, and JSON-RPC parity."
    },
    {
      type: "prompt",
      title: "Ask about tevm-effect",
      placeholder: "Describe a Layer, JSON-RPC, stream, or Voltaire issue or change…"
    },
    {
      type: "flows",
      title: "Review, reproduce, and probe"
    },
    {
      type: "links",
      links: [
        { label: "Repository", url: "https://github.com/evmts/tevm-effect" },
        { label: "CI", url: "https://github.com/evmts/tevm-effect/actions/workflows/ci.yml" },
        { label: "ZEVM", url: "https://github.com/evmts/zevm" },
        { label: "Voltaire", url: "https://github.com/evmts/voltaire" }
      ]
    }
  ]
})

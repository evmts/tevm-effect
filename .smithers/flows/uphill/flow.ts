/**
 * `uphill`: continuous metrics and hill climbing for `@tevm/effect`.
 *
 * Runs `uphill --compact` inside a durable Smithers CI job so pull requests and
 * scheduled audits score footprint, Effect/VibeLang quality, and architecture
 * against `.agents/uphill/uphill.baseline.yaml`.
 */
import { Flow } from "@smthrs/flow"
import { CiJob } from "@smthrs/sandbox"
import { Schema } from "effect"

const uphillJob = CiJob.make("uphill", {
  steps: [{
    name: "uphill",
    run: "npm exec --yes --package=bun@1.4.2 --package=uphill@0.0.11 -- sh -ec 'uphill check && uphill --compact && test -s .uphill/report.json'"
  }]
})

export default Flow.make("uphill", {
  description: "Score continuous footprint, quality, and architecture metrics with Uphill.",
  capabilities: ["sandbox:job"],
  effects: {
    reads: ["**"],
    writes: [".uphill/**"],
    mode: "expected",
    onConflict: "serialize",
    tier: "reversible"
  },
  modelInvocable: true,
  payload: { run: Schema.String, repo: Schema.String, sha: Schema.String, ref: Schema.String, event: Schema.String },
  success: CiJob.Result,
  body: (run) => uphillJob.call(run)
})

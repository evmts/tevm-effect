/**
 * `uphill`: continuous metrics and hill climbing for `@tevm/effect`.
 *
 * Runs `uphill --compact` inside a durable Smithers CI job so pull requests and
 * scheduled audits score footprint, Effect/VibeLang quality, and architecture
 * against `.agents/uphill/uphill.baseline.yaml`.
 */
import { Flow } from "@smthrs/flow"
import { Node } from "@smthrs/plan"
import { CiJob } from "@smthrs/sandbox"
import { Schema } from "effect"

const implementationVersion = "uphill/v1"

const uphillJob = CiJob.make("uphill", {
  steps: [
    {
      name: "install-uphill",
      run: "command -v uphill >/dev/null 2>&1 || curl -fsSL https://wevm.sh/uphill | sh"
    },
    {
      name: "uphill",
      run: "PATH=\"$HOME/.uphill/bin:$HOME/.bun/bin:$PATH\" uphill --compact"
    }
  ]
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
  payload: Schema.Struct({
    run: CiJob.Target.fields.run,
    repo: CiJob.Target.fields.repo,
    sha: CiJob.Target.fields.sha,
    ref: CiJob.Target.fields.ref
  }),
  success: CiJob.Result,
  body: Node.capture(
    { implementationVersion },
    (target: CiJob.Target) => uphillJob.call(target)
  )
})

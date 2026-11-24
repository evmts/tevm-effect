import { Smithers as S } from "@smthrs/targets"

// tevm-effect's build graph. The root PACKAGE.ts declares the targets; the
// files a target names are its inputs and their digests are its key, so
// `smthrs ci '//...'` reruns only targets whose inputs changed and replays the
// rest from `.smithers/cache` (synced through build.smithers.sh when tokens are
// present). Root `pnpm install --frozen-lockfile` runs first; smthrs itself
// is a root devDependency so declarations and the CLI share one `effect`.
export const runtime = S.Runtime.Node({ version: ">=26.4.0" })
export const packageManager = S.PackageManager.Pnpm({ version: "11.25.0", runtime })

export const Workspace = S.Workspace("evmts-tevm-effect", {
  repository: "evmts/tevm-effect",
  runtime,
  packageManager,
  nodeModules: S.Npm.NodeModules({ packageJson: S.file("//package.json") }),
  cache: S.Cache({
    directory: ".smithers/cache",
    hostDirectories: ["dist", ".vibe", "coverage"],
    remote: S.RemoteCache.make({
      endpoint: "https://build.smithers.sh",
      read: S.Secret("SMITHERS_CACHE_READ_TOKEN"),
      write: S.Secret("SMITHERS_CACHE_WRITE_TOKEN")
    })
  }),
  host: S.Host({ bins: ["node", "sh"] }),
  discovery: {
    prune: ["node_modules", "dist", ".vibe", "coverage", ".smithers/cache", ".smithers/reports"]
  }
})

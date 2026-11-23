// Node.js HTTP server Layer helper mounting tevm-effect's platform-agnostic
// `makeJsonRpcHttpRouter` on `@effect/platform-node`'s `NodeHttpServer`.

import { createServer } from "node:http"
import { NodeHttpServer } from "@effect/platform-node"

/** @throws {never} */
export function makeNodeHttpServerLayer(options: { readonly port: number; readonly host?: string }) {
  return NodeHttpServer.layer(createServer, {
    port: options.port,
    host: options.host ?? "127.0.0.1",
  })
}

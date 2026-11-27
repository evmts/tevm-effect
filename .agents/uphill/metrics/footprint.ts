import { appendFileSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { gzipSync } from "node:zlib";

const out = process.env.UPHILL_METRICS;
if (!out) {
  console.error("UPHILL_METRICS is not set");
  process.exit(1);
}

const root = process.cwd();
const lines: string[] = [];

function quote(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function walk(dir: string): string[] {
  const result: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if ([".jj", ".git", "node_modules", ".uphill", "dist", ".vibe"].includes(entry.name)) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) result.push(...walk(full));
    else result.push(full);
  }
  return result.sort();
}

const srcRoot = join(root, "src");
const allSrc = walk(srcRoot).filter((f) => /\.(vibe|ts)$/.test(f) && !f.includes(".test."));

// Map each public export surface to its constituent source files.
const surfaces: Record<string, (rel: string) => boolean> = {
  ".": (rel) =>
    !rel.startsWith("src/platform/") &&
    !rel.startsWith("src/testing/") &&
    !rel.startsWith("src/voltaire/"),
  "./platform/node": (rel) => rel.startsWith("src/platform/"),
  "./testing": (rel) => rel.startsWith("src/testing/"),
  "./voltaire": (rel) => rel.startsWith("src/voltaire/"),
};

for (const [surface, matcher] of Object.entries(surfaces)) {
  const matched = allSrc.filter((f) => matcher(relative(root, f)));
  const combined = Buffer.concat(matched.map((f) => readFileSync(f)));
  const gz = gzipSync(combined, { level: 9 }).length;
  lines.push(`surface-bytes ${quote(surface)} ${gz}B`);
}

for (const file of allSrc) {
  const rel = relative(root, file);
  const lineCount = readFileSync(file, "utf8").split("\n").length;
  lines.push(`module-lines ${quote(rel)} ${lineCount}`);
}

const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
  dependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
};
lines.push(`runtime-deps dependencies ${Object.keys(pkg.dependencies ?? {}).length}`);
lines.push(`runtime-deps peerDependencies ${Object.keys(pkg.peerDependencies ?? {}).length}`);

appendFileSync(out, `${lines.join("\n")}\n`);

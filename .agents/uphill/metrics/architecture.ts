import { appendFileSync, existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

const out = process.env.UPHILL_METRICS;
if (!out) {
  console.error("UPHILL_METRICS is not set");
  process.exit(1);
}

const root = process.cwd();
const outLines: string[] = [];

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
const subsystems = readdirSync(srcRoot, { withFileTypes: true })
  .filter((e) => e.isDirectory())
  .map((e) => e.name)
  .sort();

for (const sub of subsystems) {
  const files = walk(join(srcRoot, sub)).filter((f) => /\.(vibe|ts)$/.test(f));
  const testFiles = files.filter((f) => f.includes(".test."));
  const prodFiles = files.filter((f) => !f.includes(".test."));
  const prodLines = prodFiles.reduce((acc, f) => acc + readFileSync(f, "utf8").split("\n").length, 0);
  const testLines = testFiles.reduce((acc, f) => acc + readFileSync(f, "utf8").split("\n").length, 0);

  if (testFiles.length === 0) {
    outLines.push(
      `subsystem-tests ${quote(`src/${sub}`)} fail note ${quote(`0 test files covering ${prodFiles.length} source files (${prodLines} lines)`)}`,
    );
  } else {
    outLines.push(`subsystem-tests ${quote(`src/${sub}`)} pass`);
  }

  const ratio = prodLines > 0 ? Math.round((testLines / prodLines) * 100) : 100;
  outLines.push(`test-ratio ${quote(`src/${sub}`)} ${ratio}`);
}

// Check package.json export source entries
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
  exports?: Record<string, string | Record<string, string>>;
};
for (const [subpath, target] of Object.entries(pkg.exports ?? {})) {
  if (typeof target === "object" && target["vibelang-source"]) {
    const srcPath = join(root, target["vibelang-source"]);
    if (existsSync(srcPath)) {
      outLines.push(`docs-and-exports ${quote(`export:${subpath}`)} pass`);
    } else {
      outLines.push(
        `docs-and-exports ${quote(`export:${subpath}`)} fail note ${quote(`missing ${target["vibelang-source"]}`)}`,
      );
    }
  }
}

// Check local Markdown links in README.md and AGENTS.md
for (const docFile of ["README.md", "AGENTS.md"]) {
  const full = join(root, docFile);
  if (!existsSync(full)) {
    outLines.push(`docs-and-exports ${quote(docFile)} fail note "missing required documentation file"`);
    continue;
  }
  const content = readFileSync(full, "utf8");
  const linkRe = /\[[^\]]+\]\(([^)]+)\)/g;
  let broken: string | null = null;
  let m: RegExpExecArray | null;
  while ((m = linkRe.exec(content)) !== null) {
    const href = m[1]!.split("#")[0]!;
    if (!href || /^(?:https?:|mailto:|#)/.test(href)) continue;
    const resolved = resolve(dirname(full), href);
    if (!existsSync(resolved)) {
      broken = `broken link ${href}`;
      break;
    }
  }
  if (broken) {
    outLines.push(`docs-and-exports ${quote(docFile)} fail note ${quote(broken)}`);
  } else {
    outLines.push(`docs-and-exports ${quote(docFile)} pass`);
  }
}

appendFileSync(out, `${outLines.join("\n")}\n`);

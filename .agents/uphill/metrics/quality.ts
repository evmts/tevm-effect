import { appendFileSync, readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

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

function findFirstLine(content: string, regex: RegExp): { line: number; match: string } | null {
  const lines = content.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i]!.match(regex);
    if (m) return { line: i + 1, match: m[0] };
  }
  return null;
}

function checkLongFunctions(content: string): { name: string; line: number; length: number } | null {
  // Custom brace-depth measurement for VibeLang & TypeScript functions (TigerStyle 70-line limit).
  const fnRe = /(?:export\s+)?(?:async\s+)?(?:effect\s+)?function\s+([A-Za-z0-9_]+)/g;
  let worst: { name: string; line: number; length: number } | null = null;
  let m: RegExpExecArray | null;
  while ((m = fnRe.exec(content)) !== null) {
    const startIdx = m.index;
    const startLine = content.slice(0, startIdx).split("\n").length;
    const braceIdx = content.indexOf("{", startIdx);
    if (braceIdx === -1) continue;
    let depth = 0;
    let i = braceIdx;
    let inStr: string | null = null;
    for (; i < content.length; i++) {
      const ch = content[i]!;
      const prev = i > 0 ? content[i - 1] : "";
      if (inStr) {
        if (ch === inStr && prev !== "\\") inStr = null;
        continue;
      }
      if (ch === '"' || ch === "'" || ch === "`") {
        inStr = ch;
        continue;
      }
      if (ch === "{") depth++;
      else if (ch === "}") {
        depth--;
        if (depth === 0) break;
      }
    }
    const len = content.slice(startIdx, i + 1).split("\n").length;
    if (len > 70 && (!worst || len > worst.length)) {
      worst = { name: m[1]!, line: startLine, length: len };
    }
  }
  return worst;
}

const files = walk(join(root, "src")).filter((f) => /\.(vibe|ts)$/.test(f) && !f.includes(".test."));

for (const file of files) {
  const rel = relative(root, file);
  const content = readFileSync(file, "utf8");
  const lines = content.split("\n");

  // 1. Platform isolation (core src/ outside src/platform/ must not import node:*)
  if (!rel.startsWith("src/platform/")) {
    const nodeImport = findFirstLine(content, /from\s+["']node:[^"']+["']|require\(["']node:[^"']+["']\)/);
    if (nodeImport) {
      outLines.push(
        `platform-isolation ${quote(rel)} fail note ${quote(`line ${nodeImport.line}: core module imports Node builtin (${nodeImport.match})`)}`,
      );
    } else {
      outLines.push(`platform-isolation ${quote(rel)} pass`);
    }
  }

  // 2. Typed errors (no raw throw new Error)
  const rawThrow = findFirstLine(content, /\bthrow\s+new\s+(?:Error|TypeError|RangeError)\b/);
  if (rawThrow) {
    outLines.push(
      `typed-errors ${quote(rel)} fail note ${quote(`line ${rawThrow.line}: raw ${rawThrow.match}; use Data.TaggedError / VibeLang error`)}`,
    );
  } else {
    outLines.push(`typed-errors ${quote(rel)} pass`);
  }

  // 3. Type escape hatches
  const escapeHatch = findFirstLine(
    content,
    /\bas\s+any\b|:\s*any\b|\bas\s+unknown\s+as\b|@ts-ignore|@ts-expect-error/,
  );
  if (escapeHatch) {
    outLines.push(
      `type-escape-hatches ${quote(rel)} fail note ${quote(`line ${escapeHatch.line}: type escape hatch (${escapeHatch.match})`)}`,
    );
  } else {
    outLines.push(`type-escape-hatches ${quote(rel)} pass`);
  }

  // 4. TigerStyle function length <= 70 lines
  const longFn = checkLongFunctions(content);
  if (longFn) {
    outLines.push(
      `function-length ${quote(rel)} fail note ${quote(`line ${longFn.line}: function ${longFn.name} is ${longFn.length} lines (> 70)`)}`,
    );
  } else {
    outLines.push(`function-length ${quote(rel)} pass`);
  }

  // 5. Effect boundaries (no Effect.runSync/runPromise/runFork inside library modules)
  const runEffect = findFirstLine(content, /\bEffect\.(?:runSync|runPromise|runFork)\b/);
  if (runEffect) {
    outLines.push(
      `effect-boundaries ${quote(rel)} fail note ${quote(`line ${runEffect.line}: ${runEffect.match} inside library code`)}`,
    );
  } else {
    outLines.push(`effect-boundaries ${quote(rel)} pass`);
  }

  // 6. Hygiene (console.*, TODO/FIXME, lines > 120 chars)
  const consoleHit = findFirstLine(content, /\bconsole\.(?:log|warn|error|debug|info)\s*\(/);
  const todoHit = findFirstLine(content, /\b(?:TODO|FIXME|HACK|XXX)\b/);
  const longLineIdx = lines.findIndex((l) => l.length > 120);
  if (consoleHit) {
    outLines.push(
      `hygiene ${quote(rel)} fail note ${quote(`line ${consoleHit.line}: stray ${consoleHit.match}`)}`,
    );
  } else if (todoHit) {
    outLines.push(
      `hygiene ${quote(rel)} fail note ${quote(`line ${todoHit.line}: unresolved ${todoHit.match}`)}`,
    );
  } else if (longLineIdx !== -1) {
    outLines.push(
      `hygiene ${quote(rel)} fail note ${quote(`line ${longLineIdx + 1}: line is ${lines[longLineIdx]!.length} chars (> 120)`)}`,
    );
  } else {
    outLines.push(`hygiene ${quote(rel)} pass`);
  }
}

appendFileSync(out, `${outLines.join("\n")}\n`);

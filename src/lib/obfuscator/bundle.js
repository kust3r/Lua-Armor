import { readFileSync, existsSync } from "node:fs";
import { dirname, resolve, isAbsolute, join } from "node:path";
function tryResolve(spec, fromDir, entryDir) {
  const candidates = [];
  if (spec.startsWith("./") || spec.startsWith("../") || isAbsolute(spec)) {
    const base = isAbsolute(spec) ? spec : resolve(fromDir, spec);
    candidates.push(base, base + ".lua", base + ".luau", join(base, "init.lua"), join(base, "init.luau"));
  } else {
    const rel = spec.replace(/\./g, "/");
    for (const root of [fromDir, entryDir]) {
      candidates.push(
        join(root, rel + ".lua"),
        join(root, rel + ".luau"),
        join(root, rel, "init.lua"),
        join(root, rel, "init.luau")
      );
    }
  }
  for (const c of candidates) if (existsSync(c)) return c;
  return null;
}
function escapeLuaString(s) {
  let level = 0;
  while (s.includes("]" + "=".repeat(level) + "]")) level++;
  const eq = "=".repeat(level);
  return `[${eq}[
${s}
]${eq}]`;
}
function scan(spec, fromDir, ctx) {
  const resolved = tryResolve(spec, fromDir, ctx.entryDir);
  if (!resolved) throw new Error(`bundle: cannot resolve module '${spec}' from ${fromDir}`);
  if (ctx.visited.has(resolved)) return;
  ctx.visited.add(resolved);
  const src = readFileSync(resolved, "utf8");
  ctx.modules.set(spec, src);
  const reqRe = /\b(?:require|bundle\s*\.\s*require)\s*\(\s*(['"])([^'"]+)\1\s*\)/g;
  let m;
  while ((m = reqRe.exec(src)) !== null) {
    try {
      scan(m[2], dirname(resolved), ctx);
    } catch (e) {
      throw new Error(`bundle: ${e.message} (required from ${resolved})`);
    }
  }
  const jsonRe = /\bbundle\s*\.\s*json\s*\(\s*(['"])([^'"]+)\1\s*\)/g;
  while ((m = jsonRe.exec(src)) !== null) {
    const p = tryResolve(m[2], dirname(resolved), ctx.entryDir);
    if (!p) throw new Error(`bundle.json: cannot find ${m[2]}`);
    ctx.jsonAssets.set(m[2], readFileSync(p, "utf8"));
  }
  const readRe = /\bbundle\s*\.\s*read\s*\(\s*(['"])([^'"]+)\1\s*\)/g;
  while ((m = readRe.exec(src)) !== null) {
    const p = tryResolve(m[2], dirname(resolved), ctx.entryDir);
    if (!p) throw new Error(`bundle.read: cannot find ${m[2]}`);
    ctx.textAssets.set(m[2], readFileSync(p, "utf8"));
  }
}
async function bundle(entryPath) {
  const abs = resolve(entryPath);
  if (!existsSync(abs)) throw new Error(`bundle: entry not found: ${abs}`);
  const ctx = {
    entryDir: dirname(abs),
    modules: /* @__PURE__ */ new Map(),
    jsonAssets: /* @__PURE__ */ new Map(),
    textAssets: /* @__PURE__ */ new Map(),
    visited: /* @__PURE__ */ new Set()
  };
  const entrySrc = readFileSync(abs, "utf8");
  ctx.visited.add(abs);
  const tmpEntrySpec = "__entry__";
  ctx.modules.set(tmpEntrySpec, entrySrc);
  const reqRe = /\b(?:require|bundle\s*\.\s*require)\s*\(\s*(['"])([^'"]+)\1\s*\)/g;
  let m;
  while ((m = reqRe.exec(entrySrc)) !== null) {
    scan(m[2], ctx.entryDir, ctx);
  }
  const jsonRe = /\bbundle\s*\.\s*json\s*\(\s*(['"])([^'"]+)\1\s*\)/g;
  while ((m = jsonRe.exec(entrySrc)) !== null) {
    const p = tryResolve(m[2], ctx.entryDir, ctx.entryDir);
    if (!p) throw new Error(`bundle.json: cannot find ${m[2]}`);
    ctx.jsonAssets.set(m[2], readFileSync(p, "utf8"));
  }
  const readRe = /\bbundle\s*\.\s*read\s*\(\s*(['"])([^'"]+)\1\s*\)/g;
  while ((m = readRe.exec(entrySrc)) !== null) {
    const p = tryResolve(m[2], ctx.entryDir, ctx.entryDir);
    if (!p) throw new Error(`bundle.read: cannot find ${m[2]}`);
    ctx.textAssets.set(m[2], readFileSync(p, "utf8"));
  }
  ctx.modules.delete(tmpEntrySpec);
  const lines = [];
  lines.push("-- bundled by lurapy bundle.ts");
  lines.push("local __loaders = {}");
  for (const [name, src] of ctx.modules) {
    lines.push(`__loaders[${JSON.stringify(name)}] = function(...) ${src}
end`);
  }
  lines.push("local __cache = {}");
  lines.push("local __origRequire = require");
  lines.push("function require(name)");
  lines.push("  if __cache[name] ~= nil then return __cache[name] end");
  lines.push("  local ld = __loaders[name]");
  lines.push("  if ld == nil then return __origRequire(name) end");
  lines.push("  local r = ld(name); if r == nil then r = true end");
  lines.push("  __cache[name] = r; return r");
  lines.push("end");
  lines.push("local __assets = {}");
  for (const [k, v] of ctx.textAssets) {
    lines.push(`__assets[${JSON.stringify(k)}] = ${escapeLuaString(v)}`);
  }
  lines.push("local __json = {}");
  for (const [k, v] of ctx.jsonAssets) {
    lines.push(`__json[${JSON.stringify(k)}] = ${escapeLuaString(v)}`);
  }
  lines.push('local function __decodeJson(s) local f, err = (loadstring or load)("return " .. (s:gsub("null","nil"):gsub(":", "="):gsub("\\"([%w_]-)\\"%s*=", "[\\"%1\\"]="))) if not f then error("bundle.json parse: "..tostring(err)) end return f() end');
  lines.push("bundle = { require = require, read = function(p) return __assets[p] end, json = function(p) return __decodeJson(__json[p]) end }");
  lines.push("-- entry --");
  lines.push(entrySrc);
  return lines.join("\n");
}
export {
  bundle
};

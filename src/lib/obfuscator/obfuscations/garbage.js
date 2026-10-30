const CHARS = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
function rndName(prefix = "_g") {
  const len = Math.floor(Math.random() * 4) + 2;
  let name = prefix;
  for (let i = 0; i < len; i++) {
    name += CHARS[Math.floor(Math.random() * CHARS.length)];
  }
  return name;
}
function rndInt(min = 0, max = 999) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
const garbageGenerators = [
  // Dead variable assignment
  () => {
    const v = rndName();
    return `local ${v}=${rndInt()}`;
  },
  // Unused function
  () => {
    const fn = rndName("_fn");
    const p1 = rndName("_p");
    const p2 = rndName("_p");
    return `local function ${fn}(${p1},${p2}) return ${p1}+${p2}+${rndInt()} end`;
  },
  // Dead loop
  () => {
    const v = rndName();
    const i = rndName("_i");
    return `local ${v}=0;for ${i}=1,${rndInt(2, 8)} do ${v}=${v}+${i} end`;
  },
  // False branch (never executes)
  () => {
    const v = rndName();
    return `if false then local ${v}=${rndInt()};${v}=${v}+1 end`;
  },
  // Nil comparison branch
  () => {
    const v = rndName();
    return `if nil then local ${v}="dead" end`;
  },
  // Impossible numeric check
  () => {
    const n = rndInt(10, 100);
    const v = rndName();
    return `local ${v}=${n};if ${v}<0 and ${v}>0 then ${v}=${v}+1 end`;
  },
  // Table construction + discard
  () => {
    const t = rndName("_t");
    return `local ${t}={${rndInt()},${rndInt()},${rndInt()},["${rndName()}"]=true}`;
  },
  // String manipulation (dead)
  () => {
    const s = rndName("_s");
    const l = rndName("_l");
    return `local ${s}="${rndName()}${rndInt()}";local ${l}=#${s}`;
  },
  // Nested function (dead)
  () => {
    const outer = rndName("_of");
    const inner = rndName("_if");
    const p = rndName("_x");
    return `local ${outer}=function(${p}) local ${inner}=function() return ${p}+${rndInt()} end;return ${inner} end`;
  },
  // While false (never runs)
  () => {
    const v = rndName();
    return `while false do local ${v}=${rndInt()};break end`;
  },
  // Repeat until true (runs once but does nothing meaningful)
  () => {
    const v = rndName();
    return `local ${v}=${rndInt()};repeat ${v}=${v}-1 until true`;
  },
  // Pcall wrapper (dead)
  () => {
    const v = rndName();
    return `local ${v};pcall(function() ${v}=${rndInt()} end)`;
  },
  // Coroutine (dead)
  () => {
    const v = rndName();
    return `local ${v}=coroutine.wrap(function() coroutine.yield(${rndInt()}) end)`;
  },
  // Select trick
  () => {
    const v = rndName();
    return `local ${v}=select(1,${rndInt()},${rndInt()},${rndInt()})`;
  },
  // Metatable trick (anti-deobfuscation)
  () => {
    const t = rndName("_mt");
    const v = rndName();
    return `local ${t}=setmetatable({},{__index=function() return ${rndInt()} end});local ${v}=${t}[${rndInt()}]`;
  },
  // Type check dead branch
  () => {
    const n = rndInt();
    return `if type(${n})=="string" then error("unreachable") end`;
  },
  // Math identity assertion
  () => {
    const n = rndInt(1, 50);
    const v = rndName();
    return `local ${v}=${n}*${n};if ${v}<0 then error("math broken") end`;
  },
  // String byte extraction (dead)
  () => {
    const s = rndName("_s");
    const b = rndName("_b");
    return `local ${s}="${rndName()}";local ${b}=string.byte(${s},1)`;
  },
  // Tostring/tonumber chain
  () => {
    const v = rndName();
    return `local ${v}=tonumber(tostring(${rndInt()}))+${rndInt(1, 10)}`;
  },
  // Multi-return dead call
  () => {
    const fn = rndName("_mr");
    const a = rndName();
    const b = rndName();
    return `local function ${fn}() return ${rndInt()},${rndInt()},${rndInt()} end;local ${a},${b}=${fn}()`;
  }
];
function generateGarbage(count = 5) {
  const stmts = [];
  for (let i = 0; i < count; i++) {
    const gen = garbageGenerators[Math.floor(Math.random() * garbageGenerators.length)];
    stmts.push(gen());
  }
  for (let i = stmts.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [stmts[i], stmts[j]] = [stmts[j], stmts[i]];
  }
  return stmts.join(";") + ";";
}
function injectGarbage(source, intensity = 3) {
  const lines = source.split(";");
  const result = [];
  for (let i = 0; i < lines.length; i++) {
    result.push(lines[i]);
    if (i > 0 && i % Math.max(5, Math.floor(15 / intensity)) === 0) {
      const count = Math.floor(Math.random() * intensity) + 1;
      result.push(generateGarbage(count));
    }
  }
  return result.join(";");
}
function generateGarbageWrapper() {
  const stateVar = rndName("_ws");
  const targetState = rndInt(100, 999);
  const prefix = [
    `local ${stateVar}=${targetState}`,
    `if ${stateVar}==${targetState} then`
  ].join(";") + ";";
  const fakeElse = generateGarbage(3);
  const suffix = `else ${fakeElse} end`;
  return { prefix, suffix };
}
export {
  garbageGenerators,
  generateGarbage,
  generateGarbageWrapper,
  injectGarbage,
  rndInt,
  rndName
};

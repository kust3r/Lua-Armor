import { analyzePrototype, macroEligibility } from "./function-ir";
import { binaryToBytes, numberLiteral, quoteBytes } from "./literal-values";
import { LuaDiagnostic } from "./diagnostics";
import { selectHardenedFusions } from "./hardened-patterns";
const M = 16777216;
const rnd = (n) => Math.floor(Math.random() * n);
const shuffled = (values) => {
  const out = [...values];
  for (let i = out.length - 1; i > 0; i--) {
    const j = rnd(i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};
const operators = { ADD: "+", SUB: "-", MUL: "*", DIV: "/", MOD: "%", POW: "^", EQ: "==", LT: "<", LE: "<=" };
const capsuleChecksum = (bytes) => {
  let h = 1;
  for (let i = 0; i < bytes.length; i++) h = (h * 131 + bytes[i] + i + 1) % M;
  return h;
};
const capsuleRollStart = (state, functionSalt, regionSalt) => (state * 97 + functionSalt * 17 + regionSalt * 13) % M;
const capsuleRollNext = (roll, checksum, site, length) => (roll * 131 + checksum * 17 + site + length * 29) % M;
function generateHardenedVM(proto, opcodes, mode = "full") {
  const materializerCount = 12;
  const materializerOrder = shuffled(Array.from({ length: materializerCount }, (_, index) => index));
  const stats = { version: 4, revision: 3, regions: 0, capsules: 0, capsuleReuses: 0, macros: {}, families: [0, 0, 0], materializers: Array(materializerCount).fill(0), layouts: [] };
  const carrierPlans = Array.from({ length: 3 }, () => {
    const multiplier = 1 + 2 * rnd(128);
    const offset = rnd(256);
    const bytes = Array(256);
    for (let byte = 0; byte < 256; byte++) bytes[(byte * multiplier + offset) % 256] = byte;
    return { multiplier, offset, bytes };
  });
  const descriptorFields = ["e", "a", "w", "m", "b", "h", "z", "t", "o", "r", "u", "n", "c"];
  const descriptorLayouts = Array.from({ length: materializerCount }, () => shuffled(descriptorFields));
  const descriptorIndex = descriptorLayouts.map((layout) => Object.fromEntries(layout.map((name, index) => [name, index + 1])));
  const virtual = (p) => ({ ...p, nativeSource: void 0, protos: p.protos.map(virtual) });
  const ir = analyzePrototype(virtual(proto), opcodes);
  const factories = [];
  let serial = 0;
  function emit(p, info) {
    const id = ++serial;
    const children = p.protos.map((c, i) => emit(c, info.children[i]));
    if (p.nativeSource !== void 0) {
      factories.push(`P[${id}]=function(U,G) return (${p.nativeSource})(U,G,function(k,v) local ids={${children.join(",")}};return P[ids[k+1]](v,G) end) end;`);
      return id;
    }
    const regions = [];
    const limit = mode === "constants" ? 1 : 24 + rnd(17);
    const functionSalt = 1 + rnd(16e6);
    const frameNames = ["B", "C", "X", "I", "M", "A", "E", "D", "Q", "K", "S", "Z", "H", "V", "T", "R", "O", "N", "J"];
    const frameSlots = Object.fromEntries(shuffled(frameNames).map((name, index) => [name, index + 1]));
    const f = (name) => `F[${frameSlots[name]}]`;
    const [B, C0, X, I0, MM, A0, E0, DD, Q, K0, S0, Z0, H0, V0, T0, RR, OO, NN, JJ] = frameNames.map(f);
    const capsuleDescriptors = [];
    const descriptorKeys = /* @__PURE__ */ new Set();
    const eligible = mode === "full" ? [...macroEligibility({ ...info, children: [] }).filter((e) => e.eligible && e.pattern !== "ARITHMETIC_RETURN"), ...selectHardenedFusions(info, p)] : [];
    const tokens = /* @__PURE__ */ new Set();
    for (const block of info.blocks) {
      for (let at = 0; at < block.operations.length; ) {
        let end = Math.min(block.operations.length, at + limit);
        for (const e of eligible) if (e.pcs[0] >= block.operations[at].pc && e.pcs[0] <= block.operations[end - 1].pc) end = Math.max(end, block.operations.findIndex((o) => o.pc === e.pcs[e.pcs.length - 1]) + 1);
        const ops = block.operations.slice(at, end);
        let token = 0;
        do
          token = 100 + rnd(16e6);
        while (tokens.has(token));
        tokens.add(token);
        const map = mode === "constants" ? Array.from({ length: p.maxReg + 1 }, (_, i) => i + 1) : shuffled(Array.from({ length: p.maxReg + 1 }, (_, i) => i + 1));
        const live = new Set(block.liveOut);
        for (const o of block.operations.slice(end).reverse()) {
          for (const w of o.writes) if (typeof w !== "number" || !info.captured.includes(w)) live.delete(w);
          for (const r of o.reads) live.add(r);
        }
        for (const o of [...ops].reverse()) {
          for (const w of o.writes) if (typeof w !== "number" || !info.captured.includes(w)) live.delete(w);
          for (const r of o.reads) live.add(r);
        }
        const familyRoll = rnd(100);
        const family = mode === "constants" ? 0 : familyRoll < 65 ? 0 : familyRoll < 83 ? 1 : 2;
        regions.push({ ops, start: ops[0].pc, token, salt: 1 + rnd(8e6), family, map, live: [...live], entryStates: [] });
        at = end;
      }
    }
    if (mode !== "constants" && regions.length >= 3) for (let i = 0; i < 3; i++) regions[i].family = i;
    const byPc = new Map(regions.map((r) => [r.start, r]));
    const controlStates = /* @__PURE__ */ new Set();
    const allocateState = () => {
      let value = 0;
      do
        value = 1 + rnd(M - 1);
      while (controlStates.has(value));
      controlStates.add(value);
      return value;
    };
    const entryState = allocateState();
    regions[0]?.entryStates.push(entryState);
    const edgeStates = /* @__PURE__ */ new Map();
    for (const from of regions) {
      const last = from.ops[from.ops.length - 1];
      for (const target of last.successors) {
        const to = byPc.get(target);
        if (!to) continue;
        const edge = `${from.start}:${target}`;
        if (!edgeStates.has(edge)) edgeStates.set(edge, allocateState());
        const acceptedState = edgeStates.get(edge);
        if (acceptedState === void 0) throw new Error(`V4_EDGE_STATE:${id}:${from.start}:${target}`);
        to.entryStates.push(acceptedState);
      }
    }
    for (const region of regions) {
      region.entryStates = [...new Set(region.entryStates)];
      if (region.entryStates.length === 0) region.entryStates.push(allocateState());
    }
    const captured = new Set(info.captured);
    const bodies = /* @__PURE__ */ new Map();
    const read = (r, n) => captured.has(n) ? `${C0}[${n}][1]` : n <= p.maxReg ? `${B}[${r.map[n]}]` : `${X}[${n}]`;
    const getDynamic = (_r, n, dest) => `local ${dest};if ${n}>${p.maxReg} then ${dest}=${X}[${n}] elseif ${C0}[${n}] then ${dest}=${C0}[${n}][1] else ${dest}=${B}[${MM}[${n}+1]] end;`;
    const setDynamic = (_r, n, value) => `if ${n}>${p.maxReg} then ${X}[${n}]=${value} elseif ${C0}[${n}] then ${C0}[${n}][1]=${value} else ${B}[${MM}[${n}+1]]=${value} end;`;
    const integrity = (q, d, e, salt) => `((${q})*97+(${d})*17+(${e})*13+${salt})%${M}`;
    const transition = (from, target) => {
      const to = byPc.get(target);
      if (!to) {
        if (target === info.exit) return `${H0}=true;${V0}={n=0};`;
        throw new Error(`V4_REGION_TARGET:${id}:${target}`);
      }
      const copies = to.live.filter((s) => typeof s === "number" && !captured.has(s)).map((s) => `N[${to.map[s]}]=${read(from, s)};`).join("");
      const edge = 1 + rnd(1e6);
      const state = edgeStates.get(`${from.start}:${target}`);
      if (state === void 0) throw new Error(`V4_EDGE_STATE:${id}:${from.start}:${target}`);
      const back = target <= from.start;
      const resets = to.ops.filter((o) => o.name === "TFORLOOP" && !back).map((o) => `${I0}[${o.pc}]=nil;`).join("");
      return `do local N={};${copies}${B}=N;${resets}${back ? `${E0}=(${E0}+1)%${M};` : ""}${DD}=(${DD}*33+${edge}+${E0})%${M};${Q}=${state};${K0}=${integrity(Q, DD, E0, to.salt)};${S0}=${to.token};end;`;
    };
    const numericKey = (roll, site) => {
      let x = (roll + site * 40503) % M;
      x = (x * 97 + Math.floor(x / 256) * 193 + site) % M;
      return (x + Math.floor(x / 65536) * 29 + site * 7) % 256;
    };
    const capsule = (r, o) => {
      const value = p.constants[o.b];
      if (value === null) return "nil";
      if (typeof value === "boolean") return String(value);
      if (mode === "regions") return typeof value === "number" ? numberLiteral(value) : quoteBytes(binaryToBytes(value));
      const cacheIdentity = `${o.b}:${typeof value}`;
      const reused = r.capsuleCache?.get(cacheIdentity);
      if (reused) {
        stats.capsuleReuses++;
        return `${NN}[${reused}]`;
      }
      const site = 1 + rnd(1e6), family = materializerOrder[rnd(materializerCount)], shape = Math.floor(family / 3), stride = 1 + rnd(63);
      const text = typeof value === "number" ? Object.is(value, -0) ? "-0" : String(value) : value;
      const bytes = binaryToBytes(text);
      const checksum = capsuleChecksum(bytes);
      const ordinal = (r.capsuleOrdinal ?? 0) + 1;
      r.capsuleOrdinal = ordinal;
      const reverse = shape % 2 === 1;
      const variants = r.entryStates.map((state) => {
        const roll = r.capsuleRolls?.get(state);
        if (roll === void 0) throw new Error(`V4_CAPSULE_ROLL:${id}:${r.start}:${state}`);
        const k = numericKey(roll, site);
        const encoded = bytes.map((b, i) => (b + k + (i + 1) * stride) % 256);
        return { state, roll, payload: quoteBytes(reverse ? [...encoded].reverse() : encoded) };
      });
      const selectorModuli = [5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67, 71, 73, 79, 83, 89, 97, 101, 103, 107, 109, 113, 127, 131, 137, 139, 149, 151, 157, 163, 167, 173, 179, 181, 191, 193, 197, 199, 211, 223, 227, 229, 233, 239, 241, 251];
      let selector;
      for (let attempt = 0; attempt < 4096 && !selector; attempt++) {
        const modulus = selectorModuli[rnd(selectorModuli.length)];
        const multiplier = 1 + rnd(modulus - 1), offset = rnd(modulus);
        const slots = variants.map((variant) => (variant.roll * multiplier + offset) % modulus + 1);
        if (new Set(slots).size === slots.length) selector = { multiplier, offset, modulus, slots };
      }
      if (!selector) throw new Error(`V4_CAPSULE_SELECTOR:${id}:${o.pc}`);
      stats.capsules++;
      stats.materializers[family]++;
      const selectedSlots = selector.slots;
      const payloads = variants.map((variant, index) => `[${selectedSlots[index]}]=${variant.payload}`).join(",");
      let descriptorKey = 0;
      do
        descriptorKey = 1 + rnd(M - 1);
      while (descriptorKeys.has(descriptorKey));
      descriptorKeys.add(descriptorKey);
      const cacheKey = 1 + rnd(1048575);
      const tag = (checksum + site * 17 + ordinal * 31) % M;
      const fields = { e: `{${payloads}}`, a: site, w: stride, m: selector.multiplier, b: selector.offset, h: selector.modulus, z: typeof value === "number", t: tag, o: ordinal, r: frameSlots.R, u: frameSlots.O, n: frameSlots.N, c: cacheKey };
      capsuleDescriptors.push(`[${descriptorKey}]={${descriptorLayouts[family].map((name) => fields[name]).join(",")}}`);
      let lookupMultiplier = 0, lookupSalt = 0, lookupKeys = [];
      for (let attempt = 0; attempt < 4096; attempt++) {
        lookupMultiplier = 1 + 2 * rnd(128);
        lookupSalt = 1 + rnd(M - 1);
        lookupKeys = r.entryStates.map((state) => {
          const roll = r.capsuleRolls?.get(state);
          if (roll === void 0) throw new Error(`V4_CAPSULE_ROLL:${id}:${r.start}:${state}`);
          return (roll * lookupMultiplier + lookupSalt) % M;
        });
        if (new Set(lookupKeys).size === lookupKeys.length && lookupKeys.every((key) => !descriptorKeys.has(key))) break;
        lookupKeys = [];
      }
      if (lookupKeys.length === 0) throw new Error(`V4_CAPSULE_LOOKUP:${id}:${o.pc}`);
      for (const key of lookupKeys) {
        descriptorKeys.add(key);
        capsuleDescriptors.push(`[${key}]=${descriptorKey}`);
      }
      r.capsuleCache?.set(cacheIdentity, cacheKey);
      for (const state of r.entryStates) {
        const roll = r.capsuleRolls?.get(state);
        if (roll === void 0) throw new Error(`V4_CAPSULE_ROLL:${id}:${r.start}:${state}`);
        r.capsuleRolls.set(state, capsuleRollNext(roll, checksum, site, bytes.length));
      }
      return `D${family + 1}(F,${JJ}[${JJ}[(${RR}*${lookupMultiplier}+${lookupSalt})%${M}]])`;
    };
    const checkpoint = (count = 1) => `${Z0}=${Z0}+${count};`;
    const invoke = (r, o, fn) => {
      const args = o.b === 0 ? `(${T0} or ${o.a - 1})-${o.a}` : String(o.b - 1);
      const count = o.c === 0 ? "v.n" : String(o.c - 1);
      return `do local f=${fn ?? read(r, o.a)};local t={};local n=${args};for i=1,n do ${getDynamic(r, `${o.a}+i`, "x")}t[i]=x end;local v=pack(f(unpack(t,1,n)));${o.name === "TAILCALL" ? `${V0}=v;${H0}=true;` : `${o.c === 0 ? `${T0}=${o.a}+v.n-1;` : ""}for i=1,${count} do ${setDynamic(r, `${o.a}+i-1`, "v[i]")}end;`}end;`;
    };
    const conditional = (r, expression, yes, no) => `if ${expression} then ${transition(r, yes)}else ${transition(r, no)}end;`;
    const condition = (r, o, expr = read(r, o.a)) => o.c === 0 ? `not (${expr})` : o.c === 2 ? `(${expr})==nil` : o.c === 1 || o.c === 3 ? expr : "false";
    function operation(r, o) {
      const a = read(r, o.a), b = read(r, o.b), c = read(r, o.c);
      if (operators[o.name]) return `${a}=(${b}${operators[o.name]}${c});`;
      switch (o.name) {
        case "LOADK":
          return `${a}=${capsule(r, o)};`;
        case "GETGLOBAL":
          return `${a}=G[${capsule(r, o)}];`;
        case "SETGLOBAL":
          return `G[${capsule(r, o)}]=${a};`;
        case "LOADNIL":
          return Array.from({ length: o.b - o.a + 1 }, (_, i) => `${read(r, o.a + i)}=nil;`).join("");
        case "LOADBOOL":
          return `${a}=${o.b !== 0};${o.c !== 0 ? transition(r, o.pc + 2) : ""}`;
        case "MOVE":
          return `${a}=${b};`;
        case "GETUPVAL":
          return `${a}=U[${o.b}][1];`;
        case "SETUPVAL":
          return `U[${o.b}][1]=${a};`;
        case "GETTABLE":
          return `${a}=${b}[${c}];`;
        case "SETTABLE":
          return `${a}[${b}]=${c};`;
        case "NEWTABLE":
          return `${a}={};`;
        case "SELF":
          return `${read(r, o.a + 1)}=${b};${a}=${b}[${c}];`;
        case "FLOORDIV":
          return `${a}=math.floor(${b}/${c});`;
        case "UNM":
          return `${a}=-${b};`;
        case "NOT":
          return `${a}=not ${b};`;
        case "LEN":
          return `${a}=#${b};`;
        case "CONCAT": {
          let e = read(r, o.c);
          for (let j = o.c - 1; j >= o.b; j--) e = `${read(r, j)}..(${e})`;
          return `${a}=(${e});`;
        }
        case "JMP":
          return transition(r, o.a);
        case "JMPIF":
          return conditional(r, condition(r, o), o.b, o.pc + 1);
        case "TEST":
          return conditional(r, `(not not ${a})~=${o.c !== 0}`, o.pc + 2, o.pc + 1);
        case "TESTSET":
          return `if (not not ${b})==${o.c !== 0} then ${a}=${b};${transition(r, o.pc + 1)}else ${transition(r, o.pc + 2)}end;`;
        case "CALL":
        case "TAILCALL":
          return invoke(r, o);
        case "RETURN":
          return `do local v={n=${o.b === 0 ? `(${T0} or ${o.a - 1})-${o.a}+1` : o.b - 1}};for i=1,v.n do ${getDynamic(r, `${o.a}+i-1`, "x")}v[i]=x end;${V0}=v;${H0}=true;end;`;
        case "VARARG":
          return `for i=1,${o.b === 0 ? `${A0}.n` : o.b - 1} do ${setDynamic(r, `${o.a}+i-1`, `${A0}[i]`)}end;${o.b === 0 ? `${T0}=${o.a}+${A0}.n-1;` : ""}`;
        case "SETLIST":
          return `for i=1,${o.b === 0 ? `(${T0} or ${o.a})-${o.a}` : o.b} do ${getDynamic(r, `${o.a}+i`, "x")}${a}[${o.c}+i]=x end;`;
        case "CLOSE":
          return Array.from({ length: o.b - o.a + 1 }, (_, i) => captured.has(o.a + i) ? `${C0}[${o.a + i}]={${read(r, o.a + i)}};` : "").join("");
        case "CLOSURE": {
          const child = p.protos[o.b];
          if (!child) throw new Error("V4_CHILD");
          return `${a}=P[${children[o.b]}]({${child.upvalues.map((u, i) => `[${i}]=${u.source === 0 ? `${C0}[${u.index}]` : `U[${u.index}]`}`).join(",")}},G);`;
        }
        case "FORPREP":
          return `do local x=tonumber(${a});if x==nil then error("invalid for initial",0) end;local y=tonumber(${read(r, o.a + 1)});if y==nil then error("invalid for limit",0) end;local z=tonumber(${read(r, o.a + 2)});if z==nil then error("invalid for step",0) end;${a}=x;${read(r, o.a + 1)}=y;${read(r, o.a + 2)}=z;if (z>0 and x<=y) or (z<=0 and x>=y) then ${read(r, o.a + 3)}=x;${transition(r, o.pc + 1)}else ${transition(r, o.b + 1)}end;end;`;
        case "FORLOOP":
          return `do local z=${read(r, o.a + 2)};local x=${a}+z;${a}=x;if (z>0 and x<=${read(r, o.a + 1)}) or (z<=0 and x>=${read(r, o.a + 1)}) then ${read(r, o.a + 3)}=x;${transition(r, o.b)}else ${transition(r, o.pc + 1)}end;end;`;
        case "TFORLOOP":
          return `do local it,st=${a},${read(r, o.a + 1)};if not ${I0}[${o.pc}] then ${I0}[${o.pc}]=true;if type(it)=='table' then local ctrl;local mt=getmetatable(it);if type(mt)=='table' and rawget(mt,'__iter') then it,st,ctrl=mt.__iter(it) else it,st,ctrl=next,it,nil end;${a}=it;${read(r, o.a + 1)}=st;${read(r, o.a + 2)}=ctrl end end;local v=pack(it(st,${read(r, o.a + 2)}));${Array.from({ length: o.c }, (_, i) => `${read(r, o.a + 3 + i)}=v[${i + 1}];`).join("")}if v[1]~=nil then ${read(r, o.a + 2)}=v[1];${transition(r, o.pc + 2)}else ${I0}[${o.pc}]=nil;${transition(r, o.pc + 1)}end;end;`;
        default:
          throw new Error(`V4_UNSUPPORTED:${o.name}`);
      }
    }
    for (const r of regions) {
      r.capsuleCache = /* @__PURE__ */ new Map();
      r.capsuleOrdinal = 0;
      r.capsuleRolls = new Map(r.entryStates.map((state) => [state, capsuleRollStart(state, functionSalt, r.salt)]));
      const accepted = r.entryStates.map((state) => `${Q}==${state}`).join(" or ");
      let body = `${MM}={${r.map.join(",")}};if not(${accepted}) or ${K0}~=${integrity(Q, DD, E0, r.salt)} then error(731,0) end;${RR}=(${Q}*97+${functionSalt}*17+${r.salt}*13)%${M};${OO}=0;${NN}={};`;
      let terminated = false;
      for (let i = 0; i < r.ops.length; ) {
        const o = r.ops[i], y = r.ops[i + 1], z = r.ops[i + 2];
        const match = eligible.find((e) => e.pcs[0] === o.pc && e.pcs.every((pc) => r.ops.some((n) => n.pc === pc)) && rnd(4) !== 0);
        const countMacro = (n) => {
          stats.macros[n] = (stats.macros[n] ?? 0) + 1;
        };
        if (match && y && z && match.pattern === "LOADK_COMPARE_BRANCH") {
          const cmp = `(${y.b === o.a ? capsule(r, o) : read(r, y.b)}${operators[y.name]}${y.c === o.a ? capsule(r, o) : read(r, y.c)})`;
          body += checkpoint(3) + conditional(r, condition(r, z, cmp), z.b, z.pc + 1);
          countMacro(match.pattern);
          i += 3;
          terminated = true;
          continue;
        }
        if (match && y && match.pattern === "TABLE_CALL") {
          body += checkpoint(2) + `do local resolved=${read(r, o.b)}[${read(r, o.c)}];` + invoke(r, y, "resolved") + "end;";
          countMacro(match.pattern);
          i += 2;
          continue;
        }
        if (match && y && match.pattern === "GLOBAL_TABLE") {
          body += checkpoint(2) + `${read(r, y.a)}=G[${capsule(r, o)}][${read(r, y.c)}];`;
          countMacro(match.pattern);
          i += 2;
          continue;
        }
        if (match && y && z && match.pattern === "GLOBAL_KEY_TABLE") {
          body += checkpoint(3) + `do local object=G[${capsule(r, o)}];local property=${capsule(r, y)};${read(r, z.a)}=object[property];end;`;
          countMacro(match.pattern);
          i += 3;
          continue;
        }
        if (match && y && match.pattern === "ARITHMETIC_RETURN") {
          const e = o.name === "FLOORDIV" ? `math.floor(${read(r, o.b)}/${read(r, o.c)})` : `(${read(r, o.b)}${operators[o.name]}${read(r, o.c)})`;
          body += checkpoint(2) + `${V0}={n=1,${e}};${H0}=true;`;
          countMacro(match.pattern);
          i += 2;
          terminated = true;
          continue;
        }
        if (match && y && match.pattern === "CALL_BRANCH") {
          const args = Array.from({ length: o.b - 1 }, (_, j) => read(r, o.a + j + 1)).join(",");
          body += checkpoint(2) + `do local value=${read(r, o.a)}(${args});` + conditional(r, condition(r, y, "value"), y.b, y.pc + 1) + "end;";
          countMacro(match.pattern);
          i += 2;
          terminated = true;
          continue;
        }
        body += checkpoint() + operation(r, o);
        const last = r.ops[r.ops.length - 1];
        if (o === last && (o.successors.length !== 1 || o.successors[0] !== o.pc + 1 || ["RETURN", "TAILCALL", "JMP"].includes(o.name))) terminated = true;
        i++;
      }
      if (!terminated) body += transition(r, r.ops[r.ops.length - 1].successors[0] ?? info.exit);
      bodies.set(r, body);
      stats.regions++;
      stats.families[r.family]++;
      stats.layouts.push(r.map);
    }
    const entry = regions[0];
    if (!entry) throw new Error("V4_EMPTY");
    const closures = shuffled(regions.filter((r) => r.family !== 0)).map((r, i) => r.family === 1 ? `C[${r.token}]=${i + 1};L[${i + 1}]=function(F) ${bodies.get(r)}end;` : `H[${r.token}]=function() ${bodies.get(r)}end;`).join("");
    const inline = shuffled(regions.filter((r) => r.family === 0)).map((r, i) => `${i ? "elseif" : "if"} ${S0}==${r.token} then ${bodies.get(r)}`).join("");
    const dispatch = `${inline}${inline ? "else " : ""}local h=C[${S0}];if h then L[h](F) else h=H[${S0}];if not h then error(732,0) end;h() end;${inline ? "end;" : ""}`;
    const descriptorTable = `{${capsuleDescriptors.join(",")}}`;
    factories.push(`P[${id}]=function(U,G) local J=${descriptorTable};local fn;fn=function(...) local G=getfenv(fn);local args=pack(...);local F={[${frameSlots.B}]={},[${frameSlots.C}]={},[${frameSlots.X}]={},[${frameSlots.I}]={},[${frameSlots.M}]={${entry.map.join(",")}},[${frameSlots.A}]={n=math.max(0,args.n-${p.numParams})},[${frameSlots.E}]=0,[${frameSlots.D}]=0,[${frameSlots.Q}]=${entryState},[${frameSlots.K}]=${integrity(String(entryState), "0", "0", entry.salt)},[${frameSlots.S}]=${entry.token},[${frameSlots.Z}]=0,[${frameSlots.H}]=false,[${frameSlots.R}]=0,[${frameSlots.O}]=0,[${frameSlots.N}]={},[${frameSlots.J}]=J};${[...captured].map((n) => `${C0}[${n}]={};`).join("")}${Array.from({ length: p.numParams }, (_, n) => `${read(entry, n)}=args[${n + 1}];`).join("")}for i=1,${A0}.n do ${A0}[i]=args[i+${p.numParams}] end;local C,H,L={},{},{};${closures}while not ${H0} do ${dispatch}end;return unpack(${V0},1,${V0}.n) end;setfenv(fn,G);return fn end;`);
    return id;
  }
  const root = emit(proto, ir);
  const carriers = stats.capsules ? `local R={${carrierPlans.map((plan) => quoteBytes(plan.bytes)).join(",")}};` : "local R={};";
  const decoders = Array.from({ length: materializerCount }, (_, family) => {
    const primitive = family % 3;
    const structure = Math.floor(family / 3);
    const reverse = structure % 2 === 1;
    const carrierIndex = family % carrierPlans.length;
    const carrier = carrierPlans[carrierIndex];
    const at = (name) => `d[${descriptorIndex[family][name]}]`;
    const e = at("e"), a = at("a"), w = at("w"), m = at("m"), b = at("b"), h = at("h"), z = at("z"), tag = at("t"), ordinal = at("o"), rollSlot = at("r"), ordinalSlot = at("u"), cacheSlot = at("n"), cacheKey = at("c");
    const unit = primitive === 0 ? "p=p..string.char(d);" : primitive === 1 ? `local z=(d*${carrier.multiplier}+${carrier.offset})%256+1;p=p..string.sub(R[${carrierIndex + 1}],z,z);` : `p=p..string.format('%c',d);`;
    const flushAt = 19 + family;
    const flush = `n=n+1;if n==${flushAt} then s=s..p;p='';n=0 end;`;
    const decoded = (index) => {
      if (structure === 0) return `(string.byte(v,i)-k-${index}*w)%256`;
      if (structure === 1) return `((string.byte(v,i)-${index}*w)%256-k)%256`;
      if (structure === 2) return `((string.byte(v,i)-k)%256-${index}*w)%256`;
      return `(256+string.byte(v,i)-(k+${index}*w)%256)%256`;
    };
    const step = reverse ? "i=i-1;" : "i=i+1;";
    const condition = reverse ? "i>=1" : "i<=#v";
    const index = reverse ? "#v-i+1" : "i";
    const body = `local j=${index};local d=${decoded("j")};g=(g*131+d+j)%${M};${unit}${flush}`;
    let loop;
    if (structure === 0) {
      loop = reverse ? `for i=#v,1,-1 do ${body}end;` : `for i=1,#v do ${body}end;`;
    } else if (structure === 1) {
      loop = `local i=${reverse ? "#v" : "1"};while ${condition} do ${body}${step}end;`;
    } else if (structure === 2) {
      loop = `local i=${reverse ? "#v" : "1"};if #v>0 then repeat ${body}${step}until ${reverse ? "i<1" : "i>#v"} end;`;
    } else {
      const blockEnd = reverse ? "math.max(1,i-10)" : "math.min(#v,i+10)";
      const innerCondition = reverse ? "i>=u" : "i<=u";
      loop = `local i=${reverse ? "#v" : "1"};while ${condition} do local u=${blockEnd};while ${innerCondition} do ${body}${step}end;end;`;
    }
    const key = structure % 2 === 0 ? `local x=(q+a*40503)%${M};x=(x*97+math.floor(x/256)*193+a)%${M};local k=(x+math.floor(x/65536)*29+a*7)%256;` : `local x=(a*40503+q)%${M};local y=math.floor(x/256);x=(a+y*193+x*97)%${M};local k=(x+math.floor(x/65536)*29+a*7)%256;`;
    const selector = structure === 0 ? `(q*m+b)%h+1` : structure === 1 ? `((b+q*m)%h)+1` : structure === 2 ? `(b%h+(q%h)*(m%h))%h+1` : `(q*(m%h)+b)%h+1`;
    const finish = structure === 0 ? `local result=z and tonumber(s) or s;` : structure === 1 ? `local result=s;if z then result=tonumber(result) end;` : structure === 2 ? `local result;if z then result=tonumber(s) else result=s end;` : `local result=(not z) and s or tonumber(s);`;
    return `D${family + 1}=function(F,d)if not d then error(${733 + family},0) end;local a,w,m,b,h,z,t,o,rs,os,ns,ck=${a},${w},${m},${b},${h},${z},${tag},${ordinal},${rollSlot},${ordinalSlot},${cacheSlot},${cacheKey};if F[os]+1~=o then error(${760 + family},0) end;local q=F[rs];local e=${e};local v=e[${selector}];if not v then error(${733 + family},0) end;${key}local s,p,n,g='','',0,1;${loop}s=s..p;v=nil;if (g+a*17+o*31)%${M}~=t then error('E_INTEGRITY',0) end;F[rs]=(q*131+g*17+a+#s*29)%${M};F[os]=o;${finish}F[ns][ck]=result;return result end;`;
  }).join("");
  const decoderLocals = Array.from({ length: materializerCount }, (_, family) => `D${family + 1}`).join(",");
  return { code: `local getfenv,setfenv=getfenv,setfenv;local G=getfenv();local string,table,math=string,table,math;local type,tonumber,error,next,rawget,getmetatable=type,tonumber,error,next,rawget,getmetatable;local select=select;local unpack=unpack or table.unpack;local function pack(...) return {n=select('#',...),...} end;${carriers}local ${decoderLocals};${decoders}local P={};${factories.join("")}return P[${root}]({},G)(...);`, stats };
}
function assertHardenedOptions(level, dynamic, cooperativeYield) {
  if (level !== 3) throw new LuaDiagnostic("V4_LEVEL", "virtualize", "Hardened VM v4 requires Level 3");
  if (dynamic || cooperativeYield) throw new LuaDiagnostic("V4_EXECUTION_MODE", "virtualize", "Candidate supports direct execution without artificial scheduler waits only");
}
export {
  assertHardenedOptions,
  generateHardenedVM
};

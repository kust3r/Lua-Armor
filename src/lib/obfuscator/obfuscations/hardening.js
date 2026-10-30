function mkRng(seed) {
  let s = seed | 0 || 2654435769;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 4294967295;
  };
}
function pickName(rng, taken) {
  const alpha = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const digits = alpha + "0123456789";
  for (; ; ) {
    const len = 2 + Math.floor(rng() * 3);
    let n = alpha[Math.floor(rng() * alpha.length)];
    for (let i = 1; i < len; i++) n += digits[Math.floor(rng() * digits.length)];
    if (!taken.has(n) && !RESERVED.has(n)) {
      taken.add(n);
      return n;
    }
  }
}
const RESERVED = /* @__PURE__ */ new Set(["do", "end", "if", "then", "else", "elseif", "local", "return", "for", "while", "repeat", "until", "function", "and", "or", "not", "nil", "true", "false", "in", "break"]);
function hexNum(n, rng) {
  if (n < 0) return "(-" + hexNum(-n, rng) + ")";
  const use = rng();
  if (use < 0.6) {
    let h = n.toString(16);
    if (rng() < 0.4) h = "0".repeat(1 + Math.floor(rng() * 2)) + h;
    let mixed = "";
    for (const ch of h) mixed += rng() < 0.5 ? ch.toUpperCase() : ch.toLowerCase();
    return (rng() < 0.5 ? "0x" : "0X") + mixed;
  }
  if (use < 0.85 && n < 1 << 20) {
    let b = n.toString(2);
    if (rng() < 0.4) b = "0".repeat(1 + Math.floor(rng() * 2)) + b;
    if (b.length > 3 && rng() < 0.6) {
      const pos = 1 + Math.floor(rng() * (b.length - 2));
      b = b.slice(0, pos) + "_" + b.slice(pos);
    }
    return (rng() < 0.5 ? "0b" : "0B") + b;
  }
  return n.toString();
}
function escStr(s, rng) {
  const q = rng() < 0.5 ? '"' : "'";
  const qc = q.charCodeAt(0);
  let out = q;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    const r = rng();
    if (c >= 32 && c <= 126 && c !== 92 && c !== qc && r < 0.55) {
      out += s[i];
    } else {
      out += "\\" + c.toString(10).padStart(3, "0");
    }
  }
  out += q;
  return out;
}
function buildMagic(rng) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/_-.";
  let s = "";
  const len = 96 + Math.floor(rng() * 64);
  for (let i = 0; i < len; i++) s += alphabet[Math.floor(rng() * alphabet.length)];
  let sum = 0;
  for (let i = 0; i < s.length; i++) sum = sum + s.charCodeAt(i) | 0;
  sum = sum + s.length * 131 | 0;
  return { lit: s, sum };
}
function emitAntiDebug(rng, taken) {
  const ok = pickName(rng, taken);
  const d = pickName(rng, taken);
  const hk = pickName(rng, taken);
  const sv = pickName(rng, taken);
  const gi = pickName(rng, taken);
  const fi = pickName(rng, taken);
  const gr = pickName(rng, taken);
  const rg = pickName(rng, taken);
  return [
    "do",
    ` local ${ok},${d}=pcall(function() return debug end)`,
    ` if ${ok} and type(${d})==${escStr("table", rng)} then`,
    // B1: detect line/call/return hooks installed via debug.sethook
    `  if type(${d}.gethook)==${escStr("function", rng)} then local ${hk}=${d}.gethook() if ${hk}~=nil then return end end`,
    // B1: self-inspect current frame; a spy stub often has an empty/short source
    `  if type(${d}.getinfo)==${escStr("function", rng)} then local ${gi}=${d}.getinfo local ${fi}=${gi}(${hexNum(1, rng)},${escStr("S", rng)}) if ${fi}~=nil and type(${fi})==${escStr("table", rng)} and type(${fi}.source)==${escStr("string", rng)} and #${fi}.source<${hexNum(3, rng)} then return end end`,
    // B1: getregistry wrapper detection
    `  if type(${d}.getregistry)==${escStr("function", rng)} then local ${rg}=pcall(${d}.getregistry) if not ${rg} then return end end`,
    " end",
    "end"
  ].join(" ");
}
function emitPhantomCalls(rng, taken) {
  const x = pickName(rng, taken);
  const y = pickName(rng, taken);
  const services = ["Lighting", "Workspace", "Players", "RunService", "UserInputService", "ReplicatedStorage", "StarterGui", "TweenService", "HttpService", "Debris"];
  const classes = ["Folder", "Part", "Model", "Frame", "TextLabel", "ScreenGui", "BindableEvent", "BoolValue", "StringValue", "IntValue"];
  const props = ["Name", "Parent", "Position", "Size", "Color", "Transparency", "Visible", "Text", "Value", "CFrame"];
  const events = ["Changed", "ChildAdded", "AncestryChanged", "DescendantAdded", "Destroying"];
  const calls = [];
  const N = 6 + Math.floor(rng() * 6);
  for (let i = 0; i < N; i++) {
    const pick = Math.floor(rng() * 5);
    const svc = services[Math.floor(rng() * services.length)];
    const cls = classes[Math.floor(rng() * classes.length)];
    const pr = props[Math.floor(rng() * props.length)];
    const ev = events[Math.floor(rng() * events.length)];
    if (pick === 0) calls.push(`local _=game:GetService(${escStr(svc, rng)})`);
    else if (pick === 1) calls.push(`local _=Instance.new(${escStr(cls, rng)})`);
    else if (pick === 2) calls.push(`local _=game:GetService(${escStr(svc, rng)}):FindFirstChild(${escStr(cls, rng)})`);
    else if (pick === 3) calls.push(`local _=Instance.new(${escStr(cls, rng)}) _.${pr}=${escStr(cls, rng)}`);
    else calls.push(`local _=Instance.new(${escStr(cls, rng)}).${ev}:Connect(function() end)`);
  }
  const a = Math.floor(rng() * 9999) + 100;
  return [
    "do",
    ` local ${x}=${hexNum(a, rng)}`,
    ` if (${x}%${hexNum(1, rng)}~=${hexNum(0, rng)}) then`,
    "  " + calls.join(" "),
    " end",
    "end"
  ].join(" ");
}
const FAKE_ROBLOX_SLOTS = [
  "Path2DControlPoint",
  "StudioService",
  "UGCValidationService",
  "MemoryStoreService",
  "AvatarImportService",
  "PathfindingLink",
  "SurfaceAppearance",
  "TextChatCommand",
  "ExperienceInviteOptions",
  "ReflectionMetadataEnums",
  "PackageService",
  "CalloutService",
  "AnimationRigData",
  "ClusterPacketCache",
  "ProximityPromptService",
  "RbxAnalyticsService",
  "AssetCounterService",
  "TimerService",
  "SafetyService",
  "PolicyService"
];
function pickSlotName(rng, used) {
  for (let tries = 0; tries < 32; tries++) {
    const n = FAKE_ROBLOX_SLOTS[Math.floor(rng() * FAKE_ROBLOX_SLOTS.length)];
    if (!used.has(n)) {
      used.add(n);
      return n;
    }
  }
  return FAKE_ROBLOX_SLOTS[0] + Math.floor(rng() * 999);
}
function emitApiCache(rng, taken) {
  const ok = pickName(rng, taken);
  const gs = pickName(rng, taken);
  const inw = pickName(rng, taken);
  const gm = pickName(rng, taken);
  const ns = pickName(rng, taken);
  const sGame = runtimeStr("game", rng);
  const sInstance = runtimeStr("Instance", rng);
  const sNew = runtimeStr("new", rng);
  const sGetService = runtimeStr("GetService", rng);
  const slotUsed = /* @__PURE__ */ new Set();
  const slotGs = pickSlotName(rng, slotUsed);
  const slotIn = pickSlotName(rng, slotUsed);
  return [
    "do",
    ` local ${ok}=pcall(function()`,
    `  local ${ns}=${envAccessExpr(rng)} or {}`,
    `  local ${gm}=${ns}[${sGame}]`,
    `  local ${gs}=${gm} and ${gm}[${sGetService}]`,
    `  local ${inw}=${ns}[${sInstance}]`,
    `  ${inw}=${inw} and ${inw}[${sNew}]`,
    // Keep references as local upvalues only — do NOT publish into the
    // environment (avoids exposing GetService/Instance.new under discoverable
    // slot names like CalloutService/TimerService). The pcall scope already
    // captures gs and inw as upvalues accessible to the VM closure.
    ` end)`,
    ` if not ${ok} then end`,
    "end"
  ].join(" ");
}
function emitEnvProbe(rng, taken) {
  const t = pickName(rng, taken);
  return [
    "do",
    ` if type(string)~=${escStr("table", rng)} then return end`,
    ` if type(string.char)~=${escStr("function", rng)} then return end`,
    ` if type(string.byte)~=${escStr("function", rng)} then return end`,
    ` if type(string.sub)~=${escStr("function", rng)} then return end`,
    ` if type(table)~=${escStr("table", rng)} then return end`,
    // V4.1 has no table.concat reconstruction choke point. Validate the third
    // byte materializer that is actually used by the candidate instead.
    ` if type(string.format)~=${escStr("function", rng)} then return end`,
    ` local ${t}=string.char(${hexNum(72, rng)},${hexNum(73, rng)}) if ${t}~=${escStr("HI", rng)} then return end`,
    "end"
  ].join(" ");
}
function runtimeStr(s, rng) {
  const key = 1 + Math.floor(rng() * 240);
  const offset = Math.floor(rng() * 200);
  const parts = [];
  for (let i2 = 0; i2 < s.length; i2++) {
    const enc = s.charCodeAt(i2) + key + (i2 + 1) & 255;
    parts.push(hexNum(enc, rng));
  }
  const locals = /* @__PURE__ */ new Set();
  const d = pickName(rng, locals);
  const o = pickName(rng, locals);
  const i = pickName(rng, locals);
  void offset;
  return `((function() local ${d}={${parts.join(",")}} local ${o}=${escStr("", rng)} for ${i}=${hexNum(1, rng)},#${d} do ${o}=${o}..string.char((${d}[${i}]-${hexNum(key, rng)}-${i})%${hexNum(256, rng)}) end return ${o} end)())`;
}
function envAccessExpr(rng) {
  const forms = [
    "(_ENV or (getfenv and getfenv(1)))",
    "((getfenv and getfenv(1)) or _ENV)",
    `(_ENV or (type(getfenv)==${runtimeStr("function", rng)} and getfenv(1)))`,
    `((function() if type(getfenv)==${runtimeStr("function", rng)} then return getfenv(1) end return _ENV end)())`,
    `((type(getfenv)==${runtimeStr("function", rng)} and getfenv(1)) or _ENV or nil)`
  ];
  return forms[Math.floor(rng() * forms.length)];
}
function emitIntegrity(magic, expected, rng, taken) {
  const m = pickName(rng, taken);
  const s = pickName(rng, taken);
  const i = pickName(rng, taken);
  const g = pickName(rng, taken);
  const envRef = envAccessExpr(rng);
  return [
    "do",
    ` local ${m}=${escStr(magic, rng)}`,
    ` local ${s}=${hexNum(0, rng)}`,
    ` for ${i}=${hexNum(1, rng)},#${m} do ${s}=(${s}+string.byte(${m},${i})) end`,
    ` ${s}=(${s}+#${m}*${hexNum(131, rng)})`,
    ` if ${s}~=${hexNum(expected >>> 0, rng)} then return end`,
    ` local ${g}=${envRef}; if ${g} then ${g}[${m}]=nil end`,
    "end"
  ].join(" ");
}
function emitRobloxEnvLock(rng, taken) {
  const okA = pickName(rng, taken);
  const rA = pickName(rng, taken);
  const okB = pickName(rng, taken);
  const rB = pickName(rng, taken);
  const env = pickName(rng, taken);
  const gm = pickName(rng, taken);
  const v3 = pickName(rng, taken);
  const tf = pickName(rng, taken);
  const instanceType = runtimeStr("Instance", rng);
  const svcNames = ["RunService", "Players", "ReplicatedStorage"];
  const probeChoices = [
    { name: "Vector3", argc: 3 },
    { name: "Vector2", argc: 2 },
    { name: "CFrame", argc: 3 },
    { name: "Color3", argc: 3 },
    { name: "UDim", argc: 2 },
    { name: "UDim2", argc: 4 }
  ];
  const probe = probeChoices[Math.floor(rng() * probeChoices.length)];
  const args = [];
  for (let i = 0; i < probe.argc; i++) args.push(hexNum(Math.floor(rng() * 9) + 1, rng));
  const svcLits = svcNames.map((name) => runtimeStr(name, rng));
  const sProbe = runtimeStr(probe.name, rng);
  const sNew = runtimeStr("new", rng);
  const sGame = runtimeStr("game", rng);
  const sGetService = runtimeStr("GetService", rng);
  const sTypeof = runtimeStr("typeof", rng);
  const setup = `local ${env}=${envAccessExpr(rng)} or {}; local ${gm}=${env}[${sGame}]; local ${tf}=${env}[${sTypeof}]; if ${gm}==nil or type(${tf})~=${runtimeStr("function", rng)} or ${tf}(${gm})~=${instanceType} then return end local ${v3}=${sProbe}`;
  const placeIdVar = pickName(rng, taken);
  const jobIdVar = pickName(rng, taken);
  const hbVar = pickName(rng, taken);
  const hbOk = pickName(rng, taken);
  const errVar = pickName(rng, taken);
  const errOk = pickName(rng, taken);
  const sPlaceId = runtimeStr("PlaceId", rng);
  const sJobId = runtimeStr("JobId", rng);
  const sRunService = runtimeStr("RunService", rng);
  const sHeartbeat = runtimeStr("Heartbeat", rng);
  const sConnect = runtimeStr("Connect", rng);
  const deepChecks = [
    // PlaceId must be a number (mocks often return nil or string)
    `local ${placeIdVar}=${gm}[${sPlaceId}]; if type(${placeIdVar})~=${runtimeStr("number", rng)} then return end`,
    // JobId must be a string (empty in Studio, but still a string)
    `local ${jobIdVar}=${gm}[${sJobId}]; if type(${jobIdVar})~=${runtimeStr("string", rng)} then return end`,
    // Heartbeat must be a valid RBXScriptSignal with Connect (non-yielding probe)
    `local ${hbOk},${hbVar}=pcall(function() local _rs=${gm}[${sGetService}](${gm},${sRunService}); local _hb=_rs[${sHeartbeat}]; return _hb and type(_hb[${sConnect}])==${runtimeStr("function", rng)} end); if not ${hbOk} or not ${hbVar} then return end`,
    // GetService with invalid name must ERROR specifically (mocks often return nil or wrong error)
    `local ${errOk},${errVar}=pcall(function() return ${gm}[${sGetService}](${gm},${runtimeStr("\\0InvalidSvc\\0", rng)}) end); if ${errOk} then return end`
  ];
  const checks = [
    `local ${okA},${rA}=pcall(function() local V=${env}[${v3}]; return V and V[${sNew}](${args.join(",")}) end) if not ${okA} or ${rA}==nil or ${tf}(${rA})~=${v3} then return end`,
    ...svcLits.map((lit) => `local ${okB},${rB}=pcall(function() return ${gm}[${sGetService}](${gm},${lit}) end) if not ${okB} or ${rB}==nil or ${tf}(${rB})~=${instanceType} then return end`),
    // Interleave deep probes randomly among existing checks
    ...deepChecks
  ];
  for (let i = checks.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [checks[i], checks[j]] = [checks[j], checks[i]];
  }
  return "do " + setup + " " + checks.join(" ") + " end";
}
function replaceOutsideStrings(code, map) {
  const keys = Object.keys(map).sort((a, b) => b.length - a.length);
  const n = code.length;
  let out = "";
  let i = 0;
  while (i < n) {
    const c = code[i];
    if (c === '"' || c === "'") {
      const q = c;
      out += c;
      i++;
      while (i < n) {
        const ch = code[i];
        if (ch === "\\" && i + 1 < n) {
          out += ch + code[i + 1];
          i += 2;
          continue;
        }
        out += ch;
        i++;
        if (ch === q) break;
      }
      continue;
    }
    if (c === "[") {
      let j = i + 1, eqs = 0;
      while (j < n && code[j] === "=") {
        eqs++;
        j++;
      }
      if (j < n && code[j] === "[") {
        const close = "]" + "=".repeat(eqs) + "]";
        const end = code.indexOf(close, j + 1);
        if (end >= 0) {
          out += code.slice(i, end + close.length);
          i = end + close.length;
          continue;
        }
      }
    }
    if (c === "-" && code[i + 1] === "-") {
      let j = i + 2, eqs = 0, long = false;
      if (code[j] === "[") {
        let k = j + 1;
        while (k < n && code[k] === "=") {
          eqs++;
          k++;
        }
        if (code[k] === "[") {
          long = true;
          j = k + 1;
        }
      }
      if (long) {
        const close = "]" + "=".repeat(eqs) + "]";
        const end = code.indexOf(close, j);
        if (end >= 0) {
          out += code.slice(i, end + close.length);
          i = end + close.length;
          continue;
        }
      }
      const nl = code.indexOf("\n", i);
      const endIdx = nl < 0 ? n : nl;
      out += code.slice(i, endIdx);
      i = endIdx;
      continue;
    }
    let matched = false;
    for (const k of keys) {
      if (code.charCodeAt(i) !== k.charCodeAt(0)) continue;
      if (!code.startsWith(k, i)) continue;
      const prev = i > 0 ? code[i - 1] : " ";
      const next = i + k.length < n ? code[i + k.length] : " ";
      if (/[A-Za-z0-9_.]/.test(prev)) continue;
      if (/[A-Za-z0-9_]/.test(next)) continue;
      const replacement = map[k];
      out += typeof replacement === "function" ? replacement() : replacement;
      i += k.length;
      matched = true;
      break;
    }
    if (matched) continue;
    out += c;
    i++;
  }
  return out;
}
function applyHardening(code, opts, level = 2) {
  const parts = [];
  const seed = opts.seed ?? Math.floor(Math.random() * 2147483647);
  const rng = mkRng(seed);
  const taken = /* @__PURE__ */ new Set();
  if (opts.antiDebug) parts.push(emitAntiDebug(rng, taken));
  if (opts.antiTamper) {
    parts.push(emitEnvProbe(rng, taken));
    const { lit, sum } = buildMagic(rng);
    parts.push(emitIntegrity(lit, sum, rng, taken));
  } else if (opts.envLock) {
    parts.push(emitEnvProbe(rng, taken));
  }
  if (opts.robloxEnvLock) {
    parts.push(emitRobloxEnvLock(rng, taken));
    parts.push(emitApiCache(rng, taken));
  }
  for (let i = parts.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [parts[i], parts[j]] = [parts[j], parts[i]];
  }
  const preName = pickName(rng, taken);
  const prelude = `local ${preName}=${hexNum(Math.floor(rng() * 65535) + 1, rng)};`;
  const guard = parts.join(" ");
  const dispatchMethod = /([,{])x=function\([^)]*\)/;
  const match = dispatchMethod.exec(code);
  let injected;
  if (match && match.index >= 0) {
    const insertAt = match.index + match[0].length;
    injected = code.slice(0, insertAt) + " " + prelude + " " + guard + " " + code.slice(insertAt);
  } else {
    injected = prelude + " " + guard + " " + code;
  }
  return injected;
}
function hardeningFromToggles(toggles, seed) {
  return {
    antiTamper: !!toggles.antiTamper,
    antiDebug: !!toggles.antiDebug || !!toggles.debugLib,
    envLock: !!toggles.envLock,
    robloxEnvLock: !!toggles.robloxEnvLock,
    encryptedOpcodes: !!toggles.encryptedOpcodes,
    seed
  };
}
export {
  applyHardening,
  hardeningFromToggles,
  replaceOutsideStrings
};

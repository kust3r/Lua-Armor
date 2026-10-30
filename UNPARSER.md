# AST → Lua/Luau

## API e CLI

```ts
import { astToLua } from './src/lib/obfuscator/unparser';
import { regenerateSource } from './src/lib/obfuscator/source-emission';
const { code } = astToLua(ast, { target: 'luau', mode: 'compact' });
const readable = regenerateSource(source, { target: 'lua51', mode: 'readable', comments: true });
```

```sh
bun cli.ts examples/unparser/input.lua /tmp/readable.lua --platform lua51 --emit-source readable
bun cli.ts examples/unparser/input.lua /tmp/compact.lua --platform lua51 --emit-source compact
LUAU_BIN=/path/to/luau bunx vitest run
LUAU_BIN=/path/to/luau bun unparser-benchmark.ts
```

`--emit-source` is explicitly **not obfuscation**. It bypasses VM generation; existing `--readable` is unchanged. `--keep-comments` works only with readable emission. The site continues using AST → bytecode → VM. No original-source diagnostic is attached to a production output. No public API was added.

The API does not mutate its input. Invalid or incompatible nodes throw `LuaDiagnostic` with code, phase, feature, target and source span/AST path; errors are not replaced with approximate code. `diagnostics` in successful results is currently empty. `flatten: true` in `regenerateSource` exposes transformation inspection explicitly.

## Verified inventory

The original union had **32**, not 29, kinds: 15 statement/container kinds and 17 expression kinds. `ParenExpr` and `IfExpr` bring the total to **34**. `AST_KINDS satisfies Record<ASTNode['kind'], true>` makes the inventory compiler-checked; `mapChildren` and the expression emitter use exhaustive `never` checks. The existing AST is shared, not duplicated. `ExpressionNode`, `StatementNode`, `LValueNode` and discriminated `TableField` are exported; legacy consumers still accept the broad `ASTNode` shape and are runtime-validated at emission/virtualization boundaries.

| Kinds | Producer | Consumers |
|---|---|---|
| Block, LocalDecl, LocalFunc, Assign | parser; flattening also constructs these | compiler, bindings, traversal, optimizer, minifier, unparser |
| CompoundAssign | parser | compiler, bindings/traversal, minifier, unparser |
| If, While, Repeat | parser; flattening constructs If/While | compiler, bindings, traversal, optimizer, minifier, unparser |
| NumericFor, GenericFor, DoBlock | parser; optimizer may construct DoBlock | compiler, bindings, traversal, optimizer, minifier, unparser |
| Return, Break, Continue, ExprStmt | parser; flattening constructs Break | compiler, traversal, optimizer, minifier, unparser |
| NumberLit, StringLit, BoolLit, NilLit | parser; optimizer/constants; flattening synthetic numbers/booleans | compiler/constants, traversal, optimizer, minifier, unparser |
| NameExpr, BinOp, UnOp | parser; flattening constructs names/operators | compiler, bindings, traversal, optimizer, minifier, unparser |
| Call, MethodCall, DotAccess, IndexAccess | parser; native-boundary lowering | compiler, bindings, traversal, optimizer, minifier, unparser |
| TableCtor, FuncExpr, Vararg | parser; native factories; flattening constructs FuncExpr | compiler, bindings, traversal, optimizer, minifier, unparser |
| ParenExpr | parser, optimizer scalar adjustment | compiler scalar handling, bindings/traversal, minifier, unparser |
| IfExpr | parser, without lossy and/or lowering | compiler branches, bindings/traversal, optimizer, minifier, unparser |

Macros are recognized structurally for `LPY_NO_VIRTUALIZE`; production textual macro handling now uses token boundaries for identifier/call matching. The prefix is reserved; the emitter round-trips native marks as macro calls and native factory emission consumes them deliberately.

## Preservation rules

- Precedence table includes right-associative exponentiation/concatenation, unary precedence and child position; no algebraic reassociation. Explicit `ParenExpr` keeps scalar result adjustment.
- Table fields preserve named/computed/sequence form and order. Metatables are ordinary calls/tables.
- Byte arrays preserve raw Lua string values; the JS text view is auxiliary. Source UTF-8 is encoded once; decimal escapes produce bytes. Changed text invalidates stale parsed byte metadata. Production VM string constants are binary byte strings and fragmentation does not re-encode them as UTF-8.
- Generated numeric escapes have exactly three decimal digits. Short escaped literals avoid initial-newline and CR normalization issues. Parsing normalizes long-string newlines per Lua rules. No physical literal newline in compact mode.
- Exact numeric lexemes and integer strings are retained before Number conversion. Stale lexemes are not reused if values change. Integer versus float spelling is retained for Lua 5.3/5.4 emission. Synthetic negative zero/nonfinite values have explicit arithmetic spellings without mutable globals.
- Token boundaries are managed during emission; both modes share one visitor. Semicolons prevent accidental call continuation across statements. Compact output may retain harmless spaces inside name/parameter lists; it is safe compact emission, not shortest-possible output.
- Comments require opt-in retention and are associated before the next statement by source line; comments inside an expression may move to its statement boundary. Exact whitespace/trailing-comment positions are not preserved. Luau analysis directives `--!strict`, `--!nonstrict` and `--!nocheck` are retained at the source-emission prefix (including compact mode). They remain rejected for VM transformation; `--!native`, optimization and unknown directives are rejected individually, never silently removed.
- Native and VM locals use declaration-point resolution; initializer expressions execute before new names are introduced. Scope restoration and `CLOSE` detach cells without invalidating surviving closures. Loop iteration closures have explicit tests. Flattening conservatively preserves programs with top-level local declarations instead of unsafe name-based hoisting; this reduces flattening for those programs but preserves semantics.

## Platform matrix

Language support is distinct from the host. The same Luau syntax capability applies to `roblox`, but tests on standalone Luau do not prove Studio client loading/services/scheduler compatibility.

| Feature | Lua 5.1 | Lua 5.2 | Lua 5.3 | Lua 5.4 | LuaJIT | Luau |
|---|---|---|---|---|---|---|
| Core AST parse + readable/compact emission | yes | yes | yes | yes | yes | yes |
| Core official compiler + execution checked | 5.1.5 | 5.2.4 | 5.3.6 | 5.4.8 | 2.1.1792349434 | 0.743 |
| continue / compound / conditional expression | diagnostic | diagnostic | diagnostic | diagnostic | diagnostic | native emission + VM |
| Integer division `//` | diagnostic | diagnostic | emit | emit | diagnostic | emit + VM |
| Native integer bitwise | diagnostic | diagnostic | emit, executed | emit, executed | diagnostic | diagnostic (no silent bit32 replacement) |
| Exact 64-bit integer emission | double semantics | double semantics | yes | yes | double profile; cdata suffixes rejected | double semantics |
| Types/generics/casts | diagnostic | diagnostic | diagnostic | diagnostic | diagnostic | diagnostic; no heuristic erasure |
| Interpolation | diagnostic | diagnostic | diagnostic | diagnostic | diagnostic | diagnostic; no placeholder replacement |
| Labels/goto | diagnostic | diagnostic | diagnostic | diagnostic | diagnostic | diagnostic |
| `<const>` / `<close>` | diagnostic | diagnostic | diagnostic | diagnostic | diagnostic | diagnostic |
| Full production VM | diagnostic* | diagnostic* | diagnostic* | diagnostic* | diagnostic* | existing VM, tested |
| Hybrid native/VM | not claimed | not claimed | not claimed | not claimed | not claimed | tested both directions |

*An independent probe found the legacy VM emitting Luau binary literals for Lua 5.1–5.4 and missing functions under LuaJIT even for `print("OK")`. These paths now fail with `UNSUPPORTED_VM_TARGET` instead of returning invalid artifacts. This is an explicit compatibility restriction, not a claim that this task repaired those whole VM backends. Source regeneration remains available for all six dialects. Integer subtype and values that the VM cannot preserve receive `UNSUPPORTED_VM_INTEGER`. Lua 5.2+ lexical `_ENV` is unsupported by the VM; in Luau/Roblox `_ENV` is an ordinary identifier resolved by binding. Legacy VM targets remain unavailable regardless of this distinction.

LuaJIT-specific cdata numeric suffixes and newer Lua features are not inferred from version numbers. Runtime discovery is explicit via test variables; unavailable tools produce visible skips, not substitution.

## LPY_NO_VIRTUALIZE boundary

The macro requires a statically identifiable function literal, e.g. `LPY_NO_VIRTUALIZE(function(...) ... end)`. Arguments supplied to the resulting function are fully dynamic; calls, varargs and nil values are evaluated at runtime. The macro is reserved; it is not expanded inside strings/comments. Functions are emitted natively through compact `astToLua` factories, not dynamically loaded from their bodies. VM children remain virtualized unless explicitly marked native.

- Only native bindings accessed across a VM region boundary are cells; exclusive locals/parameters remain ordinary Lua locals. Explicit native-to-native closures use ordinary lexical captures. Unmarked children remain VM; captures crossing them (including transitively) require cells. Factory captures refer to the same cells as VM upvalues.
- Nested VM functions receive shared cells; native accesses are rewritten consistently. Multiple assignments remain native multiple assignments, retaining parallel-write behavior. Compound assignments keep one receiver/index evaluation.
- A fresh closure is created at each CLOSURE execution, not per call; no native factory branch/tables are emitted in pure-VM programs. Transitive captures, callbacks, recursion, reentrancy, nil/false, yield and per-invocation separation are tested.
- Globals use the current VM script environment; private factories/cells are never published there. `hardcodeGlobals` combined with native functions is explicitly rejected because a live environment and copied snapshot are not interchangeable.
- Unresolved global `debug`, `getfenv` and `setfenv` usage in native functions is rejected. Same-named locals and captures from the compiler parent are allowed by lexical resolution. Luau `_ENV` is not treated as the Lua 5.2 environment mechanism. Arbitrary aliases to environment/introspection functions cannot be proven safe by static name checks; programs using those APIs indirectly are outside the supported hybrid contract. No transparency is promised for upvalue/debug inspection or dynamic environment replacement. Lua 5.2+ hybrid `_ENV` is not claimed.
- Direct native emission exposes more structure and string bytes. Decimal byte escapes hide readable text but are **not encryption**. Existing hardening/builtin hiding/wrapper passes still run; unparser is not a protection replacement. Introspection-sensitive programs require explicit diagnostics/contract restrictions rather than a claim of arbitrary equivalence.

## Tests and evidence

Baseline before source edits: **19 passed, 45 skipped**, Lua/luac 5.1.5 installed; the historical hard-coded Luau path did not exist. Official Luau 0.743 was downloaded to temporary tools; Lua 5.2.4/5.3.6/5.4.8 and LuaJIT were built in `/tmp`, not added to application dependencies. Runtime tests now accept `LUAU_BIN`.

New suites: `unparser.test.ts` and `unparser-dialects.test.ts`. Cases compare normalized ASTs and runtime values/effect traces/errors, bytes, exact integer spellings and native boundaries. Generated ASTs use seeds 1, 42, 91357 with bounded tree depth and external process timeouts. Tests never inject traps into production. Existing policy/GC/line-info/loader/VM suites remain.

During the final randomized suite, an existing wrapper suffix bug was reproduced: a payload ending in `]` followed by `]]` closed one character early. Delimiter selection now checks the concatenated suffix, with 80 deterministic generated-wrapper executions as regression.

CLI examples were regenerated, parsed by official `luac` and executed. Site verification: real login → paste a function capturing `x` → obfuscate → output displayed → download; `/obfuscation`, no page errors. Downloaded output compiled with official Luau. Default Roblox probes mean standalone execution of that particular site artifact is **not** claimed; hybrid execution is separately tested with the Luau target.

Roblox Studio validation remains manual. No offline stub proves real scheduler yield or client loader availability.

## Measurements (2026-10-19, sandbox)

`unparser-benchmark.ts`, seed 42, fixed example corpus, 3 warmups + 9 measured samples:

| Metric | Median |
|---|---:|
| Source | 345 bytes |
| Readable output | 371 bytes |
| Compact output | 312 bytes |
| Lexer + parser | 0.378 ms |
| Readable emission (validation included) | 0.173 ms |
| Compact emission (validation included) | 0.085 ms |
| Full level-2 VM generation | 72.122 ms |
| Full level-2 production output | 45,484 bytes |

Separate fixed workload: 2,000 calls, seed 42, same load/parse/init/execute timing envelope, 2 warmups + 5 samples:

| Variant | Median elapsed | Output bytes |
|---|---:|---:|
| VM function | 22.442 ms | 39,877 |
| Explicit native function | 11.722 ms | 38,727 |

These tiny workloads are not Studio fluency measurements or exact CPU-per-coroutine accounting. Oscillation is visible in raw samples; there is no performance pass/fail threshold. The production-path baseline timing/size for this exact corpus was not captured before edits, so **no before/after whole-engine speed claim** is made. The measured added emission cost is separated, and pure-VM programs do not invoke source regeneration. Earlier KONTRA numbers are not comparable across runtime versions/configurations.


## Review stage: binding sharing and faithful KONTRA

See `benchmarks/kontra/README.md` and `evidence/offline-results.json` for the reproducible 12-call KONTRA workload. The previous tiny-call benchmark remains historical evidence, not proof of KONTRA fluency. New differential cases in `hybrid-sharing.test.ts` cover runtime argument side effects, sibling native closures, transitive cross-boundary captures, callback suspension, protected errors and recovery, crossed reentry, continue captures and reused scopes. The site now offers only runnable VM targets; source regeneration targets remain in CLI.

### Capability layers (partial language support)

| Resource | Parser/AST | Unparser | Bytecode compiler | VM | Hybrid |
|---|---|---|---|---|---|
| Core represented Lua syntax | represented | six dialects, gated | represented subset | Luau/Roblox only | Luau/Roblox contract |
| Luau continue/compound/if-expression | represented | Luau only | supported | tested offline | tested offline |
| Exact Lua 5.3/5.4 integers/bitwise | represented with metadata | source supported | diagnostic where semantics unavailable | no legacy target | not claimed |
| Types/generics/casts/interpolation | not represented | not implemented | not implemented | not implemented | not implemented |
| Analysis directives | trivia retained | recognized Luau directives preserved | VM transfer rejected | not implemented | not implemented |
| Native/introspection/environment replacement | identifiers parsed | source emitted | restricted by target/binding | arbitrary transparency not claimed | introspection contract restrictions |

A diagnostic is a refusal, never implemented compatibility. Roadmap for language expansion is separate: first typed AST and round-trip syntax, then target-specific lowering, then execution validation. None is silently erased to accelerate this stage.

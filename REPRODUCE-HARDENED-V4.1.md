# Reprodução da Hardened VM v4.1

> Procedimento histórico. A reprodução atual está em
> `REPRODUCE-HARDENED-V4.2.md`.

## Dependências

- Node.js 20+ e npm.
- Bun para os scripts TypeScript de benchmark.
- Um executável Luau compatível, informado em `LUAU_BIN`.

O `package-lock.json` foi sincronizado com `package.json`. O lockfile antigo do Bun contém URLs do cache interno do Lovable; fora desse ambiente, prefira `npm install`.

## Verificação do site

```bash
npm install
npm run typecheck
npm run build
```

## Testes funcionais selecionados

```bash
LUAU_BIN=/caminho/para/luau npx vitest run \
  src/test/hardened-v4.test.ts \
  src/test/retired-line-option.test.ts \
  src/test/execution-contracts.test.ts \
  src/test/capture-layout.test.ts \
  src/test/close-elision.test.ts \
  src/test/concat-semantics.test.ts \
  src/test/constant-integrity-runtime.test.ts \
  src/test/constant-integrity.test.ts \
  src/test/hybrid-sharing.test.ts \
  src/test/obfuscation-full.test.ts \
  src/test/obfuscation-session.test.ts \
  src/test/runtime-renamer.test.ts \
  src/test/string-permutation.test.ts \
  src/test/structural-emission.test.ts \
  src/test/vm-codegen.test.ts \
  src/test/vm-execution-policy.test.ts \
  src/test/vm-runtime-regressions.test.ts
```

## Evidência KB

```bash
bun benchmarks/hardened-v4.1/generate.ts
bun benchmarks/hardened-v4.1/inspect-structure.ts
LUAU_BIN=/caminho/para/luau bun benchmarks/hardened-v4.1/run-evidence.ts
```

Cada resultado tem SHA-256 em `benchmarks/hardened-v4.1/runs/`. Os artefatos `KB-v4-original-*.luau` foram gerados a partir do ZIP original antes das alterações; a proveniência está em `original-v4-baseline.json`.

## Uso privado

CLI:

```bash
LURAPY_INTERNAL_HARDENED_VM=4 bun cli.ts input.luau --level 3 --platform luau
```

Preview do site:

```bash
VITE_LURAPY_INTERNAL_HARDENED_VM=4 npm run build
```

Sem a variável, o site usa o backend legado. A flag só seleciona v4.1 no Level 3.

# Reprodução da Hardened VM v4.2

> Procedimento histórico. Para a versão atual, use
> `REPRODUCE-HARDENED-V4.3.md`.

## Dependências

- Node.js 20+
- Dependências do `package.json`
- Luau informado em `LUAU_BIN` para testes de execução
- Bun somente para uso direto da CLI

## Site e testes

```bash
npm ci
npm run build
npm run lint
LUAU_BIN=/caminho/para/luau npx vitest run \
  src/test/hardened-v42.test.js \
  src/test/hardened-v42-selection.test.jsx --maxWorkers=1
```

Suíte usada nesta entrega, excluindo apenas dois arquivos que exigem
`/usr/bin/lua`:

```bash
LUAU_BIN=/caminho/para/luau npm test -- \
  --maxWorkers=1 \
  --exclude src/test/unparser.test.js \
  --exclude src/test/unparser-dialects.test.js
```

## Auditoria KB e comparação anexada

```bash
LUAU_BIN=/caminho/para/luau npx vite-node \
  scripts/audit-current-v42.mjs \
  /caminho/KB.lua \
  /caminho/kb-controller.luau \
  /caminho/KB-Luraph.lua \
  /caminho/KB-Obfuscated.lua \
  audit/current-v42
```

O comando grava três artefatos, executa os checksums, testa quatro hooks em
três sementes e produz `audit.json` com hashes SHA-256 e métricas estruturais.

## Rollback

```bash
VITE_LURAPY_LEGACY_LEVEL3=1 npm run build
LURAPY_LEGACY_LEVEL3=1 bun cli.js input.luau --preset strong --platform luau
```

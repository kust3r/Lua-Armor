# Reprodução — Hardened VM v4.3

## Requisitos

- Node.js 20+;
- dependências instaladas com `npm ci`;
- runtime Luau;
- `lua` e `luac` somente para os testes específicos de Lua 5.1.

## Testes focados

```bash
LUAU_BIN=/caminho/para/luau npx vitest run \
  src/test/hardened-v43.test.js \
  src/test/hardened-v43-selection.test.jsx \
  --maxWorkers=1
```

## Campanha KB

```bash
LUAU_BIN=/caminho/para/luau npx vite-node \
  scripts/audit-current-v43.mjs \
  /caminho/kb-original.lua \
  /caminho/kb-controller.luau \
  /caminho/KB-Luraph.lua \
  /caminho/KB-Lurapy-legado.lua \
  audit/current-v43
```

O script gera três artefatos, executa o controlador, confere os quatro
checksums e roda hooks de `char`, `sub`, `format` e `concat`. O diretório de
saída contém os artefatos e `audit.json`.

## Projeto completo

```bash
LUAU_BIN=/caminho/para/luau npm test
npm run lint
npm run build
```

## Hashes da evidência desta entrega

- script de auditoria: `56461f8d63cc92712ddcddc19567ac29d82a6aa8c1232107274ad3d761118426`;
- motor v4.3: `82871a57323e09692fcae54783c55126b19b453c7734ba0cacc09dcc74519222`;
- teste focado: `f89c94e3eb46b51d1b73fa328998c9580362d180e8eeaf73bd7536915bb3ecd3`.

O manifesto final deve ser usado para conferir os hashes após qualquer mudança
posterior no repositório. Nesta execução, 513 testes independentes de Lua 5.1
passaram; a suíte integral ainda registrou 25 `ENOENT` por ausência de
`/usr/bin/lua`, além de 550 testes aprovados e 14 ignorados.


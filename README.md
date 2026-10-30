# Lurapy

Site e motor de ofuscação Lua/Luau em JavaScript. O navegador e a CLI usam o
mesmo engine.

## Desenvolvimento

Requer Node.js 20+.

```bash
npm ci
npm run dev
```

Validação principal:

```bash
npm run build
npm run lint
LUAU_BIN=/caminho/para/luau npm test
```

Alguns testes de emissão Lua 5.1 também requerem `lua` e `luac` instalados.

## Level 3

Luau e Roblox usam a Hardened VM v4.3 por padrão. Ela usa regiões com estados
de entrada, slots de frame permutados por protótipo e constantes ligadas à
ordem de execução de cada região. Constantes repetidas na mesma região usam um
cache local e cada cápsula valida o conteúdo decodificado antes de entregá-lo.

Rollback de emergência no site:

```bash
VITE_LURAPY_LEGACY_LEVEL3=1 npm run build
```

Rollback equivalente na CLI:

```bash
LURAPY_LEGACY_LEVEL3=1 bun cli.js input.luau --preset strong --platform luau
```

Isso aumenta o trabalho de extração e detecta edições diretas, mas não cria
segredo criptográfico nem estabelece equivalência com o Luraph. Consulte
`HARDENED-V4.3-REPORT.md`, `RESEARCH-LUA-OBFUSCATION-2026-10-30.md` e
`REPRODUCE-HARDENED-V4.3.md` para os resultados e limites.

Nunca publique `.env`, `node_modules` ou `dist` no repositório.

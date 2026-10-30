# Lurapy — JavaScript

Todo o código do site está em JavaScript (`.js` e `.jsx`). JSX é processado
pelo Vite.

## Abrir o site

```bash
npm ci
npm run dev
```

## Gerar a versão de hospedagem

```bash
npm run build
npm run preview
```

O resultado fica em `dist/`.

## Ofuscar pela linha de comando

```bash
bun cli.js arquivo.lua --preset strong --platform luau
bun cli.js entrada.lua saida.lua --preset strong --platform roblox --seed 1337
```

O preset `strong` usa Hardened VM v4.3 em Luau/Roblox. Para um rollback
temporário, defina `LURAPY_LEGACY_LEVEL3=1`.

## Testes

```bash
LUAU_BIN=/caminho/para/luau npm test
```

Os números desta revisão ficam no relatório v4.3. Testes que executam Lua 5.1
exigem `lua`/`luac`; os testes do Level 3 exigem um runtime Luau configurado em
`LUAU_BIN`.

## Segurança

A v4.3 mantém a remoção da tabela pública de 137 entradas, liga a seleção de
cada descritor ao estado acumulado da região e verifica o conteúdo decodificado.
Nos artefatos KB das sementes 7, 42 e 1337, hooks genéricos de `char`, `sub`,
`format` e `concat` recuperaram 0/82 literais longos.

Isso não significa “igual ao Luraph”. Um atacante que modele especificamente o
runtime ainda pode reconstruir estados, seletores e materializadores. Os dados
completos estão em `audit/current-v43/audit.json`.

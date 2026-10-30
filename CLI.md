# Lurapy CLI

Roda o mesmo motor de ofuscação do app web direto no terminal.

## Requisitos

- [Bun](https://bun.sh) (já vem no projeto)

## Uso básico

```bash
bun cli.js entrada.lua                    # → entrada.obf.lua
bun cli.js entrada.lua saida.lua          # arquivo de saída explícito
bun cli.js entrada.lua --preset strong    # nível máximo
bun cli.js entrada.lua --platform roblox --on antiTamper,antiDebug,intenseVm --seed 42
```

Os defaults vêm de `configs.json` na raiz do projeto. Flags na linha de comando
sempre sobrescrevem o arquivo.

## Flags

| Flag | Descrição |
|---|---|
| `--platform <id>` | `roblox` · `luau` · `luajit` · `lua54` · `lua53` · `lua52` · `lua51` |
| `--preset <name>` | `minify` · `weak` · `medium` · `strong` |
| `--loader <mode>` | `direct` padrão, sem compilação dinâmica; `dynamic` exige compilador em execução |
| `--cooperative-yield` | Autoriza pausas artificiais somente na coroutine de entrada; pode alterar seu protocolo |
| `--seed <n>` | Seed inteiro para output determinístico |
| `--readable` | Mantém quebras de linha (best-effort) |
| `--bundle` | Trata o input como entrypoint de bundle (require/json/read) |
| `--on  toggle,toggle` | Liga toggles (lista separada por vírgula) |
| `--off toggle,toggle` | Desliga toggles |
| `--config <path>` | Usa outro `configs.json` |
| `--print-config` | Mostra a config resolvida e sai |
| `-h, --help` | Ajuda |

## Toggles disponíveis

- `intenseVm` — diversidade estrutural extra; não impõe limite de instruções
- `vmCompression` — loader de fonte LZW+Base92, somente com `--loader dynamic`
- `hardcodeGlobals` — copia `_G` no início
- `confuseNames` — nomes enganosos (index, loader, etc.)
- `debugLib` — trap de debug clássico (arriscado)
- `antiTamper` — integridade via checksum de magic blob ⭐
- `antiDebug` — detecta `debug.gethook` ativo ⭐
- `envLock` — confere `string.char/byte/sub`, `table.concat`

## Presets

| Preset | Level | Toggles padrão |
|---|---|---|
| `minify` | 1 | (nenhum hardening) |
| `weak` | 1 | `envLock` |
| `medium` | 2 | `antiTamper`, `antiDebug`, `envLock` |
| `strong` | 3 | medium + `intenseVm`, `hardcodeGlobals` |

## Bundle multi-arquivo

```lua
-- entry.lua
local util = require("util")              -- procura util.lua / util/init.lua
local data = bundle.json("./data.json")   -- decode JSON em tabela Lua
local readme = bundle.read("./README.md") -- string crua
```

```bash
bun cli.js entry.lua bundled.obf.lua --bundle --preset strong
```

O bundler:
- Resolve `require("a.b")` como `a/b.lua`, `a/b.luau`, `a/b/init.lua`, etc.
- Encapsula cada módulo num loader cacheado (`require` é shadowed).
- Embute `bundle.json` e `bundle.read` como tabela / string Lua nativa.
- Empacota tudo num único script independente antes de ofuscar.

## Regeneração explícita de fonte (não é ofuscação)

`bun cli.js entrada.lua saida.lua --platform lua51 --emit-source readable`

Use `--emit-source compact` para emissão compacta ou `--keep-comments` no modo legível. A opção antiga `--readable` não muda de significado. Veja `UNPARSER.md` para a matriz e os diagnósticos; a VM de produção é validada em Luau, e alvos legados incompatíveis são recusados em vez de gerar sintaxe inválida.

## Contratos de execução

O site e a CLI geram por padrão VM executável e fábricas `LPY_NO_VIRTUALIZE` diretamente, em uma linha. LZW comprime os dados do programa, não outra fonte a ser compilada. `packer` e `vmCompression` salvos não ativam compilação dinâmica no modo direto. `LPY_ENCFUNC`/`LPY_FUNCENC`, cuja implementação exige compilação, recebem diagnóstico nesse modo; não são confundidas com a ponte nativa.

Yields artificiais são desligados por padrão, inclusive no alvo Roblox. Isso preserva o protocolo de coroutines, mas um cálculo longo pode ocupar o cliente continuamente. `--cooperative-yield` autoriza apenas a coroutine que iniciou a instância; coroutines filhas não herdam a autorização. Erros/retornos mantêm identidade e aridade; o modo autorizado usa uma fronteira protegida por invocação, podendo mudar detalhes do traceback. Tempo de funções desconhecidas pode incluir suspensão: não é CPU exata.

`diagnosticInstructionLimit` só funciona em `obfuscateDiagnostic`, limitado a 5.000.000 instruções por invocação, incluindo trabalho dessa invocação ao longo de yields, não o trabalho dos filhos em suas próprias invocações. Produção não emite esse contador.

GC Fixes solta blocos cifrados consumidos; não destrói handlers compartilhados. A saída ofuscada é compacta em uma linha física; isso não remove metadados de traceback produzidos pelo compilador do ambiente.

Bootstrap direto permitido: `string.char`, `getfenv(1)` e fallback `_ENV`/`_G` para descobrir o ambiente. Bibliotecas internas são resolvidas localmente por nomes codificados. Nem o formato visual nem o payload cifrado garantem irrecuperabilidade no cliente.

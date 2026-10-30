# Relatório — Lurapy Hardened VM v4.2

> Evidência histórica preservada. A versão atual está em
> `HARDENED-V4.3-REPORT.md`.

Data da análise: 30/10/2026.

## Resposta direta

A comparação “Lurapy 44/100” recebida não representa este código. O arquivo
`KB-Obfuscated (4).lua` veio do backend Level 3 legado: ele tem 76.072 bytes,
uma tabela aritmética pública de 137 entradas e 60 sequências decimais de
construção de strings. O site ainda selecionava esse backend porque a v4.1
dependia de uma flag privada.

A v4.2 torna o backend endurecido o padrão do Level 3 para Luau e Roblox. A
tabela mostrada pelo usuário não aparece nos novos artefatos. Isso é uma
melhoria concreta, mas os dados não sustentam a frase “igual ao Luraph”.

## Entradas comparadas

| Arquivo | Bytes | SHA-256 |
|---|---:|---|
| KB original | 14.214 | `57f3d4ebe6c68f960544feb7ba4f114a12fb348403e1da548d9646cc98a940ea` |
| Luraph v15.1 anexado | 334.295 | `f4ea7ae704160f8aa369dd0126dd8c685bb6938cac6d7161f7be9a077dd61ff9` |
| Lurapy legado anexado | 76.072 | `5c4b410a026f502bc6c155656535094ccafb8d863711f8c2f830cdf3d512dde8` |

O original contém 94 strings únicas, das quais 82 têm seis bytes ou mais.

## Mudanças implementadas

1. Level 3 escolhe v4.2 por padrão no navegador e na CLI para Luau/Roblox.
2. O legado só é selecionado pelo rollback explícito
   `VITE_LURAPY_LEGACY_LEVEL3=1` ou `LURAPY_LEGACY_LEVEL3=1`.
3. As constantes continuam separadas por ocorrência e ligadas ao estado real
   de entrada de cada região.
4. Os 24 materializadores deixaram de repetir seis moldes quatro vezes. Agora
   combinam:
   - quatro estruturas de iteração;
   - três primitivas de emissão de byte;
   - duas direções de leitura;
   - 24 limites de fragmentação;
   - quatro expressões equivalentes de seleção;
   - permutação independente dos nove argumentos;
   - terminações e códigos de erro distintos.
5. O engine registra `2026.10.hardened-v4.2` e revisão 2.
6. A opção “Disable line information” permanece removida.

## Resultado funcional do KB

| Seed | Bytes | Checksums | Ciclo de vida |
|---:|---:|---|---|
| 7 | 288.473 | `[-2.1109608642076587, 6006995, 2176958, 60300]` | OK |
| 42 | 290.311 | iguais | OK |
| 1337 | 291.863 | iguais | OK |

Todos os artefatos são uma linha, não contêm a assinatura da tabela de 137
entradas e não contêm sequências decimais longas de `string.char`.

## Hooks genéricos

Foram executadas 12 combinações: `string.char`, `string.sub`, `string.format`
e `table.concat` em cada uma das três sementes.

- 12/12 execuções preservaram checksums e ciclo de vida.
- 0/82 literais longos foram retornados integralmente por qualquer hook.
- `table.concat` recebeu zero chamadas.
- Os outros hooks retornaram no máximo dois bytes por chamada.

Esse teste mostra que o ponto único de despejo usado contra a versão antiga foi
removido. Ele não impede um atacante de registrar milhares de bytes isolados e
reconstruí-los usando o estado, a ordem e os argumentos das chamadas.

## Comparação estrutural com Luraph

| Medida | Luraph anexado | Lurapy legado | Lurapy v4.2 |
|---|---:|---:|---:|
| Tamanho | 334.295 B | 76.072 B | 288–292 KB |
| Tabela aritmética pública | não | sim | não |
| Sequências decimais `string.char` | 0 | 60 | 0 |
| Literal longo diretamente visível | 1/82 | 1/82 | 1/82 |
| Repetição em blocos fixos de 64 B | 0,04% | 0% | 0,34–0,73% |

O único literal longo diretamente coincidente nos três é `number`, também
usado pelo runtime. A métrica de repetição mostra que a aparência melhorou, mas
o Luraph anexado ainda apresenta menos repetição exata. Tamanho, contagem de
funções e aparência não demonstram sozinhos dificuldade de deofuscação.

As imagens do Lumarge também não provam proximidade com Luraph: nelas, 411/411
referências de constantes do Lumarge foram capturadas, enquanto o pool do
Luraph nem foi enumerado. Os alvos e a cobertura do atacante são diferentes,
portanto a pontuação não é uma comparação controlada.

## Validação do repositório

- 64/64 testes focados da v4.2 e seleção do site passaram.
- 510/510 testes executáveis neste ambiente passaram.
- A suíte integral original teve 26 falhas de infraestrutura em dois arquivos
  que chamam `/usr/bin/lua`, ausente neste ambiente; os outros 441 testes dessa
  primeira rodada passaram.
- `npm run build` passou e gerou o worker com a versão v4.2.
- Um `npm ci` limpo a partir do novo `package-lock.json` instalou 391 pacotes;
  nesse ambiente limpo, o build e os 64 testes focados também passaram.
- `npm run lint` terminou com 0 erros e 136 avisos preexistentes.
- O servidor Vite respondeu HTTP 200 para a página, a entrada React e o worker.

## Limites restantes

- Roblox Studio não está disponível neste ambiente; compatibilidade real com
  APIs, scheduler e diferenças do runtime do Studio ainda precisa ser testada.
- Não foi demonstrada reconstrução zero por um deofuscador feito para a v4.2.
- O código do engine está no cliente e, portanto, um atacante pode estudá-lo.
- Checks de integridade detectam alterações acidentais ou não atualizadas; não
  autenticam o artefato contra alguém que controla todo o arquivo.
- Não há base técnica para prometer paridade com Luraph v15.1.

Os dados brutos e os três artefatos estão em `audit/current-v42/`.

# Relatório — Lurapy Hardened VM v4.3

Data: 30/10/2026.

## Resultado direto

A v4.3 corrige os dois problemas concretos demonstrados contra a v4.2:

1. as chamadas de constante não carregam mais todos os dados necessários para
   serem avaliadas isoladamente em qualquer ordem;
2. uma alteração de byte no payload de uma constante usada agora termina com
   `E_INTEGRITY`, em vez de entregar silenciosamente outro texto.

O novo backend passou os testes funcionais e a campanha KB nas três sementes.
Isto aumenta o trabalho necessário para extrair constantes e detecta edições
diretas. Não é autenticação, segredo criptográfico ou prova de equivalência com
o Luraph. Um analisador específico ainda pode acompanhar o fluxo regional,
simular os estados e reconstruir os valores.

## Causa da falha da v4.2

O arquivo testado continha 781 chamadas protegidas. Cada chamada recebia, no
próprio local, os nove elementos necessários para escolher e decodificar seu
descritor. O estado funcionava como mais uma entrada enumerável. O teste externo
percorreu 910 combinações indicadas pelas guardas e recuperou as 781 chamadas.

O checksum anterior também não cobria adequadamente o conteúdo entregue por
cada cápsula. A alteração observada de `KONTRA` para `LONTRA` preservou execução
e checksums.

## Mudanças implementadas

- O frame da VM passou a usar slots numéricos permutados por protótipo para
  registradores, controle, integridade, descritores e caches.
- Cada região inicia um estado acumulado derivado da aresta real de entrada, do
  sal da função e do sal da região.
- A próxima constante só pode ser selecionada pelo estado acumulado atual. A
  seleção usa uma tabela indireta para localizar o descritor; a chamada não
  transporta mais o descritor completo nem nove argumentos independentes.
- Cada materialização avança a ordem e o estado. Tentar usar uma cápsula fora da
  ordem produz erro.
- Constantes repetidas dentro da região são reutilizadas por cache local. No KB,
  isso eliminou de 102 a 112 chamadas por artefato.
- Cada cápsula calcula e confere um tag sobre os bytes decodificados antes de
  entregar o valor.
- Os descritores permutam seus campos de forma independente nas 12 famílias de
  materialização.
- As regiões cresceram de 16–24 para 24–40 operações e o mix entre emissão em
  linha e closures foi reequilibrado para reduzir assinaturas repetidas.
- A configuração do Tailwind passou a examinar também `.js` e `.jsx`; isso
  corrige classes ausentes no build do site e não altera o motor.
- A opção antiga “Disable line information” permanece removida.

## Campanha KB

Entrada: 94 strings únicas; 82 com seis bytes ou mais.

| Seed | Bytes | Regiões | Decodificações | Reusos | Funções | Checksums | Ciclo |
|---:|---:|---:|---:|---:|---:|---|---|
| 7 | 358.909 | 152 | 669 | 112 | 142 | exatos | OK |
| 42 | 360.927 | 161 | 679 | 102 | 142 | exatos | OK |
| 1337 | 354.785 | 159 | 671 | 110 | 145 | exatos | OK |

Checksums esperados e observados:

`[-2.1109608642076587, 6006995, 2176958, 60300]`

Os 12 ensaios com hooks genéricos em `string.char`, `string.sub`,
`string.format` e `table.concat` recuperaram 0/82 literais longos. Todos
preservaram o ciclo de vida do controlador.

## Comparação estrutural delimitada

| Artefato (seed 42 quando aplicável) | Bytes | Funções | `elseif` | repetição deslizante de janelas de 64 bytes |
|---|---:|---:|---:|---:|
| Luraph v15.1 fornecido | 334.295 | 113 | 335 | 2,30% |
| Lurapy v4.2 | 290.311 | — | — | 11,92% |
| Lurapy v4.3 | 360.927 | 142 | 451 | 8,74% |

A v4.3 reduziu a repetição estrutural da v4.2 e ficou na mesma ordem de tamanho
do exemplo Luraph. Ainda repete mais janelas e tem mais funções/ramificações. A
semelhança de tamanho ou aparência não mede resistência à recuperação.

## Integridade

Dois testes alteram um byte:

- diretamente na cápsula emitida pelo gerador;
- numa string de aplicação do artefato final produzido pelo engine.

Ambos falham com `E_INTEGRITY`. O tag está dentro do próprio artefato. Um
atacante que compreenda e reescreva payload, descritor e tag pode contorná-lo;
portanto, o mecanismo detecta corrupção e modificações diretas, não autoria.

## Limites

- A v4.3 continua sendo um interpretador entregue junto com os dados. Tudo que
  o cliente executa pode ser observado ou modelado por um atacante dedicado.
- A dependência de ordem impede a enumeração isolada da v4.2, mas não impede
  uma simulação completa e ordenada do fluxo.
- Os resultados de hooks cobrem quatro interfaces genéricas; não cobrem hooks
  específicos no frame, nos descritores ou no ponto de consumo.
- A compatibilidade funcional foi testada no runtime Luau local. Roblox Studio
  ainda precisa validar scripts reais, APIs Roblox, erros e coroutines.
- O Level 3 Hardened v4.3 é selecionado para Luau/Roblox. Isto não transforma o
  mesmo executor em uma VM Lua 5.1 genérica.
- Nenhum resultado deste relatório autoriza a expressão “nível Luraph”.

## Validação do repositório

- testes focados v4.3: 67/67 aprovados;
- suíte sem os dois arquivos que exigem `/usr/bin/lua`: 513/513 aprovados;
- suíte integral: 550 aprovados, 14 ignorados e 25 falhas `ENOENT` causadas
  exclusivamente pela ausência de `/usr/bin/lua` antes da execução;
- lint: código de saída 0, com 136 avisos históricos e nenhum erro;
- build Vite: aprovado; o build avisou sobre o asset remoto de dunas e o tamanho
  do bundle, sem interromper a geração.

Os testes locais não substituem Roblox Studio.

Dados brutos: `audit/current-v43/audit.json`.


# Mudanças da Hardened VM v4.2

> Registro histórico. As alterações atuais estão em
> `CHANGES-HARDENED-V4.3.md`.

## Motor

- O Level 3 de Luau/Roblox seleciona v4.2 por padrão no site e na CLI.
- O backend legado continua disponível somente como rollback explícito.
- A tabela aritmética pública do Level 3 antigo deixa de aparecer na saída
  padrão.
- Os 24 materializadores usam quatro estruturas de laço, três primitivas de
  byte, duas direções, limites de fragmento diferentes, expressões de seleção
  diferentes e permutações próprias de argumentos.
- A seleção da cápsula continua ligada ao estado real de entrada da região.
- O metadado passa a registrar engine `2026.10.hardened-v4.2` e revisão 2.

## Interface e CLI

- `VITE_LURAPY_LEGACY_LEVEL3=1` faz rollback do site.
- `LURAPY_LEGACY_LEVEL3=1` faz rollback da CLI.
- A opção removida “Disable line information” continua ausente e ignorada em
  históricos antigos.

## Evidência

- 64/64 testes focados passaram.
- 510/510 testes da suíte executável neste ambiente passaram.
- Build de produção concluído.
- 12/12 execuções da matriz de hooks preservaram o KB e recuperaram 0/82
  literais longos por retorno direto.
- Três artefatos KB passaram com os quatro checksums exatos e
  `MOCK_LIFECYCLE_OK`.

Os resultados não provam paridade com Luraph nem resistência contra um extrator
feito especificamente para a v4.2.

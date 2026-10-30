# Lurapy Hardened VM v4.1 — implementação e evidência

> Documento histórico. A versão atual é a v4.3; consulte
> `HARDENED-V4.3-REPORT.md`.

Data: 29/10/2026

## Resposta direta

O projeto recebido foi corrigido e ganhou uma candidata Level 3 realmente melhor que a v4 presente no ZIP. Ela fecha o ponto único de reconstrução por `table.concat`, liga cada cápsula ao estado de entrada da região, remove os pares explícitos `{estado, ciphertext}` dos sites de constantes, distribui 781 cápsulas por 24 materializadores e aplica de verdade as opções de hardening escolhidas.

Isso aproxima algumas propriedades observáveis de uma VM comercial polimórfica, mas **não demonstra equivalência ao Luraph**. O artefato continua contendo interpretador, estados, ciphertexts e lógica de reconstrução; um analisador de fluxo completo ainda pode reconstruí-los. A candidata permanece atrás de flag interna até passar no Roblox Studio.

## O que foi alterado

### Constantes ligadas ao fluxo

- A v4 recebida calculava a chave com uma expressão que se cancelava e terminava estática por região/site.
- A v4.1 usa o estado de entrada real da aresta na chave da cápsula.
- Cada região confere estado e integridade antes de executar: alterar somente o estado aborta com erro interno.
- Uma constante usada em entradas diferentes recebe ciphertexts diferentes.
- O descritor não publica mais o estado ao lado do ciphertext. Um seletor afim esparso escolhe a variante; para recuperar o valor, o atacante precisa associar o site à região e aos estados aceitos.

### Reconstrução sem ponto único público

- `table.concat` foi removido do caminho de reconstrução e dos guards da candidata.
- Foram criadas 24 funções locais independentes, sem uma tabela central de decoders que possa ser percorrida com um único wrapper.
- As funções alternam seis formas: `string.char`, byte carrier com `string.sub`, `string.format('%c')` e suas versões reversas.
- No KB, cada materializador atende 32 ou 33 das 781 cápsulas.
- Os byte carriers contêm as 256 possibilidades, em permutações afins, e não armazenam um dicionário de texto original.

### VM e emissão

- Regiões usam bancos de registradores permutados e cópia paralela nas transições.
- A execução usa três famílias reais de dispatch.
- Estados de aresta, integridade regional e época de back-edge são verificados.
- Macro-opcodes executáveis continuam restritos aos padrões com semântica comprovada; o KB gerou `GLOBAL_KEY_TABLE`, `LOADK_COMPARE_BRANCH` e `TABLE_CALL`.
- Os nomes finais continuam sendo renomeados e os números normalizados pela emissão do projeto.

### Integração

- As opções `antiTamper`, `antiDebug`, `envLock` e `robloxEnvLock` agora alteram os bytes da v4.1; antes eram apenas registradas em metadados no caminho v4.
- A candidata pode ser selecionada no CLI com `LURAPY_INTERNAL_HARDENED_VM=4`.
- O site pode selecioná-la somente em build privado com `VITE_LURAPY_INTERNAL_HARDENED_VM=4` e apenas no Level 3.
- Sem a flag, o backend publicado continua sendo o legado.
- A opção antiga **Disable line information** continua retirada: valores históricos são aceitos e ignorados, não são persistidos e não mudam os bytes.
- `.env` foi excluído da entrega; `.env.example` documenta as chaves. Os valores atuais devem permanecer no gerenciador de secrets do Lovable/Supabase.

## Resultados medidos

Todos os números abaixo vêm dos arquivos em `benchmarks/hardened-v4.1/runs/`.

### Tamanho do KB

| Seed | Backend legado | v4 original do ZIP | v4.1 | Redução v4 → v4.1 | v4.1 / legado |
|---:|---:|---:|---:|---:|---:|
| 7 | 57.081 B | 435.924 B | 285.411 B | 34,5% | 5,00× |
| 42 | 56.243 B | 444.437 B | 283.998 B | 36,1% | 5,05× |
| 1337 | 56.319 B | 445.875 B | 283.557 B | 36,4% | 5,03× |

### Execução no controlador Luau local

| Seed | Legado | v4 original | v4.1 | Redução v4 → v4.1 | v4.1 / legado |
|---:|---:|---:|---:|---:|---:|
| 7 | 0,559 s | 2,284 s | 1,865 s | 18,3% | 3,34× |
| 42 | 0,553 s | 2,264 s | 1,631 s | 28,0% | 2,95× |
| 1337 | 0,557 s | 2,509 s | 1,578 s | 37,1% | 2,83× |

Esses tempos são uma observação local do KB, não um benchmark de Roblox Studio.

### Matriz de hooks públicos, seed 42

Um processo separado substituiu exatamente uma primitiva pública e registrou a string completa devolvida por cada chamada.

| Artefato | Hook | Maior retorno | Literais longos exatos |
|---|---|---:|---:|
| v4 original | `table.concat` | 80 B | 20/82 |
| v4.1 | `table.concat` | nenhuma chamada | 0/82 |
| v4.1 | `string.char` | 1 B | 0/82 |
| v4.1 | `string.sub` | 1 B | 0/82 |
| v4.1 | `string.format` | 1 B | 0/82 |

Isso prova que o dump antigo por uma única primitiva pública foi fechado para esse artefato. Não prova resistência a patch estático dos 24 materializadores.

### Superfície estática simples

Nos três artefatos v4.1, tokens de string visíveis continham 0/82 literais longos exatos do KB. Isso mede apenas presença literal; um avaliador que interprete seletor, fluxo e decoder é uma ameaça mais forte.

### Correção funcional

- Nove artefatos (legado, v4 original e v4.1, três seeds) produziram os mesmos quatro checksums: `-2.1109608642076587`, `6006995`, `2176958`, `60300`.
- Todos concluíram `MOCK_LIFECYCLE_OK`.
- 260 testes selecionados passaram, incluindo 78 testes próprios da v4.1 e o KB completo.
- `npm run build` passou.
- `npm run typecheck` passou após separar o código de produção dos testes históricos incompletos.

## Limites que continuam abertos

- Não há prova de paridade com Luraph e não há acesso à implementação interna do Luraph.
- Um atacante pode identificar os materializadores, extrair estados aceitos das regiões e executar uma análise de fluxo. A v4.1 aumenta o trabalho; não torna a recuperação impossível.
- A campanha S0–S6 histórica não pôde ser repetida porque o ZIP do site não continha os módulos de benchmark importados por esses testes. Eles não foram recriados nem declarados aprovados.
- O Roblox Studio não está disponível neste ambiente. Yields, APIs Roblox reais e desempenho em dispositivos ainda precisam da matriz no Studio.
- O custo ainda é alto: aproximadamente 5× o tamanho e 2,8×–3,3× o tempo do backend legado no KB.
- Anti-debug e anti-hook são atrasos, não fronteiras de segurança. Código que precisa rodar no cliente sempre pode ser observado por um atacante com controle do runtime.

## Arquivos principais

- `src/lib/obfuscator/hardened-v4.ts`: cápsulas, regiões, dispatch e materializadores.
- `src/lib/obfuscator/engine.ts`: integração, hardening ativo e metadados.
- `src/lib/obfuscator/obfuscations/hardening.ts`: guards sem `table.concat`.
- `src/hooks/useObfuscationJob.ts`: flag privada do site.
- `src/test/hardened-v4.test.ts`: equivalência, adulteração e estrutura.
- `benchmarks/hardened-v4.1/`: geração, inspeção, matriz de hooks e resultados brutos.

## Ativação recomendada

1. Implantar o projeto mantendo a flag vazia.
2. Criar uma preview privada com `VITE_LURAPY_INTERNAL_HARDENED_VM=4`.
3. Validar no Roblox Studio os scripts reais, callbacks, coroutines, metamétodos e APIs Roblox.
4. Comparar tempo, tamanho e erros com o backend atual.
5. Ativar gradualmente somente depois dessa validação. Não publicar como “nível Luraph”; publicar como Hardened VM v4.1 experimental até nova auditoria artifact-only.

# Pesquisa técnica — ofuscação Lua/Luau e recuperação

Data de corte: 30/10/2026.

## Método e limites

Foram usados código-fonte público versionado, documentação no próprio código e
os artefatos fornecidos nesta campanha. Marketing, tabelas sem método e nomes
de recursos sem amostra reproduzível não foram tratados como evidência.

Fontes públicas conferidas:

| Projeto | Commit conferido | Uso nesta análise |
|---|---|---|
| [LuraphDeobfuscator](https://github.com/PhoenixZeng/LuraphDeobfuscator) | `cea768add7fb03ad24cda33cb7a6ba0b0cda5a75` | pipeline público de recuperação de Luraph antigo |
| [Prometheus](https://github.com/Prometheus-Lua/Prometheus) | `0d3e287c2fd9ef927e210268ea0a8bb1e7a4d581` | ofuscador público atual e composição de passos |
| [Prometheus-Deobfuscator](https://github.com/0x251/Prometheus-Deobfuscator) | `7d0582fc2d150713941f02f8988323629dd054e7` | ataques por padrões, constantes e dispatch |
| [Luau](https://github.com/luau-lang/luau) | `a4818b6678822bb726a0eb2299cae751d3017a6a` | semântica e implementação do runtime alvo |
| [unluac](https://github.com/viruscamp/unluac) | `9c59af46483a932a47224bf2ac84ad8a63094da5` | reconstrução de fonte a partir de bytecode Lua |
| [luadec](https://github.com/viruscamp/luadec) | `895d92313fabaee260121c758c8320d1b21dd741` | referência histórica de decompilação Lua |

O LuraphDeobfuscator declara testes somente entre Luraph v11.5 e v11.8.1. Ele
não prova que a v15 ou a v15.1 foi quebrada. As observações sobre v15.1 abaixo
vêm exclusivamente da amostra fornecida, cujo SHA-256 é
`f4ea7ae704160f8aa369dd0126dd8c685bb6938cac6d7161f7be9a077dd61ff9`.

Os sites/documentos oficiais do Luarmor e do Luraph não ficaram acessíveis de
forma reproduzível neste ambiente, e não foi localizada uma implementação
pública verificável do Luarmor. Por isso, não são atribuídos algoritmos internos
ao Luarmor. Recursos comerciais observáveis, como autenticação/licenciamento,
não são confundidos com resistência do bytecode.

## O que os recuperadores públicos realmente fazem

### Luraph antigo

O README e o código do LuraphDeobfuscator mostram uma sequência mais forte que
procurar nomes ou formatar a saída:

1. analisar o Lua em AST e resolver símbolos;
2. otimizar expressões e fluxo;
3. identificar handlers pelo efeito semântico;
4. recuperar chaves/rotinas do loader;
5. executar simbolicamente a carga de constantes, instruções e protótipos;
6. resolver redirecionamentos entre handlers;
7. remover truques anti-decompiler;
8. reconstruir bytecode Lua e aplicar otimizações de CFG.

Em `LuraphDevirtualizer.java`, handlers como MOVE e LOADK são reconhecidos pela
forma das leituras e escritas, e não pelo número do opcode. Isso ensina duas
coisas: permutar IDs só altera o rótulo; e várias aparências com o mesmo efeito
podem ser agrupadas depois de uma normalização.

### Prometheus

O Prometheus público combina VM baseada em registradores, array de constantes,
cifra de strings, anti-tamper, divisão de strings e transformações de fluxo. O
repositório também deixa claro que suporte a Luau não equivale a cobrir toda a
semântica do Roblox. A existência de um deobfuscador público baseado em
constantes, dispatch, propagação e padrões mostra o custo de manter estruturas
estáveis entre gerações.

O Prometheus-Deobfuscator possui partes dependentes de padrões e expressões
regulares; ele é evidência de superfície atacável, não uma prova universal de
recuperação correta. Sua utilidade para o Lurapy é adversarial: qualquer tabela,
helper ou dispatcher repetido deve ser considerado uma possível assinatura.

### Decompiladores Lua/Luau

unluac e luadec atacam uma etapa posterior: dado bytecode reconhecido, tentam
reconstruir estruturas de alto nível. Assim, impedir um dump central do pool não
basta. Se um lifter recuperar instruções, operandos, arestas e protótipos, um
decompilador convencional volta a ser útil.

O runtime Luau mantém constantes e código em protótipos internos e executa uma
VM de registradores. A compatibilidade exige preservar avaliação única,
metamétodos, múltiplos retornos, closures/upvalues, erros, iteração e coroutines.
Transformações que quebram esses contratos são bugs, mesmo quando dificultam
uma ferramenta de análise.

## Observações da amostra Luraph v15.1

A amostra fornecida tem 334.295 bytes, 113 tokens `function`, 335 `elseif` e
nenhuma longa sequência decimal de `string.char`. Ela usa uma grande estrutura
de funções indexadas, transições por tuplas/múltiplos retornos e leitura de
dados indireta. A repetição deslizante de janelas idênticas de 64 bytes foi
2,30%, com máximo de 12 ocorrências da mesma janela.

Essas observações sustentam somente propriedades da emissão:

- menor repetição de moldes;
- maior fragmentação da topologia;
- transições com dados misturados ao controle;
- ausência das assinaturas antigas do Lurapy.

Elas não revelam o algoritmo interno completo da v15.1 e não permitem afirmar
que todas as constantes estejam protegidas, que exista criptografia secreta ou
que a fonte seja irrecuperável.

## Confronto com Lurapy v4.2

Pontos que funcionaram:

- a tabela aritmética pública de 137 entradas saiu da produção;
- hooks genéricos de string não recuperaram os 82 literais longos do KB;
- regiões, layouts e famílias reduziram a leitura direta da VM;
- os checksums funcionais e o ciclo de vida foram preservados.

Pontos que falharam ou ficaram fracos:

- 781 chamadas de decodificação ainda eram autossuficientes;
- 910 combinações de estado puderam ser enumeradas fora do fluxo real;
- uma alteração de byte em constante consumida não foi detectada;
- 24 materializadores repetiam demasiada estrutura;
- os nomes fixos dos campos do frame ajudavam a alinhar protótipos;
- a emissão seed 42 repetia 11,92% das janelas deslizantes de 64 bytes, contra
  2,30% na amostra Luraph;
- não havia ataque público independente que acompanhasse toda a ordem regional.

## Decisões implementadas na v4.3

### 1. Constantes ligadas à sequência

O descritor agora é alcançado por um índice derivado do estado acumulado. Cada
decodificação avança esse estado e a ordem esperada. A chamada isolada deixou de
conter o pacote completo de parâmetros. Para extrair tudo, o atacante precisa
reconstruir uma entrada válida da região e simular a sequência.

Isto corrige o ataque isolado demonstrado. Não impede um analisador de fluxo.

### 2. Integridade por conteúdo

O materializador calcula um checksum sobre os bytes produzidos e compara com o
tag do descritor. A edição direta que antes trocava um título agora falha. Como
tag e verificador são públicos, isto é detecção de alteração, não MAC.

### 3. Menos ocorrências independentes

Repetições na mesma região usam cache. O KB caiu de 781 chamadas observadas na
v4.2 para 669–679 na v4.3, com 102–112 reusos. A redução não é uma pontuação de
segurança; elimina superfícies redundantes e custo de runtime.

### 4. Topologia e frame

Slots do frame mudam por protótipo. Regiões são maiores e três estilos de
dispatch coexistem com distribuição ponderada. A repetição deslizante de 64
bytes caiu de 11,92% para 8,74% na seed 42. O resultado ainda está acima dos
2,30% da amostra Luraph.

## Próximas melhorias sustentadas

Estas frentes têm critério técnico e devem ser implementadas isoladamente:

1. **Atacante artifact-only com fluxo:** interpretar as regiões da v4.3 a partir
   somente do artefato e medir valores, ocorrências e consumidores. O próximo
   motor deve responder a uma recuperação demonstrada por esse atacante.
2. **Superoperadores com eliminação real de intermediários:** selecionar árvores
   de IR somente quando efeitos, erros, metamétodos e múltiplos retornos forem
   preservados. Fundir texto sem remover o estado observável não basta.
3. **Especialização por protótipo:** gerar famílias de transição e materialização
   a partir do uso real de cada função, com limite de tamanho e custo. O objetivo
   é reduzir moldes globais, não apenas criar mais helpers equivalentes.
4. **Slicing adversarial no CI:** normalizar bindings, aritmética, tabelas e
   closures; comparar a IR comum entre sementes. Incompleto deve ser registrado
   como incompleto, nunca como resistência.
5. **Matriz semântica Roblox Studio:** testar APIs Roblox, `__iter`, coroutines,
   erros, closures escapadas e scripts reais. O runtime local não substitui isso.
6. **Orçamento:** registrar bytes, geração, inicialização, execução e memória em
   repetições balanceadas. Uma observação isolada não sustenta ganho.

Não foram recomendados predicados opacos caros, checks anti-debug destrutivos,
loops inúteis ou multiplicação indiscriminada de handlers. Essas técnicas
frequentemente aumentam tamanho e custo sem criar trabalho residual após
normalização.

## Cenários mínimos para a próxima rodada

- três sementes públicas e sementes reservadas congeladas antes do teste;
- constantes repetidas, iguais em regiões diferentes e em branches distintos;
- joins, loops e retornos ao início da região;
- nil/false, NaN, infinito, `-0`, bytes NUL e strings binárias;
- closures, upvalues fechados, recursão e closures escapadas;
- múltiplos retornos, varargs, tail calls, erros e coroutines;
- metamétodos de tabela, aritmética, concatenação e iteração;
- alteração de payload, descritor, tag, aresta, ordem e cache;
- comparação de saída, erros observáveis e efeitos, não apenas checksums;
- hooks genéricos e hooks específicos no ponto de consumo;
- medição separada de cobertura, precisão e custo.


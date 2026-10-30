# Prompt para o Lovable — substituir pelo Lurapy Hardened VM v4.1

> Prompt histórico da entrega v4.1. Não use para a v4.3 publicada neste
> repositório.

Substitua o projeto atual pelo conteúdo do arquivo `Lurapy-site-hardened-v4.1.zip`. Não tente restaurar essas mudanças pelo histórico e não reaplique apenas partes visuais: os arquivos do ZIP são a fonte da entrega.

## Objetivo

Integrar a Hardened VM v4.1 como candidata privada de Level 3, preservando o backend legado como padrão e mantendo rollback simples. Esta entrega corrige vulnerabilidades concretas da v4 anterior, mas não deve ser anunciada como equivalente ao Luraph.

## Procedimento obrigatório

1. Faça uma cópia do projeto atual e registre o commit/hash anterior.
2. Extraia o ZIP e substitua os arquivos correspondentes do projeto.
3. Não copie o `.env` do ZIP anterior. Preserve no gerenciador de secrets os valores atuais de Supabase e use `.env.example` como inventário.
4. Execute `npm install`; o `package-lock.json` entregue está sincronizado. Fora do ambiente Lovable, não use o cache privado registrado nos lockfiles antigos do Bun.
5. Execute `npm run typecheck` e `npm run build`.
6. Execute os testes listados em `REPRODUCE-HARDENED-V4.1.md` quando houver um runtime Luau disponível.
7. Compare os SHA-256 e resultados de `benchmarks/hardened-v4.1/runs/` com o manifesto da entrega.
8. Faça uma preview privada com `VITE_LURAPY_INTERNAL_HARDENED_VM=4`.
9. Mantenha essa variável vazia em produção até eu concluir os testes no Roblox Studio.

## Comportamento que deve permanecer

- Levels 1 e 2 continuam no backend legado.
- Level 3 continua no backend legado quando a flag interna está ausente.
- Level 3 usa v4.1 somente quando `VITE_LURAPY_INTERNAL_HARDENED_VM=4`.
- CLI usa v4.1 somente com `LURAPY_INTERNAL_HARDENED_VM=4`.
- Targets fora de Roblox/Luau e modos incompatíveis devem falhar de forma explícita, sem fallback silencioso.
- A opção `Disable line information` permanece removida da interface, configuração e novas gravações. Chaves históricas podem ser aceitas apenas para compatibilidade, devem ser ignoradas e não podem alterar bytes.
- Nenhum módulo de benchmark pode ser importado pelo código de produção.

## Mudanças de segurança que não podem ser desfeitas

- Não reintroduza `table.concat` na reconstrução de constantes ou nos guards da v4.1.
- Não volte a guardar `{estado, ciphertext}` em cada cápsula.
- Preserve a chave ligada ao estado real de entrada e a verificação de integridade regional.
- Preserve os seletores esparsos de variantes.
- Preserve os 24 materializadores locais independentes e o balanceamento por round-robin embaralhado.
- Preserve as seis formas de materialização (`char`, byte carrier por `sub`, `format`, diretas e reversas).
- Preserve as três famílias de dispatch e os mapas regionais de registradores.
- Preserve a aplicação real das opções `antiTamper`, `antiDebug`, `envLock` e `robloxEnvLock` antes da renomeação final.
- Não transforme a v4.1 em uma tabela central de handlers/decoders que possa ser envolvida por um único loop de hook.

## Gates antes de ativar no site

- Os quatro checksums do KB devem ser exatamente `-2.1109608642076587`, `6006995`, `2176958`, `60300` em três seeds.
- `MOCK_LIFECYCLE_OK` deve aparecer em todos os artefatos.
- A matriz de hooks da v4.1 deve manter 0/82 literais longos para hooks isolados em `table.concat`, `string.char`, `string.sub` e `string.format`.
- `table.concat` deve ter zero chamadas no caminho v4.1 do KB.
- Cada um dos 24 materializadores deve atender no máximo `ceil(capsules/24)` sites; no KB atual são 32–33.
- Adulterar o estado de entrada sem atualizar sua integridade deve abortar.
- O artefato v4.1 não pode conter `\\xHH`.
- Não aceite regressão funcional em closures, upvalues, varargs, nil/false, múltiplos retornos, metamétodos, erros, loops genéricos ou coroutines.

## Validação obrigatória no Roblox Studio

Antes de promover, teste pelo menos:

- LocalScript e ModuleScript;
- callbacks que sobrevivem ao retorno do chunk principal;
- coroutines com yield/resume;
- closures em loops e upvalues compartilhados;
- `pcall`/`xpcall`, metamétodos e múltiplos retornos;
- APIs Roblox usadas pelos scripts reais;
- três seeds por fixture;
- tempo de inicialização, tempo da ação principal, memória e tamanho;
- comportamento com cada toggle de hardening habilitado individualmente e em conjunto.

Se qualquer caso falhar, mantenha o backend legado ativo e entregue o log e a fixture mínima. Não faça fallback silencioso e não corrija removendo a proteção responsável sem uma comparação causal.

## Relatório que você deve devolver

Entregue:

- lista exata de arquivos substituídos;
- commit/hash anterior e novo;
- saída de typecheck e build;
- testes executados, aprovados, falhos e não executados;
- confirmação de que os secrets existentes foram preservados fora do ZIP;
- valor da flag em preview e produção;
- resultados do Roblox Studio;
- qualquer divergência em relação a `HARDENED-V4.1-REPORT.md`.

Não escreva “proteção nível Luraph”, “indeobfuscável” ou “paridade Luraph”. A descrição correta nesta etapa é: **Hardened VM v4.1 experimental, com brechas específicas da v4 anterior corrigidas e promoção condicionada à validação no Roblox Studio e a uma nova análise artifact-only**.

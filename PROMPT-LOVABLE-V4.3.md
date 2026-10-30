# Prompt para o Lovable — substituir pelo Lurapy Hardened VM v4.3

Use o repositório público `https://github.com/kust3r/Lua-Armor`, branch `main`,
no commit informado pelo proprietário após esta entrega. Substitua o código do
projeto pelo conteúdo desse commit. Não copie somente o motor e não combine
arquivos da versão anterior.

## Regras obrigatórias

1. Preserve as variáveis secretas já cadastradas no Lovable/Supabase. Não
   substitua `.env`, não publique chaves e não copie valores de exemplo sobre a
   configuração existente.
2. Preserve o projeto Supabase, autenticação, banco, domínio e usuários atuais.
3. Use `npm ci` a partir do `package-lock.json` do commit.
4. Não reative “Disable line information”; a opção foi removida e deve continuar
   ausente da UI, configuração salva, request e gerador.
5. Level 3 em Luau/Roblox deve usar Hardened VM v4.3 por padrão. A variável
   `VITE_LURAPY_LEGACY_LEVEL3` não deve estar definida como `1` na produção.
6. Não altere os arquivos em `audit/current-v43` e não regenere a evidência com
   entradas diferentes.
7. Não descreva a versão como “igual ao Luraph”. Use a descrição factual:
   constantes ordenadas por região, slots permutados, cache regional e detecção
   de edições diretas.

## Procedimento

1. Faça backup da configuração de ambiente do projeto atual.
2. Importe todos os arquivos do commit novo.
3. Reaplique somente os valores das variáveis de ambiente preservadas.
4. Confirme que `tailwind.config.js` inclui extensões `js`, `jsx`, `ts` e `tsx`.
5. Execute:

   ```bash
   npm ci
   npm run lint
   npm run build
   ```

6. Se o ambiente possuir Luau, execute:

   ```bash
   LUAU_BIN=/caminho/para/luau npx vitest run \
     src/test/hardened-v43.test.js \
     src/test/hardened-v43-selection.test.jsx \
     --maxWorkers=1
   ```

7. Publique primeiro em preview.
8. No preview, entre com uma conta de teste e ofusque um script Luau no Level 3.
9. Confirme nos metadados do job:
   - `engineVersion = 2026.10.hardened-v4.3`;
   - `hardenedVmVersion = 4`;
   - `hardenedVmRevision = 3`;
   - `usedLevel = 3`.
10. Execute o artefato em Luau/Roblox Studio e compare saída, efeitos, erros e
    coroutines com o original.
11. Promova o preview somente depois dessas verificações.

## Critérios de rejeição

Interrompa a publicação e entregue o log completo se ocorrer qualquer item:

- fallback silencioso para o backend legado;
- revisão diferente de 3;
- erro de build ou teste;
- `.env` ou credencial presente no commit/build;
- opção “Disable line information” reaparecendo;
- diferença funcional entre original e ofuscado;
- artefato Level 3 contendo a antiga tabela aritmética pública de 137 entradas;
- alteração de um byte numa constante usada continuar executando sem
  `E_INTEGRITY`.

## Relatório final esperado

Informe o commit importado, comandos e códigos de saída, URL do preview, versão
observada nos metadados, resultado do teste no Studio e eventuais limitações.
Não resuma falhas como “tudo certo”; inclua o primeiro erro completo.


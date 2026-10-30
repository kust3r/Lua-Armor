# Alterações — Hardened VM v4.3

## Motor

- revisão do backend: 3;
- versão pública do engine: `2026.10.hardened-v4.3`;
- 12 famílias de materializador, com layouts de descritor independentes;
- lookup duplamente indireto do descritor a partir do estado acumulado;
- ordem de cápsulas conferida no runtime;
- estado de cápsula atualizado após cada valor;
- checksum por conteúdo decodificado com falha `E_INTEGRITY`;
- cache regional para ocorrências repetidas;
- slots do frame permutados por protótipo;
- regiões de 24–40 operações;
- distribuição ponderada de regiões inline/closure, mantendo as três famílias.

## Site e seleção

- Level 3 continua selecionando o backend v4 por padrão em Luau/Roblox;
- rollback legado continua explícito pelas variáveis documentadas;
- Tailwind inclui arquivos JavaScript e JSX na descoberta de classes;
- credenciais e `.env` não fazem parte da entrega;
- “Disable line information” continua removido.

## Testes novos

- rejeição de edição de um byte na cápsula;
- rejeição de edição de um byte no artefato final;
- uso obrigatório de estado/ordem e cache de repetidos;
- metadados de revisão 3;
- 48 combinações funcionais (16 cenários × 3 sementes);
- campanha KB com três sementes e 12 execuções de hooks.

## Compatibilidade

Nenhuma mudança foi feita no formato de configuração salvo, autenticação,
Supabase ou contrato visual do fluxo de ofuscação. O rollback legado continua
disponível para resposta operacional. O novo backend Level 3 continua restrito
a Luau/Roblox e execução direta.


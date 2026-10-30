# Hardened VM v4.3 — 30/10/2026
- [x] Reproduzir a superfície da v4.2: 781 chamadas isoláveis, 910 combinações enumeráveis e alteração de byte sem rejeição.
- [x] Ligar descritores à ordem regional, permutar slots por protótipo, reutilizar constantes repetidas e verificar conteúdo decodificado.
- [x] Executar KB em seeds 7/42/1337: quatro checksums e lifecycle exatos; 12 hooks com 0/82 literais longos.
- [x] Validar 67 testes focados, 513 testes independentes de Lua 5.1, lint sem erros e build de produção.
- [x] Registrar fontes públicas e limites de Luraph v11/v15.1, Prometheus, decompiladores Lua/Luau e indisponibilidade de evidência reproduzível do Luarmor.
- [ ] Executar no Roblox Studio e construir atacante artifact-only com fluxo para medir a recuperação ordenada da v4.3.
- Limite: a nova sequência aumenta o trabalho do extrator, mas continua simulável; não anunciar paridade Luraph.

# Importação Hardened VM v4.1 — 29/10/2026
- [x] Rollback/hash anterior salvo; 33 arquivos novos/substituídos do ZIP verificado; secrets, Cloud e históricos intactos.
- [x] 260 testes selecionados aprovados após repetição com menor concorrência; nove KB regenerados byte-idênticos; checksums/lifecycle/estrutura exatos; 12 hooks em três seeds com 0/82 longos e zero concat; runs recebidos preservados.
- [x] Flag 4 em .env.development somente; produção sem flag; nenhuma publicação. Login e worker real do navegador conferidos; seleção isolada em 12 testes.
- [x] Relatório/inventário/hashes e logs de importação preparados; build automático OK. npm/typecheck/build manuais não executados pela política deste ambiente (bun install utilizado).
- [ ] Roblox Studio e nova análise artifact-only: gates externos não executados, impedem promoção.
- [ ] Fluxo autenticado completo da interface: bloqueado por chave de acesso não disponível; não simulado como validação real.

# Hardened VM v4 — mandato posterior 29/10/2026
- [x] Integrar candidata executável no Level 3 sob flag interna; preservar padrão e Levels 1/2; CLI interna verificada.
- [x] Reutilizar fundação FunctionIR em módulo de produção; emitir regiões/cápsulas/fusões/layout/dispatch (dependência causal forte NÃO estabelecida).
- [x] Validar matriz Luau e KB em três seeds; corrigir regressões observadas; Lua5.1/política/toggles fora da compatibilidade desta candidata e declarados no relatório.
- [x] Revisão mínima separada; 12 ataques supervisionados, scores censurados por unsupported/unknown/RSS, não proteção.
- [x] Hook único medido: 89/94 e 77/82 nas três seeds; gates REPROVADOS, candidata permanece interna.
- [x] Conferir opção retirada e preparar fontes/patches/logs/JSON/hash avulsos.
- [ ] Roblox Studio e promoção geral — bloqueadas: execução externa de Studio indisponível e gates locais reprovados; nenhuma publicação.
- Resultado desta candidata: REJEITADA para proteção/promoção, não trabalho de implementação pendente silencioso.

# Atacante artifact-only e candidata causal única — 29/10/2026
- [x] Atacante S0–S6 independente em benchmarks/artifact-only-v1 (artefato apenas; 19 testes); revisão independente aplicada em parte.
- [x] Fixtures públicas em 3 seeds (57 artefatos), supervisão 512 MiB/45 s, controles KB, estático-only Luraph/RealTest; invariância de renomeação/layout no KB.
- [x] Freeze por pins.json (com desvio divulgado em pins-addendum.json) e reservadas criadas depois, analisadas uma vez.
- [x] Relatório (REPORT.md) com limites explícitos.
- [ ] Candidata causal + 4 ablações — BLOQUEADA: atacante só com capacidade parcial (G4/G5 falham no KB), consumidor não medido, solidez de caminhos desconhecidos aberta, invariância incompleta.
- [ ] Revisão rev1 do atacante (invalidar derivados após caminhos desconhecidos; verificador de evidência no scorer) — nova revisão, não editar congelados.

# Fundação da revisão de VM — 29/10/2026
- [x] Implementar análise offline CFG/efeitos/liveness/constantes por uso e elegibilidade de cinco padrões; 27 testes novos + 11 contratos existentes aprovados, seis controles compilados/analisados, sem executar Lua. Revisão independente e regressão numérica corrigida no modelo; run1 preservado e run2 aprovado.
- [x] Confrontar tokens afins por época: inversa pública recupera 4 estados/5 arestas; hipótese REJECTED, sem emissão ou reabertura de candidatas antigas.
- [x] Validar preservação por hashes e preparar fontes/evidências avulsas; sem promoção/publicação.
- [ ] Integração de uma nova VM/proteção bloqueada: fórmula testada falha no gate causal; handlers fundidos, cápsulas e validação Studio não estão implementados/aprovados.


# Ajustes finais do seletor de nível — 29/10/2026
- [x] Fim quadrado do preenchimento escondido sob a bolinha, partículas do Level 3 saem de trás do disco branco opaco e maiores, três marcações de 6px. Conferido na tela (Level 1, arraste até o 3 e Level 3 parado); testes do seletor passam.
- [x] Botão de abrir o slider com a mesma cor e borda das três barrinhas do topo; degradê e estrelinhas somente no Level 3; sem a setinha ao lado de "Proteção leve". Conferido na tela: fundo, borda superior, borda lateral e cor do texto idênticos ao disco do menu; opacidade 0 no Level 1/2 e 1 no Level 3; nenhum ícone na descrição.
- [x] Bolinhas brancas e degradê de fundo se movendo de forma totalmente suave e devagar. Piscar das estrelas em ciclos de 6,9–11,7s; deriva do degradê em 32s e das estrelas em 46s, conferida na tela (deslocamento de ~1–3px em 2,5s); parada com movimento reduzido. 14 testes do seletor passam.
- [x] Três marcadores de posição de volta na trilha: exatamente uma bolinha por nível, centrada nas coordenadas do thumb (16,5px / 134px / 251,5px numa trilha de 268px), visível nos Levels 1 e 2 e sumindo com transição suave no Level 3. Conferido na tela com as três posições medidas; 18 testes do seletor passam.

# Brilho do estágio durante a ofuscação — 29/10/2026
- [x] Cada cor passa uma única vez por ciclo (amarelo, rosa, azul), sem repetição; rotação de paletas por JavaScript removida e módulo correspondente excluído.
- [x] Ciclo mais lento (15s, ~5s por cor) e azul fortalecido #6F93FF, inspirado no azul Lovable #4B73FF; varredura sem salto na reinício (deslocamento exato de um azulejo).
- [x] Medido na tela com o CSS real: 60 quadros em 15s mostram amarelo → rosa → azul, um de cada, e o laço não salta. 4 testes novos em src/test/obf-shimmer.test.ts; build OK.
- [x] Movimento reduzido respeitado: a varredura para e o texto volta ao tom discreto. A regra antiga estava sem efeito (perdia por ordem de fonte); corrigida e conferida no navegador (animação nenhuma, sem degradê).
- [ ] Conferência dentro da ofuscação real — bloqueada: a área de trabalho exige a chave de acesso, que não está disponível para teste automatizado; validar na prévia pelo usuário.

# Redesign do seletor de nível — 29/10/2026
- [x] Aplicar card 300px, trilha 29px, thumb 33px, cabeçalho e estrelas orgânicas conforme plano aprovado.
- [x] 6 testes do seletor passam; teclado, reset, Esc e níveis 1/2/3 conferidos em 390/600/1280px com a verificação de acesso simulada só no navegador de teste. Arraste por mouse/toque não reexecutado nesta rodada.

# Padrões destacados na emissão — 28/10/2026
- [x] Identificar nas imagens bootstrap decimal, transporte Base85 e dispatcher repetitivo.
- [x] Escopo aprovado: transporte de nomes, apresentação do alfabeto e chamada centralizada sem nova VM.
- [x] Implementar três mudanças: 91 testes passam; seeds 7/42/1337 com resultados e RNG idênticos à referência. Medições pequenas sem alegação de ganho; saída aumenta 120–130 bytes. RealTest não regenerado sem original; nenhum deploy.

# Correção de entrega adversarial v2 — 26/10/2026
- [x] Preservar 209/209 entradas exatas em área somente leitura antes das alterações; nenhuma perda.
- [x] Preparar sete lotes autocontidos com 315 conteúdos, manifesto real e mapa externo; decoder verificou todos os hashes.
- [x] Reproduzir 39 testes mais cinco regressões, registrar seis outputs seed42 e comparação completa 131/2196 hashes.
- [x] Perfilar 12 células próprias/públicas antes de Luraph, orçamento comum; supervisor melhor contabilizado, Luraph ainda RSS censurado.
- [ ] Capacidades integrais/paridade S0–S6 e solução RSS: bloqueadas por implementação interna incompleta explicitada no plano; sem congelamento/reservadas/candidata/promoção, não marcadas concluídas.

# Comparação adversarial justa — 26/10/2026
- [x] Revisar lacunas e executar versão offline; 131 arquivos de produção e 2.196 históricos intactos.
- [x] Concluir inventário (130 ocorrências) e testes de registro legado/persistência/bytes determinísticos; 39 testes passam e UI real limpa chave na gravação.
- [x] Implementar diagnóstico conservador parcial e matriz real; pipeline integral/CFG VM/S6/confirmador KB independente não concluídos, campanha encerrada sem candidata.
- [x] Registrar snapshot final somente desenvolvimento; reservadas não criadas porque suporte obrigatório falhou. Não chamar snapshot de congelamento adversarial válido.
- [x] Comparar controles intenso sem/com GC nas três seeds; recuperações concluídas 94/94 e 82/82, falhas RSS censuradas. Luraph não avançou, paridade indeterminada.
- [x] Documentar caminho causal e limites sem hipótese nova; preparar entrega avulsa parcial com fontes/evidências completas desta rodada.
- [ ] Materiais externos ausentes (dez arquivos, baseline exata, original RealTest e Studio) limitam reprodução e promoção; não bloqueiam tarefas independentes.

# Adendo adversarial público — 23/10/2026
- [ ] Conferir anexos, proveniência pública e disponibilidade dos dez arquivos com hashes enviados; hashes sem arquivos não são validação.
- [ ] Inventariar referências remanescentes da opção retirada, distinguindo compatibilidade e evidências históricas imutáveis.
- [ ] Planejar atacante normalizado e congelado antes de nova candidata; preservar produção e seeds reservadas.

# Reescrita Level 3 — polymorphic-vm-v3 — 23/10/2026
- [x] Implementar protótipo parcial isolado sobre IR compartilhada; REJECTED, sem promoção, sem ativação/publicação. Superinstruções reais e cobertura integral não atingidas; candidata encerrada por recuperação total e recorrência 17,689x, não tarefas silenciosamente aprovadas.
- [x] Remover Disable line information público/CLI/jobs, ignorar legado com bytes idênticos; testes e geração/download reais conferidos.
- [x] Avaliar fixtures/layouts/páginas, recuperação B e custos; 94/94 e 82/82 recuperados, gates estruturais falhos. A/C/D/comparador integral/reservadas não executados, sem alegação de proteção.
- [x] Preparar implementação parcial, patches, amostras, resultados e manifesto avulsos; limites explícitos no relatório.
- [ ] Baseline v1 congelada indisponível e Studio externo não disponível; bloqueiam gate oficial e promoção, que já é proibida pelas falhas observadas.

# Diagnóstico completo de recuperação — 22/10/2026
- [x] Confrontar o elo causal com o motor atual: getter emite a própria chave; comentários de circularidade são incorretos. Contagens externas não reproduzidas.
- [x] Executar plano aprovado: cinco comentários corrigidos; JavaScript emitido idêntico, outros 58 arquivos intactos; 36 testes direcionados passaram com Luau 0.743 verificado. Nota, diff, hashes e logs avulsos entregues; sem variante, ganho alegado ou implantação.

# Correções localizadas string-regions — revisão independente — 22/10/2026
- [x] Patch corrigido aplicado com GNU patch exit 0; três hashes declarados idênticos, inclusive fonte sem newline; original preservado.
- [x] 12 análises reindexadas com oito origens finais explícitas; seis testes passam. Hash histórico do reconhecedor não registrado, referência do manifesto identificada sem inventar proveniência.
- [x] debugLib fora do contrato verificado documentado; entrega avulsa com manifesto versionado, sem campanhas, promoção ou implantação.

# Especialização real de strings — variante isolada — 22/10/2026
- [x] Congelar controle atual e implementar LOADK/CONCAT com consumidores seguros GETTABLE/SETTABLE somente na cópia experimental.
- [x] Validar KB/contratos, adaptar recuperador e medir geração/tamanho/preparação/recorrência sem alterar históricos; 94/94 valores restaurados nas duas sementes, 181/181 regiões conferidas.
- [x] Entregar código, patch, artefatos e evidências avulsos; site inalterado, sem ganho de proteção demonstrado e sem promoção.

# Resistência à recuperação — triagem delimitada — 22/10/2026
- [x] Examinar uma construção relacional triangular: projeção inversa local elimina a dependência alegada; encerramento na formulação, sem modelo, promoção ou alteração do motor.
- [x] Preparar relatório, especificação, critérios, inspeção reproduzível e hashes individuais; cinco verificações de evidências salvas passaram, sem novas medições de desempenho/proteção.

# Mapa inverso Base85 — 22/10/2026
- [x] Corrigir largura mínima sem novos sorteios: 25 testes, tipos do motor e KB funcionais; pool/palavras/protótipos iguais, 292 bytes totais a menos. Diff, exemplo, round-trip e KB novo avulsos; sem ZIP/deploy ou ganho de proteção. RealTest continua sem original para regeneração.

# Revisão independente structural-v2 — 22/10/2026
- [x] Fortalecer somente a asserção de closure escapada: sete testes existentes aprovados, saída 0; diff textual, log e adendo v3 preparados sem sobrescrever históricos ou alterar motor.
- [ ] Regenerar RealTest somente a partir do original ou receber nova saída do usuário — bloqueado: original não fornecido; limpeza estática não comprova os três ajustes.

# RealTest — emissão estrutural — 22/10/2026
- [x] Congelar motor atual, amostra e critérios prospectivos sem sobrescrever históricos.
- [x] Unificar validade/capturas em transporte compacto exato; distribuir verificador mantendo leituras/ordem; remover apenas tabelas numéricas puras sem usos por bindings.
- [x] Validar contratos direcionados, determinismo, KB funcional/custos pareados e recuperação antiga/adaptada; não executar RealTest desconhecido.
- [x] Entregar diff unificado, relatório curto, trechos antes/depois e saídas avulsas, sem ZIP/deploy; declarar limites e ausência de candidata sustentada.

# Revisão independente emission-v1 — 22/10/2026
- [x] Corrigir cobertura por artefato (9/1 controladas, 10/2 upload) e capturas E/t do helper, sem modificar evidências históricas.
- [x] Reproduzir preparo histórico por hashes/patch congelados; seis contratos passam. Corrigir starvation RPC cedendo event loop entre casos; grupos cobrem 1.014 aprovados/12 skips existentes, mais três regressões novas; logs de falhas preservados.
- [x] Preparar diff unificado completo, comandos, logs e resumo em arquivos avulsos versionados, sem ZIP ou deploy.
- [x] Localizar rota real em word-data/vm-codegen e encerrar emissão sem ganho de proteção ou candidata sustentada; Studio e runtimes Lua ausentes seguem não validados.

# Emissão decimal, nomes reutilizáveis e helpers — 22/10/2026
- [x] Congelar 54 arquivos/critério antes das edições; históricos e rejeições preservados.
- [x] Implementar nomes por compatibilidade lexical, decimais estruturais após RNG legado e dois helpers externos reais; caminho legado byte-idêntico.
- [x] Validar KB/25 processos/custos, recuperação 94/94 e 82/82 sem ganho de proteção; login, geração, download e expansão reais conferidos. Suíte direcionada limpa, suíte ampla com limitação de timeout de infraestrutura e testes históricos congelados documentados.
- [x] Entregar 186 arquivos inspecionados, motor completo/54 arquivos baseline, seis fontes alterados, patches, exemplos e relatório em Files/lurapy-emission-v1 sem ZIP; coleção criada, indexação inicialmente pending.

# Revisão de confiança e hipótese contextual — 22/10/2026
- [x] Registrar conferência Codex e decoder por posição; corrigir referências dos logs sem sobrescrever evidências; decoder local 41/41.
- [x] Comparação: salvar diagnóstico e retornar erro em divergência; subprocessos exit 0/1, 32 testes passam e 54 arquivos do motor intactos.
- [x] Congelar 607 arquivos e registrar revisão externa com atribuição correta; zero divergências.
- [x] Confiança v2.1 separada: 4 falhas antes/6 sucessos depois; cinco KB × três modos sem diferenças de candidatos/confiança/proveniência/tiers.
- [x] Hipótese rejeitada no modelo: 50 estados/41 posições, zero incorretos, normalização simples; nenhum motor experimental nem medição de desempenho.
- [x] 30 testes locais e em staging passam; pacote com fontes necessárias, manifesto e documentos avulsos preparado.

# Experimento KB fused-v1 — 22/10/2026
- [x] Congelar seis anexos, critérios e 54 arquivos da produção; hashes preservados.
- [x] Implementar leitura fundida e ablação estreita de handlers em scratch, sem alterar o motor do site.
- [x] Reproduzir 585 slots/2674 instruções/94 literais do anexo; 119 consumidores recuperados por adaptação e núcleo alternativo compartilhando transporte.
- [x] Conferir quatro checksums em original + seis artefatos; 90 contratos, 129 testes e 14 limites de operando/política passaram.
- [x] Medir 96 execuções pareadas + 48 gerações independentes; comparar emissão/bytecode e entregar REPORT.md/manifesto. Fusão rejeitada por proteção; nada promovido.
- [x] Diagnóstico causal (CAUSAL.md, causal.ts, patch do recuperador): fusão não tocou a rota LOADK+CONCAT; sem hipótese nova sustentada.
- Limites registrados, sem aprovação implícita: load host separado, heap pós-coleta, mapa completo de operações/IR e razão custo do relógio/lote não estabelecidos; Studio/executores dependem de ambiente externo.

# Investigação localizada após confirmação audit.7 — 21/10/2026
# Seletor de intensidade com slider — 22/10/2026
- [x] Refinar preenchimento azul 1/2 e degradê 3, remover marcadores e limitar 24 estrelas/preenchimento ao thumb; borda do preenchimento dentro do thumb durante arraste, região cinza à direita conferida em 600×1067; 20 testes, geração real, mouse/toque e compilação OK.
- [x] Refinamento: card compacto 280px, Level 1 cinza, arraste contínuo com snap somente ao soltar e partículas viajando à esquerda. Mouse 1,779→2 e toque 1,795 antes do snap; 20 testes, geração real, 390×844/600×1067 e compilação OK.
- [x] Trocar somente o seletor por popover acessível, três posições e visuais animados conforme referência.
- [x] Conferir teclado, clique no trilho, arraste por mouse/toque, Escape e clique fora; preferência preservada após recarregar e geração real em Level 3. Desktop 1280×1800 e celular 390×844, redução de movimento respeitada; 19 testes passaram, compilação OK e nenhum erro no navegador.
# Conversa sem recortes e paisagem — 22/10/2026
- [x] Estender a rolagem atrás do topo e do campo, sem barras ou cortes horizontais; espaço final acompanha a altura do campo.
- [x] Colocar a paisagem anexada atrás do campo; conferir 4 gerações reais, menu e rolagem em 600×1082 e 1280×1800, sem erros; 22 testes e compilação OK.
- [x] Corrigir corte no topo da paisagem: altura automática preserva proporção original; conferido em 1280×489 e 600×1082, compilação OK.
- [x] Ampliar a paisagem no celular em pé: conferido em 600×1067 e 390×844, colinas/árvores mais visíveis; proporção preservada e tela deitada inalterada; compilação OK.

- [x] Preservar confirmação; invariantes inconclusiva quanto à não regressão; nenhuma matriz ampla repetida.
- [x] Emissão: preservar ordem rawLit (índices, seed, multiplicador) em scratch elimina diferenças canônicas nas quatro células afetadas; não comprova bytecode host idêntico.
- [x] Heap CALL: coleta equivalente em duas células, 3 processos/variante; deltas sobreviventes 0/+1 KiB; alocações e upvalues não enumeráveis na CLI.
- [x] Prólogo sintético: ambos avaliadores recuperam todos slots sem programa do usuário; hipótese determinística encerrada, sem defesa de produção.
- [x] Disable Line Information: manter indisponível por limitação interna de saída fonte; não prometer remoção de traceback nem esperar Studio para definir isso.
- [x] Entregar relatório localizado e repasse reproduzível ao Codex; nenhuma candidata promovida.

# Confirmação direcionada das candidatas audit.7 — 21/10/2026
- [x] Registrar verificação externa do pacote sem atribuir execução ao sandbox.
- [x] Registrar critérios prévios; medir lotes longStrings e invariantes com seis ordens equilibradas; comparar emissão/bytecode.
- [x] Confirmar casos decisivos CALL de forma independente e agregar todas as rodadas.
- [x] Decidir promoção por candidata: nenhuma promovida; sem commit/combinação a verificar.
- [x] Preservar contratos/saída/integridade e entregar conclusão e proposta arquitetural curta, sem nova camada.
- [ ] Lumarge/Studio/executores — aguardam materiais externos; Disable Line Information é indisponibilidade interna definida, não pendência externa.

# "Nova conversa" removida — 21/10/2026
- [x] Tirar o item, a confirmação inline e os estilos do menu superior; sobram LURAPY e "Sair".
- [x] Retirar o mecanismo de limpeza da conversa (resetToken) e o repasse de status, sem tocar em histórico, preferências ou motor.
- [x] Conferir no navegador (600x1067: menu só com Sair, "Nova conversa" ausente, geração real com cartão; 52 testes; compilação OK).

# Bordinha do login nos controles — 21/10/2026
- [x] Levar o fio de 1px do card do login para a cápsula de intensidade e o botão de enviar.
- [x] Disco circular com a mesma borda atrás das três barrinhas no topo direito.
- [x] Conferir no navegador (menu/Logout, geração real com cartão, 36 testes; compilação OK).

# Barras removidas — 21/10/2026
- [x] Retirar a faixa atrás do card do chat e a barra do topo (sem fundo, sem desfoque).
- [x] Esconder a barra lateral de rolagem.
- [x] Conversa passa a rolar em área própria, sem texto atrás do menu nem ao lado do card.
- [x] Conferir no navegador (600x1067; 4 gerações reais, rolagem no meio, cartões nítidos; 50 testes; compilação OK).

# Fundo nas cores da referência — 21/10/2026
- [x] Topo #20282E e faixa de horizonte #987675 no chat e no login.
- [x] Faixa concentrada entre ~62% e ~70% da altura, base escura.
- [x] Conferir no navegador (amostragem: topo a distância 1 do alvo; pico #866867; texto legível; compilação OK).

# Desfoque removido — 21/10/2026
- [x] Retirar a rampa de blur progressiva e a conversa ancorada na base.
- [x] Barra superior e rodapé voltam ao vidro fosco anterior (blur 30px).
- [x] Conferir no navegador (600x1067; saudação, cartão e texto nítidos; compilação OK).


# Barras de vidro — 21/10/2026
- [x] Remover borda do campo de chat e da cápsula de intensidade.
- [x] Barra superior e rodapé em vidro fosco com a conversa rolando por trás.
- [x] Conferir geração, Expandir, cópia e download reais no navegador (1280/600; compilação OK).

# Controles da conversa — 21/10/2026
- [x] Restaurar ícone de copiar após confirmação e tamanhos adaptativos em base 1024.
- [x] Envio circular com seta, interrupção real por quadrado e intensidade em cápsula permanente.
- [x] Remover tentativas visíveis e interromper falha com mensagem honesta.
- [x] Testar cópia, tamanhos, cancelamento e fluxo real de geração (41 testes; geração/download/cópia/interrupção/erro reais; larguras 360/600/1280; compilação OK).

# Revisão da entrega audit.7
- [x] Corrigir patches/pacote, incluir baseline e dependências, validar reprodução isolada e hashes.
- [x] Corrigir custos históricos e medir invariantes numéricas sem remover integridade (otimização não promovida).
- [x] Separar fases e variantes da extração.
- [x] Concluir controles CALL em checkpoints e investigar dispersão sem promoção.
- [x] Entregar relatório versionado, logs e amostras preservadas.
- [ ] git apply --numstat/--check/aplicação — bloqueados pela política do ambiente; não contornar.
- [ ] Explicar regressões recorrentes de strings longas na candidata de invariantes antes de qualquer promoção.

# Audit.7
- [x] Congelar referência, critérios e corrigir denominadores/extração autônoma.
- [x] Reproduzir e atribuir mutações históricas; corrigir integridade e validar contornos.
- [x] Experimentar resolução por constante e adaptar extração, sem promoção automática.
- [x] Avaliar CALL condicional e contratos especializados com critérios prévios.
- [x] Medir custos, executar testes/tipos e geração/download no navegador.
- [x] Entregar patches separados, fixtures/artefatos, hashes, logs e relatório.
- [ ] Evidências externas Lumarge/Studio/executores/Disable Line Information — indisponíveis.

# Audit.6
- [x] Congelar audit.5, critérios e proveniência.
- [x] Executar TypeScript e controles negativos readonly com logs.
- [x] Reproduzir recuperação estática de constantes e distinguir seus limites.
- [x] Testar adulterações controladas; hooks externos pendentes (sem procedimentos).
- [x] Isolar cache/congelamento e verificar ciclo de vida do worker; memória retida exata pendente.
- [x] Avaliar CALL com diagnósticos dinâmicos e matriz 45 células: benefício limitado, não promovida.
- [x] Entregar evidências/diff/limitações (nenhuma mudança de motor promovida).
- [ ] Comparação Lumarge/Lurapy — faltam original, artefatos, opções, hashes e métodos; Studio/executores — ambiente indisponível. Disable Line Information — limitação já documentada.

# Ajustes visuais — 20/10/2026
- [x] Seletor circular de nível com expansão lateral ao abrir.
- [x] Retirar contorno branco acionado pelo mouse, preservando foco de teclado.
- [x] Centralizar formulário de login no celular.
- [x] Verificar seletor, botões e centralização na tela real; 17 testes passaram.
- [x] Remover disco atrás do ícone ao clicar e o fundo da opção selecionada no toque.
- [x] Botão Ofuscar habilitado somente quando houver código ou anexo para ofuscar.
- [x] Mensagens de erro do motor traduzidas para português brasileiro (ex.: Erro de sintaxe na linha 1: expressão inválida.).

# Continuação audit.4 → audit.5
- [x] Congelar baseline e reproduzir falha de operandos em cópia isolada.
- [x] Medir fluxo real do worker, memória e retenções em sucessos/falhas repetidos.
- [x] Estabelecer contrato profundamente readonly e orçamento medido do cache.
- [x] Diagnosticar custos recorrentes e contratos de faixas/liveness; experimentar isoladamente.
- [x] Validar matriz níveis/seeds, semântica e produção sem instrumentação.
- [x] Entregar diffs, scripts, logs, JSONs e relatório com limitações reais.


- Limitações declaradas no relatório: GC/retained heap do worker não disponível; sem ganho de VM ou RSS total; correção de propriedade tem custo de geração.

# Continuação audit.3 → audit.4
- [x] Congelar audit.3 por hashes e medir load/inicialização/primeira/recorrente contrabalançada em 54 células.
- [x] Analisar MOVE/LOADK conservadoramente e rejeitar vias rápidas/fusão/operandos sem benefício seguro; execução promovida continua idêntica.
- [x] Experimentar organização/padding separados e medir caminhos reais; isolamento completo dos nomes finais/encoding permanece limitação, não promovido.
- [x] Medir tokenizações/bytes/alocações conhecidas e promover cache exato limitado à sessão grande, sem alteração de bytes.
- [x] Validar 787 testes, matriz níveis/seeds, hashes e fluxo real de geração/download; registrar regressões e ruído sem alegar ganho de VM.
- [x] Entregar relatório, diffs separados, scripts, fixtures, manifesto e JSONs, inclusive rejeições.

## Histórico audit.3
- [x] Fixar baseline audit.2, runtime e manifesto reproduzível.
- [x] Reproduzir/corrigir numeric-for e testes que executavam outro artefato.
- [x] Auditar/corrigir bindings na ocultação de builtins.
- [x] Isolar callbacks e rejeitar nova geração externa aninhada sem bloquear etapas internas.
- [x] Perfilar geração e execução separadamente, testar ablações isoladas e promover apenas CLOSE inerte.
- [x] Incorporar capturas externas como evidência não reproduzida e entregar fixtures controladas separadas.
- [x] Validar matriz e preparar relatório, diffs, scripts, fixtures e JSONs.
- [ ] Reproduzir benchmark Luraph externo — bloqueado por fonte/harness/artefatos/metadados e amostras não fornecidos.
- [ ] Validar Studio/APIs externas/resistência à recuperação — bloqueado por ambiente e evidências externos indisponíveis.
- [ ] Disable Line Information com efeito real — bloqueado por limitação do compilador hospedeiro no modo direto; continua indisponível e não concluído.

## UI — conversa (out/2026)
- [x] Recolher mensagem expandida automaticamente quando sai da tela (IntersectionObserver).
- [ ] Minicard de anexo: trocar legenda "Arquivo" pelo tamanho resumido (X KB).
- [ ] Cartão do ofuscado: trocar "Lua · X bytes" por "X KB".
- [ ] Corrigir nome do artefato: arquivo sem hífen (ex.: KB.lua) virou ".lua"; esperado KB-Obfuscated.lua.
- [x] Minicard de anexo e cartão do ofuscado mostram tamanho resumido em KB (sem "Arquivo"/"bytes").
- [x] Nome do artefato: anexo sem hífen agora ganha -Obfuscated.lua (KB.lua → KB-Obfuscated.lua).

# Base escura atrás do campo removida — 21/10/2026
- [x] Degradê da tela de ofuscação termina no tom do horizonte (#987675) até a base, sem véu crescente para quase-preto.
- [x] Login mantém a paisagem original; card, controles e motor não mudam.
- [x] Conferir no navegador (600x1082 e 1280x900, boas-vindas e conversa: base #896A69 atrás do campo; compilação OK).

## Atacante v3 (2026-10-26) — concluído
- S0 corrigido: parse único, COW, hash streaming, fingerprints fixos, resolver mínimo; Luraph completou S0 (176 MiB, 605 ms, execução única).
- Diferencial v1/v3: 0 divergências em 13 alvos; 41 testes v3 passam.
- Capacidades 6.1–6.8 implementadas com positivos/negativos/FP; 94/94 reclassificado (precisão de conjunto ~19%, correção de consumidor null).
- Heldout bloqueado; sem candidata; produção/históricos íntegros (verify_integrity: unchanged).
- Pendente: confirmação independente do KB, associação consumidor/PC em nível VM, paridade S1–S6.

## Atacante v3-real (2026-10-27)
- [x] Decoder de lotes autocontido, mkbatches, runner logado, matriz única, pins v3-real (92).
- [x] Seis controles, RealTest S0, rota B, ativação por módulo, comparação pós-persistência, memória por alvo, integridade (131/2.196 inalterados).
- [x] Testes: 41 v3 + 12 novos; suíte completa 1073 ok / 12 ignorados após corrigir permissão do Luau.
- [ ] Rota B na seed 7 (0 produtores); rebaixar strict/certain; alcançabilidade; verdade-base de consumidor — sem candidata/heldout.

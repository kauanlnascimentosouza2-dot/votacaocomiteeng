# Atualização V8 — prazos de Manufatura no cronograma

Esta versão inclui os 13 vencimentos da imagem enviada para a edição **14ª Semana das Engenharias — 2026.2**. Como a imagem não informa horários, cada tarefa aparece como evento de dia inteiro. As datas de setembro já vencidas aparecem como atrasadas. Os eventos existentes, projetos, entregas e votos são preservados.

## Para colocar no site

1. No Supabase, confirme que **14ª Semana das Engenharias — 2026.2** é o semestre ativo.
2. Abra o SQL Editor do projeto e execute todo o conteúdo de `supabase/manufatura-calendar-2026-update.sql`. O resultado esperado é `Success. No rows returned`. Se o SQL avisar que o semestre não está ativo, ative-o antes de repetir.
3. Envie o conteúdo **desta pasta** para a pasta `votacaocomiteeng-vercel-supabase` do repositório GitHub conectado à Vercel, preservando a estrutura de arquivos. Aguarde o novo deployment ficar `Ready`.
4. Abra o site e confira **Cronograma** em setembro, outubro e novembro de 2026. Mantenha o filtro **Entrega** ativo. A lista à direita também mostra as tarefas e seus estados.

O SQL pode ser executado novamente sem duplicar esses 13 eventos. Ele não envia e-mails retroativos e não modifica o cadastro de demandas. Esta pasta também contém as atualizações anteriores; se alguma migração antiga ainda não tiver sido aplicada, execute-a antes desta.

## Datas incluídas

| Tarefa | Vencimento |
| --- | --- |
| Protótipo inicial | 22/09/2026 |
| Microprodução | 29/09/2026 |
| Produção piloto | 06/10/2026 |
| Produção - Lote 01 | 13/10/2026 |
| Lote 2 — corte e gravação | 20/10/2026 |
| Lote 3 — peças e bases | 27/10/2026 |
| Lote 4 — produção principal | 03/11/2026 |
| Montagem progressiva | 10/11/2026 |
| Fechamento de produção | 17/11/2026 |
| Fechamento da fabricação | 20/11/2026 |
| Acabamento e retrabalho final | 24/11/2026 |
| Inspeção 100% e contagem | 25/11/2026 |
| Embalagem e identificação | 26/11/2026 |

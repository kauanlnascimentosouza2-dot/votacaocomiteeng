# V10 — novas votações, histórico e tutorial de primeiro acesso

## Como publicar

1. No Supabase do site, execute **todo** o arquivo `supabase/voting-v10-update.sql` no SQL Editor. As migrações anteriores de semestres e grupos precisam já estar aplicadas. O resultado esperado é `Success. No rows returned`. Pode repetir este SQL sem apagar dados.
2. Envie o conteúdo desta pasta para a pasta `votacaocomiteeng-vercel-supabase` do repositório GitHub conectado à Vercel. Mantenha a estrutura; não crie outra pasta com o mesmo nome dentro dela.
3. Aguarde o deployment ficar `Ready`.
4. Entre no site. O tutorial abre no primeiro acesso após esta atualização. Clique em **Começar** ao concluir ou **Pular tutorial**. A preferência fica salva na conta; o ícone de ajuda no rodapé do menu reabre o guia.

## Encerrar a votação antiga

Abra **Votação → Gerenciar votações**. Na caixa **Votação anterior**, clique em **Encerrar votação anterior** e confirme. Ela sai de **Em andamento**; projetos e votos continuam no **Histórico**, acessível ao administrador. Os resultados da votação antiga conservam o acesso administrativo que já existia.

## Criar uma votação nova

1. Cadastre a demanda em **Painel administrativo → Demandas e prazos**, com votação habilitada e os grupos participantes.
2. Os grupos preparam os projetos e os líderes confirmam as entregas.
3. Em **Revisão de projetos**, aprove os projetos que poderão participar.
4. Abra **Votação → Gerenciar votações**, selecione a demanda e pelo menos dois projetos aprovados.
5. Confira início e fim. O início deve ser na data de publicação dos projetos ou depois. Clique em **Criar votação**.

A criação da demanda configura os prazos; a rodada é criada depois da aprovação e seleção dos projetos. Você pode manter várias votações de demandas diferentes em andamento. Os projetos de uma rodada agendada ficam ocultos aos participantes até o horário de abertura.

## Regras e encerramento

- Participantes de grupos ativos do semestre podem votar; administradores também podem votar, mesmo sem grupo.
- O projeto do próprio grupo fica bloqueado, levando em conta o grupo atual e a composição registrada na demanda.
- Há um voto por pessoa por rodada, com **uma única alteração**. Ambas as ações pedem confirmação.
- O modo anônimo oculta a escolha individual na interface administrativa; o modo aberto a identifica. O banco mantém o vínculo para controlar elegibilidade e alteração.
- O administrador pode encerrar antes do prazo. No horário final, o sistema bloqueia novos votos e retira a rodada da vitrine. Páginas já abertas se atualizam em até 30 segundos.
- O administrador acompanha resultados parciais e quem votou. Para participantes, os resultados dependem de **Liberar resultados** após o encerramento.
- Em empate com votos registrados, **Criar votação de desempate** inicia outra rodada apenas com os projetos empatados em primeiro lugar. Cada rodada tem sua própria alteração de voto.
- Encerrar uma rodada não encerra a demanda. Isso permite criar desempates e preservar as entregas.
- As datas das novas rodadas aparecem no Cronograma.

## Tutorial

Há orientações para administrador, participante com grupo ativo e cadastro aguardando alocação. O tutorial explica menu, grupo, prazos, entrega, votação, comunidade e perfil. A conclusão é salva na conta, inclusive ao pular, e o botão de ajuda permite rever o guia.

## Verificação

Foram verificadas as regras da migração e da votação em PostgreSQL temporário e o comportamento da interface e do tutorial em ambiente de teste. O teste com e-mails, contas reais e dados do seu Supabase deve ser feito depois da publicação.

Esta atualização mantém usuários, grupos, projetos, votos e os arquivos das versões anteriores. Nenhuma ação deste pacote encerra automaticamente a votação antiga durante a migração: o administrador confirma o encerramento pelo painel.

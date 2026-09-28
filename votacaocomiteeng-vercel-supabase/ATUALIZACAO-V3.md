# Atualização V3 — semestres, grupos e demandas

Esta versão foi preparada para ser instalada sem apagar os usuários, propostas e votos existentes.

## O que entra nesta etapa

- criação, início e encerramento de semestres;
- semestre inicial `14ª Semana das Engenharias — 2026.2`;
- novos cadastros em **Aguardando alocação**;
- quadro de participantes com arrastar e soltar;
- grupos de até 9 pessoas, com um líder e ativação pelo administrador;
- demandas para todos ou apenas grupos selecionados;
- etapas intermediárias, prazos, publicação e configuração da votação;
- ambiente privado de cada grupo;
- edição colaborativa do projeto com histórico de versões;
- entrega final exclusiva do líder;
- imagem principal, até 5 imagens adicionais, PDF de até 20 MB e links;
- entregas atrasadas aceitas e identificadas.

## Ordem de instalação

1. No Supabase, abra **SQL Editor**.
2. Execute todo o arquivo `supabase/semester-workflow.sql` uma única vez.
3. No GitHub, substitua os arquivos do projeto pelos arquivos desta pasta, mantendo a mesma pasta raiz configurada na Vercel.
4. Aguarde a Vercel mostrar o novo deployment como **Ready**.
5. Entre como administrador e abra **Painel admin → Semestres e grupos**.
6. Monte os grupos, escolha os líderes, ative cada grupo e inicie o semestre.
7. Abra **Painel admin → Demandas e prazos** para cadastrar o primeiro trabalho.

## Segurança da implantação

- A migração usa `create table if not exists` e não exclui o modelo anterior.
- Arquivos de projeto são armazenados em bucket privado.
- Operações administrativas continuam protegidas pela conta do administrador.
- A composição dos grupos e as alterações dos projetos ficam registradas em histórico.

## Próxima etapa planejada

A revisão administrativa, publicação automática, nova votação com bloqueio do voto no próprio grupo, uma alteração permitida, liberação manual do resultado e segundo turno em caso de empate serão conectados ao novo modelo após a validação desta etapa.

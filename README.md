# gpt

Versao enxuta do projeto `App Turbo GPT`, mantendo apenas a biblioteca de ganchos.

## Arquivos

- `index.html`: interface estatica em PT-BR.
- `content-hooks-data.js`: base copiada e normalizada dos ganchos.
- `js/config.js`: configuracao do Supabase compartilhado com o Turbo GPT.
- `js/supabase-init.js`: inicializacao do cliente Supabase.
- `js/app.js`: login, validacao de acesso, busca, filtros, paginacao, adaptacao de tema e copia.
- `middleware.js`: protecao do arquivo `content-hooks-data.js` na Vercel via cookie `tg_auth`.
- `vercel.json`: headers e configuracao basica para deploy na Vercel.

## Como abrir

Abra `index.html` diretamente no navegador para desenvolvimento local.

Em producao, publique a pasta `gpt` na Vercel. O login usa o mesmo Supabase do Turbo GPT e consulta a tabela `purchase_records`.

## Escopo

Este projeto nao inclui skills, prompts de imagem, prompts de video, assets pesados ou materiais de venda do projeto original. O foco e somente ganchos.

O acesso e liberado apenas para usuarios autenticados com compra ativa em `purchase_records`.

# Poderosa Moda Fitness

Loja estática com vitrine dinâmica, painel administrativo protegido por Supabase Auth e cadastro completo de produtos.

## Rodar localmente

Como o projeto usa ES Modules no navegador, abra por um servidor local:

```bash
python3 -m http.server 5173
```

Depois acesse:

- Loja: `http://localhost:5173`
- Admin: `http://localhost:5173/admin.html`

## Configurar Supabase

1. Crie um projeto no Supabase.
2. Em `SQL Editor`, rode o arquivo [supabase-products.sql](/home/mateus/projetos/poderosa/supabase-products.sql).
3. Em `Authentication > Users`, crie a conta da dona da loja:
   - E-mail: `admin@poderosa.com`
   - Senha: defina no Supabase Auth. Não salve senha em arquivo do projeto.
4. Rode este SQL para liberar esse e-mail como admin:

```sql
insert into public.admin_users (email)
values ('admin@poderosa.com');
```

5. Em `Project Settings > API`, copie `Project URL` e `anon public key`.
6. Configure [supabase-config.js](/home/mateus/projetos/poderosa/supabase-config.js):

```js
window.PODEROSA_CONFIG = {
  supabaseUrl: "https://SEU-PROJETO.supabase.co",
  supabaseAnonKey: "SUA_ANON_PUBLIC_KEY",
  whatsappNumber: "5585982184602",
  maxImageSizeMb: 4,
  imageBucket: "product-images"
};
```

Nunca coloque `service_role` ou chave secreta no front-end.

## Segurança

O painel usa Supabase Auth. As regras RLS em `supabase-products.sql` permitem que visitantes vejam apenas produtos com `ativo = true`; criar, editar e excluir produtos exige usuário autenticado cujo e-mail exista em `public.admin_users`.

O bucket `product-images` é público para leitura das fotos e restrito para upload, edição e exclusão por administradoras.

## Primeiro produto

1. Acesse `/admin.html`.
2. Entre com `admin@poderosa.com` e a senha criada no Supabase Auth.
3. Para cadastrar um novo produto, preencha nome, descrição, preço, categoria, tamanhos, cores, status e fotos.
4. Deixe `Produto ativo na loja` marcado para aparecer na vitrine.
5. Salve. A loja carrega automaticamente apenas produtos ativos do banco.

Enquanto o Supabase não estiver configurado, a loja mostra os produtos de fallback em [products.js](/home/mateus/projetos/poderosa/products.js) para desenvolvimento local sem banco. Quando o Supabase está configurado, a vitrine usa somente a tabela `products`. Se a tabela estiver vazia, a loja mostra estado vazio.

## Administrar produtos

Para tirar um produto da loja sem apagar definitivamente, abra o produto e clique em `Desativar`, ou use o botão rápido na lista. Para apagar definitivamente, clique em `Excluir`. Produtos excluídos ou inativos não aparecem na vitrine pública. Para remover fotos ruins, abra o produto, clique em `Remover` na miniatura desejada e salve. Para trocar uma foto, clique em `Trocar` na miniatura, selecione uma nova imagem e salve.

## Publicar na Vercel

1. Suba os arquivos para um repositório Git.
2. Importe o repositório na Vercel.
3. Como é site estático, não precisa de build command.
4. Defina o output/public directory como raiz do projeto.
5. Garanta que `supabase-config.js` esteja com a URL e anon key públicas corretas antes do deploy.

Se quiser usar variáveis de ambiente reais na Vercel, adicione uma etapa de build para gerar `supabase-config.js` a partir de `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY`, mantendo apenas chaves públicas no arquivo final.

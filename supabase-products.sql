create extension if not exists pgcrypto;

create table if not exists public.admin_users (
  email text primary key,
  created_at timestamptz not null default now()
);

create table if not exists public.products (
  id text primary key default gen_random_uuid()::text,
  nome text not null,
  slug text unique not null,
  descricao text,
  preco numeric(10,2) not null check (preco >= 0),
  preco_promocional numeric(10,2) check (preco_promocional is null or preco_promocional >= 0),
  categoria text not null,
  tamanhos text[] not null default '{}',
  cores text[] not null default '{}',
  imagens text[] not null default '{}',
  imagem_principal text,
  status text not null default 'novo' check (status in ('novo', 'mais_vendido', 'promocao', 'esgotado')),
  estoque integer check (estoque is null or estoque >= 0),
  em_destaque boolean not null default false,
  no_banner boolean not null default false,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

alter table public.admin_users enable row level security;
alter table public.products enable row level security;

create or replace function public.is_store_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.admin_users
    where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

drop policy if exists "Public can view active products" on public.products;
create policy "Public can view active products"
on public.products
for select
using (ativo = true or public.is_store_admin());

drop policy if exists "Admins can insert products" on public.products;
create policy "Admins can insert products"
on public.products
for insert
with check (public.is_store_admin());

drop policy if exists "Admins can update products" on public.products;
create policy "Admins can update products"
on public.products
for update
using (public.is_store_admin())
with check (public.is_store_admin());

drop policy if exists "Admins can delete products" on public.products;
create policy "Admins can delete products"
on public.products
for delete
using (public.is_store_admin());

drop policy if exists "Admins can view admin users" on public.admin_users;
create policy "Admins can view admin users"
on public.admin_users
for select
using (public.is_store_admin());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-images',
  'product-images',
  true,
  4194304,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public can read product images" on storage.objects;
create policy "Public can read product images"
on storage.objects
for select
using (bucket_id = 'product-images');

drop policy if exists "Admins can upload product images" on storage.objects;
create policy "Admins can upload product images"
on storage.objects
for insert
with check (bucket_id = 'product-images' and public.is_store_admin());

drop policy if exists "Admins can update product images" on storage.objects;
create policy "Admins can update product images"
on storage.objects
for update
using (bucket_id = 'product-images' and public.is_store_admin())
with check (bucket_id = 'product-images' and public.is_store_admin());

drop policy if exists "Admins can delete product images" on storage.objects;
create policy "Admins can delete product images"
on storage.objects
for delete
using (bucket_id = 'product-images' and public.is_store_admin());

-- Depois de criar a dona no Supabase Auth, rode:
-- insert into public.admin_users (email) values ('admin@poderosa.com');

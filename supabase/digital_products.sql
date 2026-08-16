-- Adds "Digital Products" (roadmap Section 3.5) — distinct from Courses
-- (3.10): static, sell-once content (meal plans, transformation guides,
-- training programs) with no lessons, progress tracking, or certificate.
-- Same admin-authored catalog + gated-content + direct-to-platform Stripe
-- Checkout pattern as courses, just simpler (one content blob, not lessons).
-- Run this in the Supabase SQL Editor.

create table if not exists digital_products (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  price_cents int not null,
  created_at timestamptz not null default now()
);

alter table digital_products enable row level security;

drop policy if exists "Digital products are readable by anyone" on digital_products;
create policy "Digital products are readable by anyone"
  on digital_products for select
  using (true);

drop policy if exists "Only the admin can manage digital products" on digital_products;
create policy "Only the admin can manage digital products"
  on digital_products for all
  using (auth.jwt() ->> 'email' = 'teamlix6@gmail.com')
  with check (auth.jwt() ->> 'email' = 'teamlix6@gmail.com');

-- No client-side writes — created by create-digital-product-checkout
-- (pending), marked paid by stripe-webhook, both service-role only. Defined
-- before digital_product_content since that table's RLS references it.
create table if not exists digital_product_purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references digital_products(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'paid')),
  stripe_checkout_session_id text,
  created_at timestamptz not null default now(),
  unique (user_id, product_id)
);

alter table digital_product_purchases enable row level security;

drop policy if exists "Users view their own digital product purchases" on digital_product_purchases;
create policy "Users view their own digital product purchases"
  on digital_product_purchases for select
  using (auth.uid() = user_id);

-- The actual content (body text + optional external file link, same
-- pattern as exercises.video_url) is only readable by users with a paid
-- purchase. One row per product — unlike course_lessons there's no
-- ordering/multiple rows, just a single content blob per product.
create table if not exists digital_product_content (
  product_id uuid primary key references digital_products(id) on delete cascade,
  body text not null default '',
  file_url text default ''
);

alter table digital_product_content enable row level security;

drop policy if exists "Only the admin can manage digital product content" on digital_product_content;
create policy "Only the admin can manage digital product content"
  on digital_product_content for all
  using (auth.jwt() ->> 'email' = 'teamlix6@gmail.com')
  with check (auth.jwt() ->> 'email' = 'teamlix6@gmail.com');

drop policy if exists "Buyers can read their purchased content" on digital_product_content;
create policy "Buyers can read their purchased content"
  on digital_product_content for select
  using (
    exists (
      select 1 from digital_product_purchases
      where digital_product_purchases.product_id = digital_product_content.product_id
        and digital_product_purchases.user_id = auth.uid()
        and digital_product_purchases.status = 'paid'
    )
  );

grant select on digital_products to anon, authenticated;
grant insert, update, delete on digital_products to authenticated;
grant select on digital_products to service_role;
grant select on digital_product_purchases to authenticated;
grant select, insert, update on digital_product_purchases to service_role;
grant select on digital_product_content to authenticated;
grant insert, update, delete on digital_product_content to authenticated;

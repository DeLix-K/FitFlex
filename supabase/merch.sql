-- Adds branded e-commerce: merch is sourced live from your connected
-- Printful store (no product catalog duplicated in Supabase — Printful
-- stays the source of truth for designs/prices), paid via Stripe Checkout
-- with native shipping-address collection, then automatically submitted to
-- Printful for real fulfillment once payment succeeds.
-- Run this in the Supabase SQL Editor.

create table if not exists merch_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending_payment'
    check (status in ('pending_payment', 'paid', 'submitted', 'fulfilled', 'failed')),
  stripe_checkout_session_id text,
  printful_order_id text,
  items jsonb not null,
  amount_cents int not null,
  shipping_name text,
  shipping_address1 text,
  shipping_address2 text,
  shipping_city text,
  shipping_state text,
  shipping_country text,
  shipping_zip text,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table merch_orders enable row level security;

drop policy if exists "Users view their own merch orders" on merch_orders;
create policy "Users view their own merch orders"
  on merch_orders for select
  using (auth.uid() = user_id);

drop trigger if exists merch_orders_set_updated_at on merch_orders;
create trigger merch_orders_set_updated_at
  before update on merch_orders
  for each row execute function set_updated_at();

-- No client-side writes — created by create-merch-checkout (pending_payment),
-- updated by stripe-webhook (paid -> submitted/failed after talking to
-- Printful), both service-role only.
grant select on merch_orders to authenticated;
grant select, insert, update on merch_orders to service_role;

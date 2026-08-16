-- Adds Stripe customer/subscription tracking to profiles, and grants the
-- service role (used by create-checkout-session and stripe-webhook) access
-- to read/update it. service_role bypasses RLS policies, but it still needs
-- ordinary Postgres GRANTs like any other role — it does not get blanket
-- table access automatically.
-- Run this in the Supabase SQL Editor.

alter table profiles
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text;

grant select, update on profiles to service_role;

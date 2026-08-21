-- The original trainer_marketplace.sql only granted service_role
-- select+update on trainer_profiles (rows were expected to be admin-seeded
-- directly via SQL, then only ever updated by trainer-connect-onboarding).
-- The new trainer-signup Edge Function needs to INSERT a fresh row for a
-- first-time self-service trainer, which service_role didn't have
-- permission to do -- RLS is bypassed for service_role, but table-level
-- GRANTs are a separate, still-enforced layer.
grant insert on trainer_profiles to service_role;

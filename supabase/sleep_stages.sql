-- Adds sleep-stage breakdown (deep/REM/light/awake) for the redesigned
-- Sleep screen. Oura's /sleep endpoint already returns these per-record;
-- oura-sleep-sync just wasn't capturing them yet. Manual entries leave
-- these null -- a user self-reporting can't reasonably estimate sleep
-- stages, only a device can.

alter table sleep_logs
  add column if not exists deep_minutes int,
  add column if not exists rem_minutes int,
  add column if not exists light_minutes int,
  add column if not exists awake_minutes int;

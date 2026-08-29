// Supabase Edge Function: syncs the last 7 days of Oura sleep data into
// sleep_logs for the calling user, if they've connected Oura. Oura data
// overwrites any manual entry for the same night, since it's more accurate.
// Deploy via the Supabase dashboard: Edge Functions > Create a new function.
// Keep "Enforce JWT Verification" ON.

import { createClient } from 'npm:@supabase/supabase-js@2';

const ALLOWED_ORIGINS = (Deno.env.get('ALLOWED_ORIGINS') ?? '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
}

function buildCorsHeaders(origin: string | null): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': isAllowedOrigin(origin) ? origin! : 'null',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    Vary: 'Origin',
  };
}

async function refreshOuraToken(
  refreshToken: string,
  clientId: string,
  clientSecret: string
): Promise<{ access_token: string; refresh_token: string; expires_in: number } | null> {
  const basicAuth = btoa(`${clientId}:${clientSecret}`);
  const response = await fetch('https://api.ouraring.com/oauth/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basicAuth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken }).toString(),
  });
  if (!response.ok) return null;
  return response.json();
}

Deno.serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req.headers.get('Origin'));
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header.' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();

    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid or expired session.' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: connection } = await adminClient
      .from('oura_connections')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!connection) {
      return new Response(JSON.stringify({ connected: false, synced: 0 }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let accessToken = connection.access_token;

    if (new Date(connection.expires_at).getTime() <= Date.now()) {
      const clientId = Deno.env.get('OURA_CLIENT_ID');
      const clientSecret = Deno.env.get('OURA_CLIENT_SECRET');
      if (!clientId || !clientSecret) {
        return new Response(JSON.stringify({ error: 'Oura is not configured.' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const refreshed = await refreshOuraToken(connection.refresh_token, clientId, clientSecret);
      if (!refreshed) {
        await adminClient.from('oura_connections').delete().eq('user_id', user.id);
        return new Response(
          JSON.stringify({ connected: false, synced: 0, error: 'Oura connection expired. Please reconnect.' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      accessToken = refreshed.access_token;
      await adminClient
        .from('oura_connections')
        .update({
          access_token: refreshed.access_token,
          refresh_token: refreshed.refresh_token,
          expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
        })
        .eq('user_id', user.id);
    }

    const endDate = new Date().toISOString().slice(0, 10);
    const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const authHeaders = { Authorization: `Bearer ${accessToken}` };

    const [scoreResponse, sessionResponse] = await Promise.all([
      fetch(`https://api.ouraring.com/v2/usercollection/daily_sleep?start_date=${startDate}&end_date=${endDate}`, {
        headers: authHeaders,
      }),
      fetch(`https://api.ouraring.com/v2/usercollection/sleep?start_date=${startDate}&end_date=${endDate}`, {
        headers: authHeaders,
      }),
    ]);

    if (!scoreResponse.ok || !sessionResponse.ok) {
      const errorBody = !scoreResponse.ok ? await scoreResponse.text() : await sessionResponse.text();
      console.error('Oura API error', errorBody);
      return new Response(JSON.stringify({ connected: true, synced: 0, error: 'Could not sync Oura data. Please try again.' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const scoreData = await scoreResponse.json();
    const sessionData = await sessionResponse.json();

    const scoresByDay = new Map<string, number>();
    for (const record of scoreData.data ?? []) {
      if (typeof record.score === 'number') scoresByDay.set(record.day, record.score);
    }

    // A day can have multiple sleep periods (naps); only the main overnight
    // sleep should populate the daily log.
    const rows = (sessionData.data ?? [])
      .filter((record: { type?: string }) => record.type === 'long_sleep')
      .map((record: {
        day: string;
        total_sleep_duration?: number;
        bedtime_start?: string;
        bedtime_end?: string;
        deep_sleep_duration?: number;
        rem_sleep_duration?: number;
        light_sleep_duration?: number;
        awake_time?: number;
        average_hrv?: number;
        lowest_heart_rate?: number;
        sleep_phase_5_min?: string;
      }) => ({
        user_id: user.id,
        sleep_date: record.day,
        duration_minutes: record.total_sleep_duration != null
          ? Math.round(record.total_sleep_duration / 60)
          : null,
        bedtime: record.bedtime_start ?? null,
        wake_time: record.bedtime_end ?? null,
        sleep_score: scoresByDay.get(record.day) ?? null,
        deep_minutes: record.deep_sleep_duration != null ? Math.round(record.deep_sleep_duration / 60) : null,
        rem_minutes: record.rem_sleep_duration != null ? Math.round(record.rem_sleep_duration / 60) : null,
        light_minutes: record.light_sleep_duration != null ? Math.round(record.light_sleep_duration / 60) : null,
        awake_minutes: record.awake_time != null ? Math.round(record.awake_time / 60) : null,
        average_hrv: record.average_hrv ?? null,
        lowest_heart_rate: record.lowest_heart_rate ?? null,
        sleep_phase_5min: record.sleep_phase_5_min ?? null,
        source: 'oura',
      }));

    if (rows.length === 0) {
      return new Response(JSON.stringify({ connected: true, synced: 0 }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { error: upsertError } = await adminClient
      .from('sleep_logs')
      .upsert(rows, { onConflict: 'user_id,sleep_date' });

    if (upsertError) {
      return new Response(
        JSON.stringify({ connected: true, synced: 0, error: `Could not save sleep data: ${upsertError.message}` }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(JSON.stringify({ connected: true, synced: rows.length }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: 'Something went wrong. Please try again.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

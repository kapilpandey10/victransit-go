import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function signUrl(path: string, devId: string, apiKey: string): Promise<string> {
  const separator = path.includes('?') ? '&' : '?';
  const urlWithDevId = `${path}${separator}devid=${devId}`;

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(apiKey),
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(urlWithDevId));
  const signature = Array.from(new Uint8Array(sig))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  return `https://timetableapi.ptv.vic.gov.au${urlWithDevId}&signature=${signature}`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { path } = await req.json();

    if (!path || typeof path !== 'string') {
      return new Response(JSON.stringify({ error: 'Missing path parameter' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const devId = Deno.env.get('PTV_DEV_ID');
    const apiKey = Deno.env.get('PTV_API_KEY');

    if (!devId || !apiKey) {
      return new Response(JSON.stringify({ error: 'PTV credentials not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const signedUrl = await signUrl(path, devId, apiKey);

    const ptvResponse = await fetch(signedUrl, {
      headers: { 'Accept': 'application/json' },
    });

    const data = await ptvResponse.json();

    return new Response(JSON.stringify(data), {
      status: ptvResponse.status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

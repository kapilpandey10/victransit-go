import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { encode } from "https://deno.land/std@0.168.0/encoding/hex.ts";
import { HmacSha1 } from "https://deno.land/std@0.168.0/hash/sha1.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function signUrl(path: string, devId: string, apiKey: string): string {
  const separator = path.includes('?') ? '&' : '?';
  const urlWithDevId = `${path}${separator}devid=${devId}`;
  
  const hmac = new HmacSha1(apiKey);
  hmac.update(urlWithDevId);
  const signature = Array.from(new Uint8Array(hmac.arrayBuffer()))
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

    const signedUrl = signUrl(path, devId, apiKey);
    
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

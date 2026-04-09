// supabase/functions/get-transcript/index.ts
// Edge Function — obtiene transcripción de YouTube con timestamps via Supadata API
// Deploy: supabase functions deploy get-transcript
// Secret requerido: supabase secrets set SUPADATA_API_KEY=tu_api_key

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function extractVideoId(url: string): string | null {
  const patterns = [
    /youtube\.com\/watch\?v=([a-zA-Z0-9_-]+)/,
    /youtu\.be\/([a-zA-Z0-9_-]+)/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]+)/,
  ]
  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match) return match[1]
  }
  return null
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { url } = await req.json()
    if (!url) {
      return new Response(JSON.stringify({ error: 'URL requerida' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const videoId = extractVideoId(url)
    if (!videoId) {
      return new Response(JSON.stringify({ error: 'No se pudo extraer el ID del video de YouTube' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const apiKey = Deno.env.get('SUPADATA_API_KEY')
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'API key de transcripción no configurada' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Llamar a Supadata API
    const supadataRes = await fetch(
      `https://api.supadata.ai/v1/youtube/transcript?videoId=${videoId}&lang=es`,
      { headers: { 'x-api-key': apiKey } }
    )

    if (!supadataRes.ok) {
      // Intentar sin especificar idioma (algunos videos solo tienen en inglés)
      const supadataResEn = await fetch(
        `https://api.supadata.ai/v1/youtube/transcript?videoId=${videoId}`,
        { headers: { 'x-api-key': apiKey } }
      )
      if (!supadataResEn.ok) {
        return new Response(JSON.stringify({
          error: 'Este video no tiene subtítulos disponibles. Prueba con un video que tenga subtítulos activados.'
        }), { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      const dataEn = await supadataResEn.json()
      return buildResponse(dataEn, corsHeaders)
    }

    const data = await supadataRes.json()
    return buildResponse(data, corsHeaders)

  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})

function buildResponse(data: any, corsHeaders: Record<string, string>) {
  // Supadata devuelve { content: [{text, offset}] } o { transcript: string }
  const segments = (data.content ?? []).map((s: any) => ({
    text: s.text,
    start: Math.round((s.offset ?? 0) / 1000), // ms → segundos
  }))

  const transcript = segments.length > 0
    ? segments.map((s: any) => s.text).join(' ')
    : (data.transcript ?? '')

  return new Response(JSON.stringify({ transcript, segments }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
}

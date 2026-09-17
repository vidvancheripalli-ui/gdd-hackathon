import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  })
}

export function admin() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )
}

export async function authenticated(request: Request) {
  const token = request.headers
    .get('Authorization')
    ?.replace('Bearer ', '')

  if (!token) return null

  const { data } = await admin().auth.getUser(token)

  return data.user
}

export const options = () =>
  new Response(null, {
    status: 204,
    headers: corsHeaders,
  })
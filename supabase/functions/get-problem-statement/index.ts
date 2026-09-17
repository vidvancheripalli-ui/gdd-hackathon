import { admin, authenticated, json, options } from '../_shared/auth.ts'

// Configure only trusted, server-side URLs. Do not accept a filename from the browser.
const statements: Record<string, string | undefined> = {
  'AI / ML': Deno.env.get('PROBLEM_STATEMENT_AI_URL'),
  'Web Development': Deno.env.get('PROBLEM_STATEMENT_WEB_URL'),
  Cybersecurity: Deno.env.get('PROBLEM_STATEMENT_CYBER_URL'),
  'Open Innovation': Deno.env.get('PROBLEM_STATEMENT_OPEN_URL'),
}

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return options()
  const user = await authenticated(request); if (!user) return json({ error: 'Sign in is required.' }, 401)
  const { data } = await admin().from('registrations').select('hackathon_domain,status').eq('auth_user_id', user.id).in('status', ['approved', 'pending_review']).maybeSingle()
  const url = data && statements[data.hackathon_domain]
  if (!url) return json({ error: 'Your problem statement is not available yet.' }, 404)
  return json({ url })
})

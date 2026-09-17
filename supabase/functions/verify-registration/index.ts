import { admin, authenticated, json, options } from '../_shared/auth.ts'

const text = (v: unknown, min = 1, max = 100) => typeof v === 'string' && v.trim().length >= min && v.trim().length <= max
const email = (v: unknown) => text(v, 4, 254) && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v as string)

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return options()
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405)
  const user = await authenticated(request); if (!user) return json({ error: 'Sign in is required.' }, 401)
  try {
    const body = await request.json()
    if (body.website) return json({ error: 'Unable to process this request.' }, 400) // honeypot
    const fields = ['name','rollNo','branch','section','email','phone','year','teamName']
    if (fields.some(key => !text(body[key]))) return json({ error: 'Complete all required fields.' }, 400)
    if (!email(body.email) || !/^[-+()\d\s]{8,20}$/.test(body.phone)) return json({ error: 'Enter a valid email and phone number.' }, 400)
    if (user.email?.toLowerCase() !== body.email.toLowerCase()) return json({ error: 'Use the email associated with your Google account.' }, 400)
    const size = Number(body.teamSize); const members = Array.isArray(body.members) ? body.members : []
    if (!Number.isInteger(size) || size < 1 || size > 4 || members.length !== size - 1) return json({ error: 'Team size and member details do not match.' }, 400)
    const rolls = [body.rollNo, ...members.map((m: any) => m.rollNo)]
    if (new Set(rolls.map((v: string) => v.trim().toUpperCase())).size !== rolls.length || members.some((m: any) => !text(m.name) || !text(m.rollNo) || !text(m.branch) || !text(m.section) || !email(m.email))) return json({ error: 'Check each team member’s details and roll number.' }, 400)
    // hCaptcha verification is intentionally server-side; require a token in production.
    const secret = Deno.env.get('HCAPTCHA_SECRET')
    if (secret) { const check = await fetch('https://hcaptcha.com/siteverify', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ secret, response: body.hcaptchaToken || '' }) }).then(r => r.json()); if (!check.success) return json({ error: 'CAPTCHA verification failed. Please try again.' }, 400) }
    const db = admin(); const { data: existing } = await db.from('registrations').select('id').in('leader_roll_no', rolls).limit(1)
    if (existing?.length) return json({ error: 'One or more team members are already registered.' }, 409)
    const { data, error } = await db.from('registration_attempts').insert({ auth_user_id: user.id, payload: { ...body, hcaptchaToken: undefined, website: undefined }, status: 'verified' }).select('id').single()
    if (error) throw error
    return json({ attemptId: data.id })
  } catch (error) { console.error(error); return json({ error: 'Could not verify registration. Please try again.' }, 500) }
})

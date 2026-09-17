import { supabase, isConfigured } from '../lib/supabase'

const unavailable = () => { throw new Error('Supabase is not configured. Add your project values to .env.local.') }

export async function signInWithGoogle() {
  if (!isConfigured) return unavailable()

  sessionStorage.setItem(
    'gdg-oauth-return',
    'register'
  )

  const { error } =
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
      },
    })

  if (error) {
    sessionStorage.removeItem(
      'gdg-oauth-return'
    )
    throw error
  }
}

export async function verifyRegistration(payload) {
  if (!isConfigured) return unavailable()
  const { data, error } = await supabase.functions.invoke('verify-registration', { body: payload })
  if (error) throw error
  if (!data?.attemptId) throw new Error(data?.error || 'Could not create a registration attempt.')
  return data
}

export async function submitPayment(payload) {
  if (!isConfigured) return unavailable()
  const { data, error } = await supabase.functions.invoke('submit-payment', { body: payload })
  if (error) throw error
  if (!data?.success) throw new Error(data?.error || 'Payment submission failed.')
  return data
}

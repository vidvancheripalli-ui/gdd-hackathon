import { admin, json, options } from '../_shared/auth.ts'

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const GOOGLE_SHEETS_URL = 'https://sheets.googleapis.com/v4/spreadsheets'

type ServiceAccount = {
  client_email: string
  private_key: string
  token_uri?: string
}

const base64url = (input: Uint8Array | string) => {
  const bytes =
    typeof input === 'string'
      ? new TextEncoder().encode(input)
      : input

  let binary = ''
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }

  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

const pemToArrayBuffer = (pem: string) => {
  const base64 = pem
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\s/g, '')

  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)

  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }

  return bytes.buffer
}

const createJwt = async (serviceAccount: ServiceAccount) => {
  const now = Math.floor(Date.now() / 1000)

  const header = {
    alg: 'RS256',
    typ: 'JWT',
  }

  const payload = {
    iss: serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud: serviceAccount.token_uri ?? GOOGLE_TOKEN_URL,
    iat: now,
    exp: now + 3600,
  }

  const encodedHeader = base64url(JSON.stringify(header))
  const encodedPayload = base64url(JSON.stringify(payload))

  const unsignedToken = `${encodedHeader}.${encodedPayload}`

  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToArrayBuffer(serviceAccount.private_key),
    {
      name: 'RSASSA-PKCS1-v1_5',
      hash: 'SHA-256',
    },
    false,
    ['sign'],
  )

  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    new TextEncoder().encode(unsignedToken),
  )

  return `${unsignedToken}.${base64url(new Uint8Array(signature))}`
}

const getAccessToken = async (serviceAccount: ServiceAccount) => {
  const jwt = await createJwt(serviceAccount)

  const response = await fetch(
    serviceAccount.token_uri ?? GOOGLE_TOKEN_URL,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: jwt,
      }),
    },
  )

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Google token request failed: ${error}`)
  }

  const data = await response.json()

  return data.access_token as string
}

const appendRows = async (
  accessToken: string,
  spreadsheetId: string,
  sheetName: string,
  rows: unknown[][],
) => {
  if (rows.length === 0) return

  const url =
    `${GOOGLE_SHEETS_URL}/${spreadsheetId}/values/` +
    `${encodeURIComponent(sheetName)}:append` +
    '?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS'

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      values: rows,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(
      `Google Sheets write failed for ${sheetName}: ${error}`,
    )
  }
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return options()
  }

  if (request.method !== 'POST') {
    return json(
      { error: 'Method not allowed.' },
      405,
    )
  }

  try {
    console.log('SYNC STARTED')

    const spreadsheetId =
      Deno.env.get('GOOGLE_SHEETS_SPREADSHEET_ID')

    const serviceAccountJson =
      Deno.env.get('GOOGLE_SERVICE_ACCOUNT_JSON')

    console.log(
      'Spreadsheet configured:',
      !!spreadsheetId,
    )

    console.log(
      'Service account configured:',
      !!serviceAccountJson,
    )

    if (!spreadsheetId || !serviceAccountJson) {
      return json(
        {
          error:
            'Google Sheets configuration is missing.',
        },
        500,
      )
    }

    const serviceAccount =
      JSON.parse(serviceAccountJson) as ServiceAccount

    const accessToken =
      await getAccessToken(serviceAccount)

    const db = admin()

    const { data: registrations, error } =
      await db
        .from('registrations')
        .select('*')
        .eq('sheets_synced', false)
        .order('created_at', {
          ascending: true,
        })
        .limit(10)

    if (error) {
      throw error
    }

    console.log(
      'Registrations found:',
      registrations?.length ?? 0,
    )

    if (!registrations || registrations.length === 0) {
      return json({
        success: true,
        synced: 0,
      })
    }

    let syncedCount = 0

    for (const registration of registrations) {
      console.log(
        'Attempting Sheets write for:',
        registration.id,
      )

      const { data: members, error: membersError } =
        await db
          .from('registration_members')
          .select('*')
          .eq('registration_id', registration.id)
          .order('created_at', {
            ascending: true,
          })

      if (membersError) {
        throw membersError
      }

      const { data: payment, error: paymentError } =
        await db
          .from('payments')
          .select('*')
          .eq('registration_id', registration.id)
          .maybeSingle()

      if (paymentError) {
        throw paymentError
      }

      // Registrations sheet
      await appendRows(
        accessToken,
        spreadsheetId,
        'Registrations',
        [[
          registration.id,
          registration.team_name,
          registration.team_size,
          registration.hackathon_domain,
          registration.leader_name,
          registration.leader_roll_no,
          registration.leader_branch,
          registration.leader_section,
          registration.leader_email,
          registration.leader_phone,
          registration.leader_year,
          registration.status,
          registration.created_at,
        ]],
      )

      // Members sheet
      // The team leader is inserted as the FIRST row.
      // There is NO separate leader/team-leader column.
      const memberRows = [
        [
          registration.id,
          registration.team_name,
          registration.leader_name,
          registration.leader_roll_no,
          registration.leader_branch,
          registration.leader_section,
          registration.leader_email,
          registration.created_at,
        ],
        ...(members ?? []).map((member) => [
          registration.id,
          registration.team_name,
          member.name,
          member.roll_no,
          member.branch,
          member.section,
          member.email,
          member.created_at,
        ]),
      ]

      await appendRows(
        accessToken,
        spreadsheetId,
        'Members',
        memberRows,
      )

      // Payments sheet
      if (payment) {
        await appendRows(
          accessToken,
          spreadsheetId,
          'Payments',
          [[
            registration.id,
            payment.transaction_id,
            payment.status,
            payment.storage_path,
            payment.submitted_at,
            payment.verified_at,
            payment.rejection_reason,
          ]],
        )
      }

      // Mark registration as synced only after
      // all required Sheets writes succeeded.
      const { error: updateError } =
        await db
          .from('registrations')
          .update({
            sheets_synced: true,
          })
          .eq('id', registration.id)

      if (updateError) {
        throw updateError
      }

      syncedCount++
    }

    return json({
      success: true,
      synced: syncedCount,
    })
  } catch (error) {
    console.error('SYNC ERROR:', error)

    return json(
      {
        error:
          'Could not sync registrations to Google Sheets.',
      },
      500,
    )
  }
})
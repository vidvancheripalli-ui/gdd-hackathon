import {
  admin,
  authenticated,
  json,
  options,
} from '../_shared/auth.ts'

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

  const user = await authenticated(request)

  if (!user) {
    return json(
      { error: 'Sign in is required.' },
      401,
    )
  }

  try {
    const body = await request.json()

    const {
      attemptId,
      transactionId,
      screenshot,
    } = body

    if (
      typeof attemptId !== 'string' ||
      !attemptId
    ) {
      return json(
        { error: 'Invalid registration session.' },
        400,
      )
    }

    if (
      typeof transactionId !== 'string' ||
      !/^[A-Za-z0-9-]{6,80}$/.test(
        transactionId.trim(),
      )
    ) {
      return json(
        { error: 'Enter a valid transaction ID.' },
        400,
      )
    }

    if (
      !screenshot ||
      typeof screenshot !== 'object' ||
      typeof screenshot.name !== 'string' ||
      typeof screenshot.type !== 'string' ||
      typeof screenshot.data !== 'string'
    ) {
      return json(
        { error: 'Payment screenshot is required.' },
        400,
      )
    }

    if (
      ![
        'image/jpeg',
        'image/png',
        'image/webp',
      ].includes(screenshot.type)
    ) {
      return json(
        {
          error:
            'Use a PNG, JPEG, or WEBP payment screenshot.',
        },
        400,
      )
    }

    /*
     * Base64 is approximately 33% larger than the
     * original file. This limit safely accommodates
     * a 5 MB original image.
     */
    if (screenshot.data.length > 7_000_000) {
      return json(
        {
          error:
            'Payment screenshot must be 5 MB or smaller.',
        },
        400,
      )
    }

    const db = admin()

    const {
      data: attempt,
      error: attemptError,
    } = await db
      .from('registration_attempts')
      .select('*')
      .eq('id', attemptId)
      .eq('auth_user_id', user.id)
      .eq('status', 'verified')
      .gt(
        'expires_at',
        new Date().toISOString(),
      )
      .single()

    if (attemptError) {
      console.error(
        'Attempt lookup error:',
        attemptError,
      )
    }

    if (!attempt) {
      return json(
        {
          error:
            'This registration session expired. Please start again.',
        },
        400,
      )
    }

    const payload = attempt.payload

    if (
      !payload ||
      typeof payload !== 'object'
    ) {
      throw new Error(
        'Registration data is invalid.',
      )
    }

    /*
     * Convert the base64 screenshot into binary data.
     */
    let bytes: Uint8Array

    try {
      bytes = Uint8Array.from(
        atob(screenshot.data),
        (c) => c.charCodeAt(0),
      )
    } catch {
      return json(
        { error: 'Invalid payment screenshot.' },
        400,
      )
    }

    if (bytes.length > 5 * 1024 * 1024) {
      return json(
        {
          error:
            'Payment screenshot must be 5 MB or smaller.',
        },
        400,
      )
    }

    /*
     * Use the attempt ID as the folder name.
     *
     * This avoids exposing personal information in the
     * storage path and makes every upload uniquely traceable.
     */
    const extension =
      screenshot.type === 'image/jpeg'
        ? 'jpg'
        : screenshot.type === 'image/webp'
          ? 'webp'
          : 'png'

    const filePath =
      `${attemptId}/payment-${crypto.randomUUID()}.${extension}`

    /*
     * Upload to the private Supabase Storage bucket.
     */
    const {
      error: uploadError,
    } = await db.storage
      .from('payment-screenshots')
      .upload(
        filePath,
        bytes,
        {
          contentType: screenshot.type,
          upsert: false,
        },
      )

    if (uploadError) {
      console.error(
        'Storage upload error:',
        uploadError,
      )

      throw new Error(
        'Payment proof upload failed.',
      )
    }

    /*
     * Create the registration record.
     */
    const {
      data: registration,
      error: registrationError,
    } = await db
      .from('registrations')
      .insert({
        auth_user_id: user.id,
        team_name: payload.teamName,
        team_size: Number(payload.teamSize),
        leader_name: payload.name,
        leader_roll_no: payload.rollNo,
        leader_branch: payload.branch,
        leader_section: payload.section,
        leader_email: payload.email,
        leader_phone: payload.phone,
        leader_year: payload.year,
      })
      .select()
      .single()

    if (registrationError) {
      console.error(
        'Registration insert error:',
        registrationError,
      )

      /*
       * Clean up the uploaded screenshot if the
       * registration could not be created.
       */
      await db.storage
        .from('payment-screenshots')
        .remove([filePath])

      throw new Error(
        'Could not create your registration.',
      )
    }

    /*
     * Save team members.
     */
    const members = Array.isArray(payload.members)
      ? payload.members
      : []

    if (members.length > 0) {
      const memberRows = members.map(
        (member: any) => ({
          registration_id: registration.id,
          name: member.name,
          roll_no: member.rollNo,
          branch: member.branch,
          section: member.section,
          email: member.email,
        }),
      )

      const {
        error: membersError,
      } = await db
        .from('registration_members')
        .insert(memberRows)

      if (membersError) {
        console.error(
          'Member insert error:',
          membersError,
        )

        /*
         * Clean up both database registration
         * and uploaded screenshot.
         */
        await db
          .from('registrations')
          .delete()
          .eq('id', registration.id)

        await db.storage
          .from('payment-screenshots')
          .remove([filePath])

        throw new Error(
          'Could not save team member details.',
        )
      }
    }

    /*
     * Save payment details.
     */
    const {
      error: paymentError,
    } = await db
      .from('payments')
      .insert({
        registration_id: registration.id,
        transaction_id: transactionId.trim(),
        storage_path: filePath,
      })

    if (paymentError) {
      console.error(
        'Payment insert error:',
        paymentError,
      )

      await db
        .from('registrations')
        .delete()
        .eq('id', registration.id)

      await db.storage
        .from('payment-screenshots')
        .remove([filePath])

      throw new Error(
        'Could not save the payment details.',
      )
    }

    /*
     * Finalize the registration attempt.
     */
    const {
      error: attemptUpdateError,
    } = await db
      .from('registration_attempts')
      .update({
        status: 'payment_submitted',
      })
      .eq('id', attemptId)
      .eq('auth_user_id', user.id)
      .eq('status', 'verified')

    if (attemptUpdateError) {
      console.error(
        'Attempt update error:',
        attemptUpdateError,
      )

      throw new Error(
        'Could not finalize the registration.',
      )
    }

    return json({
      success: true,
      registrationId: registration.id,
    })
  } catch (error) {
    console.error(
      'Payment submission error:',
      error,
    )

    return json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Payment submission failed.',
      },
      500,
    )
  }
})
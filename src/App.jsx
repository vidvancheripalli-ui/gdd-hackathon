import { useEffect, useState } from 'react'
import HCaptcha from '@hcaptcha/react-hcaptcha'
import gdgLogo from '../gdg-logo.jpeg'
import problemStatementsPdf from './assets/gdd-hackober-ps.pdf'
import { supabase, isConfigured } from './lib/supabase'
import {
  signInWithGoogle,
  submitPayment,
  verifyRegistration,
} from './services/registration'


const blankMember = () => ({
  name: '',
  rollNo: '',
  branch: '',
  section: '',
  email: '',
})

const initialForm = {
  name: '',
  rollNo: '',
  branch: '',
  section: '',
  email: '',
  phone: '',
  year: '',
  teamName: '',
  teamSize: '2',
  website: '',
  members: [blankMember()],
}

function Header({ page }) {
  return (
    <header>
      <a
        className="brand"
        href="#top"
        aria-label="GDG on Campus home"
      >
        {/* <span className="mark">
          <i></i>
          <i></i>
          <i></i>
          <i></i>
        </span> */}
        <img
       className="brand-logo"
       src={gdgLogo}
       alt="GDGoC GRIET"
       />
        <span>
          Google Developer Groups <small>on Campus</small>
        </span>
      </a>

      <div
        className="stepper"
        aria-label={`Step ${page} of 3`}
      >
        <b className={page >= 1 ? 'active' : ''}>1</b>
        <span></span>
        <b className={page >= 2 ? 'active' : ''}>2</b>
        <span></span>
        <b className={page >= 3 ? 'active' : ''}>3</b>
      </div>
    </header>
  )
}

function Notice({ children, kind = 'info' }) {
  return (
    <div className={`notice ${kind}`}>
      {children}
    </div>
  )
}

function BackButton({ onClick, label }) {
  return (
    <button
      className="secondary back-button"
      type="button"
      onClick={onClick}
    >
      ← {label}
    </button>
  )
}

function Register({ onVerified, onBack }) {
  const [form, setForm] = useState(() => {
    try {
      return (
        JSON.parse(
          sessionStorage.getItem(
            'gdg-registration-form'
          ) || 'null'
        ) || initialForm
      )
    } catch {
      return initialForm
    }
  })

  const [user, setUser] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [hcaptchaToken, setHcaptchaToken] =
    useState('')

  useEffect(() => {
    if (!supabase) return

    let mounted = true

    async function loadUser() {
      const { data } =
        await supabase.auth.getUser()

      if (!mounted) return

      const authenticatedUser = data.user || null

      setUser(authenticatedUser)

      if (authenticatedUser) {
        sessionStorage.removeItem(
          'gdg-oauth-return'
        )
      }
    }

    loadUser()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!mounted) return

        const authenticatedUser =
          session?.user || null

        setUser(authenticatedUser)

        if (authenticatedUser) {
          sessionStorage.removeItem(
            'gdg-oauth-return'
          )
        }
      }
    )

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    sessionStorage.setItem(
      'gdg-registration-form',
      JSON.stringify(form)
    )
  }, [form])

  const memberCount = Math.max(
    0,
    Number(form.teamSize) - 1
  )

  function change(name, value) {
    setForm((prev) => ({
      ...prev,
      [name]: value,
    }))
  }

  function sizeChange(value) {
    setForm((prev) => ({
      ...prev,
      teamSize: value,
      members: Array.from(
        {
          length: Math.max(
            0,
            Number(value) - 1
          ),
        },
        (_, i) =>
          prev.members[i] || blankMember()
      ),
    }))
  }

  function memberChange(
    index,
    name,
    value
  ) {
    setForm((prev) => ({
      ...prev,
      members: prev.members.map(
        (member, i) =>
          i === index
            ? {
                ...member,
                [name]: value,
              }
            : member
      ),
    }))
  }

  async function submit(e) {
    e.preventDefault()
    setError('')

    if (!user) {
      setError(
        'Please sign in with Google before continuing.'
      )
      return
    }

    

    if (!hcaptchaToken) {
      setError(
        'Please complete the CAPTCHA.'
      )
      return
    }

    setBusy(true)

    try {
      const data =
        await verifyRegistration({
          ...form,
          hcaptchaToken,
        })

      sessionStorage.setItem(
        'gdg-attempt-id',
        data.attemptId
      )

      onVerified(
        data.attemptId
      )
    } catch (err) {
      setError(
        err.message ||
          'Please check your details and try again.'
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <main id="top">
      <Header page={1} />

      <div className="page-navigation">
        <BackButton
          onClick={onBack}
          label="Back to event"
        />
      </div>

      <section className="hero">
        <p className="eyebrow">
          GDG ON CAMPUS PRESENTS
        </p>

        <h1>Build what’s next.</h1>

        <p>
          Register your team for{' '}
          {import.meta.env.VITE_EVENT_NAME ||
            'the Hackathon'}.
        </p>
      </section>

      <form
        className="card form"
        onSubmit={submit}
      >
        <div className="section-title">
          <div>
            <p className="eyebrow">
              STEP 01
            </p>

            <h2>Team registration</h2>
          </div>

          <span className="required">
            * Required
          </span>
        </div>

        <div
          className={`signin ${
            user ? 'signed-in' : ''
          }`}
        >
          <div>
            <strong>
              {user
                ? 'Signed in with Google'
                : 'Start with Google'}
            </strong>

            <small>
              {user
                ? user.email
                : 'We use this to secure your registration.'}
            </small>
          </div>

          {user ? (
            <span className="check">
              ✓
            </span>
          ) : (
            <button
              type="button"
              className="google"
              onClick={() =>
                signInWithGoogle().catch(
                  (e) =>
                    setError(e.message)
                )
              }
            >
              G Continue with Google
            </button>
          )}
        </div>

        {error && (
          <Notice kind="error">
            {error}
          </Notice>
        )}

        <fieldset>
          <legend>
            Team leader
          </legend>

          <div className="grid two">
            <Field
              label="Full name"
              value={form.name}
              onChange={(v) =>
                change('name', v)
              }
              required
            />

            <Field
              label="Roll number"
              value={form.rollNo}
              onChange={(v) =>
                change('rollNo', v)
              }
              required
            />

            <Field
              label="Branch"
              value={form.branch}
              onChange={(v) =>
                change('branch', v)
              }
              required
            />

            <Field
              label="Section"
              value={form.section}
              onChange={(v) =>
                change('section', v)
              }
              required
            />

            <Field
              label="College email"
              type="email"
              value={form.email}
              onChange={(v) =>
                change('email', v)
              }
              required
            />

            <Field
              label="Phone number"
              type="tel"
              value={form.phone}
              onChange={(v) =>
                change('phone', v)
              }
              required
            />
          </div>

          <div className="grid three">
            <Select
              label="Year"
              value={form.year}
              options={[
                '1st year',
                '2nd year',
                '3rd year',
                '4th year',
              ]}
              onChange={(v) =>
                change('year', v)
              }
              required
            />

            <Field
              label="Team name"
              value={form.teamName}
              onChange={(v) =>
                change(
                  'teamName',
                  v
                )
              }
              required
            />

            <Select
              label="Team size"
              value={form.teamSize}
              options={[
                '2',
                '3',
                '4',
              ]}
              onChange={sizeChange}
              required
            />
          </div>
        </fieldset>

        {memberCount > 0 && (
          <fieldset>
            <legend>
              Team members{' '}
              <small>
                ({memberCount} required)
              </small>
            </legend>

            {form.members.map(
              (member, index) => (
                <div
                  className="member"
                  key={index}
                >
                  <h3>
                    Member {index + 2}
                  </h3>

                  <div className="grid two">
                    {[
                      'name',
                      'rollNo',
                      'branch',
                      'section',
                      'email',
                    ].map((key) => (
                      <Field
                        key={key}
                        label={
                          key === 'rollNo'
                            ? 'Roll number'
                            : key === 'email'
                            ? 'College email'
                            : key
                                .charAt(0)
                                .toUpperCase() +
                              key.slice(1)
                        }
                        type={
                          key === 'email'
                            ? 'email'
                            : 'text'
                        }
                        value={
                          member[key]
                        }
                        onChange={(v) =>
                          memberChange(
                            index,
                            key,
                            v
                          )
                        }
                        required
                      />
                    ))}
                  </div>
                </div>
              )
            )}
          </fieldset>
        )}

        <input
          className="honeypot"
          tabIndex="-1"
          autoComplete="off"
          value={form.website}
          onChange={(e) =>
            change(
              'website',
              e.target.value
            )
          }
          aria-hidden="true"
        />

        <Notice>
          Complete the CAPTCHA before
          continuing. It is verified securely
          when you submit.
        </Notice>

        <div className="captcha">
          <HCaptcha
            sitekey={
              import.meta.env
                .VITE_HCAPTCHA_SITE_KEY
            }
            onVerify={(token) => {
              setHcaptchaToken(token)
              setError('')
            }}
            onExpire={() => {
              setHcaptchaToken('')
            }}
            onError={() => {
              setHcaptchaToken('')
              setError(
                'CAPTCHA could not be loaded. Please try again.'
              )
            }}
          />
        </div>

        <button
          className="primary"
          type="submit"
          disabled={busy}
        >
          {busy
            ? 'Verifying your team…'
            : 'Continue to payment →'}
        </button>
      </form>
    </main>
  )
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
  required,
}) {
  return (
    <label>
      {label}
      {required && <em>*</em>}

      <input
        type={type}
        value={value}
        onChange={(e) =>
          onChange(e.target.value)
        }
        required={required}
      />
    </label>
  )
}

function Select({
  label,
  value,
  options,
  onChange,
  required,
}) {
  return (
    <label>
      {label}
      {required && <em>*</em>}

      <select
        value={value}
        onChange={(e) =>
          onChange(e.target.value)
        }
        required={required}
      >
        <option value="">
          Select {label.toLowerCase()}
        </option>

        {options.map((option) => (
          <option
            key={option}
            value={option}
          >
            {option}
          </option>
        ))}
      </select>
    </label>
  )
}

function Payment({
  attemptId,
  onSuccess,
  onBack,
}) {
  const [transactionId, setTransactionId] =
    useState(
      () =>
        sessionStorage.getItem(
          'gdg-transaction-id'
        ) || ''
    )

  const [file, setFile] =
    useState(null)

  const [busy, setBusy] =
    useState(false)

  const [error, setError] =
    useState('')

  useEffect(() => {
    sessionStorage.setItem(
      'gdg-transaction-id',
      transactionId
    )
  }, [transactionId])

  async function submit(e) {
    e.preventDefault()
    setError('')

    if (!transactionId.trim()) {
      setError(
        'Please enter your transaction ID / UTR number.'
      )
      return
    }

    if (!file) {
      setError(
        'Please upload your payment screenshot.'
      )
      return
    }

    if (
      file.size >
      5 * 1024 * 1024
    ) {
      setError(
        'Screenshot must be 5 MB or smaller.'
      )
      return
    }

    setBusy(true)

    try {
      await submitPayment({
        attemptId,
        transactionId:
          transactionId.trim(),
        screenshot:
          await fileToPayload(file),
      })

      onSuccess()
    } catch (err) {
      setError(
        err.message ||
          'Payment could not be submitted.'
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <main>
      <Header page={2} />

      <div className="page-navigation">
        <BackButton
          onClick={onBack}
          label="Back to registration"
        />
      </div>

      <section className="hero compact">
        <p className="eyebrow">
          STEP 02
        </p>

        <h1>
          Complete your payment.
        </h1>

      </section>

      <form
        className="card payment"
        onSubmit={submit}
      >
        {error && (
          <Notice kind="error">
            {error}
          </Notice>
        )}

        <div className="qr">
          <div
            className="fake-qr"
            aria-label="Official payment QR placeholder"
          >
            <img src="/event-qr.jpeg" />
          </div>

          {/* <strong>
            Official event payment QR
          </strong>

          <small>
            Replace this placeholder with
            the official college/club account
            QR before launch.
          </small>
        </div>
 */}
        <Notice>
          You may screenshot this QR, pay
          using your UPI/banking app, then
          return here. Your transaction ID is
          retained in this browser.
        </Notice>

        <Field
          label="Transaction ID / UTR number"
          value={transactionId}
          onChange={setTransactionId}
          required
        />

        <label>
          Payment screenshot
          <em>*</em>

          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(e) =>
              setFile(
                e.target.files?.[0] ||
                  null
              )
            }
            required
          />

          <small>
            {file
              ? `${file.name} selected`
              : 'PNG, JPEG, or WEBP · maximum 5 MB'}
          </small>
        </label>

        <button
          className="primary"
          type="submit"
          disabled={busy}
        >
          {busy
            ? 'Submitting securely…'
            : 'Submit payment proof →'}
        </button>
      </form>
    </main>
  )
}

function fileToPayload(file) {
  return new Promise(
    (resolve, reject) => {
      const reader =
        new FileReader()

      reader.onerror = reject

      reader.onload = () => {
        const result =
          reader.result

        if (
          typeof result !==
          'string'
        ) {
          reject(
            new Error(
              'Could not read the selected file.'
            )
          )
          return
        }

        const base64 =
          result.includes(',')
            ? result.split(',')[1]
            : result

        resolve({
          name: file.name,
          type: file.type,
          data: base64,
        })
      }

      reader.readAsDataURL(file)
    }
  )
}

function ThankYou({ onBack }) {
  return (
    <main>
      <Header page={3} />

      <section className="thank card">
        <div className="celebrate">
          ✓
        </div>

        <p className="eyebrow">
          YOU’RE ALL SET
        </p>

        <h1>
          Thanks for registering!
        </h1>

        <p>
          Your payment proof is with the
          organizing team for review. Please Download Your Problem Statement and Join the WhatsApp group to stay updated on the event.
        </p>

        <div className="actions">
          <BackButton
            onClick={onBack}
            label="Back to event"
          />

          <a
            className="secondary link"
            href={problemStatementsPdf}
            download="gdd-hackober-problem-statements.pdf"
          >
            Download problem statement
          </a>

          <a
            className="primary link"
            href={
              import.meta.env
                .VITE_WHATSAPP_INVITE_URL ||
              '#'
            }
          >
            Join WhatsApp group ↗
          </a>
        </div>
      </section>
    </main>
  )
}

function Home({ onRegister }) {
  return (
    <main className="home">
      <nav className="home-nav">
        <a
          className="brand"
          href="#top"
          aria-label="GDG on Campus home"
        >
          {/* <span className="mark">
            <i></i>
            <i></i>
            <i></i>
            <i></i>
          </span> */}
          <img
       className="brand-logo"
       src={gdgLogo}
       alt="GDGoC GRIET"
       />

          <span>
            Google Developer Groups <small>on Campus</small>
          </span>
        </a>

        <button
          className="nav-register"
          onClick={onRegister}
        >
          Register
        </button>
      </nav>

      <section
        className="job-layout"
        id="top"
      >
        <article className="job-main">
          <p className="eyebrow">
            GDG ON CAMPUS
          </p>

          <h1>Google Developer Day - 2026</h1>
          <div
  className="empty-description"
  aria-label="Event description"
>
  <section>
    <h2>Hack'ober 26</h2>

    <p>
      Hack'o'Ber '26 follows a random problem-allocation format.
      Instead of selecting a problem statement based on individual
      preferences, teams will receive a problem statement randomly
      assigned by the organising team.
    </p>

    <ul>
      <li>
        <strong>Understand:</strong>{' '}
        Analyse the assigned problem and identify its requirements,
        constraints, and intended outcome.
      </li>

      <li>
        <strong>Ideate:</strong>{' '}
        Develop a clear and feasible approach to solving the assigned
        challenge.
      </li>

      <li>
        <strong>Build:</strong>{' '}
        Convert the proposed solution into a functional prototype
        using appropriate technologies, frameworks, APIs, or platforms.
      </li>

      <li>
        <strong>Collaborate:</strong>{' '}
        Work effectively as a team by distributing responsibilities,
        communicating throughout the event, and making collective
        technical decisions.
      </li>

      <li>
        <strong>Adapt:</strong>{' '}
        Quickly understand and work with unfamiliar problem domains
        because problem statements are randomly allotted.
      </li>

      <li>
        <strong>Present:</strong>{' '}
        Demonstrate the solution and clearly communicate the problem,
        approach, implementation, functionality, and potential impact.
      </li>
    </ul>
  </section>

  <section>
    <h2>What We Expect From Participants</h2>

    <p>
      Participants are expected to approach the event with a strong
      problem-solving mindset and a willingness to work with challenges
      outside their existing areas of familiarity.
    </p>

    <ul>
      <li>
        Analyse problems carefully before developing a solution.
      </li>
      <li>
        Develop practical and technically feasible approaches.
      </li>
      <li>
        Build a functional prototype within the allotted time.
      </li>
      <li>
        Collaborate effectively with teammates.
      </li>
      <li>
        Adapt quickly to unfamiliar technical domains.
      </li>
      <li>
        Make informed technical decisions under time constraints.
      </li>
      <li>
        Clearly demonstrate and communicate the final solution.
      </li>
    </ul>

    <p>
      The emphasis is not simply on producing a large amount of code.
      What matters is how effectively a team understands the assigned
      challenge and transforms it into a meaningful, working solution.
    </p>
  </section>

  <section>
    <h2>Evaluation</h2>

    <p>
      Teams will be evaluated on the quality of their solution and
      their ability to demonstrate its technical and practical value.
    </p>

    <ul>
      <li>Understanding of the assigned problem</li>
      <li>Innovation and creativity of the approach</li>
      <li>Technical implementation</li>
      <li>Functionality of the prototype</li>
      <li>Relevance and practicality of the solution</li>
      <li>Effective use of technology</li>
      <li>Team collaboration</li>
      <li>Quality of the demonstration</li>
      <li>Clarity and effectiveness of the final presentation</li>
    </ul>

    <p>
      The final evaluation will focus on problem-solving, technical
      execution, adaptability, and communication.
    </p>
  </section>

  <section>
    <h2>Interaction With Google Experts</h2>

    <p>
      A key component of Google Developers Day is the opportunity for
      participants to interact with Google experts.
    </p>

    <ul>
      <li>Gain exposure to industry perspectives.</li>
      <li>Learn from experienced technology professionals.</li>
      <li>
        Understand real-world approaches to technology and development.
      </li>
      <li>
        Gain insights into skills expected in professional environments.
      </li>
      <li>
        Showcase your work and interact with experienced professionals.
      </li>
    </ul>
  </section>

  <section>
    <h2>Team Details</h2>

    <ul>
      <li>
        <strong>Team Size:</strong> 2–4 members
      </li>
      <li>
        <strong>Registration Fee:</strong> ₹400 per team
      </li>
      <li>
        Teams will collectively work on the problem statement assigned
        to them during the event.
      </li>
    </ul>
  </section>

  <section>
    <h2>Perks &amp; Opportunities</h2>

    <ul>
      <li>
        <strong>₹6,000 Prize Pool</strong>
        <p>
          Compete for a total prize pool of ₹6,000.
        </p>
      </li>

      <li>
        <strong>Exclusive Goodies</strong>
        <p>
          Participants will receive event goodies as part of their
          Hack'o'Ber experience.
        </p>
      </li>

      <li>
        <strong>Google Cloud Jam Access</strong>
        <p>
          Receive free slots and pre-registration access for upcoming
          Google Cloud Jams, subject to event arrangements.
        </p>
      </li>

      <li>
        <strong>Interaction With Google Experts</strong>
        <p>
          Get opportunities to interact with Google experts and gain
          insights from experienced technology professionals.
        </p>
      </li>

      <li>
        <strong>Participation Certificate</strong>
        <p>
          Receive a certificate recognising your participation.
        </p>
      </li>

      <li>
        <strong>Hands-on Development Experience</strong>
        <p>
          Gain practical exposure to collaborative development,
          time-bound problem solving, prototyping, and technical
          presentation.
        </p>
      </li>
    </ul>
  </section>

  <section>
    <h2>Event Details</h2>

    <ul>
      <li>
        <strong>Event:</strong> Google Developers Day 2026
      </li>
      <li>
        <strong>Theme:</strong> Hack'o'Ber '26
      </li>
      <li>
        <strong>Date:</strong> 1 October 2026
      </li>
      <li>
        <strong>Time:</strong> 9:00 AM – 4:00 PM
      </li>
      <li>
        <strong>Venue:</strong> Hall 1, GRIET
      </li>
      <li>
        <strong>Expected Participation:</strong> 60+ teams
      </li>
      <li>
        <strong>Team Size:</strong> 2–4 members
      </li>
      <li>
        <strong>Registration Fee:</strong> ₹400 per team
      </li>
      <li>
        <strong>Prize Pool:</strong> ₹6,000
      </li>
      <li>
        <strong>Last Date to Register:</strong> 29 September 2026
      </li>
    </ul>
  </section>

  <section>
    <h2>Why Hack'o'Ber '26?</h2>

    <p>
      Hack'o'Ber '26 is designed to challenge participants to work
      beyond predefined comfort zones and develop solutions to
      problems assigned to them during the event.
    </p>

    <p>
      The challenge is not only about what a team already knows,
      but also about how effectively it can learn, adapt, build,
      and solve.
    </p>
  </section>

  <section>
    <h2>THE PROBLEM IS OURS.<br />THE SOLUTION IS YOURS.</h2>
  </section>
</div>
        </article>

        <aside className="job-sidebar">
          <div className="job-detail">
            <span className="detail-icon blue">
              ⌖
            </span>

            <div>
              <small>Location</small>
              <strong>9:00 AM – 4:00 PM <br/> Hall 1, GRIET</strong>
            </div>
          </div>

          <div className="job-detail">
            <span className="detail-icon red">
              ◷
            </span>

            <div>
              <small>
                Registrations
              </small>
              <strong>29th September 2026</strong>
              <small> Event date</small>
              <strong>1rst October 2026</strong>
            </div>
          </div>

          <div className="job-detail">
            <span className="detail-icon yellow">
              ◌
            </span>

            <div>
              <small>
                Event format
              </small>
              <strong>Hackathon of team Sizes 2 - 4</strong>
            </div>
          </div>

          <div className="job-detail">
            <span className="detail-icon green">
              ₹
            </span>

            <div>
              <small>Prize & registration</small>
              <strong>₹6,000 prize pool</strong>
              <small>Team registration fee</small>
              <strong>₹400 per team</strong>
            </div>
          </div>

          <button
            className="primary apply"
            onClick={onRegister}
          >
            Register now
          </button>
        </aside>
      </section>
    </main>
  )
}

export default function App() {
  const [page, setPage] =
    useState(() => {
      if (
        sessionStorage.getItem(
          'gdg-attempt-id'
        )
      ) {
        return 'payment'
      }

      if (
        sessionStorage.getItem(
          'gdg-oauth-return'
        ) === 'register'
      ) {
        return 'register'
      }

      return 'home'
    })

  const [attemptId, setAttemptId] =
    useState(
      () =>
        sessionStorage.getItem(
          'gdg-attempt-id'
        ) || ''
    )

  // const [domain, setDomain] =
  //   useState(() => {
  //     try {
  //       return (
  //         JSON.parse(
  //           sessionStorage.getItem(
  //             'gdg-registration-form'
  //           ) || '{}'
  //         ).domain || 'selected'
  //       )
  //     } catch {
  //       return 'selected'
  //     }
  //   })

  const register = (
  <Register
    onBack={() => setPage('home')}
    onVerified={(id) => {
      setAttemptId(id)
      setPage('payment')
    }}
  />
)
  

  if (page === 'home') {
    return (
      <Home
        onRegister={() =>
          setPage('register')
        }
      />
    )
  }

  if (!isConfigured) {
    return (
      <>
        {register}

        <footer>
          Demo mode: configure Supabase
          values to enable sign-in and
          submission.
        </footer>
      </>
    )
  }

  if (page === 'register') {
    return register
  }

  if (page === 'payment') {
    return (
      <Payment
        attemptId={attemptId}
        onBack={() => setPage('register')}
        onSuccess={() =>
          setPage('thankyou')
        }
      />
    )
  }

  return (
    <ThankYou
      onBack={() => setPage('home')}
    />
  )
}

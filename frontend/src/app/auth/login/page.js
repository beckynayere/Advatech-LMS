'use client'

import { useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { RiEyeLine, RiEyeOffLine, RiArrowRightLine, RiShieldCheckLine } from 'react-icons/ri'
import { useAuthContext } from '@/lib/context/AuthContext'
import styles from './login.module.css'

// Demo credentials — these are the Moodle usernames
// Update these once backend dev confirms the actual Moodle usernames
const DEMO = [
  { label: 'School Admin', username: 'admin@tuk.ac.ke', password: 'ChangeMe@2025!', role: 'Admin' },
  { label: 'Lecturer', username: 'lecturer@tuk.ac.ke', password: 'ChangeMe@2025!', role: 'Lecturer' },
  { label: 'Student', username: 'student@tuk.ac.ke', password: 'ChangeMe@2025!', role: 'Student' },
]

export default function LoginPage() {
  const { login } = useAuthContext()
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const user = await login(username, password)
      const dashMap = {
        institution_admin: '/admin/dashboard',
        platform_admin: '/platform/dashboard',
        lecturer: '/lecturer/dashboard',
        student: '/student/dashboard',
      }
      router.replace(dashMap[user.role] || '/admin/dashboard')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const fillDemo = (demo) => {
    setUsername(demo.username)
    setPassword(demo.password)
    setError('')
  }

  return (
    <div className={styles.page}>
      {/* LEFT */}
      <div className={styles.left}>
        <div className={styles.brand}>
          <div className={styles.logoWrapper}>
            <Image
              src="/AdvaGroup-logo.jpeg"
              alt="AdvaTech Group Logo"
              width={40}
              height={40}
              priority
              className={styles.brandLogo}
            />
          </div>
          <div>
            <div className={styles.brandName}>AdvaTech LMS</div>
            <div className={styles.brandSub}>Academic Platform</div>
          </div>
        </div>

        <div className={styles.hero}>
          <div className={styles.heroTag}>
            <RiShieldCheckLine size={12} />
            Trusted by African institutions
          </div>
          <h1 className={styles.heroTitle}>
            Learning built for<br />
            <span>African campuses</span>
          </h1>
          <p className={styles.heroDesc}>
            A multi-tenant platform where every institution gets its own
            isolated environment — courses, grading, timetables, and payments
            all in one place.
          </p>
        </div>

        <div className={styles.stats}>
          <div className={styles.stat}>
            <div className={styles.statValue}>3+</div>
            <div className={styles.statLabel}>Institutions</div>
          </div>
          <div className={styles.stat}>
            <div className={styles.statValue}>99%</div>
            <div className={styles.statLabel}>Uptime</div>
          </div>
          <div className={styles.stat}>
            <div className={styles.statValue}>300+</div>
            <div className={styles.statLabel}>Concurrent users</div>
          </div>
        </div>
      </div>

      {/* RIGHT */}
      <div className={styles.right}>
        <div className={styles.formWrap}>
          <div className={styles.formHeader}>
            <h2 className={styles.formTitle}>Welcome back</h2>
            <p className={styles.formSub}>Sign in with your email and password</p>
          </div>

          <form onSubmit={handleSubmit}>
            {error && <div className={styles.error}>{error}</div>}

            <div className={styles.field}>
              <label className={styles.label}>Email</label>
              <div className={styles.inputWrap}>
                <input
                  className={styles.input}
                  type="text"
                  placeholder="your@email.ac.ke"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  required
                  autoComplete="username"
                  autoCapitalize="none"
                />
              </div>
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Password</label>
              <div className={styles.inputWrap}>
                <input
                  className={styles.input}
                  type={showPass ? 'text' : 'password'}
                  placeholder="Enter your password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className={styles.inputIcon}
                  onClick={() => setShowPass(v => !v)}
                >
                  {showPass ? <RiEyeOffLine size={16} /> : <RiEyeLine size={16} />}
                </button>
              </div>
            </div>

            <button className={styles.submitBtn} type="submit" disabled={loading}>
              {loading ? 'Signing in…' : 'Sign in'}
              {!loading && <RiArrowRightLine size={16} />}
            </button>
          </form>

          <div className={styles.divider}>
            <div className={styles.dividerLine} />
            <span className={styles.dividerText}>Demo access</span>
            <div className={styles.dividerLine} />
          </div>

          <div className={styles.demoGrid}>
            {DEMO.map(d => (
              <button key={d.role} className={styles.demoBtn} onClick={() => fillDemo(d)}>
                {d.label}
                <span className={styles.demoBtnRole}>{d.role}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
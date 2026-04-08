// DESTINATION: src/app/profile/page.js
'use client'
 
import { useState } from 'react'
import {
  RiUserLine, RiLockPasswordLine, RiMailLine,
  RiShieldUserLine, RiBuildingLine, RiSaveLine,
  RiEyeLine, RiEyeOffLine, RiEditLine, RiCloseLine,
} from 'react-icons/ri'
import DashboardShell from '@/components/layout/DashboardShell'
import { useToast } from '@/lib/ToastContext'
import { useAuthContext } from '@/lib/context/AuthContext'
import { apiPut } from '@/lib/api/client'
import styles from './profile.module.css'
 
const ROLE_LABELS = {
  platform_admin:    'Platform Admin',
  institution_admin: 'School Admin',
  admin:             'School Admin',
  lecturer:          'Lecturer',
  student:           'Student',
}
 
const ROLE_MAP = {
  platform_admin:    'platform',
  institution_admin: 'admin',
  admin:             'admin',
  lecturer:          'lecturer',
  student:           'student',
}
 
const ROLE_ACCENT = {
  platform_admin:    '#6366f1',
  institution_admin: '#0d9488',
  admin:             '#0d9488',
  lecturer:          '#2563eb',
  student:           '#7c3aed',
}
 
export default function ProfilePage() {
  const { user, setUser } = useAuthContext()
  const toast = useToast()
 
  // ── Profile edit state ─────────────────────────────────────────────────────
  const [editingProfile, setEditingProfile] = useState(false)
  const [profileForm, setProfileForm] = useState({ name: '', phone: '' })
  const [savingProfile, setSavingProfile] = useState(false)
 
  // ── Password change state ──────────────────────────────────────────────────
  const [pwForm, setPwForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  })
  const [savingPw, setSavingPw]           = useState(false)
  const [showCurrent, setShowCurrent]     = useState(false)
  const [showNew, setShowNew]             = useState(false)
  const [showConfirm, setShowConfirm]     = useState(false)
 
  const requiredRole = ROLE_MAP[user?.role] || 'student'
  const accent       = ROLE_ACCENT[user?.role] || '#0d9488'
 
  // ── Open profile edit modal pre-filled ─────────────────────────────────────
  const openEditProfile = () => {
    setProfileForm({ name: user?.name || '', phone: user?.phone || '' })
    setEditingProfile(true)
  }
 
  // ── Save name/phone — PUT /api/v1/users/:id ─────────────────────────────────
  const handleSaveProfile = async () => {
    if (!profileForm.name.trim()) {
      toast.warning('Name is required.')
      return
    }
    setSavingProfile(true)
    try {
      const data = await apiPut(`/api/v1/users/${user.id}`, {
        name:  profileForm.name.trim(),
        phone: profileForm.phone.trim() || null,
      })
      // Update auth context so the header reflects the new name immediately
      if (setUser && data.user) {
        setUser(prev => ({ ...prev, name: data.user.name, phone: data.user.phone }))
      }
      setEditingProfile(false)
      toast.success('Profile updated.')
    } catch (e) {
      toast.error(e.message || 'Failed to update profile.')
    } finally {
      setSavingProfile(false)
    }
  }
 
  // ── Change password — PUT /api/v1/users/:id/password ───────────────────────
  // FIX 2a: was calling POST /api/v1/auth/change-password (route does not exist)
  // Correct endpoint is PUT /api/v1/users/:id/password (users.routes.ts line ~87)
  const handleChangePassword = async () => {
    if (!pwForm.currentPassword || !pwForm.newPassword || !pwForm.confirmPassword) {
      toast.warning('All password fields are required.')
      return
    }
    if (pwForm.newPassword !== pwForm.confirmPassword) {
      toast.error('New passwords do not match.')
      return
    }
    if (pwForm.newPassword.length < 8) {
      toast.warning('New password must be at least 8 characters.')
      return
    }
    setSavingPw(true)
    try {
      // FIX: correct endpoint — PUT /api/v1/users/:id/password
      await apiPut(`/api/v1/users/${user.id}/password`, {
        currentPassword: pwForm.currentPassword,
        newPassword:     pwForm.newPassword,
      })
      setPwForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
      toast.success('Password changed successfully.')
    } catch (e) {
      toast.error(e.message || 'Failed to change password.')
    } finally {
      setSavingPw(false)
    }
  }
 
  const getInitials = (name) =>
    (name || '').split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase() || '?'
 
  return (
    <DashboardShell title="My Profile" subtitle="Account information and settings" requiredRole={requiredRole}>
      <div className={styles.page}>
 
        {/* ── Profile card ───────────────────────────────────────────────── */}
        <div className={styles.profileCard}>
          <div className={styles.avatarWrap}>
            <div className={styles.avatar} style={{ background: accent }}>
              {getInitials(user?.name)}
            </div>
            <div className={styles.avatarInfo}>
              <div className={styles.name}>{user?.name}</div>
              <div className={styles.roleChip} style={{ background: accent + '18', color: accent }}>
                {ROLE_LABELS[user?.role] || user?.role}
              </div>
            </div>
          </div>
 
          <div className={styles.infoGrid}>
            <div className={styles.infoItem}>
              <div className={styles.infoLabel}><RiMailLine size={13} /> Email</div>
              <div className={styles.infoValue}>{user?.email || '—'}</div>
            </div>
            <div className={styles.infoItem}>
              <div className={styles.infoLabel}><RiShieldUserLine size={13} /> Role</div>
              <div className={styles.infoValue}>{ROLE_LABELS[user?.role] || '—'}</div>
            </div>
            {user?.phone && (
              <div className={styles.infoItem}>
                <div className={styles.infoLabel}><RiUserLine size={13} /> Phone</div>
                <div className={styles.infoValue}>{user.phone}</div>
              </div>
            )}
            {user?.institutionId && (
              <div className={styles.infoItem}>
                <div className={styles.infoLabel}><RiBuildingLine size={13} /> Institution ID</div>
                <div className={styles.infoValue} style={{ fontFamily: 'DM Mono, monospace', fontSize: 12 }}>
                  {user.institutionId}
                </div>
              </div>
            )}
            {user?.regNo && (
              <div className={styles.infoItem}>
                <div className={styles.infoLabel}><RiUserLine size={13} /> Reg. Number</div>
                <div className={styles.infoValue} style={{ fontFamily: 'DM Mono, monospace', fontSize: 12 }}>
                  {user.regNo}
                </div>
              </div>
            )}
            {user?.department && (
              <div className={styles.infoItem}>
                <div className={styles.infoLabel}><RiBuildingLine size={13} /> Department</div>
                <div className={styles.infoValue}>{user.department}</div>
              </div>
            )}
          </div>
 
          {/* FIX 2b: Edit Profile button — was missing entirely */}
          <div style={{ marginTop: 16 }}>
            <button
              className={styles.editProfileBtn || styles.saveBtn}
              onClick={openEditProfile}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '8px 16px', borderRadius: 8, border: `1px solid ${accent}`,
                background: 'transparent', color: accent, fontSize: 13, fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              <RiEditLine size={14} /> Edit Profile
            </button>
          </div>
        </div>
 
        {/* ── Edit Profile Modal ─────────────────────────────────────────── */}
        {editingProfile && (
          <div style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1000,
          }}>
            <div style={{
              background: 'var(--surface)', borderRadius: 12, padding: 28,
              width: 420, maxWidth: '92vw', boxShadow: 'var(--shadow-xl)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <div style={{ fontSize: 15, fontWeight: 600 }}>Edit Profile</div>
                <button onClick={() => setEditingProfile(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                  <RiCloseLine size={18} />
                </button>
              </div>
 
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className={styles.field}>
                  <label className={styles.label}>Full Name</label>
                  <input
                    className={styles.input}
                    type="text"
                    placeholder="Full name"
                    value={profileForm.name}
                    onChange={e => setProfileForm(f => ({ ...f, name: e.target.value }))}
                  />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Phone (optional)</label>
                  <input
                    className={styles.input}
                    type="tel"
                    placeholder="+254 7XX XXX XXX"
                    value={profileForm.phone}
                    onChange={e => setProfileForm(f => ({ ...f, phone: e.target.value }))}
                  />
                </div>
              </div>
 
              <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
                <button
                  onClick={() => setEditingProfile(false)}
                  style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', fontSize: 13 }}
                >
                  Cancel
                </button>
                <button
                  className={styles.saveBtn}
                  onClick={handleSaveProfile}
                  disabled={savingProfile}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                >
                  <RiSaveLine size={14} />
                  {savingProfile ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        )}
 
        {/* ── Change password ────────────────────────────────────────────── */}
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <RiLockPasswordLine size={16} />
            <div>
              <div className={styles.sectionTitle}>Change Password</div>
              <div className={styles.sectionSub}>Use a strong password: min 8 chars, 1 uppercase, 1 number</div>
            </div>
          </div>
 
          <div className={styles.form}>
            {/* Current password */}
            <div className={styles.field}>
              <label className={styles.label}>Current Password</label>
              <div className={styles.inputWrap}>
                <input
                  className={styles.input}
                  type={showCurrent ? 'text' : 'password'}
                  placeholder="Enter current password"
                  value={pwForm.currentPassword}
                  onChange={e => setPwForm(f => ({ ...f, currentPassword: e.target.value }))}
                />
                <button type="button" className={styles.eyeBtn} onClick={() => setShowCurrent(v => !v)} tabIndex={-1}>
                  {showCurrent ? <RiEyeOffLine size={15} /> : <RiEyeLine size={15} />}
                </button>
              </div>
            </div>
 
            {/* New + confirm */}
            <div className={styles.row}>
              <div className={styles.field}>
                <label className={styles.label}>New Password</label>
                <div className={styles.inputWrap}>
                  <input
                    className={styles.input}
                    type={showNew ? 'text' : 'password'}
                    placeholder="New password"
                    value={pwForm.newPassword}
                    onChange={e => setPwForm(f => ({ ...f, newPassword: e.target.value }))}
                  />
                  <button type="button" className={styles.eyeBtn} onClick={() => setShowNew(v => !v)} tabIndex={-1}>
                    {showNew ? <RiEyeOffLine size={15} /> : <RiEyeLine size={15} />}
                  </button>
                </div>
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Confirm New Password</label>
                <div className={styles.inputWrap}>
                  <input
                    className={`${styles.input} ${
                      pwForm.confirmPassword && pwForm.newPassword !== pwForm.confirmPassword
                        ? styles.inputError : ''
                    }`}
                    type={showConfirm ? 'text' : 'password'}
                    placeholder="Confirm new password"
                    value={pwForm.confirmPassword}
                    onChange={e => setPwForm(f => ({ ...f, confirmPassword: e.target.value }))}
                  />
                  <button type="button" className={styles.eyeBtn} onClick={() => setShowConfirm(v => !v)} tabIndex={-1}>
                    {showConfirm ? <RiEyeOffLine size={15} /> : <RiEyeLine size={15} />}
                  </button>
                </div>
              </div>
            </div>
 
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                className={styles.saveBtn}
                onClick={handleChangePassword}
                disabled={savingPw}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                <RiSaveLine size={14} />
                {savingPw ? 'Saving…' : 'Update Password'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </DashboardShell>
  )
}
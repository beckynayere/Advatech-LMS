'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  RiCheckboxCircleFill, RiErrorWarningFill, RiLoaderLine,
  RiTimeLine, RiBuildingLine, RiRefreshLine, RiAddLine,
  RiAlertFill, RiArrowRightLine, RiRestartLine, RiEyeLine,
  RiPlayCircleLine, RiShieldCheckFill, RiRadarLine,
  RiPulseLine, RiArrowRightUpLine, RiSettings4Line, RiExternalLinkLine
} from 'react-icons/ri'
import DashboardShell from '@/components/layout/DashboardShell'
import {
  getInstitutions, approveTenant, provisionTenant,
  retryProvision, INSTITUTION_STATUS, IN_PROGRESS_STATES,
} from '@/lib/api/institutions'
import styles from './dashboard.module.css'

// ─── Helpers ─────────────────────────────────────────────────────────────────
function fmt(dt) {
  if (!dt) return '—'
  const d = new Date(dt)
  const now = new Date()
  const diff = Math.floor((now - d) / 1000)
  if (diff < 60)   return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
}

function provisioningMinutes(updatedAt) {
  if (!updatedAt) return 0
  return Math.floor((Date.now() - new Date(updatedAt)) / 60000)
}

const STUCK_THRESHOLD_MIN = 10

function StatusDot({ status }) {
  const colors = {
    running: styles.dotGreen, provisioning: styles.dotBlue,
    dns_pending: styles.dotBlue, verified: styles.dotYellow,
    requested: styles.dotGray, failed: styles.dotRed,
  }
  return <span className={`${styles.dot} ${colors[status] || styles.dotGray}`} />
}

// ─── Main dashboard ───────────────────────────────────────────────────────────
export default function PlatformDashboard() {
  const router = useRouter()
  const [institutions, setInstitutions] = useState([])
  const [loading, setLoading] = useState(true)
  const [lastRefresh, setLastRefresh] = useState(null)
  const [busy, setBusy] = useState(null)
  const pollRef = useRef(null)

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const data = await getInstitutions()
      setInstitutions(data)
      setLastRefresh(new Date())
    } catch (e) {
      console.error('Dashboard load error:', e)
    } finally {
      if (!silent) setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    const hasActive = institutions.some(i => IN_PROGRESS_STATES.includes(i.status))
    clearInterval(pollRef.current)
    if (hasActive) {
      pollRef.current = setInterval(() => load(true), 8000)
    }
    return () => clearInterval(pollRef.current)
  }, [institutions, load])

  async function handleAction(action, tenant) {
    setBusy(tenant.id)
    try {
      let updated
      if (action === 'retry')     updated = await retryProvision(tenant.id)
      if (action === 'approve')   updated = await approveTenant(tenant.id)
      if (action === 'provision') updated = await provisionTenant(tenant.id)
      if (updated) setInstitutions(prev => prev.map(i => i.id === updated.id ? updated : i))
    } catch (e) {
      console.error(e)
    } finally {
      setBusy(null)
    }
  }

  // ── Derived state ──────────────────────────────────────────────────────────
  const counts = {
    total:        institutions.length,
    running:      institutions.filter(i => i.status === 'running').length,
    pending:      institutions.filter(i => ['requested', 'verified'].includes(i.status)).length,
    provisioning: institutions.filter(i => ['provisioning', 'dns_pending'].includes(i.status)).length,
    failed:       institutions.filter(i => i.status === 'failed').length,
  }

  const attentionItems = institutions.filter(i => {
    if (i.status === 'failed') return true
    if (['provisioning', 'dns_pending'].includes(i.status) && provisioningMinutes(i.updatedAt) > STUCK_THRESHOLD_MIN) return true
    return false
  })

  const pendingApproval = institutions.filter(i => i.status === 'requested')
  const readyToProvision = institutions.filter(i => i.status === 'verified')
  const recentTenants = [...institutions].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 5)
  
  const activity = []
  institutions.forEach(t => {
    if (t.status === 'running' && t.provisionedAt) activity.push({ ts: t.provisionedAt, msg: `${t.name} is now live`, type: 'success' })
    if (t.status === 'failed' && t.updatedAt) activity.push({ ts: t.updatedAt, msg: `${t.name} failed provisioning`, type: 'danger' })
    if (t.status === 'provisioning' && t.updatedAt) activity.push({ ts: t.updatedAt, msg: `Provisioning started for ${t.name}`, type: 'info' })
    if (t.status === 'requested' && t.createdAt) activity.push({ ts: t.createdAt, msg: `New registration: ${t.name}`, type: 'gray' })
  })
  const sortedActivity = activity.sort((a, b) => new Date(b.ts) - new Date(a.ts)).slice(0, 5)

  const isHealthy = counts.failed === 0 && attentionItems.length === 0

  return (
    <DashboardShell title="Platform Overview" subtitle="Monitor and manage network institutions">
      <div className={styles.page}>

        {/* ── Dynamic Top Bar ── */}
        <div className={styles.headerBar}>
          <div className={`${styles.statusBadge} ${isHealthy ? styles.statusGood : styles.statusBad}`}>
            {isHealthy ? <RiCheckboxCircleFill size={16} /> : <RiAlertFill size={16} />}
            <span>{isHealthy ? 'All Systems Operational' : `${attentionItems.length} Actions Required`}</span>
          </div>
          
          <div className={styles.headerActions}>
            <span className={styles.lastUpdate}>
              Last checked: {lastRefresh ? fmt(lastRefresh) : '—'}
            </span>
            <button className={styles.actionBtn} onClick={() => load()} disabled={loading}>
              <RiRefreshLine size={15} className={loading ? styles.spin : ''} />
            </button>
            <Link href="/platform/institutions" className={styles.primaryBtn}>
              <RiAddLine size={16} />
              <span>Register Tenant</span>
            </Link>
          </div>
        </div>

        {/* ── High-Impact Stat Grid ── */}
        <div className={styles.statsGrid}>
          {[
            { label: 'Running Tenants', value: counts.running, mod: 'green', icon: RiCheckboxCircleFill, filter: 'running' },
            { label: 'In Provisioning', value: counts.provisioning, mod: 'blue', icon: RiLoaderLine, filter: 'provisioning', spin: counts.provisioning > 0 },
            { label: 'Awaiting Action', value: counts.pending, mod: 'yellow', icon: RiTimeLine, filter: 'requested' },
            { label: 'System Failures', value: counts.failed, mod: 'red', icon: RiErrorWarningFill, filter: 'failed', alert: counts.failed > 0 },
          ].map(s => (
            <div key={s.label} className={`${styles.statCard} ${styles[`stat_${s.mod}`]}`} onClick={() => router.push(`/platform/institutions?status=${s.filter}`)}>
              <div className={styles.statContent}>
                <span className={styles.statLabel}>{s.label}</span>
                <span className={styles.statValue}>{s.value}</span>
              </div>
              <div className={styles.statIconWrapper}>
                <s.icon size={24} className={s.spin ? styles.spin : ''} />
              </div>
              <RiArrowRightUpLine size={14} className={styles.statArrow} />
            </div>
          ))}
        </div>

        {/* ── Main Dashboard Split Area ── */}
        <div className={styles.dashboardSplit}>
          
          {/* Left Column: ACTIVE QUEUE & LATEST WORK */}
          <div className={styles.leftCol}>
            
            {/* Action Queue: Merged Attention & Pending Items */}
            {(attentionItems.length > 0 || pendingApproval.length > 0 || readyToProvision.length > 0) ? (
              <div className={styles.card}>
                <div className={styles.cardHeader}>
                  <div>
                    <h3 className={styles.cardTitle}>Action Queue</h3>
                    <p className={styles.cardSubtitle}>Tasks requiring immediate platform intervention</p>
                  </div>
                  <span className={styles.badgeCount}>
                    {attentionItems.length + pendingApproval.length + readyToProvision.length}
                  </span>
                </div>
                
                <div className={styles.queueList}>
                  {/* Attention Items (Stuck or Failed) */}
                  {attentionItems.map(t => (
                    <div key={t.id} className={`${styles.queueItem} ${styles.queueDanger}`}>
                      <div className={styles.queueIcon}><RiAlertFill size={18} /></div>
                      <div className={styles.queueDetails}>
                        <span className={styles.queueName}>{t.name}</span>
                        <span className={styles.queueMeta}>
                          {t.status === 'failed' ? (t.errorMessage || 'Failed') : `Stuck for ${provisioningMinutes(t.updatedAt)}m`}
                        </span>
                      </div>
                      <div className={styles.queueActions}>
                        {busy === t.id ? (
                          <RiLoaderLine size={16} className={styles.spin} />
                        ) : t.status === 'failed' ? (
                          <button onClick={() => handleAction('retry', t)} className={styles.retryBtn}>Retry</button>
                        ) : (
                          <Link href={`/platform/institutions/${t.id}`} className={styles.viewIconBtn}><RiEyeLine /></Link>
                        )}
                      </div>
                    </div>
                  ))}

                  {/* Pending Approval */}
                  {pendingApproval.map(t => (
                    <div key={t.id} className={`${styles.queueItem} ${styles.queueWarning}`}>
                      <div className={styles.queueIcon}><RiShieldCheckFill size={18} /></div>
                      <div className={styles.queueDetails}>
                        <span className={styles.queueName}>{t.name}</span>
                        <span className={styles.queueMeta}>Requested access · {fmt(t.createdAt)}</span>
                      </div>
                      <div className={styles.queueActions}>
                        {busy === t.id ? (
                          <RiLoaderLine size={16} className={styles.spin} />
                        ) : (
                          <button onClick={() => handleAction('approve', t)} className={styles.approveBtn}>Approve</button>
                        )}
                      </div>
                    </div>
                  ))}

                  {/* Ready to Provision */}
                  {readyToProvision.map(t => (
                    <div key={t.id} className={`${styles.queueItem} ${styles.queueInfo}`}>
                      <div className={styles.queueIcon}><RiPlayCircleLine size={18} /></div>
                      <div className={styles.queueDetails}>
                        <span className={styles.queueName}>{t.name}</span>
                        <span className={styles.queueMeta}>{t.plan} tier · Approved</span>
                      </div>
                      <div className={styles.queueActions}>
                        {busy === t.id ? (
                          <RiLoaderLine size={16} className={styles.spin} />
                        ) : (
                          <button onClick={() => handleAction('provision', t)} className={styles.provisionBtn}>Provision</button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className={styles.emptyQueueCard}>
                <RiCheckboxCircleFill size={32} className={styles.emptyIcon} />
                <h3>Queue is Empty</h3>
                <p>No tenants are currently waiting for approval or failing.</p>
              </div>
            )}

            {/* Latest Tenants Table */}
            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <div>
                  <h3 className={styles.cardTitle}>Recent Tenants</h3>
                  <p className={styles.cardSubtitle}>Latest network registrations</p>
                </div>
                <Link href="/platform/institutions" className={styles.headerLink}>
                  View All <RiArrowRightLine size={14} />
                </Link>
              </div>
              
              <div className={styles.tableWrapper}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Institution</th>
                      <th>Status</th>
                      <th>Tier</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentTenants.map(t => (
                      <tr key={t.id}>
                        <td>
                          <div className={styles.tableNameWrapper}>
                            <div className={styles.tenantAvatar}>{t.name.charAt(0)}</div>
                            <div>
                              <div className={styles.tableName}>{t.name}</div>
                              <div className={styles.tableMeta}>{t.domain ? `${t.domain}.advatech.ac.ke` : '—'}</div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className={`${styles.badge} ${styles[`badge_${INSTITUTION_STATUS[t.status]?.color || 'gray'}`]}`}>
                            <StatusDot status={t.status} />
                            {INSTITUTION_STATUS[t.status]?.label || t.status}
                          </span>
                        </td>
                        <td><span className={styles.tablePlan}>{t.plan}</span></td>
                        <td>
                          <Link href={`/platform/institutions/${t.id}`} className={styles.tableAction}>
                            <RiEyeLine size={15} />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Right Column: OVERVIEW & HEALTH */}
          <div className={styles.rightCol}>
            
            {/* Live Activity */}
            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <div>
                  <h3 className={styles.cardTitle}>Live Pulse</h3>
                  <p className={styles.cardSubtitle}>Real-time tenant activity</p>
                </div>
                <RiPulseLine size={16} className={styles.iconPulse} />
              </div>
              
              <div className={styles.activityList}>
                {sortedActivity.length === 0 ? (
                  <div className={styles.emptyState}>No recent events recorded.</div>
                ) : (
                  sortedActivity.map((ev, i) => (
                    <div key={i} className={styles.activityItem}>
                      <span className={`${styles.actDot} ${styles[`actDot_${ev.type}`]}`} />
                      <div className={styles.actContent}>
                        <span className={styles.actMsg}>{ev.msg}</span>
                        <span className={styles.actTs}>{fmt(ev.ts)}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Lifecycle Distribution */}
            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <div>
                  <h3 className={styles.cardTitle}>Lifecycle Status</h3>
                  <p className={styles.cardSubtitle}>Distribution of network accounts</p>
                </div>
                <RiRadarLine size={16} className={styles.iconRadar} />
              </div>
              
              <div className={styles.distList}>
                {Object.entries(INSTITUTION_STATUS).map(([key, cfg]) => {
                  const count = institutions.filter(i => i.status === key).length
                  const pct = institutions.length ? Math.round((count / institutions.length) * 100) : 0
                  return (
                    <div key={key} className={styles.distRow}>
                      <div className={styles.distLabelWrapper}>
                        <StatusDot status={key} />
                        <span className={styles.distLabel}>{cfg.label}</span>
                      </div>
                      <div className={styles.distBarWrapper}>
                        <div className={styles.distBarBg}>
                          <div className={`${styles.distFill} ${styles[`distFill_${key}`]}`} style={{ width: `${pct}%` }} />
                        </div>
                        <span className={styles.distCount}>{count}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Quick Links */}
            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <div>
                  <h3 className={styles.cardTitle}>Platform Resources</h3>
                </div>
              </div>
              <div className={styles.resourceGrid}>
                <Link href="/platform/institutions" className={styles.resourceItem}>
                  <RiBuildingLine size={18} />
                  <span>Manage All Tenants</span>
                </Link>
                <a href="#" className={styles.resourceItem}>
                  <RiSettings4Line size={18} />
                  <span>Platform Settings</span>
                </a>
                <a href="#" className={styles.resourceItem}>
                  <RiExternalLinkLine size={18} />
                  <span>Logs & Telemetry</span>
                </a>
              </div>
            </div>
            
          </div>
        </div>

      </div>
    </DashboardShell>
  )
}
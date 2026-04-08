// src/app/platform/institutions/page.js
// Platform Admin — Tenant Control Panel
// This is a state-driven system interface, not a CRUD dashboard.
'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import {
  RiBuildingLine, RiAddLine, RiRefreshLine,
  RiSearchLine, RiFilterLine,
  RiCheckboxCircleLine, RiErrorWarningLine,
  RiLoaderLine, RiTimeLine, RiGlobalLine,
  RiDeleteBinLine, RiSettings3Line, RiPlayCircleLine,
  RiShieldCheckLine, RiRestartLine, RiEyeLine,
  RiAlertLine, RiCloseLine,
} from 'react-icons/ri'
import DashboardShell from '@/components/layout/DashboardShell'
import {
  getInstitutions, createInstitution, approveTenant,
  provisionTenant, retryProvision, deleteTenant,
  INSTITUTION_STATUS, IN_PROGRESS_STATES,
} from '@/lib/api/institutions'
import styles from './institutions.module.css'

// ─── Status badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const cfg = INSTITUTION_STATUS[status] || { label: status, color: 'gray' }
  return (
    <span className={`${styles.badge} ${styles[`badge_${cfg.color}`]}`}>
      <span className={styles.badgeDot} />
      {cfg.label}
    </span>
  )
}

// ─── State-aware action buttons ───────────────────────────────────────────────
function TenantActions({ tenant, onAction, busy }) {
  const id = tenant.id
  const isBusy = busy === id

  if (isBusy) {
    return (
      <div className={styles.actionsBusy}>
        <RiLoaderLine size={14} className={styles.spinIcon} />
        <span>Processing…</span>
      </div>
    )
  }

  switch (tenant.status) {
    case 'requested':
      return (
        <button
          className={`${styles.actionBtn} ${styles.actionApprove}`}
          onClick={() => onAction('approve', tenant)}
        >
          <RiShieldCheckLine size={13} /> Approve
        </button>
      )

    case 'verified':
      return (
        <button
          className={`${styles.actionBtn} ${styles.actionProvision}`}
          onClick={() => onAction('provision', tenant)}
        >
          <RiPlayCircleLine size={13} /> Provision
        </button>
      )

    case 'provisioning':
    case 'dns_pending':
      return (
        <div className={styles.actionsInProgress}>
          <RiLoaderLine size={13} className={styles.spinIcon} />
          <span>{tenant.status === 'dns_pending' ? 'DNS Propagating…' : 'Provisioning…'}</span>
        </div>
      )

    case 'running':
      return (
        <div className={styles.actionsGroup}>
          <Link href={`/platform/institutions/${id}`} className={`${styles.actionBtn} ${styles.actionView}`}>
            <RiEyeLine size={13} /> View
          </Link>
          <button
            className={`${styles.actionBtn} ${styles.actionDelete}`}
            onClick={() => onAction('delete', tenant)}
          >
            <RiDeleteBinLine size={13} />
          </button>
        </div>
      )

    case 'failed':
      return (
        <div className={styles.actionsGroup}>
          <button
            className={`${styles.actionBtn} ${styles.actionRetry}`}
            onClick={() => onAction('retry', tenant)}
          >
            <RiRestartLine size={13} /> Retry
          </button>
          <Link href={`/platform/institutions/${id}`} className={`${styles.actionBtn} ${styles.actionView}`}>
            <RiEyeLine size={13} />
          </Link>
          <button
            className={`${styles.actionBtn} ${styles.actionDelete}`}
            onClick={() => onAction('delete', tenant)}
          >
            <RiDeleteBinLine size={13} />
          </button>
        </div>
      )

    default:
      return (
        <Link href={`/platform/institutions/${id}`} className={`${styles.actionBtn} ${styles.actionView}`}>
          <RiEyeLine size={13} /> View
        </Link>
      )
  }
}

// ─── Confirm dialog ───────────────────────────────────────────────────────────
function ConfirmDialog({ action, tenant, onConfirm, onCancel }) {
  if (!action || !tenant) return null
  const isDelete = action === 'delete'
  return (
    <div className={styles.overlay}>
      <div className={styles.confirmDialog}>
        <div className={styles.confirmIcon}>
          {isDelete ? <RiDeleteBinLine size={22} /> : <RiRestartLine size={22} />}
        </div>
        <div className={styles.confirmTitle}>
          {isDelete ? 'Delete tenant?' : 'Retry provisioning?'}
        </div>
        <div className={styles.confirmBody}>
          {isDelete
            ? <>This will permanently destroy <strong>{tenant.name}</strong>'s namespace, database, and all data. This cannot be undone.</>
            : <>Re-trigger the provisioning job for <strong>{tenant.name}</strong>. Previous failed steps will be retried from the last checkpoint.</>
          }
        </div>
        <div className={styles.confirmActions}>
          <button className={styles.confirmCancel} onClick={onCancel}>Cancel</button>
          <button
            className={isDelete ? styles.confirmDestructive : styles.confirmPrimary}
            onClick={onConfirm}
          >
            {isDelete ? 'Yes, delete' : 'Yes, retry'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Create modal ─────────────────────────────────────────────────────────────
function CreateModal({ onClose, onCreate }) {
  const [form, setForm] = useState({ name: '', domain: '', adminEmail: '', adminName: '', plan: 'Standard' })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  async function submit() {
    if (!form.name.trim()) { setErr('Institution name is required.'); return }
    if (!form.domain.trim()) { setErr('Domain is required.'); return }
    setSaving(true); setErr('')
    try {
      const created = await createInstitution(form)
      onCreate(created)
      onClose()
    } catch (e) {
      setErr(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <div className={styles.modalTitle}>Register Institution</div>
          <button className={styles.modalClose} onClick={onClose}><RiCloseLine size={18} /></button>
        </div>
        <div className={styles.modalBody}>
          {err && <div className={styles.formError}><RiAlertLine size={14} />{err}</div>}
          {[
            { key: 'name', label: 'Institution Name', placeholder: 'e.g. Technical University of Kenya', required: true },
            { key: 'domain', label: 'Subdomain', placeholder: 'e.g. tuk (becomes tuk.advatech.ac.ke)', required: true },
            { key: 'adminEmail', label: 'Admin Email', placeholder: 'admin@institution.ac.ke' },
            { key: 'adminName', label: 'Admin Contact Name', placeholder: 'Dr. Jane Doe' },
          ].map(f => (
            <div key={f.key} className={styles.field}>
              <label className={styles.label}>
                {f.label}{f.required && <span className={styles.req}>*</span>}
              </label>
              <input
                className={styles.input}
                value={form[f.key]}
                onChange={e => set(f.key, e.target.value)}
                placeholder={f.placeholder}
              />
            </div>
          ))}
          <div className={styles.field}>
            <label className={styles.label}>Plan</label>
            <select className={styles.input} value={form.plan} onChange={e => set('plan', e.target.value)}>
              <option>Standard</option>
              <option>Enterprise</option>
            </select>
          </div>
        </div>
        <div className={styles.modalFooter}>
          <button className={styles.btnSecondary} onClick={onClose} disabled={saving}>Cancel</button>
          <button className={styles.btnPrimary} onClick={submit} disabled={saving}>
            {saving ? <><RiLoaderLine size={14} className={styles.spinIcon} /> Registering…</> : 'Register Institution'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
const STATUS_FILTERS = ['all', 'requested', 'verified', 'provisioning', 'dns_pending', 'running', 'failed']

export default function InstitutionsPage() {
  const [institutions, setInstitutions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [showCreate, setShowCreate] = useState(false)
  const [confirm, setConfirm] = useState({ action: null, tenant: null })
  const [busy, setBusy] = useState(null) // tenant id currently being actioned
  const [toast, setToast] = useState(null)
  const pollRef = useRef(null)

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    setError(null)
    try {
      const data = await getInstitutions()
      setInstitutions(data)
    } catch (e) {
      setError(e.message)
    } finally {
      if (!silent) setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // Polling: if any tenant is in-progress, poll every 5s
  useEffect(() => {
    const hasInProgress = institutions.some(i => IN_PROGRESS_STATES.includes(i.status))
    if (hasInProgress) {
      pollRef.current = setInterval(() => load(true), 5000)
    } else {
      clearInterval(pollRef.current)
    }
    return () => clearInterval(pollRef.current)
  }, [institutions, load])

  function showToast(msg, type = 'success') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  async function handleAction(action, tenant) {
    if (action === 'delete' || action === 'retry') {
      setConfirm({ action, tenant })
      return
    }
    await executeAction(action, tenant)
  }

  async function executeAction(action, tenant) {
    setBusy(tenant.id)
    setConfirm({ action: null, tenant: null })
    try {
      let updated
      if (action === 'approve')    updated = await approveTenant(tenant.id)
      if (action === 'provision')  updated = await provisionTenant(tenant.id)
      if (action === 'retry')      updated = await retryProvision(tenant.id)
      if (action === 'delete') {
        await deleteTenant(tenant.id)
        setInstitutions(prev => prev.filter(i => i.id !== tenant.id))
        showToast(`${tenant.name} deleted.`, 'danger')
        return
      }
      if (updated) {
        setInstitutions(prev => prev.map(i => i.id === updated.id ? updated : i))
      }
      const msgs = {
        approve: `${tenant.name} approved — ready to provision.`,
        provision: `Provisioning started for ${tenant.name}.`,
        retry: `Retry triggered for ${tenant.name}.`,
      }
      showToast(msgs[action] || 'Done.')
    } catch (e) {
      showToast(e.message, 'danger')
    } finally {
      setBusy(null)
    }
  }

  // Filtering
  const filtered = institutions.filter(i => {
    const matchSearch = !search || i.name.toLowerCase().includes(search.toLowerCase()) || (i.domain || '').includes(search.toLowerCase())
    const matchStatus = statusFilter === 'all' || i.status === statusFilter
    return matchSearch && matchStatus
  })

  const counts = {
    total:        institutions.length,
    running:      institutions.filter(i => i.status === 'running').length,
    provisioning: institutions.filter(i => ['provisioning', 'dns_pending', 'verified'].includes(i.status)).length,
    failed:       institutions.filter(i => i.status === 'failed').length,
    requested:    institutions.filter(i => i.status === 'requested').length,
  }

  return (
    <DashboardShell title="Institutions" subtitle="Tenant control plane">

      {/* Toast */}
      {toast && (
        <div className={`${styles.toast} ${styles[`toast_${toast.type}`]}`}>
          {toast.type === 'danger' ? <RiErrorWarningLine size={15} /> : <RiCheckboxCircleLine size={15} />}
          {toast.msg}
        </div>
      )}

      {/* Confirm dialog */}
      <ConfirmDialog
        action={confirm.action}
        tenant={confirm.tenant}
        onConfirm={() => executeAction(confirm.action, confirm.tenant)}
        onCancel={() => setConfirm({ action: null, tenant: null })}
      />

      {/* Create modal */}
      {showCreate && (
        <CreateModal
          onClose={() => setShowCreate(false)}
          onCreate={t => setInstitutions(prev => [t, ...prev])}
        />
      )}

      <div className={styles.page}>

        {/* Stats row */}
        <div className={styles.statsRow}>
          {[
            { label: 'Total Tenants',  value: counts.total,        mod: 'teal' },
            { label: 'Live',           value: counts.running,      mod: 'success' },
            { label: 'In Progress',    value: counts.provisioning, mod: 'warning', pulse: counts.provisioning > 0 },
            { label: 'Failed',         value: counts.failed,       mod: 'danger',  alert: counts.failed > 0 },
            { label: 'Awaiting Review',value: counts.requested,    mod: 'gray' },
          ].map(s => (
            <div key={s.label} className={`${styles.statCard} ${s.alert ? styles.statAlert : ''}`}>
              {s.pulse && <span className={styles.pulseDot} />}
              <div className={`${styles.statValue} ${styles[s.mod]}`}>{s.value}</div>
              <div className={styles.statLabel}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Failed alert banner */}
        {counts.failed > 0 && (
          <div className={styles.alertBanner}>
            <RiAlertLine size={16} />
            <strong>{counts.failed} tenant{counts.failed > 1 ? 's' : ''} failed provisioning.</strong>
            {' '}Review the failed entries below and retry or delete.
          </div>
        )}

        {/* Toolbar */}
        <div className={styles.toolbar}>
          <div className={styles.searchWrap}>
            <RiSearchLine size={14} className={styles.searchIcon} />
            <input
              className={styles.searchInput}
              placeholder="Search by name or domain…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className={styles.filterTabs}>
            {STATUS_FILTERS.map(f => (
              <button
                key={f}
                className={`${styles.filterTab} ${statusFilter === f ? styles.filterActive : ''}`}
                onClick={() => setStatusFilter(f)}
              >
                {f === 'all' ? 'All' : (INSTITUTION_STATUS[f]?.label || f)}
                {f !== 'all' && (
                  <span className={styles.filterCount}>
                    {institutions.filter(i => i.status === f).length}
                  </span>
                )}
              </button>
            ))}
          </div>
          <div className={styles.toolbarRight}>
            <button className={styles.refreshBtn} onClick={() => load()} disabled={loading}>
              <RiRefreshLine size={14} className={loading ? styles.spinIcon : ''} />
            </button>
            <button className={styles.addBtn} onClick={() => setShowCreate(true)}>
              <RiAddLine size={15} /> Register Institution
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className={styles.errorBanner}>
            <RiErrorWarningLine size={15} /> {error}
          </div>
        )}

        {/* Table */}
        {loading ? (
          <div className={styles.loadingState}>
            <RiLoaderLine size={22} className={styles.spinIcon} />
            Loading tenants…
          </div>
        ) : filtered.length === 0 ? (
          <div className={styles.emptyState}>
            <RiBuildingLine size={32} />
            <div>{search || statusFilter !== 'all' ? 'No tenants match your filter.' : 'No institutions registered yet.'}</div>
          </div>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Institution</th>
                  <th>Domain</th>
                  <th>Status</th>
                  <th>Plan</th>
                  <th>Registered</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(t => (
                  <tr key={t.id} className={`${styles.row} ${t.status === 'failed' ? styles.rowFailed : ''}`}>
                    <td>
                      <div className={styles.tenantName}>{t.name}</div>
                      {t.adminEmail && (
                        <div className={styles.tenantMeta}>{t.adminEmail}</div>
                      )}
                    </td>
                    <td>
                      <span className={styles.domain}>
                        {t.domain ? `${t.domain}.advatech.ac.ke` : <span className={styles.na}>—</span>}
                      </span>
                    </td>
                    <td>
                      <StatusBadge status={t.status} />
                      {t.status === 'failed' && t.failedStep && (
                        <div className={styles.failedStep}>↳ failed at: {t.failedStep}</div>
                      )}
                    </td>
                    <td><span className={styles.plan}>{t.plan || 'Standard'}</span></td>
                    <td>
                      <span className={styles.date}>
                        {t.createdAt ? new Date(t.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                      </span>
                    </td>
                    <td>
                      <TenantActions tenant={t} onAction={handleAction} busy={busy} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className={styles.footer}>
          {filtered.length} of {institutions.length} tenant{institutions.length !== 1 ? 's' : ''}
          {IN_PROGRESS_STATES.some(s => institutions.some(i => i.status === s)) && (
            <span className={styles.pollNote}>
              <span className={styles.pulseDotSmall} /> Auto-refreshing every 5s
            </span>
          )}
        </div>

      </div>
    </DashboardShell>
  )
}
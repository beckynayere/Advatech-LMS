// src/app/platform/institutions/[id]/page.js
// Tenant Detail — deep view: infra metadata + provisioning logs + state actions
'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  RiArrowLeftLine, RiBuildingLine, RiServerLine,
  RiDatabaseLine, RiHardDriveLine, RiGlobalLine,
  RiCheckboxCircleLine, RiErrorWarningLine, RiLoaderLine,
  RiTimeLine, RiDeleteBinLine, RiRestartLine, RiPlayCircleLine,
  RiShieldCheckLine, RiCalendarLine, RiAlertLine, RiRefreshLine,
  RiSettings3Line,
} from 'react-icons/ri'
import DashboardShell from '@/components/layout/DashboardShell'
import {
  getInstitution, approveTenant, provisionTenant,
  retryProvision, deleteTenant,
  INSTITUTION_STATUS, IN_PROGRESS_STATES,
} from '@/lib/api/institutions'
import styles from './detail.module.css'

// ─── Log step icon ─────────────────────────────────────────────────────────────
function LogStepIcon({ status }) {
  if (status === 'success')     return <RiCheckboxCircleLine size={16} className={styles.logSuccess} />
  if (status === 'failed')      return <RiErrorWarningLine   size={16} className={styles.logFailed} />
  if (status === 'in_progress') return <RiLoaderLine         size={16} className={`${styles.logProgress} ${styles.spinIcon}`} />
  return <RiTimeLine size={16} className={styles.logPending} />
}

// ─── Provisioning log viewer ──────────────────────────────────────────────────
function LogsViewer({ logs, status }) {
  const bottomRef = useRef(null)
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  if (!logs || logs.length === 0) {
    return (
      <div className={styles.logsEmpty}>
        {['requested', 'verified'].includes(status)
          ? 'Provisioning has not started yet.'
          : 'No log entries available.'}
      </div>
    )
  }

  return (
    <div className={styles.logsViewer}>
      {logs.map((log, i) => (
        <div key={i} className={`${styles.logEntry} ${styles[`logEntry_${log.status}`]}`}>
          <div className={styles.logStep}>
            <LogStepIcon status={log.status} />
            <span className={styles.logStepName}>{log.step}</span>
            {log.ts && (
              <span className={styles.logTs}>
                {new Date(log.ts).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            )}
          </div>
          {log.msg && (
            <div className={`${styles.logMsg} ${log.status === 'failed' ? styles.logMsgFailed : ''}`}>
              {log.msg}
            </div>
          )}
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  )
}

// ─── Infra metadata row ───────────────────────────────────────────────────────
function InfraRow({ icon: Icon, label, value, mono }) {
  return (
    <div className={styles.infraRow}>
      <span className={styles.infraIcon}><Icon size={14} /></span>
      <span className={styles.infraLabel}>{label}</span>
      <span className={`${styles.infraValue} ${mono ? styles.mono : ''}`}>
        {value || <span className={styles.na}>not assigned</span>}
      </span>
    </div>
  )
}

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

// ─── Main page ────────────────────────────────────────────────────────────────
export default function TenantDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const [tenant, setTenant] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [actionBusy, setActionBusy] = useState(false)
  const [actionError, setActionError] = useState(null)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const pollRef = useRef(null)

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const data = await getInstitution(id)
      setTenant(data)
      setError(null)
    } catch (e) {
      setError(e.message)
    } finally {
      if (!silent) setLoading(false)
    }
  }, [id])

  useEffect(() => { load() }, [load])

  // Poll if in-progress
  useEffect(() => {
    if (!tenant) return
    if (IN_PROGRESS_STATES.includes(tenant.status)) {
      pollRef.current = setInterval(() => load(true), 5000)
    } else {
      clearInterval(pollRef.current)
    }
    return () => clearInterval(pollRef.current)
  }, [tenant, load])

  async function doAction(action) {
    setActionBusy(true)
    setActionError(null)
    setDeleteConfirm(false)
    try {
      let updated
      if (action === 'approve')   updated = await approveTenant(id)
      if (action === 'provision') updated = await provisionTenant(id)
      if (action === 'retry')     updated = await retryProvision(id)
      if (action === 'delete') {
        await deleteTenant(id)
        router.push('/platform/institutions')
        return
      }
      if (updated) setTenant(updated)
    } catch (e) {
      setActionError(e.message)
    } finally {
      setActionBusy(false)
    }
  }

  if (loading) {
    return (
      <DashboardShell title="Tenant Detail" subtitle="Loading…">
        <div className={styles.fullLoading}>
          <RiLoaderLine size={28} className={styles.spinIcon} />
          <span>Loading tenant…</span>
        </div>
      </DashboardShell>
    )
  }

  if (error || !tenant) {
    return (
      <DashboardShell title="Tenant Detail" subtitle="Error">
        <div className={styles.fullError}>
          <RiErrorWarningLine size={28} />
          <div>{error || 'Tenant not found.'}</div>
          <Link href="/platform/institutions" className={styles.backLink}>
            ← Back to Institutions
          </Link>
        </div>
      </DashboardShell>
    )
  }

  const isInProgress = IN_PROGRESS_STATES.includes(tenant.status)
  const fmt = (dt) => dt
    ? new Date(dt).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '—'

  return (
    <DashboardShell
      title={tenant.name}
      subtitle={`Tenant ID: ${tenant.id} · ${tenant.domain ? tenant.domain + '.advatech.ac.ke' : 'No domain'}`}
    >
      <div className={styles.page}>

        {/* Back + refresh */}
        <div className={styles.topBar}>
          <Link href="/platform/institutions" className={styles.backLink}>
            <RiArrowLeftLine size={14} /> Institutions
          </Link>
          <button className={styles.refreshBtn} onClick={() => load()} disabled={loading}>
            <RiRefreshLine size={14} className={loading ? styles.spinIcon : ''} />
            Refresh
          </button>
        </div>

        {/* Action error */}
        {actionError && (
          <div className={styles.errorBanner}>
            <RiErrorWarningLine size={15} /> {actionError}
          </div>
        )}

        {/* Delete confirm */}
        {deleteConfirm && (
          <div className={styles.inlineConfirm}>
            <RiAlertLine size={16} />
            <span>Permanently destroy <strong>{tenant.name}</strong> and all its data?</span>
            <button className={styles.btnDanger} onClick={() => doAction('delete')} disabled={actionBusy}>
              Yes, delete
            </button>
            <button className={styles.btnGhost} onClick={() => setDeleteConfirm(false)}>Cancel</button>
          </div>
        )}

        <div className={styles.grid}>

          {/* ── Left column ────────────────────────────────────── */}
          <div className={styles.leftCol}>

            {/* Status card */}
            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <RiBuildingLine size={16} />
                <span>Status</span>
              </div>
              <div className={styles.statusBlock}>
                <StatusBadge status={tenant.status} />
                {isInProgress && (
                  <div className={styles.pollNote}>
                    <span className={styles.pulseDot} /> Auto-refreshing…
                  </div>
                )}
              </div>
              {tenant.status === 'failed' && tenant.errorMessage && (
                <div className={styles.failureBox}>
                  <div className={styles.failureTitle}>
                    <RiErrorWarningLine size={14} /> Failure details
                  </div>
                  {tenant.failedStep && (
                    <div className={styles.failureStep}>Failed at: <strong>{tenant.failedStep}</strong></div>
                  )}
                  <div className={styles.failureMsg}>{tenant.errorMessage}</div>
                </div>
              )}

              {/* State-aware actions */}
              <div className={styles.actionsBlock}>
                {actionBusy ? (
                  <div className={styles.actionsBusy}>
                    <RiLoaderLine size={15} className={styles.spinIcon} /> Processing…
                  </div>
                ) : (
                  <>
                    {tenant.status === 'requested' && (
                      <button className={`${styles.btn} ${styles.btnApprove}`} onClick={() => doAction('approve')}>
                        <RiShieldCheckLine size={15} /> Approve Tenant
                      </button>
                    )}
                    {tenant.status === 'verified' && (
                      <button className={`${styles.btn} ${styles.btnProvision}`} onClick={() => doAction('provision')}>
                        <RiPlayCircleLine size={15} /> Start Provisioning
                      </button>
                    )}
                    {tenant.status === 'failed' && (
                      <button className={`${styles.btn} ${styles.btnRetry}`} onClick={() => doAction('retry')}>
                        <RiRestartLine size={15} /> Retry Provisioning
                      </button>
                    )}
                    {tenant.status === 'running' && (
                      <Link href={`/platform/institutions/${tenant.id}/moodle-setup`} className={`${styles.btn} ${styles.btnSettings}`}>
                        <RiSettings3Line size={15} /> Moodle Setup
                      </Link>
                    )}
                    {(tenant.status === 'failed' || tenant.status === 'running') && (
                      <button className={`${styles.btn} ${styles.btnDelete}`} onClick={() => setDeleteConfirm(true)}>
                        <RiDeleteBinLine size={15} /> Delete Tenant
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Basic info */}
            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <RiBuildingLine size={16} />
                <span>Basic Info</span>
              </div>
              <div className={styles.infoGrid}>
                {[
                  { label: 'Name',          value: tenant.name },
                  { label: 'Domain',        value: tenant.domain ? `${tenant.domain}.advatech.ac.ke` : null },
                  { label: 'Plan',          value: tenant.plan },
                  { label: 'Admin Contact', value: tenant.adminName },
                  { label: 'Admin Email',   value: tenant.adminEmail },
                ].map(r => (
                  <div key={r.label} className={styles.infoRow}>
                    <span className={styles.infoLabel}>{r.label}</span>
                    <span className={styles.infoValue}>{r.value || <span className={styles.na}>—</span>}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Timestamps */}
            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <RiCalendarLine size={16} />
                <span>Timeline</span>
              </div>
              <div className={styles.infoGrid}>
                {[
                  { label: 'Registered',   value: fmt(tenant.createdAt) },
                  { label: 'Last Updated', value: fmt(tenant.updatedAt) },
                  { label: 'Provisioned',  value: fmt(tenant.provisionedAt) },
                ].map(r => (
                  <div key={r.label} className={styles.infoRow}>
                    <span className={styles.infoLabel}>{r.label}</span>
                    <span className={styles.infoValue}>{r.value}</span>
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* ── Right column ───────────────────────────────────── */}
          <div className={styles.rightCol}>

            {/* Infra metadata */}
            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <RiServerLine size={16} />
                <span>Infrastructure Metadata</span>
                <span className={styles.cardNote}>read-only</span>
              </div>
              <div className={styles.infraGrid}>
                <InfraRow icon={RiServerLine}    label="Namespace"      value={tenant.namespace}     mono />
                <InfraRow icon={RiDatabaseLine}  label="Database"       value={tenant.database}      mono />
                <InfraRow icon={RiHardDriveLine} label="Storage Prefix" value={tenant.storagePrefix} mono />
                <InfraRow icon={RiGlobalLine}    label="Moodle URL"     value={tenant.moodleUrl}     mono />
              </div>
            </div>

            {/* Provisioning logs */}
            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <RiTimeLine size={16} />
                <span>Provisioning Logs</span>
                {isInProgress && <span className={styles.liveBadge}>LIVE</span>}
              </div>
              <LogsViewer logs={tenant.logs} status={tenant.status} />
            </div>

          </div>
        </div>
      </div>
    </DashboardShell>
  )
}
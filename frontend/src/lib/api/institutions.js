// src/lib/api/institutions.js
// Platform admin control plane — tenant lifecycle management
// This is a STATE MACHINE, not a CRUD service.
// States: requested → verified → provisioning → dns_pending → running ↘ failed

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:12345'

function getToken() {
  return typeof window !== 'undefined' ? sessionStorage.getItem('lms_token') : null
}

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${getToken()}`,
  }
}

// ─── Status config (color + label for every state) ────────────────────────────
export const INSTITUTION_STATUS = {
  requested:    { label: 'Requested',    color: 'gray',    hex: '#64748b' },
  verified:     { label: 'Verified',     color: 'blue',    hex: '#2563eb' },
  provisioning: { label: 'Provisioning', color: 'warning', hex: '#d97706' },
  dns_pending:  { label: 'DNS Pending',  color: 'warning', hex: '#d97706' },
  running:      { label: 'Live',         color: 'success', hex: '#059669' },
  failed:       { label: 'Failed',       color: 'danger',  hex: '#dc2626' },
}

// States that are "in progress" — should poll for updates
export const IN_PROGRESS_STATES = ['provisioning', 'dns_pending', 'verified']

// ─── Rich mock data covering all 6 states ─────────────────────────────────────
const mockInstitutions = [
  {
    id: 1,
    name: 'Technical University of Kenya',
    domain: 'tuk',
    adminEmail: 'admin@tuk.ac.ke',
    adminName: 'Dr. James Mwangi',
    status: 'running',
    namespace: 'ns-tuk',
    database: 'db_tuk',
    storagePrefix: 'tuk/',
    moodleUrl: 'http://157.173.101.105',
    moodleConfigured: true,
    plan: 'Enterprise',
    createdAt: '2024-01-15T09:00:00Z',
    updatedAt: '2024-03-01T12:00:00Z',
    provisionedAt: '2024-01-16T14:30:00Z',
    errorMessage: null,
    failedStep: null,
    logs: [
      { step: 'Namespace created',    status: 'success', ts: '2024-01-16T14:00:00Z', msg: 'ns-tuk created successfully' },
      { step: 'Database provisioned', status: 'success', ts: '2024-01-16T14:05:00Z', msg: 'db_tuk created, migrations applied' },
      { step: 'Moodle deployed',      status: 'success', ts: '2024-01-16T14:15:00Z', msg: 'Moodle 4.3 deployed, plugins configured' },
      { step: 'Branding applied',     status: 'success', ts: '2024-01-16T14:20:00Z', msg: 'Logo and theme uploaded from S3' },
      { step: 'Domain configured',    status: 'success', ts: '2024-01-16T14:25:00Z', msg: 'Ingress route active: tuk.advatech.ac.ke' },
      { step: 'SSL issued',           status: 'success', ts: '2024-01-16T14:30:00Z', msg: "Let's Encrypt cert issued, auto-renewal enabled" },
    ],
  },
  {
    id: 2,
    name: 'Braeburn College',
    domain: 'braeburn',
    adminEmail: 'admin@braeburn.ac.ke',
    adminName: 'Sarah Kimani',
    status: 'provisioning',
    namespace: 'ns-braeburn',
    database: 'db_braeburn',
    storagePrefix: 'braeburn/',
    moodleUrl: null,
    moodleConfigured: false,
    plan: 'Standard',
    createdAt: '2024-03-10T10:30:00Z',
    updatedAt: '2024-03-10T11:45:00Z',
    provisionedAt: null,
    errorMessage: null,
    failedStep: null,
    logs: [
      { step: 'Namespace created',    status: 'success',     ts: '2024-03-10T11:30:00Z', msg: 'ns-braeburn created' },
      { step: 'Database provisioned', status: 'success',     ts: '2024-03-10T11:35:00Z', msg: 'db_braeburn ready' },
      { step: 'Moodle deployed',      status: 'in_progress', ts: '2024-03-10T11:45:00Z', msg: 'Pulling image moodle:4.3, ETA ~3 min...' },
      { step: 'Branding applied',     status: 'pending',     ts: null,                   msg: null },
      { step: 'Domain configured',    status: 'pending',     ts: null,                   msg: null },
      { step: 'SSL issued',           status: 'pending',     ts: null,                   msg: null },
    ],
  },
  {
    id: 3,
    name: 'Kabarak University',
    domain: 'kabarak',
    adminEmail: 'registrar@kabarak.ac.ke',
    adminName: 'Prof. David Rotich',
    status: 'failed',
    namespace: 'ns-kabarak',
    database: 'db_kabarak',
    storagePrefix: 'kabarak/',
    moodleUrl: null,
    moodleConfigured: false,
    plan: 'Standard',
    createdAt: '2024-03-15T08:00:00Z',
    updatedAt: '2024-03-15T08:42:00Z',
    provisionedAt: null,
    errorMessage: 'Container startup timeout after 300s. Pod stuck in CrashLoopBackOff.',
    failedStep: 'Moodle deployed',
    logs: [
      { step: 'Namespace created',    status: 'success', ts: '2024-03-15T08:10:00Z', msg: 'ns-kabarak created' },
      { step: 'Database provisioned', status: 'success', ts: '2024-03-15T08:15:00Z', msg: 'db_kabarak ready' },
      { step: 'Moodle deployed',      status: 'failed',  ts: '2024-03-15T08:42:00Z', msg: 'Error: container timeout after 300s. Pod in CrashLoopBackOff. Check resource quotas.' },
      { step: 'Branding applied',     status: 'pending', ts: null,                   msg: null },
      { step: 'Domain configured',    status: 'pending', ts: null,                   msg: null },
      { step: 'SSL issued',           status: 'pending', ts: null,                   msg: null },
    ],
  },
  {
    id: 4,
    name: 'Strathmore University',
    domain: 'strathmore',
    adminEmail: 'ict@strathmore.edu',
    adminName: 'Michael Odhiambo',
    status: 'verified',
    namespace: null,
    database: null,
    storagePrefix: null,
    moodleUrl: null,
    moodleConfigured: false,
    plan: 'Enterprise',
    createdAt: '2024-03-17T14:00:00Z',
    updatedAt: '2024-03-17T16:30:00Z',
    provisionedAt: null,
    errorMessage: null,
    failedStep: null,
    logs: [],
  },
  {
    id: 5,
    name: 'Daystar University',
    domain: 'daystar',
    adminEmail: 'admin@daystar.ac.ke',
    adminName: 'Grace Wanjiku',
    status: 'requested',
    namespace: null,
    database: null,
    storagePrefix: null,
    moodleUrl: null,
    moodleConfigured: false,
    plan: 'Standard',
    createdAt: '2024-03-18T07:00:00Z',
    updatedAt: '2024-03-18T07:00:00Z',
    provisionedAt: null,
    errorMessage: null,
    failedStep: null,
    logs: [],
  },
  {
    id: 6,
    name: 'Kenya Medical Training College',
    domain: 'kmtc',
    adminEmail: 'director@kmtc.ac.ke',
    adminName: 'Dr. Amina Hassan',
    status: 'dns_pending',
    namespace: 'ns-kmtc',
    database: 'db_kmtc',
    storagePrefix: 'kmtc/',
    moodleUrl: null,
    moodleConfigured: false,
    plan: 'Standard',
    createdAt: '2024-03-16T09:00:00Z',
    updatedAt: '2024-03-17T10:00:00Z',
    provisionedAt: null,
    errorMessage: null,
    failedStep: null,
    logs: [
      { step: 'Namespace created',    status: 'success',     ts: '2024-03-17T09:00:00Z', msg: 'ns-kmtc created' },
      { step: 'Database provisioned', status: 'success',     ts: '2024-03-17T09:05:00Z', msg: 'db_kmtc ready' },
      { step: 'Moodle deployed',      status: 'success',     ts: '2024-03-17T09:20:00Z', msg: 'Moodle 4.3 running' },
      { step: 'Branding applied',     status: 'success',     ts: '2024-03-17T09:25:00Z', msg: 'Assets uploaded' },
      { step: 'Domain configured',    status: 'in_progress', ts: '2024-03-17T10:00:00Z', msg: 'Waiting for DNS propagation (TTL 300s)...' },
      { step: 'SSL issued',           status: 'pending',     ts: null,                   msg: null },
    ],
  },
]

// ─── Normalizer ───────────────────────────────────────────────────────────────
function normalize(i) {
  return {
    id: i.id,
    name: i.name || '',
    domain: i.domain || i.subdomain || null,
    adminEmail: i.adminEmail || i.admin_email || null,
    adminName: i.adminName || i.admin_name || null,
    status: i.status || 'requested',
    namespace: i.namespace || null,
    database: i.database || i.db_name || null,
    storagePrefix: i.storagePrefix || i.storage_prefix || null,
    moodleUrl: i.moodleUrl || i.moodle_url || null,
    moodleConfigured: !!(i.moodleUrl || i.moodle_url),
    plan: i.plan || 'Standard',
    createdAt: i.createdAt || i.created_at || null,
    updatedAt: i.updatedAt || i.updated_at || null,
    provisionedAt: i.provisionedAt || i.provisioned_at || null,
    errorMessage: i.errorMessage || i.error_message || null,
    failedStep: i.failedStep || i.failed_step || null,
    logs: i.logs || [],
  }
}

// ─── API helpers ──────────────────────────────────────────────────────────────
async function apiCall(path, options = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: { ...authHeaders(), ...(options.headers || {}) },
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data?.error?.message || data?.message || `Request failed (${res.status})`)
  return data
}

function withMockFallback(mockFn) {
  return async function(...args) {
    try {
      return await mockFn(...args)
    } catch (err) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('[institutions] Backend unreachable, using mock:', err.message)
        return null // signal to caller to use mock
      }
      throw err
    }
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function getInstitutions() {
  try {
    const data = await apiCall('/api/v1/institutions')
    return (data.data || data || []).map(normalize)
  } catch (err) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[institutions] Using mock list:', err.message)
      return mockInstitutions.map(normalize)
    }
    throw err
  }
}

export async function getInstitution(id) {
  try {
    const data = await apiCall(`/api/v1/institutions/${id}`)
    return normalize(data.data || data)
  } catch (err) {
    if (process.env.NODE_ENV === 'development') {
      const found = mockInstitutions.find(i => i.id === Number(id))
      if (found) return normalize(found)
    }
    throw err
  }
}

export async function createInstitution(payload) {
  try {
    const data = await apiCall('/api/v1/institutions', {
      method: 'POST',
      body: JSON.stringify({
        name: payload.name,
        domain: payload.domain,
        adminEmail: payload.adminEmail,
        adminName: payload.adminName,
        plan: payload.plan || 'Standard',
      }),
    })
    return normalize(data.data || data)
  } catch (err) {
    if (process.env.NODE_ENV === 'development') {
      const mock = {
        id: Date.now(),
        ...payload,
        status: 'requested',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        logs: [],
      }
      return normalize(mock)
    }
    throw err
  }
}

// State machine transitions — these trigger async BullMQ jobs on the backend

export async function approveTenant(id) {
  // requested → verified
  try {
    const data = await apiCall(`/api/v1/institutions/${id}/verify`, { method: 'PATCH' })
    return normalize(data.data || data)
  } catch (err) {
    if (process.env.NODE_ENV === 'development') {
      return normalize({ ...mockInstitutions.find(i => i.id === Number(id)), status: 'verified' })
    }
    throw err
  }
}

export async function provisionTenant(id) {
  // verified → provisioning (kicks off BullMQ job)
  try {
    const data = await apiCall(`/api/v1/institutions/${id}/provision`, { method: 'POST' })
    return normalize(data.data || data)
  } catch (err) {
    if (process.env.NODE_ENV === 'development') {
      return normalize({ ...mockInstitutions.find(i => i.id === Number(id)), status: 'provisioning' })
    }
    throw err
  }
}

export async function retryProvision(id) {
  // failed → provisioning
  try {
    const data = await apiCall(`/api/v1/institutions/${id}/retry`, { method: 'POST' })
    return normalize(data.data || data)
  } catch (err) {
    if (process.env.NODE_ENV === 'development') {
      return normalize({ ...mockInstitutions.find(i => i.id === Number(id)), status: 'provisioning', errorMessage: null, failedStep: null })
    }
    throw err
  }
}

export async function deleteTenant(id) {
  try {
    await apiCall(`/api/v1/institutions/${id}`, { method: 'DELETE' })
    return true
  } catch (err) {
    if (process.env.NODE_ENV === 'development') return true
    throw err
  }
}

export async function setupMoodle(id, payload) {
  try {
    const data = await apiCall(`/api/v1/institutions/${id}/moodle-setup`, {
      method: 'POST',
      body: JSON.stringify({
        moodleUrl: payload.moodleUrl,
        wsToken: payload.wsToken,
        syncCourses: payload.syncCourses,
        syncUsers: payload.syncUsers,
      }),
    })
    return normalize(data.data || data)
  } catch (err) {
    if (process.env.NODE_ENV === 'development') return { success: true }
    throw err
  }
}
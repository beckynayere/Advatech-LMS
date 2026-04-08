// DESTINATION: src/lib/ToastContext.js
'use client'

import { createContext, useContext, useState, useCallback, useRef } from 'react'

const ToastContext = createContext(null)

let _uid = 0

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const timers = useRef({})

  const dismiss = useCallback((id) => {
    setToasts(prev => prev.map(t => t.id === id ? { ...t, leaving: true } : t))
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 300)
  }, [])

  const toast = useCallback(({ type = 'info', message, duration = 4000 }) => {
    const id = ++_uid
    setToasts(prev => [...prev, { id, type, message, leaving: false }])
    if (duration > 0) {
      timers.current[id] = setTimeout(() => dismiss(id), duration)
    }
    return id
  }, [dismiss])

  // Convenience methods
  toast.success = (msg, opts) => toast({ type: 'success', message: msg, ...opts })
  toast.error   = (msg, opts) => toast({ type: 'error',   message: msg, duration: 6000, ...opts })
  toast.info    = (msg, opts) => toast({ type: 'info',    message: msg, ...opts })
  toast.warning = (msg, opts) => toast({ type: 'warning', message: msg, ...opts })

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}

// ─── Toast Container ──────────────────────────────────────────────────────────
const ICONS = {
  success: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="8" fill="#059669" fillOpacity=".15"/>
      <path d="M4.5 8l2.5 2.5 4.5-5" stroke="#059669" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  error: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="8" fill="#dc2626" fillOpacity=".15"/>
      <path d="M5.5 5.5l5 5M10.5 5.5l-5 5" stroke="#dc2626" strokeWidth="1.6" strokeLinecap="round"/>
    </svg>
  ),
  warning: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="8" fill="#d97706" fillOpacity=".15"/>
      <path d="M8 5v3.5" stroke="#d97706" strokeWidth="1.6" strokeLinecap="round"/>
      <circle cx="8" cy="11" r=".8" fill="#d97706"/>
    </svg>
  ),
  info: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="8" fill="#2563eb" fillOpacity=".15"/>
      <path d="M8 7v4" stroke="#2563eb" strokeWidth="1.6" strokeLinecap="round"/>
      <circle cx="8" cy="5" r=".8" fill="#2563eb"/>
    </svg>
  ),
}

const BORDER = {
  success: '#059669',
  error:   '#dc2626',
  warning: '#d97706',
  info:    '#2563eb',
}

function ToastContainer({ toasts, onDismiss }) {
  if (toasts.length === 0) return null
  return (
    <div style={{
      position: 'fixed',
      bottom: 24,
      right: 24,
      zIndex: 9999,
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
      pointerEvents: 'none',
      maxWidth: 380,
    }}>
      {toasts.map(t => (
        <div
          key={t.id}
          style={{
            pointerEvents: 'all',
            display: 'flex',
            alignItems: 'flex-start',
            gap: 10,
            background: '#ffffff',
            border: '1px solid var(--border-light)',
            borderLeft: `3px solid ${BORDER[t.type]}`,
            borderRadius: 10,
            padding: '12px 14px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
            fontSize: 13,
            color: 'var(--text-primary)',
            fontWeight: 500,
            opacity: t.leaving ? 0 : 1,
            transform: t.leaving ? 'translateX(20px)' : 'translateX(0)',
            transition: 'opacity 0.28s ease, transform 0.28s ease',
            minWidth: 260,
          }}
        >
          <span style={{ flexShrink: 0, marginTop: 1 }}>{ICONS[t.type]}</span>
          <span style={{ flex: 1, lineHeight: '1.5' }}>{t.message}</span>
          <button
            onClick={() => onDismiss(t.id)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '0 0 0 6px',
              color: 'var(--text-muted)',
              fontSize: 16,
              lineHeight: 1,
              flexShrink: 0,
            }}
          >×</button>
        </div>
      ))}
    </div>
  )
}
// DESTINATION: src/components/ErrorBoundary.js
'use client'

import { Component } from 'react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    // In production you'd send this to Sentry / your error tracker
    console.error('[ErrorBoundary]', error, info)
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg)',
        padding: 24,
      }}>
        <div style={{
          background: 'var(--surface)',
          border: '1px solid var(--border-light)',
          borderRadius: 16,
          padding: '40px 48px',
          maxWidth: 480,
          width: '100%',
          textAlign: 'center',
          boxShadow: 'var(--shadow-lg)',
        }}>
          {/* Icon */}
          <div style={{
            width: 56, height: 56, borderRadius: '50%',
            background: 'var(--danger-bg)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 20px',
          }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
                stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>

          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>
            Something went wrong
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 24, lineHeight: 1.6 }}>
            An unexpected error occurred. Try refreshing the page. If the problem persists, contact support.
          </div>

          {/* Error details in dev */}
          {process.env.NODE_ENV === 'development' && this.state.error && (
            <div style={{
              background: 'var(--gray-50)', border: '1px solid var(--border)',
              borderRadius: 8, padding: '10px 14px', marginBottom: 20,
              textAlign: 'left', fontSize: 11, fontFamily: 'DM Mono, monospace',
              color: 'var(--danger)', wordBreak: 'break-word',
              maxHeight: 120, overflowY: 'auto',
            }}>
              {this.state.error.message}
            </div>
          )}

          <button
            onClick={() => {
              this.setState({ hasError: false, error: null })
              window.location.reload()
            }}
            style={{
              padding: '10px 24px',
              background: 'var(--primary)',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            Reload Page
          </button>
        </div>
      </div>
    )
  }
}
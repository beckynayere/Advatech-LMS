// DESTINATION: src/components/ui/ConfirmDialog.js
'use client'
import { RiAlertLine } from 'react-icons/ri'
import styles from './ConfirmDialog.module.css'

export default function ConfirmDialog({ open, onClose, onConfirm, title, message, confirmLabel = 'Confirm', danger = false, loading = false }) {
  if (!open) return null
  return (
    <>
      <div className={styles.backdrop} onClick={onClose} />
      <div className={styles.dialog}>
        <div className={styles.iconWrap + (danger ? ' ' + styles.dangerIcon : '')}>
          <RiAlertLine size={22} />
        </div>
        <div className={styles.title}>{title}</div>
        <div className={styles.message}>{message}</div>
        <div className={styles.actions}>
          <button className={styles.cancelBtn} onClick={onClose} disabled={loading}>
            Cancel
          </button>
          <button
            className={`${styles.confirmBtn} ${danger ? styles.dangerBtn : ''}`}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? 'Processing…' : confirmLabel}
          </button>
        </div>
      </div>
    </>
  )
}
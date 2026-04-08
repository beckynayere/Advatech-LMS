// DESTINATION: src/components/ui/Drawer.js
'use client'
import { useEffect } from 'react'
import { RiCloseLine } from 'react-icons/ri'
import styles from './Drawer.module.css'

export default function Drawer({ open, onClose, title, subtitle, children, width = 520 }) {
  // Lock body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (!open) return null

  return (
    <>
      <div className={styles.backdrop} onClick={onClose} />
      <div className={styles.drawer} style={{ width }}>
        <div className={styles.header}>
          <div>
            <div className={styles.title}>{title}</div>
            {subtitle && <div className={styles.subtitle}>{subtitle}</div>}
          </div>
          <button className={styles.closeBtn} onClick={onClose}>
            <RiCloseLine size={18} />
          </button>
        </div>
        <div className={styles.body}>{children}</div>
      </div>
    </>
  )
}
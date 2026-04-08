'use client'

import { useEffect } from 'react'
import { RiCloseLine } from 'react-icons/ri'
import styles from './Modal.module.css'

export default function Modal({ open, onClose, title, desc, size, children, footer }) {
  useEffect(() => {
    if (!open) return
    const handleKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handleKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className={styles.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`${styles.modal} ${size ? styles[size] : ''}`}>
        <div className={styles.header}>
          <div className={styles.headerText}>
            <div className={styles.title}>{title}</div>
            {desc && <div className={styles.desc}>{desc}</div>}
          </div>
          <button className={styles.closeBtn} onClick={onClose}>
            <RiCloseLine size={18} />
          </button>
        </div>
        <div className={styles.body}>{children}</div>
        {footer && <div className={styles.footer}>{footer}</div>}
      </div>
    </div>
  )
}
'use client'

import { useState, useEffect } from 'react'
import { FiBell, FiMessageSquare, FiAward, FiVideo } from 'react-icons/fi'
import { getNotifications, markNotificationRead, markAllRead } from '@/lib/api/notifications'
import styles from './NotificationDropdown.module.css'

function timeAgo(iso) {
  const diff = Date.now() - new Date(iso)
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return mins + 'm ago'
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return hrs + 'h ago'
  return Math.floor(hrs / 24) + 'd ago'
}

function getIcon(type) {
  if (type === 'announcement') return <FiMessageSquare size={15} />
  if (type === 'grade') return <FiAward size={15} />
  if (type === 'class') return <FiVideo size={15} />
  return <FiBell size={15} />
}

export default function NotificationDropdown() {
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState([])

  useEffect(() => {
    getNotifications().then(setNotifications)
  }, [])

  const unreadCount = notifications.filter(n => n.status === 'unread').length

  async function handleRead(n) {
    if (n.status === 'unread') {
      await markNotificationRead(n.id)
      setNotifications(prev =>
        prev.map(x => x.id === n.id ? { ...x, status: 'read' } : x)
      )
    }
  }

  async function handleMarkAll() {
    const unread = notifications.filter(n => n.status === 'unread')
    await markAllRead(unread)
    setNotifications(prev => prev.map(n => ({ ...n, status: 'read' })))
  }

  return (
    <div className={styles.wrapper}>
      <button className={styles.bell} onClick={() => setOpen(o => !o)}>
        <FiBell size={20} />
        {unreadCount > 0 && (
          <span className={styles.badge}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className={styles.overlay} onClick={() => setOpen(false)} />
          <div className={styles.dropdown}>
            <div className={styles.dropHead}>
              <h3>Notifications {unreadCount > 0 && '(' + unreadCount + ')'}</h3>
              {unreadCount > 0 && (
                <button className={styles.markAll} onClick={handleMarkAll}>
                  Mark all read
                </button>
              )}
            </div>
            <div className={styles.list}>
              {notifications.length === 0 ? (
                <div className={styles.empty}>No notifications yet</div>
              ) : (
                notifications.map(n => (
                  <div
                    key={n.id}
                    className={styles.item + (n.status === 'unread' ? ' ' + styles.unread : '')}
                    onClick={() => handleRead(n)}
                  >
                    <div className={styles.iconBox + ' ' + (styles[n.type] || '')}>
                      {getIcon(n.type)}
                    </div>
                    <div className={styles.itemBody}>
                      <div className={styles.itemTitle}>{n.title}</div>
                      <div className={styles.itemMsg}>{n.message}</div>
                      <div className={styles.itemTime}>{timeAgo(n.createdAt)}</div>
                    </div>
                    {n.status === 'unread' && <div className={styles.unreadDot} />}
                  </div>
                ))
              )}
            </div>
            <div className={styles.footer}>
              <button onClick={() => setOpen(false)}>Close</button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

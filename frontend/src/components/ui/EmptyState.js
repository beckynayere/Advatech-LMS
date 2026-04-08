import styles from './EmptyState.module.css'

export default function EmptyState({ icon: Icon, title, desc, actionLabel, onAction }) {
  return (
    <div className={styles.wrap}>
      {Icon && (
        <div className={styles.iconWrap}>
          <Icon size={24} />
        </div>
      )}
      <div className={styles.title}>{title}</div>
      {desc && <div className={styles.desc}>{desc}</div>}
      {actionLabel && onAction && (
        <button className={styles.action} onClick={onAction}>
          {actionLabel}
        </button>
      )}
    </div>
  )
}
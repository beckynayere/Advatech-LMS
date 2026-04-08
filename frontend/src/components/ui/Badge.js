import styles from './Badge.module.css'

export default function Badge({ label, color = 'gray', dot = false, size }) {
  return (
    <span className={`${styles.badge} ${styles[color]} ${size ? styles[size] : ''}`}>
      {dot && <span className={styles.dot} />}
      {label}
    </span>
  )
}
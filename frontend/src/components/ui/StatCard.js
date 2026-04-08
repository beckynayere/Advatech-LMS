import { RiArrowUpSLine, RiArrowDownSLine, RiSubtractLine } from 'react-icons/ri'
import styles from './StatCard.module.css'

export default function StatCard({
  label,
  value,
  icon: Icon,
  color = 'teal',
  trend,
  trendLabel,
  sub,
}) {
  const trendDir = trend > 0 ? 'up' : trend < 0 ? 'down' : 'neutral'
  const TrendIcon = trend > 0 ? RiArrowUpSLine : trend < 0 ? RiArrowDownSLine : RiSubtractLine

  return (
    <div className={`${styles.card} ${styles[color]}`}>
      <div className={styles.top}>
        {Icon && (
          <div className={styles.iconWrap}>
            <Icon size={20} />
          </div>
        )}
        {trend !== undefined && (
          <div className={`${styles.trend} ${styles[trendDir]}`}>
            <TrendIcon size={12} />
            {Math.abs(trend)}%
          </div>
        )}
      </div>
      <div className={styles.bottom}>
        <div className={styles.value}>{value}</div>
        <div className={styles.label}>{label}</div>
        {sub && <div className={styles.sub}>{sub}</div>}
      </div>
    </div>
  )
}
type StatCardProps = {
  label: string
  value: string
  helper?: string
  tone?: 'green' | 'blue' | 'amber' | 'red'
}

export function StatCard({ label, value, helper, tone = 'green' }: StatCardProps) {
  return (
    <article className={`stat-card stat-${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      {helper ? <small>{helper}</small> : null}
    </article>
  )
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(value)
}

export function formatNumber(value: number) {
  return new Intl.NumberFormat('id-ID', {
    maximumFractionDigits: 2,
  }).format(value)
}

export function formatQuantity(value: number) {
  return new Intl.NumberFormat('id-ID', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value)
}

const decimalUnitSymbols = new Set(['kg', 'gram', 'meter', 'm', 'liter', 'ltr', 'lt'])

export function isDecimalUnit(symbol?: string) {
  if (!symbol) return false
  return decimalUnitSymbols.has(symbol.trim().toLowerCase())
}

export function quantityStep(symbol?: string) {
  return isDecimalUnit(symbol) ? '0.01' : '1'
}

export const APP_TIME_ZONE = 'Asia/Jakarta'
export const APP_TIME_ZONE_LABEL = 'WIB'

const sqliteDateTimePattern = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(?::\d{2})?$/

const dateFormatter = new Intl.DateTimeFormat('id-ID', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  timeZone: APP_TIME_ZONE,
})

const receiptDateFormatter = new Intl.DateTimeFormat('id-ID', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  timeZone: APP_TIME_ZONE,
})

const timeFormatter = new Intl.DateTimeFormat('id-ID', {
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
  timeZone: APP_TIME_ZONE,
})

const dateInputFormatter = new Intl.DateTimeFormat('en-CA', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  timeZone: APP_TIME_ZONE,
})

export function parseAppDate(value: string) {
  const normalized = sqliteDateTimePattern.test(value) ? `${value.replace(' ', 'T')}Z` : value
  return new Date(normalized)
}

export function formatDateTime(value: string) {
  const date = parseAppDate(value)
  if (Number.isNaN(date.getTime())) return '-'
  return `${dateFormatter.format(date)}, ${timeFormatter.format(date)} ${APP_TIME_ZONE_LABEL}`
}

export function formatReceiptDateTime(value: string) {
  const date = parseAppDate(value)
  if (Number.isNaN(date.getTime())) return '-'
  return `${receiptDateFormatter.format(date)} ${timeFormatter.format(date)} ${APP_TIME_ZONE_LABEL}`
}

export function dateInputFromDate(date: Date) {
  return dateInputFormatter.format(date)
}

export function dateInputFromTimestamp(value: string) {
  return dateInputFromDate(parseAppDate(value))
}

export function todayDateInput() {
  return dateInputFromDate(new Date())
}

export function addDaysToDateInput(value: string, days: number) {
  const [year, month, day] = value.split('-').map(Number)
  return dateInputFromDate(new Date(Date.UTC(year, month - 1, day + days, 12)))
}

export function makeInvoiceNumber(sequence: number) {
  const now = new Date()
  const date = [now.getFullYear(), now.getMonth() + 1, now.getDate()]
    .map((part) => String(part).padStart(2, '0'))
    .join('')

  return `INV-${date}-${String(sequence).padStart(4, '0')}`
}

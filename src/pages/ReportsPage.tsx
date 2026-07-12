import { useEffect, useMemo, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { save } from '@tauri-apps/plugin-dialog'
import { Button } from '../components/Button'
import { Card } from '../components/Card'
import { DataTable } from '../components/DataTable'
import { Dropdown } from '../components/Dropdown'
import { StatCard } from '../components/StatCard'
import { posApi } from '../services/posApi'
import type { Product, Sale } from '../types/pos'
import { addDaysToDateInput, dateInputFromTimestamp, formatCurrency, formatQuantity, todayDateInput } from '../utils/format'
import { useToast } from '../components/ToastProvider'

type ReportsPageProps = {
  sales: Sale[]
}

type DateRangePreset = 'today' | 'yesterday' | '7days' | '30days' | 'this-month' | 'this-year' | 'all' | 'custom'

function csvEscape(value: string) {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

function isTauriRuntime() {
  return typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)
}

async function saveCsv(filename: string, headers: string[], rows: string[][]): Promise<string | null> {
  const content = [headers.join(','), ...rows.map((row) => row.map(csvEscape).join(','))].join('\n')
  const csvContent = '\uFEFF' + 'SEP=,\n' + content

  if (!isTauriRuntime()) {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    return 'File berhasil di-download ke folder Downloads.'
  }

  const filePath = await save({
    defaultPath: filename,
    filters: [{ name: 'CSV', extensions: ['csv'] }],
  })

  if (!filePath) return null

  await invoke('save_text_file', { path: filePath, content: csvContent })
  return `File berhasil disimpan ke ${filePath}.`
}

function getDateRange(preset: DateRangePreset, customStart: string, customEnd: string) {
  const today = todayDateInput()
  let start = ''
  let end = ''

  switch (preset) {
    case 'today':
      start = today
      end = today
      break
    case 'yesterday': {
      const yesterday = addDaysToDateInput(today, -1)
      start = yesterday
      end = yesterday
      break
    }
    case '7days': {
      start = addDaysToDateInput(today, -6)
      end = today
      break
    }
    case '30days': {
      start = addDaysToDateInput(today, -29)
      end = today
      break
    }
    case 'this-month':
      start = `${today.slice(0, 7)}-01`
      end = today
      break
    case 'this-year':
      start = `${today.slice(0, 4)}-01-01`
      end = today
      break
    case 'custom':
      start = customStart
      end = customEnd
      break
    default:
      break
  }

  return { start, end }
}

export function ReportsPage({ sales }: ReportsPageProps) {
  const [productRows, setProductRows] = useState<Product[]>([])
  const [datePreset, setDatePreset] = useState<DateRangePreset>('30days')
  const [customStart, setCustomStart] = useState(todayDateInput())
  const [customEnd, setCustomEnd] = useState(todayDateInput())
  const { showToast } = useToast()

  useEffect(() => {
    let isMounted = true

    posApi.listProducts().then((nextProducts) => {
      if (isMounted) {
        setProductRows(nextProducts)
      }
    })

    return () => {
      isMounted = false
    }
  }, [])

  const { start: dateStart, end: dateEnd } = getDateRange(datePreset, customStart, customEnd)

  const completedSales = sales.filter((sale) => sale.status === 'COMPLETED')

  const filteredSales = useMemo(() => {
    return completedSales.filter((sale) => {
      const saleDate = dateInputFromTimestamp(sale.createdAt)
      if (!dateStart && !dateEnd) return true
      if (dateStart && saleDate < dateStart) return false
      if (dateEnd && saleDate > dateEnd) return false
      return true
    })
  }, [completedSales, dateStart, dateEnd])

  const totalSales = filteredSales.reduce((sum, sale) => sum + sale.totalNet, 0)
  const totalTransactions = filteredSales.length
  const lowStockProducts = productRows.filter((product) => product.stockBase <= product.minimumStock)

  const totalProfit = filteredSales.reduce((sum, sale) => {
    return sum + sale.items.reduce((itemSum, item) => {
      const cost = item.purchasePriceSnapshot ?? 0
      const profit = (item.price - cost) * item.qty
      return itemSum + profit
    }, 0)
  }, 0)

  const marginPercent = totalSales > 0 ? (totalProfit / totalSales) * 100 : 0
  const avgTransaction = totalTransactions > 0 ? totalSales / totalTransactions : 0

  const totalItemsSold = filteredSales.reduce((sum, sale) => {
    return sum + sale.items.reduce((itemSum, item) => itemSum + item.qty, 0)
  }, 0)
  const avgItems = totalTransactions > 0 ? totalItemsSold / totalTransactions : 0

  const totalAssetValue = productRows.reduce((sum, product) => sum + product.stockBase * product.purchasePriceBase, 0)
  const totalStockSellingValue = productRows.reduce((sum, product) => sum + product.stockBase * product.defaultSellingPriceBase, 0)

  const paymentSummary = useMemo(() => {
    return ['CASH', 'QRIS', 'TRANSFER', 'DEBIT'].map((method) => ({
      method,
      total: filteredSales.filter((sale) => sale.paymentMethod === method).reduce((sum, sale) => sum + sale.totalNet, 0),
      count: filteredSales.filter((sale) => sale.paymentMethod === method).length,
    }))
  }, [filteredSales])

  const topProducts = useMemo(() => {
    const map = new Map<string, { name: string; unitName: string; qty: number; subtotal: number }>()

    filteredSales.forEach((sale) => {
      sale.items.forEach((item) => {
        const key = `${item.productNameSnapshot}__${item.unitNameSnapshot}`
        const current = map.get(key) ?? {
          name: item.productNameSnapshot,
          unitName: item.unitNameSnapshot,
          qty: 0,
          subtotal: 0,
        }
        current.qty += item.qty
        current.subtotal += item.subtotal
        map.set(key, current)
      })
    })

    return Array.from(map.values()).sort((a, b) => b.subtotal - a.subtotal)
  }, [filteredSales])

  async function exportProductsCsv() {
    const headers = ['Produk', 'Satuan', 'Qty Terjual', 'Subtotal']
    const rows = topProducts.map((item) => [
      item.name,
      item.unitName,
      String(item.qty),
      String(item.subtotal),
    ])
    try {
      const result = await saveCsv(`laporan-produk-terlaris-${dateStart ?? 'semua'}.csv`, headers, rows)
      if (result) showToast(result, 'success')
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Export gagal.', 'error')
    }
  }

  async function exportPaymentCsv() {
    const headers = ['Metode', 'Jumlah Transaksi', 'Total']
    const rows = paymentSummary.filter((item) => item.count > 0).map((item) => [
      item.method,
      String(item.count),
      String(item.total),
    ])
    try {
      const result = await saveCsv(`laporan-pembayaran-${dateStart ?? 'semua'}.csv`, headers, rows)
      if (result) showToast(result, 'success')
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Export gagal.', 'error')
    }
  }

  const datePresetOptions: { value: DateRangePreset; label: string }[] = [
    { value: 'today', label: 'Hari ini' },
    { value: 'yesterday', label: 'Kemarin' },
    { value: '7days', label: '7 hari terakhir' },
    { value: '30days', label: '30 hari terakhir' },
    { value: 'this-month', label: 'Bulan ini' },
    { value: 'this-year', label: 'Tahun ini' },
    { value: 'all', label: 'Semua data' },
    { value: 'custom', label: 'Custom' },
  ]

  function clearFilters() {
    setDatePreset('all')
  }

  return (
    <div className="page-stack">


      <Card>
        <div className="section-header">
          <div>
            <span className="eyebrow">Laporan penjualan</span>
            <h2>{datePreset === 'all' ? 'Semua data' : datePreset === 'custom' ? `${dateStart} – ${dateEnd}` : datePresetOptions.find((o) => o.value === datePreset)?.label}</h2>
          </div>
          <div className="form-actions">
            <Dropdown
              value={datePreset}
              onValueChange={(value) => setDatePreset(value as DateRangePreset)}
              options={datePresetOptions.map((o) => ({ value: o.value, label: o.label }))}
            />
          </div>
        </div>
        {datePreset === 'custom' ? (
          <div className="toolbar">
            <label>
              Mulai
              <input type="date" value={customStart} onChange={(event) => setCustomStart(event.target.value)} />
            </label>
            <label>
              Selesai
              <input type="date" value={customEnd} onChange={(event) => setCustomEnd(event.target.value)} />
            </label>
            <Button type="button" variant="ghost" size="sm" onClick={clearFilters}>Reset</Button>
          </div>
        ) : null}
      </Card>

      <div className="stats-grid">
        <StatCard label="Total penjualan" value={formatCurrency(totalSales)} tone="green" />
        <StatCard label="Margin laba" value={`${marginPercent.toFixed(1)}%`} tone="amber" />
        <StatCard label="Total aset stok" value={formatCurrency(totalAssetValue)} helper="Berdasarkan harga modal" tone="amber" />
        <StatCard label="Nilai stok jual" value={formatCurrency(totalStockSellingValue)} helper="Berdasarkan harga jual" tone="blue" />
        <StatCard label="Jumlah transaksi" value={`${totalTransactions}`} tone="blue" />
        <StatCard label="Rata-rata transaksi" value={formatCurrency(avgTransaction)} tone="green" />
        <StatCard label="Estimasi laba kotor" value={formatCurrency(totalProfit)} tone="amber" />
        <StatCard label="Total item terjual" value={`${formatQuantity(totalItemsSold)}`} tone="blue" />
        <StatCard label="Stok rendah" value={`${lowStockProducts.length}`} tone="red" />
      </div>

      <div className="reports-grid">
        <Card>
          <div className="section-header">
            <div>
              <span className="eyebrow">Produk terlaris</span>
              <h2>Top {topProducts.length} produk</h2>
            </div>
            <Button type="button" variant="secondary" size="sm" onClick={() => void exportProductsCsv()} disabled={topProducts.length === 0}>
              Export CSV
            </Button>
          </div>
          <DataTable
            data={topProducts}
            pagination
            pageSize={10}
            columns={[
              { key: 'name', header: 'Produk', render: (item) => item.name + ' — ' + item.unitName },
              { key: 'qty', header: 'Qty', align: 'right', render: (item) => formatQuantity(item.qty) },
              { key: 'subtotal', header: 'Subtotal', align: 'right', render: (item) => formatCurrency(item.subtotal) },
            ]}
          />
        </Card>

        <Card>
          <div className="section-header">
            <div>
              <span className="eyebrow">Metode pembayaran</span>
              <h2>Ringkasan</h2>
            </div>
            <Button type="button" variant="secondary" size="sm" onClick={() => void exportPaymentCsv()} disabled={paymentSummary.every((item) => item.count === 0)}>
              Export CSV
            </Button>
          </div>
          <DataTable
            data={paymentSummary}
            pagination
            pageSize={10}
            columns={[
              { key: 'method', header: 'Metode', render: (item) => item.method },
              { key: 'count', header: 'Transaksi', align: 'right', render: (item) => item.count },
              { key: 'total', header: 'Total', align: 'right', render: (item) => formatCurrency(item.total) },
            ]}
          />
        </Card>
      </div>
    </div>
  )
}

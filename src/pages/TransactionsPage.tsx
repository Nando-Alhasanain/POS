import { useEffect, useMemo, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { save } from '@tauri-apps/plugin-dialog'
import { Button } from '../components/Button'
import { Card } from '../components/Card'
import { DataTable } from '../components/DataTable'
import { Dropdown } from '../components/Dropdown'
import { Modal } from '../components/Modal'
import { ReceiptPreview } from '../components/ReceiptPreview'
import { useToast } from '../components/ToastProvider'
import { posApi } from '../services/posApi'
import type { AppUser, Sale, StoreSettings } from '../types/pos'
import { dateInputFromTimestamp, formatCurrency, formatDateTime, formatQuantity } from '../utils/format'

type TransactionsPageProps = {
  user: AppUser
}

const defaultSettings: StoreSettings = {
  storeName: 'POS TOKO',
  storeAddress: '',
  storePhone: '',
  receiptFooter: 'Terima kasih',
  receiptPaperSize: '80mm',
  currency: 'IDR',
}

function saleItemSearchText(sale: Sale) {
  return sale.items.map((item) => item.productNameSnapshot).join(' ').toLowerCase()
}

function renderSaleItems(sale: Sale, onOpenDetail: (sale: Sale) => void) {
  const visibleItems = sale.items.slice(0, 2)
  const hiddenCount = sale.items.length - visibleItems.length

  return (
    <div className="transaction-items-cell" title={sale.items.map((item) => item.productNameSnapshot).join(', ')}>
      {visibleItems.map((item) => (
        <span key={item.id}>
          {item.productNameSnapshot} · {formatQuantity(item.qty)} {item.unitNameSnapshot}
        </span>
      ))}
      {hiddenCount > 0 ? (
        <button type="button" className="transaction-items-more" onClick={() => onOpenDetail(sale)}>
          Lihat +{hiddenCount} item lain
        </button>
      ) : null}
    </div>
  )
}

function isTauriRuntime() {
  return typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)
}

function csvEscape(value: string) {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
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

export function TransactionsPage({ user }: TransactionsPageProps) {
  const [sales, setSales] = useState<Sale[]>([])
  const [settings, setSettings] = useState<StoreSettings>(defaultSettings)
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [paymentFilter, setPaymentFilter] = useState('all')
  const [dateFilter, setDateFilter] = useState('')
  const [receiptSale, setReceiptSale] = useState<Sale | undefined>(undefined)
  const [detailSale, setDetailSale] = useState<Sale | undefined>(undefined)
  const [cancelTarget, setCancelTarget] = useState<Sale | undefined>(undefined)
  const [cancelReason, setCancelReason] = useState('')
  const { showToast } = useToast()
  const [error, setError] = useState('')
  const [isCancelling, setIsCancelling] = useState(false)
  const [isReceiptPrinting, setIsReceiptPrinting] = useState(false)

  const isAdmin = user.role === 'admin'

  useEffect(() => {
    void loadData()
  }, [])

  async function loadData() {
    const [nextSales, nextSettings] = await Promise.all([posApi.listSales(), posApi.getStoreSettings()])
    setSales(nextSales)
    setSettings(nextSettings)
  }

  const filteredSales = useMemo(() => {
    const normalized = query.toLowerCase().trim()
    return sales.filter((sale) => {
      const matchesQuery = !normalized
        || sale.invoiceNumber.toLowerCase().includes(normalized)
        || saleItemSearchText(sale).includes(normalized)
      const matchesStatus = statusFilter === 'all' || sale.status === statusFilter
      const matchesPayment = paymentFilter === 'all' || sale.paymentMethod === paymentFilter
      const matchesDate = !dateFilter || dateInputFromTimestamp(sale.createdAt) === dateFilter
      return matchesQuery && matchesStatus && matchesPayment && matchesDate
    })
  }, [sales, query, statusFilter, paymentFilter, dateFilter])

  function clearFilters() {
    setQuery('')
    setStatusFilter('all')
    setPaymentFilter('all')
    setDateFilter('')
  }

  function openReceipt(sale: Sale) {
    setReceiptSale(sale)
  }

  function openDetail(sale: Sale) {
    setDetailSale(sale)
  }

  async function printReceipt() {
    if (!receiptSale) return
    setIsReceiptPrinting(true)
    try {
      await posApi.printReceipt(receiptSale)
      showToast(`Struk ${receiptSale.invoiceNumber} berhasil dikirim ke antrian printer.`, 'success')
    } catch (printError) {
      showToast(printError instanceof Error ? printError.message : 'Struk gagal dicetak.', 'error')
    } finally {
      setIsReceiptPrinting(false)
    }
  }

  async function exportTransactionsCsv() {
    const headers = [
      'Invoice', 'Tanggal', 'Kasir', 'Pelanggan', 'Produk', 'Satuan', 'Qty',
      'Harga Satuan', 'Subtotal', 'Metode Bayar', 'Total', 'Diskon', 'Net',
    ]
    const rows: string[][] = []
    filteredSales.forEach((sale) => {
      sale.items.forEach((item) => {
        rows.push([
          sale.invoiceNumber,
          formatDateTime(sale.createdAt),
          sale.cashierName,
          sale.customerName ?? '-',
          item.productNameSnapshot,
          item.unitNameSnapshot,
          String(item.qty),
          String(item.price),
          String(item.subtotal),
          sale.paymentMethod,
          String(sale.totalGross),
          String(sale.discount),
          String(sale.totalNet),
        ])
      })
    })
    try {
      const result = await saveCsv('riwayat-transaksi.csv', headers, rows)
      if (result) showToast(result, 'success')
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Export gagal.', 'error')
    }
  }

  function openCancel(sale: Sale) {
    setCancelTarget(sale)
    setCancelReason('')
  }

  async function handleCancel() {
    if (!cancelTarget) return
    if (!cancelReason.trim()) {
      setError('Alasan pembatalan wajib diisi.')
      return
    }

    setError('')
    setIsCancelling(true)
    try {
      await posApi.cancelSale({
        id: cancelTarget.id,
        cancelReason: cancelReason.trim(),
        cancelledBy: user.id,
      })
      showToast(`Transaksi ${cancelTarget.invoiceNumber} berhasil dibatalkan.`, 'success')
      setCancelTarget(undefined)
      setCancelReason('')
      await loadData()
    } catch (cancelError) {
      setError(cancelError instanceof Error ? cancelError.message : 'Pembatalan gagal.')
    } finally {
      setIsCancelling(false)
    }
  }

  return (
    <div className="page-stack">
      <Card>
        <div className="section-header">
          <div>
            <span className="eyebrow">Riwayat transaksi</span>
            <h2>Daftar invoice</h2>
          </div>
          <Button type="button" variant="secondary" onClick={() => void exportTransactionsCsv()} disabled={filteredSales.length === 0}>
            Export CSV
          </Button>
        </div>
        <div className="toolbar toolbar-wide">
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari invoice atau item" />
          <input type="date" value={dateFilter} onChange={(event) => setDateFilter(event.target.value)} />
          <Dropdown
            value={statusFilter}
            onValueChange={setStatusFilter}
            options={[
              { value: 'all', label: 'Semua status' },
              { value: 'COMPLETED', label: 'COMPLETED' },
              { value: 'CANCELLED', label: 'CANCELLED' },
            ]}
          />
          <Dropdown
            value={paymentFilter}
            onValueChange={setPaymentFilter}
            options={[
              { value: 'all', label: 'Semua pembayaran' },
              { value: 'CASH', label: 'CASH' },
              { value: 'TRANSFER', label: 'TRANSFER' },
              { value: 'QRIS', label: 'QRIS' },
              { value: 'DEBIT', label: 'DEBIT' },
              { value: 'CREDIT', label: 'CREDIT' },
              { value: 'OTHER', label: 'OTHER' },
            ]}
          />
          <Button type="button" variant="ghost" size="sm" onClick={clearFilters}>Reset</Button>
        </div>

        <DataTable<Sale>
          data={filteredSales}
          pagination
          pageSize={10}
          columns={[
            { key: 'invoice', header: 'Invoice', render: (sale) => <div className="cell-title"><strong>{sale.invoiceNumber}</strong><span>{formatDateTime(sale.createdAt)}</span></div> },
            { key: 'customer', header: 'Pelanggan', render: (sale) => sale.customerName ?? '-' },
            { key: 'items', header: 'Item', render: (sale) => renderSaleItems(sale, openDetail) },
            { key: 'method', header: 'Bayar', render: (sale) => sale.paymentMethod },
            { key: 'total', header: 'Total', align: 'right', render: (sale) => formatCurrency(sale.totalNet) },
            { key: 'status', header: 'Status', render: (sale) => <span className={sale.status === 'COMPLETED' ? 'status-pill ok' : 'status-pill warn'}>{sale.status}</span> },
            {
              key: 'action',
              header: 'Aksi',
              align: 'right',
              render: (sale) => (
                <div className="inline-actions">
                  <Button type="button" variant="secondary" size="sm" onClick={() => openReceipt(sale)}>
                    Cetak
                  </Button>
                  {isAdmin && sale.status === 'COMPLETED' ? (
                    <Button type="button" variant="danger" size="sm" onClick={() => openCancel(sale)}>
                      Batalkan
                    </Button>
                  ) : null}
                </div>
              ),
            },
          ]}
        />
      </Card>

      <Modal title={detailSale ? `Detail item ${detailSale.invoiceNumber}` : 'Detail item'} open={Boolean(detailSale)} onClose={() => setDetailSale(undefined)} wide>
        {detailSale ? (
          <div className="transaction-detail">
            <div className="transaction-detail-summary">
              <div><span>Invoice</span><strong>{detailSale.invoiceNumber}</strong></div>
              <div><span>Tanggal</span><strong>{formatDateTime(detailSale.createdAt)}</strong></div>
              <div><span>Pelanggan</span><strong>{detailSale.customerName ?? '-'}</strong></div>
              <div><span>Status</span><strong>{detailSale.status}</strong></div>
            </div>
            <div className="transaction-detail-items">
              {detailSale.items.map((item) => (
                <div className="transaction-detail-item" key={item.id}>
                  <div>
                    <strong>{item.productNameSnapshot}</strong>
                    <span>{formatQuantity(item.qty)} {item.unitNameSnapshot} x {formatCurrency(item.price)}</span>
                  </div>
                  <b>{formatCurrency(item.subtotal)}</b>
                </div>
              ))}
            </div>
            <div className="transaction-detail-total">
              <span>Total transaksi</span>
              <strong>{formatCurrency(detailSale.totalNet)}</strong>
            </div>
            <div className="form-actions">
              <Button type="button" variant="secondary" onClick={() => { setReceiptSale(detailSale); setDetailSale(undefined) }}>
                Buka struk
              </Button>
              <Button type="button" variant="ghost" onClick={() => setDetailSale(undefined)}>
                Tutup
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal title={receiptSale ? `Struk ${receiptSale.invoiceNumber}` : 'Struk'} open={Boolean(receiptSale)} onClose={() => { setReceiptSale(undefined) }}>
        {receiptSale ? (
          <div className="receipt-modal-body">
            <ReceiptPreview sale={receiptSale} settings={settings} />
            <div className="form-actions receipt-actions">
              <Button type="button" onClick={() => void printReceipt()} disabled={isReceiptPrinting}>
                {isReceiptPrinting ? 'Mencetak...' : 'Cetak struk'}
              </Button>
              <Button type="button" variant="ghost" onClick={() => { setReceiptSale(undefined) }}>
                Tutup
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal title="Batalkan transaksi" open={Boolean(cancelTarget)} onClose={() => { setCancelTarget(undefined); setCancelReason('') }}>
        {cancelTarget ? (
          <div className="form-grid dense-form">
            <div className="form-note">
              Invoice: {cancelTarget.invoiceNumber} — Total: {formatCurrency(cancelTarget.totalNet)} — {cancelTarget.items.length} item
            </div>
            <label>
              Alasan pembatalan
              <textarea rows={3} value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} placeholder="Wajib diisi" />
            </label>
            {error ? <div className="error-box">{error}</div> : null}
            <div className="form-actions">
              <Button type="button" variant="danger" onClick={() => void handleCancel()} disabled={isCancelling || !cancelReason.trim()}>
                {isCancelling ? 'Membatalkan...' : 'Ya, batalkan'}
              </Button>
              <Button type="button" variant="ghost" onClick={() => { setCancelTarget(undefined); setCancelReason('') }}>
                Batal
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  )
}

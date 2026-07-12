import { useEffect, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { open, save } from '@tauri-apps/plugin-dialog'
import { Button } from '../components/Button'
import { Card } from '../components/Card'
import { Dropdown } from '../components/Dropdown'
import { Modal } from '../components/Modal'
import { posApi, type SaveStoreSettingsInput } from '../services/posApi'
import type { Printer, StoreSettings } from '../types/pos'
import { useToast } from '../components/ToastProvider'
import { fileAssetSrc } from '../utils/productImage'

const NO_PRINTER_VALUE = '__no_printer__'

const defaultSettings: StoreSettings = {
  storeName: 'POS TOKO',
  storeAddress: '',
  storePhone: '',
  receiptFooter: 'Terima kasih',
  receiptPaperSize: '80mm',
  currency: 'IDR',
  printerName: '',
  receiptLogoPath: '',
}

type SettingsPageProps = {
  onOperationalDataReset: () => void
}

export function SettingsPage({ onOperationalDataReset }: SettingsPageProps) {
  const [form, setForm] = useState<SaveStoreSettingsInput>(defaultSettings)
  const [printers, setPrinters] = useState<Printer[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const { showToast } = useToast()
  const [isSaving, setIsSaving] = useState(false)
  const [isTesting, setIsTesting] = useState(false)
  const [isBackupLoading, setIsBackupLoading] = useState(false)
  const [isRestoreLoading, setIsRestoreLoading] = useState(false)
  const [isResetLoading, setIsResetLoading] = useState(false)
  const [restoreFile, setRestoreFile] = useState<string | null>(null)
  const [restoreConfirmText, setRestoreConfirmText] = useState('')
  const [isRestoreModalOpen, setIsRestoreModalOpen] = useState(false)
  const [resetConfirmText, setResetConfirmText] = useState('')
  const [isResetConfirmed, setIsResetConfirmed] = useState(false)
  const [isResetModalOpen, setIsResetModalOpen] = useState(false)

  useEffect(() => {
    let isMounted = true

    Promise.all([posApi.getStoreSettings(), posApi.listPrinters()])
      .then(([settings, printerRows]) => {
        if (!isMounted) return
        setForm({ ...defaultSettings, ...settings, printerName: settings.printerName ?? '' })
        setPrinters(printerRows)
      })
      .catch((loadError) => {
        if (!isMounted) return
        showToast(loadError instanceof Error ? loadError.message : 'Pengaturan gagal dimuat.', 'error')
      })
      .finally(() => {
        if (isMounted) setIsLoading(false)
      })

    return () => {
      isMounted = false
    }
  }, [])

  function updateForm<K extends keyof SaveStoreSettingsInput>(key: K, value: SaveStoreSettingsInput[K]) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  async function saveSettings() {
    setIsSaving(true)
    try {
      const saved = await posApi.saveStoreSettings(form)
      setForm({ ...defaultSettings, ...saved, printerName: saved.printerName ?? '' })
      showToast('Pengaturan berhasil disimpan.', 'success')
    } catch (saveError) {
      showToast(saveError instanceof Error ? saveError.message : 'Pengaturan gagal disimpan.', 'error')
    } finally {
      setIsSaving(false)
    }
  }

  function handleLogoChange(file?: File) {
    if (!file) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      showToast('Logo struk harus JPG, PNG, atau WebP.', 'error')
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      showToast('Ukuran logo struk maksimal 2 MB.', 'error')
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      setForm((current) => ({
        ...current,
        receiptLogoDataUrl: String(reader.result ?? ''),
        receiptLogoFileName: file.name,
        removeReceiptLogo: false,
      }))
    }
    reader.onerror = () => showToast('Logo struk gagal dibaca.', 'error')
    reader.readAsDataURL(file)
  }

  function removeLogo() {
    setForm((current) => ({
      ...current,
      receiptLogoPath: '',
      receiptLogoDataUrl: '',
      receiptLogoFileName: '',
      removeReceiptLogo: true,
    }))
  }

  async function testPrint() {
    setIsTesting(true)
    try {
      const saved = await posApi.saveStoreSettings(form)
      setForm({ ...defaultSettings, ...saved, printerName: saved.printerName ?? '' })
      await posApi.testPrint()
      showToast('Test print ESC/POS berhasil dikirim ke antrian printer.', 'success')
    } catch (testError) {
      showToast(testError instanceof Error ? testError.message : 'Test print gagal.', 'error')
    } finally {
      setIsTesting(false)
    }
  }

  async function handleBackup() {
    setIsBackupLoading(true)
    try {
      const now = new Date()
      const timestamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`
      const filePath = await save({
        defaultPath: `backup-pos-${timestamp}.postoko-backup`,
        filters: [{ name: 'Backup lengkap POS TOKO', extensions: ['postoko-backup'] }],
      })
      if (!filePath) return
      await posApi.backupDatabase(filePath)
      showToast(`Backup lengkap berhasil disimpan ke ${filePath}.`, 'success')
    } catch (backupError) {
      showToast(backupError instanceof Error ? backupError.message : 'Backup gagal.', 'error')
    } finally {
      setIsBackupLoading(false)
    }
  }

  async function handleRestore() {
    if (!window.confirm('Proses restore akan menimpa seluruh data saat ini.\n\nDatabase lama akan otomatis dibackup terlebih dahulu.\n\nLanjutkan?')) return

    try {
      const filePath = await open({
        filters: [
          { name: 'Backup lengkap POS TOKO', extensions: ['postoko-backup'] },
          { name: 'Database lama', extensions: ['db'] },
        ],
        multiple: false,
      })
      if (!filePath) return
      setRestoreFile(String(filePath))
      setRestoreConfirmText('')
      setIsRestoreModalOpen(true)
    } catch {
      showToast('Gagal membuka file.', 'error')
    }
  }

  async function confirmRestore() {
    if (!restoreFile || restoreConfirmText !== 'RESTORE') return

    setIsRestoreModalOpen(false)
    setIsRestoreLoading(true)
    try {
      const autoBackupPath = await posApi.restoreDatabase(restoreFile)
      showToast(`Backup berhasil direstore. Data lama otomatis dibackup ke ${autoBackupPath}. Harap restart aplikasi.`, 'success')
    } catch (restoreError) {
      showToast(restoreError instanceof Error ? restoreError.message : 'Restore gagal.', 'error')
    } finally {
      setIsRestoreLoading(false)
    }
  }

  function closeRestoreModal() {
    setIsRestoreModalOpen(false)
    setRestoreFile(null)
    setRestoreConfirmText('')
  }

  function handleResetData() {
    if (!window.confirm('Reset data operasional akan menghapus produk, kategori, satuan, stok, transaksi, dan foto produk.\n\nAdmin, pengaturan toko, printer, dan logo tetap disimpan. Satuan tidak akan dibuat ulang otomatis. Backup otomatis akan dibuat terlebih dahulu.\n\nLanjutkan?')) return
    setResetConfirmText('')
    setIsResetConfirmed(false)
    setIsResetModalOpen(true)
  }

  async function confirmResetData() {
    if (resetConfirmText !== 'RESET DATA' || !isResetConfirmed) return

    setIsResetLoading(true)
    try {
      const autoBackupPath = await posApi.resetOperationalData()
      setIsResetModalOpen(false)
      setResetConfirmText('')
      setIsResetConfirmed(false)
      showToast(`Data operasional berhasil direset. Backup otomatis: ${autoBackupPath}. Dashboard dan laporan sudah diperbarui.`, 'success')
      onOperationalDataReset()
    } catch (resetError) {
      showToast(resetError instanceof Error ? resetError.message : 'Reset data gagal.', 'error')
    } finally {
      setIsResetLoading(false)
    }
  }

  function closeResetModal() {
    if (isResetLoading) return
    setIsResetModalOpen(false)
    setResetConfirmText('')
    setIsResetConfirmed(false)
  }

  if (isLoading) {
    return <div className="boot-card">Memuat pengaturan...</div>
  }

  const receiptLogoSrc = form.receiptLogoDataUrl || fileAssetSrc(form.receiptLogoPath)

  return (
    <div className="page-stack settings-grid">


      <Card>
        <div className="section-header">
          <div>
            <span className="eyebrow">Pengaturan toko</span>
            <h2>Identitas struk</h2>
          </div>
        </div>
        <form className="form-grid dense-form" onSubmit={(event) => { event.preventDefault(); void saveSettings() }}>
          <div className="product-image-editor receipt-logo-editor">
            <div className="product-image-preview receipt-logo-preview">
              {receiptLogoSrc ? <img src={receiptLogoSrc} alt="Logo struk" /> : <span>LOGO</span>}
            </div>
            <div className="product-image-controls">
              <strong>Logo struk</strong>
              <span>Logo akan tampil di preview struk dan hasil cetak thermal. Format JPG, PNG, atau WebP maksimal 2 MB.</span>
              <div className="form-actions">
                <label className="file-button">
                  Pilih logo
                  <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => handleLogoChange(event.target.files?.[0])} />
                </label>
                {receiptLogoSrc ? <Button type="button" variant="ghost" onClick={removeLogo}>Hapus logo</Button> : null}
              </div>
            </div>
          </div>
          <label>Nama toko<input value={form.storeName} onChange={(event) => updateForm('storeName', event.target.value)} required /></label>
          <label>Alamat toko<textarea rows={3} value={form.storeAddress} onChange={(event) => updateForm('storeAddress', event.target.value)} /></label>
          <label>Telepon<input value={form.storePhone} onChange={(event) => updateForm('storePhone', event.target.value)} /></label>
          <label>Footer struk<textarea rows={3} value={form.receiptFooter} onChange={(event) => updateForm('receiptFooter', event.target.value)} /></label>
          <Button type="submit" disabled={isSaving}>{isSaving ? 'Menyimpan...' : 'Simpan pengaturan'}</Button>
        </form>
      </Card>

      <Card>
        <div className="section-header">
          <div>
            <span className="eyebrow">Printer</span>
            <h2>ESC/POS thermal USB</h2>
          </div>
        </div>
        <form className="form-grid dense-form" onSubmit={(event) => { event.preventDefault(); void testPrint() }}>
          <label>
            Printer Windows
            <Dropdown
              value={form.printerName || NO_PRINTER_VALUE}
              onValueChange={(value) => updateForm('printerName', value === NO_PRINTER_VALUE ? '' : value)}
              options={[
                { value: NO_PRINTER_VALUE, label: 'Pilih printer thermal' },
                ...printers.map((printer) => ({ value: printer.name, label: printer.name })),
              ]}
            />
          </label>
          <label>
            Ukuran kertas
            <Dropdown
              value={form.receiptPaperSize}
              onValueChange={(value) => updateForm('receiptPaperSize', value as StoreSettings['receiptPaperSize'])}
              options={[
                { value: '58mm', label: '58mm' },
                { value: '80mm', label: '80mm' },
              ]}
            />
          </label>
          <div className="form-note">
            Gunakan printer thermal USB yang sudah muncul di daftar printer Windows. Mode cetak memakai ESC/POS RAW, bukan dialog print browser.
          </div>
          <Button type="submit" variant="secondary" disabled={isTesting || !form.printerName}>
            {isTesting ? 'Mengirim test...' : 'Test print ESC/POS'}
          </Button>
        </form>
      </Card>

      <Card className="wide-card">
        <div className="section-header">
          <div>
            <span className="eyebrow">Backup dan restore</span>
            <h2>Data safety first</h2>
          </div>
        </div>
        <div className="backup-panel">
          <div className="backup-panel-row">
            <div>
              <strong>Backup database</strong>
              <span>Simpan database, foto produk, dan logo struk ke satu file backup.</span>
            </div>
            <Button type="button" onClick={() => void handleBackup()} disabled={isBackupLoading}>
              {isBackupLoading ? 'Mem-backup...' : 'Backup'}
            </Button>
          </div>
          <hr className="backup-divider" />
          <div className="backup-panel-row">
            <div>
              <strong>Restore database</strong>
              <span>Pulihkan backup lengkap .postoko-backup atau database lama .db. Membutuhkan verifikasi ganda.</span>
            </div>
            <Button type="button" variant="danger" onClick={() => void handleRestore()} disabled={isRestoreLoading}>
              {isRestoreLoading ? 'Memulihkan...' : 'Restore'}
            </Button>
          </div>
          <hr className="backup-divider" />
          <div className="backup-panel-row danger-row">
            <div>
              <strong>Reset data operasional</strong>
              <span>Hapus produk, kategori, satuan, stok, transaksi, dan foto produk. Admin dan pengaturan tetap aman.</span>
            </div>
            <Button type="button" variant="danger" onClick={handleResetData} disabled={isResetLoading}>
              {isResetLoading ? 'Mereset...' : 'Reset data'}
            </Button>
          </div>
        </div>
      </Card>

      <Modal title="Konfirmasi restore database" open={isRestoreModalOpen} onClose={closeRestoreModal}>
        <div className="form-grid dense-form">
          <div className="form-note" style={{ borderColor: 'var(--red)', background: 'var(--red-soft)', color: 'var(--red)' }}>
            <strong>Peringatan!</strong> Semua data saat ini akan ditimpa dengan data dari file backup. Data lama akan otomatis dibackup lengkap terlebih dahulu.
          </div>
          <div>
            <strong>File backup:</strong>
            <span style={{ display: 'block', color: 'var(--muted)', fontSize: '0.84rem', marginTop: '0.2rem' }}>{restoreFile}</span>
          </div>
          <label>
            Ketik <strong>RESTORE</strong> untuk mengonfirmasi
            <input
              value={restoreConfirmText}
              onChange={(event) => setRestoreConfirmText(event.target.value)}
              placeholder="Ketik RESTORE"
              style={{ fontFamily: 'monospace', letterSpacing: '0.15em', textTransform: 'uppercase' }}
            />
          </label>
          <div className="form-actions">
            <Button
              type="button"
              variant="danger"
              onClick={() => void confirmRestore()}
              disabled={restoreConfirmText !== 'RESTORE' || isRestoreLoading}
            >
              {isRestoreLoading ? 'Memulihkan...' : 'Restore database'}
            </Button>
            <Button type="button" variant="ghost" onClick={closeRestoreModal}>
              Batal
            </Button>
          </div>
        </div>
      </Modal>

      <Modal title="Reset data operasional" open={isResetModalOpen} onClose={closeResetModal}>
        <div className="form-grid dense-form">
          <div className="form-note" style={{ borderColor: 'var(--red)', background: 'var(--red-soft)', color: 'var(--red)' }}>
            <strong>Peringatan!</strong> Produk, kategori, satuan, stok, transaksi, dan foto produk akan dihapus permanen. Satuan tidak akan dibuat ulang otomatis. Admin, pengaturan toko, printer, footer struk, dan logo tetap disimpan. Backup otomatis dibuat sebelum reset.
          </div>
          <label>
            Ketik <strong>RESET DATA</strong> untuk mengonfirmasi
            <input
              value={resetConfirmText}
              onChange={(event) => setResetConfirmText(event.target.value)}
              placeholder="Ketik RESET DATA"
              style={{ fontFamily: 'monospace', letterSpacing: '0.12em', textTransform: 'uppercase' }}
            />
          </label>
          <label className="checkbox-line danger-checkbox">
            <input type="checkbox" checked={isResetConfirmed} onChange={(event) => setIsResetConfirmed(event.target.checked)} />
            <span>Saya paham data operasional akan dihapus dan hanya bisa dipulihkan dari backup.</span>
          </label>
          <div className="form-actions">
            <Button
              type="button"
              variant="danger"
              onClick={() => void confirmResetData()}
              disabled={resetConfirmText !== 'RESET DATA' || !isResetConfirmed || isResetLoading}
            >
              {isResetLoading ? 'Mereset...' : 'Reset data operasional'}
            </Button>
            <Button type="button" variant="ghost" onClick={closeResetModal} disabled={isResetLoading}>
              Batal
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

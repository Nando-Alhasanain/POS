import { useEffect, useMemo, useState } from 'react'
import { Button } from '../components/Button'
import { Card } from '../components/Card'
import { DataTable } from '../components/DataTable'
import { Modal } from '../components/Modal'
import { useToast } from '../components/ToastProvider'
import { posApi, type SaveUnitInput } from '../services/posApi'
import type { Product, Unit } from '../types/pos'

const emptyForm: SaveUnitInput = {
  name: '',
  symbol: '',
  description: '',
}

export function UnitsPage() {
  const [unitRows, setUnitRows] = useState<Unit[]>([])
  const [productRows, setProductRows] = useState<Product[]>([])
  const [query, setQuery] = useState('')
  const [form, setForm] = useState<SaveUnitInput>(emptyForm)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const { showToast } = useToast()
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    void loadData()
  }, [])

  async function loadData() {
    const [nextUnits, nextProducts] = await Promise.all([posApi.listUnits(), posApi.listProducts()])
    setUnitRows(nextUnits)
    setProductRows(nextProducts)
  }

  const filteredUnits = useMemo(() => {
    const normalized = query.toLowerCase().trim()
    return unitRows.filter((item) => !normalized || item.name.toLowerCase().includes(normalized) || item.symbol.toLowerCase().includes(normalized))
  }, [query, unitRows])

  function usageCount(unitId: string) {
    return productRows.reduce((sum, product) => sum + product.units.filter((unit) => unit.unitId === unitId).length, 0)
  }

  function resetForm() {
    setForm(emptyForm)
  }

  function openCreateForm() {
    resetForm()
    setIsFormOpen(true)
  }

  function openEditForm(unit: Unit) {
    setForm(unit)
    setIsFormOpen(true)
  }

  function closeForm() {
    setIsFormOpen(false)
    resetForm()
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setIsSubmitting(true)

    try {
      await posApi.saveUnit(form)
      resetForm()
      setIsFormOpen(false)
      await loadData()
    } catch (saveError) {
      showToast(saveError instanceof Error ? saveError.message : 'Satuan gagal disimpan.', 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleDelete(unit: Unit) {
    if (usageCount(unit.id) > 0) {
      showToast('Satuan sudah dipakai produk dan tidak dapat dihapus.', 'error')
      return
    }

    if (!window.confirm(`Hapus satuan ${unit.symbol}?`)) {
      return
    }

    try {
      await posApi.deleteUnit(unit.id)
      await loadData()
    } catch (deleteError) {
      showToast(deleteError instanceof Error ? deleteError.message : 'Satuan gagal dihapus.', 'error')
    }
  }

  return (
    <div className="page-stack">
      <Card>
        <div className="section-header">
          <div>
            <span className="eyebrow">Master satuan</span>
            <h2>Satuan dasar dan satuan jual</h2>
          </div>
          <Button type="button" onClick={openCreateForm}>
            Tambah satuan
          </Button>
        </div>
        <div className="toolbar">
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari nama atau symbol satuan" />
        </div>
        <DataTable<Unit>
          data={filteredUnits}
          pagination
          pageSize={10}
          columns={[
            { key: 'symbol', header: 'Symbol', render: (item) => <strong>{item.symbol}</strong> },
            { key: 'name', header: 'Nama', render: (item) => item.name },
            { key: 'description', header: 'Deskripsi', render: (item) => item.description ?? '-' },
            { key: 'usage', header: 'Dipakai', align: 'right', render: (item) => usageCount(item.id) },
            {
              key: 'action',
              header: 'Aksi',
              align: 'right',
              render: (item) => (
                <div className="inline-actions">
                  <Button type="button" variant="secondary" size="sm" onClick={() => openEditForm(item)}>
                    Edit
                  </Button>
                  <Button type="button" variant="danger" size="sm" onClick={() => void handleDelete(item)}>
                    Hapus
                  </Button>
                </div>
              ),
            },
          ]}
        />
      </Card>

      <Modal title={form.id ? 'Edit satuan' : 'Tambah satuan'} open={isFormOpen} onClose={closeForm}>
        <form className="form-grid dense-form" onSubmit={handleSubmit}>
          <div className="three-columns">
            <label>
              Nama satuan
              <input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} required />
            </label>
            <label>
              Symbol unik
              <input value={form.symbol} onChange={(event) => setForm((current) => ({ ...current, symbol: event.target.value }))} required />
            </label>
            <label>
              Deskripsi
              <input value={form.description ?? ''} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} />
            </label>
          </div>
          <div className="form-actions">
            <Button type="submit" disabled={isSubmitting || !form.name.trim() || !form.symbol.trim()}>
              {isSubmitting ? 'Menyimpan...' : 'Simpan satuan'}
            </Button>
            <Button type="button" variant="ghost" onClick={closeForm}>
              Batal
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

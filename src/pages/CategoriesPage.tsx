import { useEffect, useMemo, useState } from 'react'
import { Button } from '../components/Button'
import { Card } from '../components/Card'
import { DataTable } from '../components/DataTable'
import { Modal } from '../components/Modal'
import { useToast } from '../components/ToastProvider'
import { posApi, type SaveCategoryInput } from '../services/posApi'
import type { Category, Product } from '../types/pos'

const emptyForm: SaveCategoryInput = {
  name: '',
  description: '',
}

export function CategoriesPage() {
  const [categoryRows, setCategoryRows] = useState<Category[]>([])
  const [productRows, setProductRows] = useState<Product[]>([])
  const [query, setQuery] = useState('')
  const [form, setForm] = useState<SaveCategoryInput>(emptyForm)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const { showToast } = useToast()
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    void loadData()
  }, [])

  async function loadData() {
    const [nextCategories, nextProducts] = await Promise.all([posApi.listCategories(), posApi.listProducts()])
    setCategoryRows(nextCategories)
    setProductRows(nextProducts)
  }

  const filteredCategories = useMemo(() => {
    const normalized = query.toLowerCase().trim()
    return categoryRows.filter((item) => !normalized || item.name.toLowerCase().includes(normalized))
  }, [categoryRows, query])

  function resetForm() {
    setForm(emptyForm)
  }

  function openCreateForm() {
    resetForm()
    setIsFormOpen(true)
  }

  function openEditForm(category: Category) {
    setForm(category)
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
      await posApi.saveCategory(form)
      resetForm()
      setIsFormOpen(false)
      await loadData()
    } catch (saveError) {
      showToast(saveError instanceof Error ? saveError.message : 'Kategori gagal disimpan.', 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleDelete(category: Category) {
    const usedCount = productRows.filter((product) => product.categoryId === category.id).length
    if (usedCount > 0) {
      showToast('Kategori sudah dipakai produk dan tidak dapat dihapus.', 'error')
      return
    }

    if (!window.confirm(`Hapus kategori ${category.name}?`)) {
      return
    }

    try {
      await posApi.deleteCategory(category.id)
      await loadData()
    } catch (deleteError) {
      showToast(deleteError instanceof Error ? deleteError.message : 'Kategori gagal dihapus.', 'error')
    }
  }

  return (
    <div className="page-stack">
      <Card>
        <div className="section-header">
          <div>
            <span className="eyebrow">Master kategori</span>
            <h2>Pengelompokan produk</h2>
          </div>
          <Button type="button" onClick={openCreateForm}>
            Tambah kategori
          </Button>
        </div>
        <div className="toolbar">
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari kategori" />
        </div>
        <DataTable<Category>
          data={filteredCategories}
          pagination
          pageSize={10}
          columns={[
            { key: 'name', header: 'Nama', render: (item) => <strong>{item.name}</strong> },
            { key: 'description', header: 'Deskripsi', render: (item) => item.description ?? '-' },
            { key: 'count', header: 'Produk', align: 'right', render: (item) => productRows.filter((product) => product.categoryId === item.id).length },
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

      <Modal title={form.id ? 'Edit kategori' : 'Tambah kategori'} open={isFormOpen} onClose={closeForm}>
        <form className="form-grid dense-form" onSubmit={handleSubmit}>
          <div className="two-columns">
            <label>
              Nama kategori
              <input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} required />
            </label>
            <label>
              Deskripsi
              <input value={form.description ?? ''} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} />
            </label>
          </div>
          <div className="form-actions">
            <Button type="submit" disabled={isSubmitting || !form.name.trim()}>
              {isSubmitting ? 'Menyimpan...' : 'Simpan kategori'}
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

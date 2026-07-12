import { useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '../components/Button'
import { Card } from '../components/Card'
import { DataTable } from '../components/DataTable'
import { Dropdown } from '../components/Dropdown'
import { Modal } from '../components/Modal'
import { NumberInput } from '../components/NumberInput'
import { useToast } from '../components/ToastProvider'
import { posApi, type SaveProductInput, type SaveProductUnitInput } from '../services/posApi'
import type { Category, Product, Unit } from '../types/pos'
import { formatCurrency, formatQuantity, quantityStep } from '../utils/format'
import { productImageSrc, productInitial } from '../utils/productImage'

type ProductUnitForm = SaveProductUnitInput & {
  rowId: string
}

type ProductForm = Omit<SaveProductInput, 'units'> & {
  units: ProductUnitForm[]
}

const NO_CATEGORY_VALUE = '__no_category__'
const NO_BASE_UNIT_VALUE = '__no_base_unit__'

function rowId() {
  return `row-${Date.now()}-${Math.round(Math.random() * 1000)}`
}

function createEmptyForm(baseUnitId = ''): ProductForm {
  return {
    name: '',
    sku: '',
    categoryId: '',
    baseUnitId,
    stockBase: 0,
    minimumStock: 0,
    purchasePriceBase: 0,
    defaultSellingPriceBase: 0,
    isActive: true,
    imagePath: '',
    imageDataUrl: '',
    imageFileName: '',
    removeImage: false,
    units: baseUnitId
      ? [
          {
            rowId: rowId(),
            unitId: baseUnitId,
            conversionToBase: 1,
            sellingPrice: 0,
            barcode: '',
            isBaseUnit: true,
            isDefault: true,
          },
        ]
      : [],
  }
}

function productToForm(product: Product): ProductForm {
  return {
    id: product.id,
    name: product.name,
    sku: product.sku,
    categoryId: product.categoryId,
    baseUnitId: product.baseUnitId,
    stockBase: product.stockBase,
    minimumStock: product.minimumStock,
    purchasePriceBase: product.purchasePriceBase,
    defaultSellingPriceBase: product.defaultSellingPriceBase,
    isActive: product.isActive,
    imagePath: product.imagePath ?? '',
    imageDataUrl: '',
    imageFileName: '',
    removeImage: false,
    units: product.units.map((unit) => ({
      rowId: rowId(),
      id: unit.id,
      unitId: unit.unitId,
      conversionToBase: unit.conversionToBase,
      sellingPrice: unit.sellingPrice,
      barcode: unit.barcode ?? '',
      isBaseUnit: unit.isBaseUnit,
      isDefault: unit.isDefault,
    })),
  }
}

function formToInput(form: ProductForm): SaveProductInput {
  const units = form.units.map((unit) => ({
    id: unit.id,
    unitId: unit.unitId,
    conversionToBase: unit.unitId === form.baseUnitId ? 1 : Number(unit.conversionToBase),
    sellingPrice: unit.unitId === form.baseUnitId ? Number(form.defaultSellingPriceBase) : Number(unit.sellingPrice),
    barcode: unit.barcode,
    isBaseUnit: unit.unitId === form.baseUnitId,
    isDefault: unit.isDefault,
  }))

  return {
    id: form.id,
    name: form.name,
    sku: form.sku,
    categoryId: form.categoryId,
    baseUnitId: form.baseUnitId,
    stockBase: Number(form.stockBase),
    minimumStock: Number(form.minimumStock),
    purchasePriceBase: Number(form.purchasePriceBase),
    defaultSellingPriceBase: Number(form.defaultSellingPriceBase),
    isActive: form.isActive,
    imagePath: form.imagePath,
    imageDataUrl: form.imageDataUrl,
    imageFileName: form.imageFileName,
    removeImage: form.removeImage,
    units,
  }
}

export function ProductsPage() {
  const [productRows, setProductRows] = useState<Product[]>([])
  const [categoryRows, setCategoryRows] = useState<Category[]>([])
  const [unitRows, setUnitRows] = useState<Unit[]>([])
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('all')
  const [sortBy, setSortBy] = useState('name-asc')
  const [form, setForm] = useState<ProductForm>(createEmptyForm())
  const [isFormOpen, setIsFormOpen] = useState(false)
  const { showToast } = useToast()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [autoFocusBarcodeRow, setAutoFocusBarcodeRow] = useState('')
  const scanBufferRef = useRef('')
  const scanTimerRef = useRef<number | null>(null)
  const formRef = useRef(form)
  formRef.current = form
  const unitRowsRef = useRef(unitRows)
  unitRowsRef.current = unitRows

  useEffect(() => {
    void loadData()
  }, [])

  async function loadData() {
    const [nextProducts, nextCategories, nextUnits] = await Promise.all([posApi.listProducts(), posApi.listCategories(), posApi.listUnits()])
    setProductRows(nextProducts)
    setCategoryRows(nextCategories)
    setUnitRows(nextUnits)
    setForm((current) => (current.baseUnitId ? current : createEmptyForm(nextUnits[0]?.id ?? '')))
  }

  useEffect(() => {
    if (!isFormOpen) return

    function handleScanKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement
      const tag = target.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
        scanBufferRef.current = ''
        return
      }

      if (event.key === 'Enter') {
        const barcode = scanBufferRef.current
        scanBufferRef.current = ''
        if (scanTimerRef.current) {
          clearTimeout(scanTimerRef.current)
          scanTimerRef.current = null
        }
        if (barcode.length < 3) return

        event.preventDefault()
        const currentForm = formRef.current
        const emptyRow = [...currentForm.units].reverse().find((u) => !u.barcode?.trim())

        if (emptyRow) {
          updateUnitRow(emptyRow.rowId, { barcode })
        } else {
          const availableUnit = unitRowsRef.current.find(
            (u) => !currentForm.units.some((r) => r.unitId === u.id),
          )
          if (availableUnit) {
            const newRowId = rowId()
            setForm((current) => ({
              ...current,
              units: [
                ...current.units,
                {
                  rowId: newRowId,
                  unitId: availableUnit.id,
                  conversionToBase: availableUnit.id === current.baseUnitId ? 1 : 1,
                  sellingPrice: 0,
                  barcode,
                  isBaseUnit: availableUnit.id === current.baseUnitId,
                  isDefault: false,
                },
              ],
            }))
            setAutoFocusBarcodeRow(newRowId)
          }
        }
        return
      }

      if (event.key.length === 1) {
        scanBufferRef.current += event.key
        if (scanTimerRef.current) clearTimeout(scanTimerRef.current)
        scanTimerRef.current = window.setTimeout(() => {
          scanBufferRef.current = ''
        }, 500)
      } else {
        scanBufferRef.current = ''
      }
    }

    window.addEventListener('keydown', handleScanKey)
    return () => {
      window.removeEventListener('keydown', handleScanKey)
      if (scanTimerRef.current) {
        clearTimeout(scanTimerRef.current)
        scanTimerRef.current = null
      }
      scanBufferRef.current = ''
    }
  }, [isFormOpen])

  const filteredProducts = useMemo(() => {
    const normalized = query.toLowerCase().trim()
    return productRows
      .filter((product) => {
        const matchesQuery = !normalized || product.name.toLowerCase().includes(normalized) || product.sku.toLowerCase().includes(normalized)
        const matchesCategory = category === 'all' || product.categoryId === category
        return matchesQuery && matchesCategory
      })
      .sort((left, right) => {
        switch (sortBy) {
          case 'name-desc':
            return right.name.localeCompare(left.name, 'id')
          case 'sku-asc':
            return (left.sku || '').localeCompare(right.sku || '', 'id')
          case 'stock-asc':
            return left.stockBase - right.stockBase
          case 'stock-desc':
            return right.stockBase - left.stockBase
          case 'price-asc':
            return left.defaultSellingPriceBase - right.defaultSellingPriceBase
          case 'price-desc':
            return right.defaultSellingPriceBase - left.defaultSellingPriceBase
          case 'active-first':
            return Number(right.isActive) - Number(left.isActive)
          case 'inactive-first':
            return Number(left.isActive) - Number(right.isActive)
          case 'name-asc':
          default:
            return left.name.localeCompare(right.name, 'id')
        }
      })
  }, [category, productRows, query, sortBy])

  function resetForm() {
    setForm(createEmptyForm(unitRows[0]?.id ?? ''))
  }

  function openCreateForm() {
    resetForm()
    setIsFormOpen(true)
  }

  function openEditForm(product: Product) {
    setForm(productToForm(product))
    setIsFormOpen(true)
  }

  function closeForm() {
    setIsFormOpen(false)
    resetForm()
  }

  function updateForm<K extends keyof ProductForm>(key: K, value: ProductForm[K]) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  function handleImageChange(file?: File) {
    if (!file) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      showToast('Foto produk harus JPG, PNG, atau WebP.', 'error')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      showToast('Ukuran foto produk maksimal 5 MB.', 'error')
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      setForm((current) => ({
        ...current,
        imageDataUrl: String(reader.result ?? ''),
        imageFileName: file.name,
        removeImage: false,
      }))
    }
    reader.onerror = () => showToast('Foto produk gagal dibaca.', 'error')
    reader.readAsDataURL(file)
  }

  function removeImage() {
    setForm((current) => ({
      ...current,
      imagePath: '',
      imageDataUrl: '',
      imageFileName: '',
      removeImage: true,
    }))
  }

  function updateDefaultSellingPrice(value: number) {
    setForm((current) => ({
      ...current,
      defaultSellingPriceBase: value,
      units: current.units.map((unit) =>
        unit.unitId === current.baseUnitId ? { ...unit, sellingPrice: value, conversionToBase: 1, isBaseUnit: true } : unit,
      ),
    }))
  }

  function updateBaseUnit(baseUnitId: string) {
    setForm((current) => {
      if (!baseUnitId) {
        return { ...current, baseUnitId: '', units: [] }
      }

      if (current.units.length === 0) {
        return {
          ...current,
          baseUnitId,
          units: [
            {
              rowId: rowId(),
              unitId: baseUnitId,
              conversionToBase: 1,
              sellingPrice: current.defaultSellingPriceBase,
              barcode: '',
              isBaseUnit: true,
              isDefault: true,
            },
          ],
        }
      }

      const existingBaseRow = current.units.find((unit) => unit.unitId === current.baseUnitId) ?? current.units.find((unit) => unit.isBaseUnit) ?? current.units[0]
      const targetRow = current.units.find((unit) => unit.unitId === baseUnitId)
      const targetRowId = targetRow?.rowId ?? existingBaseRow.rowId
      const hasDefaultAfterChange = current.units.some((unit) => unit.rowId !== targetRowId && unit.isDefault)

      const units = current.units
        .filter((unit) => unit.rowId !== existingBaseRow.rowId || unit.rowId === targetRowId)
        .map((unit) => {
          if (unit.rowId !== targetRowId) {
            return { ...unit, isBaseUnit: false }
          }

          return {
            ...unit,
            unitId: baseUnitId,
            conversionToBase: 1,
            sellingPrice: current.defaultSellingPriceBase,
            isBaseUnit: true,
            isDefault: unit.isDefault || !hasDefaultAfterChange,
          }
        })

      return {
        ...current,
        baseUnitId,
        units,
      }
    })
  }

  function updateUnitRow(rowIdValue: string, patch: Partial<ProductUnitForm>) {
    setForm((current) => ({
      ...current,
      units: current.units.map((unit) => {
        if (unit.rowId !== rowIdValue) {
          return patch.isDefault ? { ...unit, isDefault: false } : unit
        }
        const nextUnit = { ...unit, ...patch }
        return {
          ...nextUnit,
          conversionToBase: nextUnit.unitId === current.baseUnitId ? 1 : nextUnit.conversionToBase,
          isBaseUnit: nextUnit.unitId === current.baseUnitId,
        }
      }),
    }))
  }

  function addUnitRow() {
    const availableUnit = unitRows.find((unit) => !form.units.some((row) => row.unitId === unit.id))
    if (!availableUnit) {
      showToast('Semua satuan sudah ditambahkan ke produk ini.', 'error')
      return
    }

    const newRowId = rowId()
    setAutoFocusBarcodeRow(newRowId)
    setForm((current) => ({
      ...current,
      units: [
        ...current.units,
        {
          rowId: newRowId,
          unitId: availableUnit.id,
          conversionToBase: availableUnit.id === current.baseUnitId ? 1 : 1,
          sellingPrice: 0,
          barcode: '',
          isBaseUnit: availableUnit.id === current.baseUnitId,
          isDefault: current.units.length === 0,
        },
      ],
    }))
  }

  function removeUnitRow(rowIdValue: string) {
    setForm((current) => {
      const target = current.units.find((unit) => unit.rowId === rowIdValue)
      if (target?.unitId === current.baseUnitId) {
        showToast('Satuan dasar tidak boleh dihapus dari satuan jual.', 'error')
        return current
      }

      return {
        ...current,
        units: current.units.filter((unit) => unit.rowId !== rowIdValue),
      }
    })
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setIsSubmitting(true)

    try {
      await posApi.saveProduct(formToInput(form))
      resetForm()
      setIsFormOpen(false)
      await loadData()
    } catch (saveError) {
      showToast(saveError instanceof Error ? saveError.message : 'Produk gagal disimpan.', 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleDelete(product: Product) {
    if (!window.confirm(`Produk "${product.name}" akan dihapus permanen jika belum punya riwayat transaksi/stok. Jika sudah punya riwayat, produk hanya akan dinonaktifkan agar histori tetap aman.\n\nLanjutkan?`)) {
      return
    }

    try {
      const result = await posApi.deleteProduct(product.id)
      await loadData()
      showToast(result.message, 'success')
    } catch (deleteError) {
      showToast(deleteError instanceof Error ? deleteError.message : 'Produk gagal dihapus.', 'error')
    }
  }

  const formImageSrc = form.imageDataUrl || productImageSrc(form.imagePath)

  return (
    <div className="page-stack">
      <Card>
        <div className="section-header">
          <div>
            <span className="eyebrow">Master produk</span>
            <h2>Produk dan satuan bertingkat</h2>
          </div>
          <Button type="button" onClick={openCreateForm}>
            Tambah produk
          </Button>
        </div>

        <div className="toolbar">
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari nama produk atau SKU" />
          <Dropdown
            value={category}
            onValueChange={setCategory}
            options={[
              { value: 'all', label: 'Semua kategori' },
              ...categoryRows.map((item) => ({ value: item.id, label: item.name })),
            ]}
          />
          <Dropdown
            value={sortBy}
            onValueChange={setSortBy}
            options={[
              { value: 'name-asc', label: 'Urut: Nama A-Z' },
              { value: 'name-desc', label: 'Urut: Nama Z-A' },
              { value: 'sku-asc', label: 'Urut: SKU A-Z' },
              { value: 'stock-asc', label: 'Urut: Stok paling sedikit' },
              { value: 'stock-desc', label: 'Urut: Stok paling banyak' },
              { value: 'price-asc', label: 'Urut: Harga termurah' },
              { value: 'price-desc', label: 'Urut: Harga termahal' },
              { value: 'active-first', label: 'Urut: Aktif dulu' },
              { value: 'inactive-first', label: 'Urut: Nonaktif dulu' },
            ]}
          />
        </div>

        <DataTable<Product>
          data={filteredProducts}
          pagination
          pageSize={10}
          columns={[
            {
              key: 'name',
              header: 'Produk',
              render: (product) => {
                const imageSrc = productImageSrc(product.imagePath)
                return (
                  <div className="product-name-cell">
                    <div className="product-thumb small-thumb">
                      {imageSrc ? <img src={imageSrc} alt={product.name} /> : <span>{productInitial(product.name)}</span>}
                    </div>
                    <div className="cell-title"><strong>{product.name}</strong><span>{product.sku || '-'}</span></div>
                  </div>
                )
              },
            },
            { key: 'category', header: 'Kategori', render: (product) => product.categoryName || '-' },
            { key: 'stock', header: 'Stok dasar', align: 'right', render: (product) => `${formatQuantity(product.stockBase)} ${product.baseUnitName}` },
            { key: 'price', header: 'Harga dasar', align: 'right', render: (product) => formatCurrency(product.defaultSellingPriceBase) },
            {
              key: 'units',
              header: 'Satuan jual',
              render: (product) => (
                <div className="unit-chips">
                  {product.units.map((unit) => (
                    <span key={unit.id}>
                      {unit.isBaseUnit
                        ? `${unit.unitName} (${unit.isDefault ? 'dasar, default' : 'dasar'})`
                        : `1 ${unit.unitName} = ${formatQuantity(unit.conversionToBase)} ${product.baseUnitName}${unit.isDefault ? ' (default)' : ''}`}
                    </span>
                  ))}
                </div>
              ),
            },
            { key: 'status', header: 'Status', render: (product) => <span className={product.isActive ? 'status-pill ok' : 'status-pill warn'}>{product.isActive ? 'Aktif' : 'Nonaktif'}</span> },
            {
              key: 'action',
              header: 'Aksi',
              align: 'right',
              render: (product) => (
                <div className="inline-actions">
                  <Button type="button" variant="secondary" size="sm" onClick={() => openEditForm(product)}>
                    Edit
                  </Button>
                  <Button type="button" variant="danger" size="sm" onClick={() => void handleDelete(product)}>
                    Hapus
                  </Button>
                </div>
              ),
            },
          ]}
        />
      </Card>

      <Modal title={form.id ? 'Edit produk' : 'Tambah produk baru'} open={isFormOpen} onClose={closeForm} wide>
        <form className="form-grid dense-form product-form" onSubmit={handleSubmit}>
          <div className="two-columns">
            <label>Nama produk<input value={form.name} onChange={(event) => updateForm('name', event.target.value)} placeholder="Contoh: Keramik 40x40" required /></label>
            <label>SKU<input value={form.sku ?? ''} onChange={(event) => updateForm('sku', event.target.value)} placeholder="KRM001" /></label>
          </div>
          <div className="product-image-editor">
            <div className="product-image-preview">
              {formImageSrc ? <img src={formImageSrc} alt={form.name || 'Foto produk'} /> : <span>{productInitial(form.name)}</span>}
            </div>
            <div className="product-image-controls">
              <strong>Foto produk</strong>
              <span>Ditampilkan di daftar produk dan kasir. Format JPG, PNG, atau WebP maksimal 5 MB.</span>
              <div className="form-actions">
                <label className="file-button">
                  Pilih foto
                  <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => handleImageChange(event.target.files?.[0])} />
                </label>
                {formImageSrc ? <Button type="button" variant="ghost" onClick={removeImage}>Hapus foto</Button> : null}
              </div>
            </div>
          </div>
          <div className="three-columns">
            <label>
              Kategori
              <Dropdown
                value={form.categoryId || NO_CATEGORY_VALUE}
                onValueChange={(value) => updateForm('categoryId', value === NO_CATEGORY_VALUE ? '' : value)}
                options={[
                  { value: NO_CATEGORY_VALUE, label: 'Tanpa kategori' },
                  ...categoryRows.map((item) => ({ value: item.id, label: item.name })),
                ]}
              />
            </label>
            <label>
              Satuan dasar
              <Dropdown
                value={form.baseUnitId || NO_BASE_UNIT_VALUE}
                onValueChange={(value) => updateBaseUnit(value === NO_BASE_UNIT_VALUE ? '' : value)}
                options={[
                  { value: NO_BASE_UNIT_VALUE, label: 'Pilih satuan' },
                  ...unitRows.map((item) => ({ value: item.id, label: item.symbol })),
                ]}
              />
            </label>
            <label>Stok awal/dasar<NumberInput step={quantityStep(unitRows.find((unit) => unit.id === form.baseUnitId)?.symbol)} value={form.stockBase} onValueChange={(value) => updateForm('stockBase', value)} /></label>
          </div>
          <div className="three-columns">
            <label>Harga modal dasar<NumberInput value={form.purchasePriceBase} onValueChange={(value) => updateForm('purchasePriceBase', value)} /></label>
            <label>Harga jual dasar<NumberInput value={form.defaultSellingPriceBase} onValueChange={updateDefaultSellingPrice} /></label>
            <label>Minimum stok<NumberInput step={quantityStep(unitRows.find((unit) => unit.id === form.baseUnitId)?.symbol)} value={form.minimumStock} onValueChange={(value) => updateForm('minimumStock', value)} /></label>
          </div>
          <label className="checkbox-line">
            <input type="checkbox" checked={form.isActive} onChange={(event) => updateForm('isActive', event.target.checked)} />
            Produk aktif dan muncul di kasir
          </label>

          <div className="section-header compact-header">
            <div>
              <span className="eyebrow">Satuan jual</span>
              <h2>Konversi dan harga per satuan</h2>
            </div>
            <Button type="button" variant="secondary" onClick={addUnitRow} disabled={!form.baseUnitId}>
              Tambah satuan jual
            </Button>
          </div>
          <p style={{ margin: '0', fontSize: '0.875rem', color: 'var(--muted)' }}>
            Satuan dasar adalah satuan terkecil untuk perhitungan stok. Satuan jual adalah satuan yang bisa dipilih saat transaksi.
          </p>

          <div className="unit-editor-list">
            {form.units.length === 0 ? <div className="empty-state">Pilih satuan dasar untuk membuat satuan jual.</div> : null}
            {form.units.map((unitRow) => {
              const isBaseUnit = unitRow.unitId === form.baseUnitId
              const selectedUnit = unitRows.find((u) => u.id === unitRow.unitId)
              const baseUnit = unitRows.find((u) => u.id === form.baseUnitId)
              const baseUnitSymbol = baseUnit?.symbol ?? ''
              const selectedUnitSymbol = selectedUnit?.symbol ?? ''

              return (
                <div className={`unit-editor-row ${isBaseUnit ? 'is-base-unit' : ''}`} key={unitRow.rowId}>
                  {isBaseUnit && <span className="unit-row-badge">Satuan Dasar</span>}
                  <label className="unit-field">
                    Satuan
                    <Dropdown
                      value={unitRow.unitId}
                      onValueChange={(value) => updateUnitRow(unitRow.rowId, { unitId: value })}
                      options={unitRows.map((unit) => ({ value: unit.id, label: unit.symbol }))}
                    />
                  </label>
                  {isBaseUnit ? (
                    <label className="unit-field">
                      Konversi
                      <input type="number" value="1" disabled />
                      <span className="unit-field-helper">
                        Selalu bernilai 1
                      </span>
                    </label>
                  ) : (
                    <label className="unit-field">
                      Konversi
                      <div className="unit-conversion-formula">
                        <span>1 {selectedUnitSymbol} =</span>
                        <NumberInput
                          step="1"
                          value={unitRow.conversionToBase}
                          onValueChange={(value) => updateUnitRow(unitRow.rowId, { conversionToBase: value })}
                        />
                        <span>{baseUnitSymbol}</span>
                      </div>
                    </label>
                  )}
                  <label className="unit-field">
                    Harga jual
                    <NumberInput value={unitRow.sellingPrice} onValueChange={(value) => updateUnitRow(unitRow.rowId, { sellingPrice: value })} />
                  </label>
                  <label className="unit-field unit-row-barcode">
                    Barcode
                    <input
                      value={unitRow.barcode ?? ''}
                      onChange={(event) => updateUnitRow(unitRow.rowId, { barcode: event.target.value })}
                      autoFocus={unitRow.rowId === autoFocusBarcodeRow}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault()
                          const formEl = event.currentTarget.closest('form')
                          if (!formEl) return
                          const focusables = Array.from(formEl.querySelectorAll<HTMLElement>('input, select, textarea, button'))
                          const idx = focusables.indexOf(event.currentTarget)
                          const next = focusables[idx + 1]
                          if (next) next.focus()
                        }
                      }}
                    />
                  </label>
                  <div className="unit-row-actions">
                    <label className="checkbox-line small-checkbox">
                      <input type="checkbox" checked={unitRow.isDefault} onChange={(event) => updateUnitRow(unitRow.rowId, { isDefault: event.target.checked })} />
                      Default
                    </label>
                    <Button type="button" variant="danger" size="sm" onClick={() => removeUnitRow(unitRow.rowId)} disabled={isBaseUnit}>
                      Hapus
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="form-actions">
            <Button type="submit" disabled={isSubmitting || !form.name.trim() || !form.baseUnitId || form.units.length === 0}>
              {isSubmitting ? 'Menyimpan...' : 'Simpan produk'}
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

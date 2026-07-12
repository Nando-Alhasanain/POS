import { useEffect, useMemo, useState } from 'react'
import { Button } from '../components/Button'
import { Card } from '../components/Card'
import { DataTable } from '../components/DataTable'
import { Dropdown } from '../components/Dropdown'
import { Modal } from '../components/Modal'
import { NumberInput } from '../components/NumberInput'
import { posApi } from '../services/posApi'
import type { AppUser, Product, StockMovement } from '../types/pos'
import { formatDateTime, formatQuantity, quantityStep } from '../utils/format'
import { useToast } from '../components/ToastProvider'

type StockPageProps = {
  user: AppUser
}

type StockInForm = {
  productId: string
  productUnitId: string
  qty: number
  note: string
}

type AdjustmentForm = {
  productId: string
  physicalStockBase: number
  note: string
}

const NO_PRODUCT_VALUE = '__no_product__'
const NO_UNIT_VALUE = '__no_unit__'

export function StockPage({ user }: StockPageProps) {
  const [productRows, setProductRows] = useState<Product[]>([])
  const [movementRows, setMovementRows] = useState<StockMovement[]>([])
  const [stockInForm, setStockInForm] = useState<StockInForm>({ productId: '', productUnitId: '', qty: 0, note: '' })
  const [adjustmentForm, setAdjustmentForm] = useState<AdjustmentForm>({ productId: '', physicalStockBase: 0, note: '' })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { showToast } = useToast()
  const [isStockInOpen, setIsStockInOpen] = useState(false)
  const [isAdjustmentOpen, setIsAdjustmentOpen] = useState(false)

  useEffect(() => {
    void loadData()
  }, [])

  async function loadData() {
    const [nextProducts, nextMovements] = await Promise.all([posApi.listProducts(), posApi.listStockMovements()])
    setProductRows(nextProducts)
    setMovementRows(nextMovements)

    setStockInForm((current) => {
      const product = nextProducts.find((item) => item.id === current.productId) ?? nextProducts[0]
      const unit = product?.units.find((item) => item.id === current.productUnitId) ?? product?.units.find((item) => item.isDefault) ?? product?.units[0]
      return {
        ...current,
        productId: product?.id ?? '',
        productUnitId: unit?.id ?? '',
      }
    })

    setAdjustmentForm((current) => {
      const product = nextProducts.find((item) => item.id === current.productId) ?? nextProducts[0]
      return {
        ...current,
        productId: product?.id ?? '',
        physicalStockBase: current.productId ? current.physicalStockBase : product?.stockBase ?? 0,
      }
    })
  }

  const stockInProduct = useMemo(
    () => productRows.find((product) => product.id === stockInForm.productId),
    [productRows, stockInForm.productId],
  )
  const stockInUnit = stockInProduct?.units.find((unit) => unit.id === stockInForm.productUnitId)
  const stockInQtyBase = stockInUnit ? stockInForm.qty * stockInUnit.conversionToBase : 0
  const adjustmentProduct = productRows.find((product) => product.id === adjustmentForm.productId)
  const adjustmentDiff = adjustmentProduct ? adjustmentForm.physicalStockBase - adjustmentProduct.stockBase : 0
  const lowStockProducts = productRows.filter((product) => product.stockBase <= product.minimumStock)
  const isAdmin = user.role === 'admin'

  function updateStockInProduct(productId: string) {
    const product = productRows.find((item) => item.id === productId)
    const unit = product?.units.find((item) => item.isDefault) ?? product?.units[0]
    setStockInForm((current) => ({
      ...current,
      productId,
      productUnitId: unit?.id ?? '',
    }))
  }

  function updateAdjustmentProduct(productId: string) {
    const product = productRows.find((item) => item.id === productId)
    setAdjustmentForm((current) => ({
      ...current,
      productId,
      physicalStockBase: product?.stockBase ?? 0,
    }))
  }

  function openAdjustmentForProduct(product: Product) {
    setAdjustmentForm({ productId: product.id, physicalStockBase: product.stockBase, note: '' })
    setIsAdjustmentOpen(true)
  }

  async function handleStockIn(event: React.FormEvent) {
    event.preventDefault()
    setIsSubmitting(true)

    try {
      await posApi.addStock({
        productId: stockInForm.productId,
        productUnitId: stockInForm.productUnitId,
        qty: stockInForm.qty,
        note: stockInForm.note,
        createdBy: user.id,
      })
      showToast('Stok masuk berhasil disimpan.', 'success')
      setStockInForm((current) => ({ ...current, qty: 0, note: '' }))
      setIsStockInOpen(false)
      await loadData()
    } catch (stockError) {
      showToast(stockError instanceof Error ? stockError.message : 'Stok masuk gagal disimpan.', 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleAdjustment(event: React.FormEvent) {
    event.preventDefault()
    setIsSubmitting(true)

    try {
      await posApi.adjustStock({
        productId: adjustmentForm.productId,
        physicalStockBase: adjustmentForm.physicalStockBase,
        note: adjustmentForm.note,
        createdBy: user.id,
      })
      showToast('Penyesuaian stok berhasil disimpan.', 'success')
      setAdjustmentForm((current) => ({ ...current, note: '' }))
      setIsAdjustmentOpen(false)
      await loadData()
    } catch (adjustError) {
      showToast(adjustError instanceof Error ? adjustError.message : 'Penyesuaian stok gagal disimpan.', 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="page-stack">


      <Modal title="Stok masuk" open={isStockInOpen} onClose={() => setIsStockInOpen(false)}>
        <form className="form-grid dense-form" onSubmit={handleStockIn}>
          <label>
            Produk
            <Dropdown
              value={stockInForm.productId || NO_PRODUCT_VALUE}
              onValueChange={(value) => updateStockInProduct(value === NO_PRODUCT_VALUE ? '' : value)}
              options={[
                { value: NO_PRODUCT_VALUE, label: 'Pilih produk', disabled: productRows.length > 0 },
                ...productRows.map((product) => ({ value: product.id, label: product.name })),
              ]}
            />
          </label>
          <div className="two-columns">
            <label>
              Satuan
              <Dropdown
                value={stockInForm.productUnitId || NO_UNIT_VALUE}
                onValueChange={(value) => setStockInForm((current) => ({ ...current, productUnitId: value === NO_UNIT_VALUE ? '' : value }))}
                options={[
                  { value: NO_UNIT_VALUE, label: 'Pilih satuan', disabled: Boolean(stockInProduct?.units.length) },
                  ...(stockInProduct?.units.map((unit) => ({ value: unit.id, label: unit.unitName })) ?? []),
                ]}
              />
            </label>
            <label>
              Qty
              <NumberInput step={quantityStep(stockInUnit?.unitName)} min="0" value={stockInForm.qty} onValueChange={(value) => setStockInForm((current) => ({ ...current, qty: value }))} />
            </label>
          </div>
          <div className="form-note">
            Konversi: {formatQuantity(stockInForm.qty || 0)} {stockInUnit?.unitName ?? '-'} = {formatQuantity(stockInQtyBase)} {stockInProduct?.baseUnitName ?? 'satuan dasar'}
          </div>
          <label>
            Catatan
            <textarea rows={3} value={stockInForm.note} onChange={(event) => setStockInForm((current) => ({ ...current, note: event.target.value }))} placeholder="Contoh: Stok masuk dari supplier" />
          </label>
          <div className="form-actions">
            <Button type="submit" disabled={!isAdmin || isSubmitting || !stockInForm.productId || !stockInForm.productUnitId || stockInForm.qty <= 0}>
              {isSubmitting ? 'Menyimpan...' : 'Simpan stok masuk'}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setIsStockInOpen(false)}>
              Batal
            </Button>
          </div>
        </form>
      </Modal>

      <Modal title="Penyesuaian stok" open={isAdjustmentOpen} onClose={() => setIsAdjustmentOpen(false)}>
        <form className="form-grid dense-form" onSubmit={handleAdjustment}>
          <label>
            Produk
            <Dropdown
              value={adjustmentForm.productId || NO_PRODUCT_VALUE}
              onValueChange={(value) => updateAdjustmentProduct(value === NO_PRODUCT_VALUE ? '' : value)}
              options={[
                { value: NO_PRODUCT_VALUE, label: 'Pilih produk', disabled: productRows.length > 0 },
                ...productRows.map((product) => ({ value: product.id, label: product.name })),
              ]}
            />
          </label>
          <div className="two-columns">
            <label>
              Stok fisik ({adjustmentProduct?.baseUnitName ?? 'satuan dasar'})
              <NumberInput step={quantityStep(adjustmentProduct?.baseUnitName)} min="0" value={adjustmentForm.physicalStockBase} onValueChange={(value) => setAdjustmentForm((current) => ({ ...current, physicalStockBase: value }))} />
            </label>
            <label>
              Alasan
              <input value={adjustmentForm.note} onChange={(event) => setAdjustmentForm((current) => ({ ...current, note: event.target.value }))} placeholder="Wajib diisi" />
            </label>
          </div>
          <div className="form-note">
            Stok sistem: {formatQuantity(adjustmentProduct?.stockBase ?? 0)} {adjustmentProduct?.baseUnitName ?? ''}. Selisih: {formatQuantity(adjustmentDiff)} {adjustmentProduct?.baseUnitName ?? ''}.
          </div>
          <div className="form-actions">
            <Button type="submit" variant="secondary" disabled={!isAdmin || isSubmitting || !adjustmentForm.productId || adjustmentForm.physicalStockBase < 0 || !adjustmentForm.note.trim()}>
              {isSubmitting ? 'Menyimpan...' : 'Simpan adjustment'}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setIsAdjustmentOpen(false)}>
              Batal
            </Button>
          </div>
        </form>
      </Modal>

      <Card>
        <div className="section-header">
          <div>
            <span className="eyebrow">Ringkasan stok</span>
            <h2>{lowStockProducts.length} produk stok rendah</h2>
          </div>
          <Button type="button" onClick={() => setIsStockInOpen(true)} disabled={!isAdmin || productRows.length === 0}>
            Tambah stok masuk
          </Button>
        </div>
        {!isAdmin ? <div className="form-note table-alert">Kasir hanya dapat melihat stok, tidak dapat menambah stok.</div> : null}
        <DataTable<Product>
          data={productRows}
          pagination
          pageSize={10}
          columns={[
            { key: 'name', header: 'Produk', render: (product) => <div className="cell-title"><strong>{product.name}</strong><span>{product.sku || '-'}</span></div> },
            { key: 'base', header: 'Satuan dasar', render: (product) => product.baseUnitName },
            { key: 'stock', header: 'Stok', align: 'right', render: (product) => `${formatQuantity(product.stockBase)} ${product.baseUnitName}` },
            { key: 'minimum', header: 'Minimum', align: 'right', render: (product) => `${formatQuantity(product.minimumStock)} ${product.baseUnitName}` },
            { key: 'status', header: 'Status', render: (product) => <span className={product.stockBase <= product.minimumStock ? 'status-pill warn' : 'status-pill ok'}>{product.stockBase <= product.minimumStock ? 'Rendah' : 'Aman'}</span> },
            {
              key: 'action',
              header: 'Aksi',
              align: 'right',
              render: (product) => (
                <Button type="button" variant="primary" size="sm" onClick={() => openAdjustmentForProduct(product)} disabled={!isAdmin}>
                  Adjustment
                </Button>
              ),
            },
          ]}
        />
      </Card>

      <Card>
        <div className="section-header">
          <div>
            <span className="eyebrow">Riwayat stok</span>
            <h2>Pergerakan stok</h2>
          </div>
        </div>
        <DataTable<StockMovement>
          data={movementRows}
          pagination
          pageSize={15}
          columns={[
            { key: 'date', header: 'Tanggal', render: (movement) => formatDateTime(movement.createdAt) },
            { key: 'product', header: 'Produk', render: (movement) => movement.productName },
            { key: 'type', header: 'Type', render: (movement) => <span className={movement.movementType === 'ADJUSTMENT' ? 'status-pill warn' : 'status-pill ok'}>{movement.movementType}</span> },
            { key: 'qty', header: 'Qty', align: 'right', render: (movement) => `${formatQuantity(movement.qty)} ${movement.unitName ?? ''}` },
            { key: 'base', header: 'Qty dasar', align: 'right', render: (movement) => formatQuantity(movement.qtyBase) },
            { key: 'before', header: 'Sebelum', align: 'right', render: (movement) => formatQuantity(movement.stockBefore) },
            { key: 'after', header: 'Sesudah', align: 'right', render: (movement) => formatQuantity(movement.stockAfter) },
            { key: 'note', header: 'Catatan', render: (movement) => movement.note ?? '-' },
          ]}
        />
      </Card>
    </div>
  )
}

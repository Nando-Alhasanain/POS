import { useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '../components/Button'
import { Card } from '../components/Card'
import { Dropdown } from '../components/Dropdown'
import { Modal } from '../components/Modal'
import { NumberInput } from '../components/NumberInput'
import { ReceiptPreview } from '../components/ReceiptPreview'
import { useToast } from '../components/ToastProvider'
import { posApi } from '../services/posApi'
import type { AppUser, CartItem, Category, PaymentMethod, Product, Sale, StoreSettings } from '../types/pos'
import { formatCurrency, formatQuantity, quantityStep } from '../utils/format'
import { productImageSrc, productInitial } from '../utils/productImage'

type SalesPageProps = {
  user: AppUser
  latestSale?: Sale
  onCompleteSale: (sale: Sale) => void
}

const paymentMethods: PaymentMethod[] = ['CASH', 'TRANSFER', 'QRIS', 'DEBIT', 'CREDIT', 'OTHER']
const paymentShortcuts = [
  { label: '5K', value: 5_000 },
  { label: '10K', value: 10_000 },
  { label: '20K', value: 20_000 },
  { label: '50K', value: 50_000 },
  { label: '100K', value: 100_000 },
]

function makeCartItem(product: Product, unitId?: string): CartItem | null {
  const unit = unitId
    ? product.units.find((item) => item.id === unitId)
    : product.units.find((item) => item.isDefault) ?? product.units[0]
  if (!unit) {
    return null
  }

  return {
    id: `${product.id}-${unit.id}-${Date.now()}`,
    productId: product.id,
    productName: product.name,
    productSku: product.sku,
    baseUnitName: product.baseUnitName,
    selectedUnitId: unit.id,
    unitName: unit.unitName,
    conversionToBase: unit.conversionToBase,
    qty: 1,
    price: unit.sellingPrice,
    stockBase: product.stockBase,
  }
}

export function SalesPage({ user, latestSale, onCompleteSale }: SalesPageProps) {
  const [productRows, setProductRows] = useState<Product[]>([])
  const [categoryRows, setCategoryRows] = useState<Category[]>([])
  const [settings, setSettings] = useState<StoreSettings>({
    storeName: 'POS TOKO',
    storeAddress: '',
    storePhone: '',
    receiptFooter: 'Terima kasih',
    receiptPaperSize: '80mm',
    currency: 'IDR',
  })
  const [query, setQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [sortBy, setSortBy] = useState('name')
  const [cart, setCart] = useState<CartItem[]>([])
  const [isPaymentOpen, setIsPaymentOpen] = useState(false)
  const [isReceiptOpen, setIsReceiptOpen] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH')
  const [paidAmount, setPaidAmount] = useState<number | undefined>(undefined)
  const [discount, setDiscount] = useState(0)
  const [customerName, setCustomerName] = useState('Umum')
  const [receiptSale, setReceiptSale] = useState<Sale | undefined>(latestSale)
  const { showToast } = useToast()
  const [checkoutError, setCheckoutError] = useState('')
  const [isCheckoutSubmitting, setIsCheckoutSubmitting] = useState(false)
  const [isReceiptPrinting, setIsReceiptPrinting] = useState(false)

  const scanBufferRef = useRef('')
  const scanTimerRef = useRef<number | null>(null)
  const productRowsRef = useRef(productRows)
  productRowsRef.current = productRows

  useEffect(() => {
    let isMounted = true

    loadCatalog()
      .then(([nextProducts, nextCategories, nextSettings]) => {
        if (isMounted) {
          setProductRows(nextProducts)
          setCategoryRows(nextCategories)
          setSettings(nextSettings)
        }
      })
      .catch((loadError) => {
        if (isMounted) {
          showToast(loadError instanceof Error ? loadError.message : 'Produk kasir gagal dimuat.', 'error')
        }
      })

    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
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
        const products = productRowsRef.current
        const matchedProduct = products.find((product) =>
          product.units.some((unit) => unit.barcode === barcode),
        )
        if (matchedProduct) {
          const matchedUnit = matchedProduct.units.find((unit) => unit.barcode === barcode)
          addProduct(matchedProduct, matchedUnit?.id)
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
  }, [])

  function loadCatalog() {
    return Promise.all([posApi.listProducts(), posApi.listCategories(), posApi.getStoreSettings()])
  }

  const filteredProducts = useMemo(() => {
    const normalized = query.toLowerCase().trim()
    return productRows
      .filter((product) => {
        const barcodeMatch = product.units.some((unit) => unit.barcode?.includes(normalized))
        const matchesQuery = !normalized ||
          product.name.toLowerCase().includes(normalized) ||
          product.sku.toLowerCase().includes(normalized) ||
          barcodeMatch
        const matchesCategory = categoryFilter === 'all' || product.categoryId === categoryFilter
        return product.isActive && product.units.length > 0 && matchesQuery && matchesCategory
      })
      .sort((left, right) => {
        if (normalized) {
          const leftExactBarcode = left.units.some((unit) => unit.barcode === normalized)
          const rightExactBarcode = right.units.some((unit) => unit.barcode === normalized)
          if (leftExactBarcode !== rightExactBarcode) return leftExactBarcode ? -1 : 1
        }
        switch (sortBy) {
          case 'price-asc':
            return (left.defaultSellingPriceBase || 0) - (right.defaultSellingPriceBase || 0)
          case 'price-desc':
            return (right.defaultSellingPriceBase || 0) - (left.defaultSellingPriceBase || 0)
          case 'stock-asc':
            return (left.stockBase || 0) - (right.stockBase || 0)
          default:
            return left.name.localeCompare(right.name)
        }
      })
      .slice(0, 30)
  }, [productRows, query, categoryFilter, sortBy])

  const subtotal = cart.reduce((sum, item) => sum + item.qty * item.price, 0)
  const hasDiscountError = discount < 0 || discount > subtotal
  const total = Math.max(0, subtotal - discount)
  const paidAmountValue = paidAmount ?? 0
  const isPaidAmountFilled = paidAmount !== undefined
  const isPaymentInsufficient = !isPaidAmountFilled || paidAmountValue < total
  const change = Math.max(0, paidAmountValue - total)
  const stockUsageByProduct = cart.reduce<Record<string, number>>((usage, item) => {
    usage[item.productId] = (usage[item.productId] ?? 0) + item.qty * item.conversionToBase
    return usage
  }, {})
  const hasStockError = Object.entries(stockUsageByProduct).some(([productId, qtyBase]) => {
    const product = productRows.find((item) => item.id === productId)
    return !product || qtyBase > product.stockBase
  })
  const hasPriceError = cart.some((item) => item.price <= 0)
  const hasQtyError = cart.some((item) => item.qty <= 0)

  useEffect(() => {
    function handleGlobalKey(event: KeyboardEvent) {
      if (event.key !== 'F2') return
      event.preventDefault()
      if (cart.length > 0 && !hasStockError && !hasPriceError && !hasQtyError && !isPaymentOpen) {
        openPayment()
      }
    }

    window.addEventListener('keydown', handleGlobalKey)
    return () => window.removeEventListener('keydown', handleGlobalKey)
  }, [cart.length, hasStockError, hasPriceError, hasQtyError, isPaymentOpen])

  function defaultProductPriceValue(product: Product) {
    const unit = product.units.find((item) => item.isDefault) ?? product.units[0]
    return unit ? formatCurrency(unit.sellingPrice) : '-'
  }

  function addProduct(product: Product, unitId?: string) {
    if (product.stockBase <= 0) {
      showToast(`Stok ${product.name} habis.`, 'error')
      return
    }

    const nextItem = makeCartItem(product, unitId)
    if (!nextItem) {
      setCheckoutError('Produk belum memiliki satuan jual.')
      return
    }

    setCheckoutError('')
    setCart((current) => {
      const existingItem = current.find((item) => item.productId === nextItem.productId && item.selectedUnitId === nextItem.selectedUnitId)
      if (!existingItem) {
        return [...current, nextItem]
      }

      return (
        current.map((item) =>
          item.id === existingItem.id
            ? { ...item, qty: item.qty + 1, stockBase: product.stockBase }
            : item,
        )
      )
    })
    setQuery('')
  }

  function updateQty(id: string, qty: number) {
    setCart((current) => current.map((item) => (item.id === id ? { ...item, qty: Math.max(0, qty) } : item)))
  }

  function updateUnit(cartId: string, productId: string, productUnitId: string) {
    const product = productRows.find((item) => item.id === productId)
    const unit = product?.units.find((item) => item.id === productUnitId)
    if (!unit) return

    setCart((current) =>
      current.map((item) =>
        item.id === cartId
          ? {
              ...item,
              selectedUnitId: unit.id,
              unitName: unit.unitName,
              conversionToBase: unit.conversionToBase,
              price: unit.sellingPrice,
            }
          : item,
      ),
    )
  }

  function removeItem(id: string) {
    setCart((current) => current.filter((item) => item.id !== id))
  }

  function openPayment() {
    setPaidAmount(undefined)
    setDiscount(0)
    setCheckoutError('')
    setIsPaymentOpen(true)
  }

  function closePayment() {
    setIsPaymentOpen(false)
    setPaidAmount(undefined)
    setDiscount(0)
    setCheckoutError('')
  }

  function addPaidAmountShortcut(amount: number) {
    setPaidAmount((current) => (current ?? 0) + amount)
  }

  async function completeSale() {
    if (cart.length === 0 || isPaymentInsufficient || hasDiscountError || hasStockError || hasPriceError || hasQtyError) return

    setCheckoutError('')
    setIsCheckoutSubmitting(true)
    try {
      const sale = await posApi.completeSale({
        cashierId: user.id,
        cashierName: user.name,
        customerName,
        paymentMethod,
        paidAmount: paidAmountValue,
        discount,
        items: cart.map((item) => ({
          productId: item.productId,
          productUnitId: item.selectedUnitId,
          qty: item.qty,
        })),
      })

      onCompleteSale(sale)
      setReceiptSale(sale)
      setIsReceiptOpen(true)
      setCart([])
      setPaidAmount(undefined)
      setDiscount(0)
      setIsPaymentOpen(false)
      const [nextProducts] = await loadCatalog()
      setProductRows(nextProducts)
    } catch (saleError) {
      setCheckoutError(saleError instanceof Error ? saleError.message : 'Transaksi gagal disimpan.')
    } finally {
      setIsCheckoutSubmitting(false)
    }
  }

  function closeReceipt() {
    setIsReceiptOpen(false)
    setReceiptSale(undefined)
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

  function handleSearchKey(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      event.preventDefault()
      const normalized = query.toLowerCase().trim()
      if (!normalized) return

      const barcodeMatch = productRows.find((product) =>
        product.units.some((unit) => unit.barcode === normalized),
      )
      if (barcodeMatch) {
        const matchedUnit = barcodeMatch.units.find((unit) => unit.barcode === normalized)
        addProduct(barcodeMatch, matchedUnit?.id)
        return
      }

      if (filteredProducts.length === 1) {
        addProduct(filteredProducts[0])
      }
    } else if (event.key === 'Escape') {
      event.preventDefault()
      setQuery('')
    }
  }

  return (
    <div className="sales-layout">
      <section className="sales-left">
        <Card className="sales-product-card">
          <div className="search-panel">
            <label>
              Cari / scan produk
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={handleSearchKey}
                placeholder="Scan barcode / cari nama atau SKU"
                autoFocus
              />
            </label>
            <div className="search-filters">
              <Dropdown
                value={categoryFilter}
                onValueChange={setCategoryFilter}
                options={[
                  { value: 'all', label: 'Semua kategori' },
                  ...categoryRows.map((cat) => ({ value: cat.id, label: cat.name })),
                ]}
              />
              <Dropdown
                value={sortBy}
                onValueChange={setSortBy}
                options={[
                  { value: 'name', label: 'Urut: Nama' },
                  { value: 'price-asc', label: 'Urut: Harga termurah' },
                  { value: 'price-desc', label: 'Urut: Harga termahal' },
                  { value: 'stock-asc', label: 'Urut: Stok paling sedikit' },
                ]}
              />
            </div>
          </div>
          <div className="product-search-list">
            {filteredProducts.length === 0 ? <div className="empty-state wide-card">Produk aktif belum tersedia.</div> : null}
            {filteredProducts.map((product) => {
              const imageSrc = productImageSrc(product.imagePath)
              const isLowStock = product.stockBase <= product.minimumStock
              const isOutOfStock = product.stockBase <= 0
              return (
                <button
                  className={isOutOfStock ? 'product-pick is-disabled' : 'product-pick'}
                  disabled={isOutOfStock}
                  key={product.id}
                  title={product.name}
                  type="button"
                  onClick={() => addProduct(product)}
                >
                  <div className="product-thumb compact-thumb">
                    {imageSrc ? <img src={imageSrc} alt={product.name} loading="lazy" /> : <span>{productInitial(product.name)}</span>}
                  </div>
                  {(isOutOfStock || isLowStock) ? <span className={isOutOfStock ? 'product-pick-alert danger' : 'product-pick-alert'}>{isOutOfStock ? 'Habis' : 'Rendah'}</span> : null}
                  <div className="product-pick-body">
                    <strong>{product.name}</strong>
                    <div className="product-pick-footer">
                      <span>{product.sku || `Stok ${formatQuantity(product.stockBase)} ${product.baseUnitName}`}</span>
                      <b>{defaultProductPriceValue(product)}</b>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </Card>
      </section>

      <aside className="cart-panel">
        <div className="cart-header">
          <div>
            <span className="eyebrow">Keranjang</span>
            <h2>{cart.length} item</h2>
          </div>
          <Button variant="ghost" type="button" onClick={() => setCart([])} disabled={cart.length === 0}>
            Kosongkan
          </Button>
        </div>

        <div className="cart-items">
          {cart.length === 0 ? (
            <div className="empty-state">Pilih produk untuk mulai transaksi.</div>
          ) : (
            cart.map((item) => {
              const product = productRows.find((candidate) => candidate.id === item.productId)
              const productStockBase = product?.stockBase ?? item.stockBase
              const stockError = (stockUsageByProduct[item.productId] ?? 0) > productStockBase

              return (
                <div className={stockError ? 'cart-item stock-error' : 'cart-item'} key={item.id}>
                  <div className="cart-item-title">
                    <strong>{item.productName}</strong>
                    <button type="button" onClick={() => removeItem(item.id)}>Hapus</button>
                  </div>
                  <div className="cart-item-main">
                    <div className="cart-controls">
                      <NumberInput min="0" step={quantityStep(item.unitName)} value={item.qty} onValueChange={(value) => updateQty(item.id, value)} />
                      <Dropdown
                        value={item.selectedUnitId}
                        onValueChange={(value) => updateUnit(item.id, item.productId, value)}
                        options={product?.units.map((unit) => ({ value: unit.id, label: unit.unitName })) ?? []}
                      />
                    </div>
                    <b className="cart-item-subtotal">{formatCurrency(item.qty * item.price)}</b>
                  </div>
                  <div className="cart-meta">
                    <span>{formatQuantity(item.qty * item.conversionToBase)} {item.baseUnitName}</span>
                    <span>{formatCurrency(item.price)} / {item.unitName}</span>
                  </div>
                  {stockError ? <div className="inline-error">Total item produk ini melebihi stok. Tersedia {formatQuantity(productStockBase)} {item.baseUnitName}.</div> : null}
                  {item.price <= 0 ? <div className="inline-error">Harga jual satuan ini belum diatur.</div> : null}
                </div>
              )
            })
          )}
        </div>

        <div className="total-panel">
          <span>Total bayar</span>
          <strong>{formatCurrency(total)}</strong>
          {checkoutError ? <div className="error-box">{checkoutError}</div> : null}
          <Button type="button" size="lg" disabled={cart.length === 0 || hasStockError || hasPriceError || hasQtyError} onClick={openPayment}>
            F2 Bayar
          </Button>
        </div>
      </aside>

      <Modal title="Pembayaran" open={isPaymentOpen} onClose={closePayment}>
        <div className="payment-grid">
          <label>
            Nama pelanggan
            <input value={customerName} onChange={(event) => setCustomerName(event.target.value)} />
          </label>
          <label>
            Metode pembayaran
            <Dropdown
              value={paymentMethod}
              onValueChange={(value) => setPaymentMethod(value as PaymentMethod)}
              options={paymentMethods.map((method) => ({ value: method, label: method }))}
            />
          </label>
          <label>
            Nominal bayar
            <NumberInput allowEmpty value={paidAmount} onValueChange={setPaidAmount} placeholder="Masukkan nominal bayar" />
          </label>
          <div className="payment-shortcuts">
            {paymentShortcuts.map((shortcut) => (
              <button type="button" className="shortcut-chip" onClick={() => addPaidAmountShortcut(shortcut.value)} key={shortcut.label}>
                {shortcut.label}
              </button>
            ))}
            <button type="button" className="shortcut-chip primary" onClick={() => setPaidAmount(total)}>
              Pas
            </button>
            <button type="button" className="shortcut-chip ghost" onClick={() => setPaidAmount(undefined)}>
              Reset
            </button>
          </div>
          <label>
            Diskon
            <NumberInput min="0" value={discount} onValueChange={setDiscount} placeholder="Masukkan nominal diskon" />
          </label>
          <div className="payment-summary">
            <span>Subtotal</span>
            <strong>{formatCurrency(subtotal)}</strong>
            <span>Diskon</span>
            <strong>{formatCurrency(discount)}</strong>
            <span>Total</span>
            <strong>{formatCurrency(total)}</strong>
            <span>Kembali</span>
            <strong>{formatCurrency(change)}</strong>
          </div>
          {!isPaidAmountFilled ? <div className="error-box">Nominal bayar wajib diisi.</div> : null}
          {hasDiscountError ? <div className="error-box">Diskon tidak boleh lebih besar dari subtotal transaksi.</div> : null}
          {isPaidAmountFilled && paidAmountValue < total ? <div className="error-box">Nominal bayar kurang dari total transaksi.</div> : null}
          {checkoutError ? <div className="error-box">{checkoutError}</div> : null}
          <Button type="button" size="lg" onClick={completeSale} disabled={isPaymentInsufficient || hasDiscountError || hasStockError || hasPriceError || hasQtyError || isCheckoutSubmitting}>
            {isCheckoutSubmitting ? 'Menyimpan...' : 'Simpan transaksi'}
          </Button>
        </div>
      </Modal>

      <Modal title={receiptSale ? `Struk ${receiptSale.invoiceNumber}` : 'Struk'} open={isReceiptOpen && Boolean(receiptSale)} onClose={closeReceipt}>
        {receiptSale ? (
          <div className="receipt-modal-body">
            <ReceiptPreview sale={receiptSale} settings={settings} />
            <div className="form-actions receipt-actions">
              <Button type="button" onClick={() => void printReceipt()} disabled={isReceiptPrinting}>
                {isReceiptPrinting ? 'Mencetak...' : 'Cetak struk'}
              </Button>
              <Button type="button" variant="ghost" onClick={closeReceipt}>
                Tutup
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  )
}

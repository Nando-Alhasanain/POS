import { invoke } from '@tauri-apps/api/core'
import { categories, products, storeSettings, units, users } from '../data/mockData'
import type { AppUser, Category, Printer, Product, ProductUnit, Sale, StockMovement, StoreSettings, Unit, UserAccount, UserRole } from '../types/pos'
import { formatReceiptDateTime } from '../utils/format'

type SetupStatus = {
  isSetupComplete: boolean
  databasePath: string
}

export type CompleteSetupInput = {
  storeName: string
  storeAddress: string
  storePhone: string
  adminName: string
  username: string
  password: string
}

type LoginInput = {
  username: string
  password: string
}

export type SaveUserInput = {
  id?: string
  name: string
  username: string
  role: UserRole
  password?: string
  isActive: boolean
  currentUserId: string
}

export type SetUserActiveInput = {
  id: string
  isActive: boolean
  currentUserId: string
}

export type ResetUserPasswordInput = {
  id: string
  password: string
}

export type SaveCategoryInput = {
  id?: string
  name: string
  description?: string
}

export type SaveUnitInput = {
  id?: string
  name: string
  symbol: string
  description?: string
}

export type SaveProductUnitInput = {
  id?: string
  unitId: string
  conversionToBase: number
  sellingPrice: number
  barcode?: string
  isBaseUnit: boolean
  isDefault: boolean
}

export type SaveProductInput = {
  id?: string
  name: string
  sku?: string
  categoryId?: string
  baseUnitId: string
  stockBase: number
  minimumStock: number
  purchasePriceBase: number
  defaultSellingPriceBase: number
  isActive: boolean
  imagePath?: string
  imageDataUrl?: string
  imageFileName?: string
  removeImage?: boolean
  units: SaveProductUnitInput[]
}

export type DeleteProductResult = {
  action: 'deleted' | 'deactivated'
  message: string
}

export type StockInInput = {
  productId: string
  productUnitId: string
  qty: number
  note?: string
  createdBy?: string
}

export type StockAdjustmentInput = {
  productId: string
  physicalStockBase: number
  note: string
  createdBy?: string
}

export type CompleteSaleInput = {
  cashierId: string
  cashierName: string
  customerName?: string
  paymentMethod: string
  paidAmount: number
  discount: number
  items: Array<{
    productId: string
    productUnitId: string
    qty: number
  }>
}

export type CancelSaleInput = {
  id: string
  cancelReason: string
  cancelledBy: string
}

export type SaveStoreSettingsInput = StoreSettings & {
  receiptLogoDataUrl?: string
  receiptLogoFileName?: string
  removeReceiptLogo?: boolean
}

let fallbackCategories = [...categories]
let fallbackUnits = [...units]
let fallbackProducts = [...products]
let fallbackSales: Sale[] = []
let fallbackStockMovements: StockMovement[] = []
let fallbackUserAccounts: UserAccount[] = users.map((user) => ({
  ...user,
  isActive: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}))

function isTauriRuntime() {
  return typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)
}

async function invokeOrFallback<T>(command: string, args: Record<string, unknown>, fallback: () => T | Promise<T>): Promise<T> {
  if (!isTauriRuntime()) {
    return fallback()
  }

  try {
    return await invoke<T>(command, args)
  } catch (error) {
    console.error(`Tauri command failed: ${command}`, error)
    throw error
  }
}

async function invokeRequired<T>(command: string, args: Record<string, unknown>, fallback: () => T | Promise<T>): Promise<T> {
  if (!isTauriRuntime()) {
    return fallback()
  }

  return invoke<T>(command, args)
}

function nextId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.round(Math.random() * 1000)}`
}

function mapUser(user: AppUser): AppUser {
  return {
    id: user.id,
    name: user.name,
    username: user.username,
    role: user.role,
  }
}

function normalizeProduct(product: Product): Product {
  return {
    ...product,
    sku: product.sku ?? '',
    categoryId: product.categoryId ?? '',
    categoryName: product.categoryName ?? 'Tanpa kategori',
    imagePath: product.imagePath ?? '',
  }
}

function productFromInput(input: SaveProductInput): Product {
  const category = fallbackCategories.find((item) => item.id === input.categoryId)
  const baseUnit = fallbackUnits.find((item) => item.id === input.baseUnitId)
  const productId = input.id ?? nextId('prd')
  const productUnits: ProductUnit[] = input.units.map((unitInput) => {
    const unit = fallbackUnits.find((item) => item.id === unitInput.unitId)
    return {
      id: unitInput.id ?? nextId('pu'),
      productId,
      unitId: unitInput.unitId,
      unitName: unit?.symbol ?? unitInput.unitId,
      conversionToBase: unitInput.conversionToBase,
      sellingPrice: unitInput.sellingPrice,
      barcode: unitInput.barcode,
      isBaseUnit: unitInput.isBaseUnit,
      isDefault: unitInput.isDefault,
    }
  })

  if (!productUnits.some((item) => item.unitId === input.baseUnitId)) {
    productUnits.unshift({
      id: nextId('pu'),
      productId,
      unitId: input.baseUnitId,
      unitName: baseUnit?.symbol ?? 'unit',
      conversionToBase: 1,
      sellingPrice: input.defaultSellingPriceBase,
      isBaseUnit: true,
      isDefault: true,
    })
  }

  return {
    id: productId,
    name: input.name,
    sku: input.sku ?? '',
    categoryId: input.categoryId ?? '',
    categoryName: category?.name ?? 'Tanpa kategori',
    baseUnitId: input.baseUnitId,
    baseUnitName: baseUnit?.symbol ?? 'unit',
    stockBase: input.stockBase,
    minimumStock: input.minimumStock,
    purchasePriceBase: input.purchasePriceBase,
    defaultSellingPriceBase: input.defaultSellingPriceBase,
    isActive: input.isActive,
    imagePath: input.removeImage ? '' : input.imageDataUrl ?? input.imagePath ?? '',
    units: productUnits,
  }
}

export const posApi = {
  getSetupStatus() {
    return invokeOrFallback<SetupStatus>('get_setup_status', {}, () => ({
      isSetupComplete: false,
      databasePath: 'browser-mock',
    }))
  },

  completeInitialSetup(input: CompleteSetupInput) {
    return invokeOrFallback<AppUser>('complete_initial_setup', { input }, () => ({
      id: 'usr-setup',
      name: input.adminName,
      username: input.username,
      role: 'admin',
    }))
  },

  login(input: LoginInput) {
    return invokeOrFallback<AppUser>('login', { input }, () => {
      const user = fallbackUserAccounts.find((item) => item.username === input.username && item.isActive)
      if (!user || input.password.length < 4) {
        throw new Error('Username atau password tidak valid.')
      }
      return mapUser(user)
    })
  },

  getUserSession(userId: string) {
    return invokeOrFallback<AppUser>('get_user_session', { userId }, () => {
      const user = fallbackUserAccounts.find((item) => item.id === userId && item.isActive)
      if (!user) {
        throw new Error('Sesi login tidak valid atau akun sudah dinonaktifkan.')
      }
      return mapUser(user)
    })
  },

  listUsers() {
    return invokeOrFallback<UserAccount[]>('list_users', {}, () => fallbackUserAccounts)
  },

  saveUser(input: SaveUserInput) {
    return invokeRequired<UserAccount>('save_user', { input }, () => {
      if (!input.id && !input.password) throw new Error('Password akun baru wajib diisi.')
      const existing = input.id ? fallbackUserAccounts.find((item) => item.id === input.id) : undefined
      const duplicate = fallbackUserAccounts.find((item) => item.username === input.username && item.id !== input.id)
      if (duplicate) throw new Error('Username sudah digunakan.')
      const now = new Date().toISOString()
      const user: UserAccount = {
        id: input.id ?? nextId('usr'),
        name: input.name,
        username: input.username,
        role: input.role,
        isActive: input.isActive,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      }
      fallbackUserAccounts = existing
        ? fallbackUserAccounts.map((item) => (item.id === user.id ? user : item))
        : [user, ...fallbackUserAccounts]
      return user
    })
  },

  setUserActive(input: SetUserActiveInput) {
    return invokeRequired<UserAccount>('set_user_active', { input }, () => {
      const target = fallbackUserAccounts.find((item) => item.id === input.id)
      if (!target) throw new Error('Akun pengguna tidak ditemukan.')
      if (input.currentUserId === input.id && !input.isActive) throw new Error('Akun yang sedang login tidak boleh menonaktifkan dirinya sendiri.')
      const next = { ...target, isActive: input.isActive, updatedAt: new Date().toISOString() }
      fallbackUserAccounts = fallbackUserAccounts.map((item) => (item.id === input.id ? next : item))
      return next
    })
  },

  resetUserPassword(input: ResetUserPasswordInput) {
    return invokeRequired<UserAccount>('reset_user_password', { input }, () => {
      if (input.password.length < 6) throw new Error('Password minimal 6 karakter.')
      const target = fallbackUserAccounts.find((item) => item.id === input.id)
      if (!target) throw new Error('Akun pengguna tidak ditemukan.')
      return { ...target, updatedAt: new Date().toISOString() }
    })
  },

  getStoreSettings() {
    return invokeOrFallback<StoreSettings>('get_store_settings', {}, () => storeSettings)
  },

  saveStoreSettings(input: SaveStoreSettingsInput) {
    return invokeRequired<StoreSettings>('save_store_settings', { input }, () => {
      Object.assign(storeSettings, {
        ...input,
        receiptLogoPath: input.removeReceiptLogo ? '' : input.receiptLogoDataUrl ?? input.receiptLogoPath ?? '',
      })
      return { ...storeSettings }
    })
  },

  listPrinters() {
    return invokeOrFallback<Printer[]>('list_printers', {}, () => [
      { name: 'Thermal 80mm (preview)' },
    ])
  },

  async testPrint() {
    await invokeRequired<void>('test_print', {}, () => undefined)
  },

  async printReceipt(sale: Sale) {
    await invokeRequired<void>('print_receipt', { sale: { ...sale, createdAt: formatReceiptDateTime(sale.createdAt) } }, () => window.print())
  },

  listCategories() {
    return invokeOrFallback<Category[]>('list_categories', {}, () => fallbackCategories)
  },

  saveCategory(input: SaveCategoryInput) {
    return invokeRequired<Category>('save_category', { input }, () => {
      const category: Category = {
        id: input.id ?? nextId('cat'),
        name: input.name,
        description: input.description,
      }
      fallbackCategories = input.id
        ? fallbackCategories.map((item) => (item.id === input.id ? category : item))
        : [category, ...fallbackCategories]
      return category
    })
  },

  async deleteCategory(id: string) {
    await invokeRequired<void>('delete_category', { input: { id } }, () => {
      fallbackCategories = fallbackCategories.filter((item) => item.id !== id)
    })
  },

  listUnits() {
    return invokeOrFallback<Unit[]>('list_units', {}, () => fallbackUnits)
  },

  saveUnit(input: SaveUnitInput) {
    return invokeRequired<Unit>('save_unit', { input }, () => {
      const unit: Unit = {
        id: input.id ?? nextId('unit'),
        name: input.name,
        symbol: input.symbol,
        description: input.description,
      }
      fallbackUnits = input.id ? fallbackUnits.map((item) => (item.id === input.id ? unit : item)) : [unit, ...fallbackUnits]
      return unit
    })
  },

  async deleteUnit(id: string) {
    await invokeRequired<void>('delete_unit', { input: { id } }, () => {
      fallbackUnits = fallbackUnits.filter((item) => item.id !== id)
    })
  },

  async listProducts() {
    const result = await invokeOrFallback<Product[]>('list_products', {}, () => fallbackProducts)
    return result.map(normalizeProduct)
  },

  async saveProduct(input: SaveProductInput) {
    const result = await invokeRequired<Product>('save_product', { input }, () => {
      const existingProduct = input.id ? fallbackProducts.find((item) => item.id === input.id) : undefined
      const product = {
        ...productFromInput(input),
        stockBase: existingProduct?.stockBase ?? input.stockBase,
      }
      fallbackProducts = input.id
        ? fallbackProducts.map((item) => (item.id === input.id ? product : item))
        : [product, ...fallbackProducts]
      return product
    })
    return normalizeProduct(result)
  },

  async deleteProduct(id: string) {
    return invokeRequired<DeleteProductResult>('delete_product', { input: { id } }, () => {
      fallbackProducts = fallbackProducts.filter((item) => item.id !== id)
      return {
        action: 'deleted',
        message: 'Produk berhasil dihapus permanen karena belum memiliki riwayat transaksi/stok.',
      }
    })
  },

  async addStock(input: StockInInput) {
    const result = await invokeRequired<Product>('add_stock', { input }, () => {
      const product = fallbackProducts.find((item) => item.id === input.productId)
      const productUnit = product?.units.find((unit) => unit.id === input.productUnitId)
      if (!product || !productUnit) {
        throw new Error('Produk atau satuan tidak valid.')
      }
      const qtyBase = input.qty * productUnit.conversionToBase
      const stockBefore = product.stockBase
      const stockAfter = stockBefore + qtyBase
      const updatedProduct = { ...product, stockBase: stockAfter }
      fallbackProducts = fallbackProducts.map((item) => (item.id === product.id ? updatedProduct : item))
      fallbackStockMovements = [
        {
          id: nextId('mov'),
          productId: product.id,
          productName: product.name,
          movementType: 'IN',
          qty: input.qty,
          unitId: productUnit.unitId,
          unitName: productUnit.unitName,
          conversionToBase: productUnit.conversionToBase,
          qtyBase,
          stockBefore,
          stockAfter,
          note: input.note,
          createdBy: input.createdBy,
          createdAt: new Date().toISOString(),
        },
        ...fallbackStockMovements,
      ]
      return updatedProduct
    })
    return normalizeProduct(result)
  },

  async adjustStock(input: StockAdjustmentInput) {
    const result = await invokeRequired<Product>('adjust_stock', { input }, () => {
      const product = fallbackProducts.find((item) => item.id === input.productId)
      if (!product) {
        throw new Error('Produk tidak ditemukan.')
      }
      const stockBefore = product.stockBase
      const stockAfter = input.physicalStockBase
      const qtyBase = stockAfter - stockBefore
      const updatedProduct = { ...product, stockBase: stockAfter }
      fallbackProducts = fallbackProducts.map((item) => (item.id === product.id ? updatedProduct : item))
      fallbackStockMovements = [
        {
          id: nextId('mov'),
          productId: product.id,
          productName: product.name,
          movementType: 'ADJUSTMENT',
          qty: qtyBase,
          qtyBase,
          stockBefore,
          stockAfter,
          note: input.note,
          createdBy: input.createdBy,
          createdAt: new Date().toISOString(),
        },
        ...fallbackStockMovements,
      ]
      return updatedProduct
    })
    return normalizeProduct(result)
  },

  listStockMovements() {
    return invokeOrFallback<StockMovement[]>('list_stock_movements', {}, () => fallbackStockMovements)
  },

  async completeSale(input: CompleteSaleInput) {
    return invokeRequired<Sale>('complete_sale', { input }, () => {
      const saleItems = input.items.map((item) => {
        const product = fallbackProducts.find((candidate) => candidate.id === item.productId)
        const unit = product?.units.find((candidate) => candidate.id === item.productUnitId)
        if (!product || !unit) {
          throw new Error('Produk atau satuan tidak valid.')
        }
        if (unit.sellingPrice <= 0) {
          throw new Error(`Harga jual untuk ${product.name} / ${unit.unitName} belum diatur.`)
        }
        const qtyBase = item.qty * unit.conversionToBase
        if (qtyBase > product.stockBase) {
          throw new Error(`Stok tidak cukup untuk ${product.name}.`)
        }

        return {
          product,
          unit,
          qty: item.qty,
          qtyBase,
          subtotal: item.qty * unit.sellingPrice,
        }
      })

      const totalGross = saleItems.reduce((sum, item) => sum + item.subtotal, 0)
      if (input.discount > totalGross) {
        throw new Error('Diskon tidak boleh lebih besar dari subtotal transaksi.')
      }
      const totalNet = totalGross - input.discount
      if (input.paidAmount < totalNet) {
        throw new Error('Nominal bayar kurang dari total transaksi.')
      }

      const saleId = nextId('sale')
      fallbackProducts = fallbackProducts.map((product) => {
        const soldQty = saleItems
          .filter((item) => item.product.id === product.id)
          .reduce((sum, item) => sum + item.qtyBase, 0)
        return soldQty > 0 ? { ...product, stockBase: product.stockBase - soldQty } : product
      })

      return {
        id: saleId,
        invoiceNumber: `INV-MOCK-${Date.now()}`,
        cashierName: input.cashierName,
        customerName: input.customerName,
        totalGross,
        discount: input.discount,
        totalNet,
        paymentMethod: input.paymentMethod as Sale['paymentMethod'],
        paidAmount: input.paidAmount,
        changeAmount: input.paidAmount - totalNet,
        status: 'COMPLETED',
        createdAt: new Date().toISOString(),
        items: saleItems.map((item) => ({
          id: nextId('sale-item'),
          productNameSnapshot: item.product.name,
          unitNameSnapshot: item.unit.unitName,
          qty: item.qty,
          conversionToBase: item.unit.conversionToBase,
          qtyBase: item.qtyBase,
          price: item.unit.sellingPrice,
          purchasePriceSnapshot: item.product.purchasePriceBase,
          subtotal: item.subtotal,
        })),
      }
    })
  },

  listSales() {
    return invokeOrFallback<Sale[]>('list_sales', {}, () => fallbackSales)
  },

  async cancelSale(input: CancelSaleInput) {
    await invokeRequired<void>('cancel_sale', { input }, () => {
      fallbackSales = fallbackSales.map((sale) =>
        sale.id === input.id ? { ...sale, status: 'CANCELLED' as Sale['status'] } : sale,
      )
    })
  },

  async backupDatabase(targetPath: string) {
    await invokeRequired<string>('backup_database', { targetPath }, () => {
      throw new Error('Backup hanya tersedia di mode Tauri desktop.')
    })
  },

  async restoreDatabase(backupPath: string) {
    return invokeRequired<string>('restore_database', { backupPath }, () => {
      throw new Error('Restore hanya tersedia di mode Tauri desktop.')
    })
  },

  async resetOperationalData() {
    return invokeRequired<string>('reset_operational_data', {}, () => {
      fallbackCategories = []
      fallbackUnits = [...units]
      fallbackProducts = []
      fallbackSales = []
      fallbackStockMovements = []
      return 'browser-mock'
    })
  },
}

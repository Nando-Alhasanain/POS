export type UserRole = 'admin' | 'kasir'

export type PageKey =
  | 'dashboard'
  | 'sales'
  | 'transactions'
  | 'products'
  | 'categories'
  | 'units'
  | 'stock'
  | 'reports'
  | 'users'
  | 'settings'

export type Unit = {
  id: string
  name: string
  symbol: string
  description?: string
}

export type Category = {
  id: string
  name: string
  description?: string
}

export type ProductUnit = {
  id: string
  productId: string
  unitId: string
  unitName: string
  conversionToBase: number
  sellingPrice: number
  barcode?: string
  isBaseUnit: boolean
  isDefault: boolean
}

export type Product = {
  id: string
  name: string
  sku: string
  categoryId: string
  categoryName: string
  baseUnitId: string
  baseUnitName: string
  stockBase: number
  minimumStock: number
  purchasePriceBase: number
  defaultSellingPriceBase: number
  isActive: boolean
  imagePath?: string
  units: ProductUnit[]
}

export type CartItem = {
  id: string
  productId: string
  productName: string
  productSku: string
  baseUnitName: string
  selectedUnitId: string
  unitName: string
  conversionToBase: number
  qty: number
  price: number
  stockBase: number
}

export type PaymentMethod = 'CASH' | 'TRANSFER' | 'QRIS' | 'DEBIT' | 'CREDIT' | 'OTHER'

export type SaleStatus = 'COMPLETED' | 'CANCELLED'

export type SaleItem = {
  id: string
  productNameSnapshot: string
  unitNameSnapshot: string
  qty: number
  conversionToBase: number
  qtyBase: number
  price: number
  purchasePriceSnapshot?: number
  subtotal: number
}

export type Sale = {
  id: string
  invoiceNumber: string
  cashierName: string
  customerName?: string
  totalGross: number
  discount: number
  totalNet: number
  paymentMethod: PaymentMethod
  paidAmount: number
  changeAmount: number
  status: SaleStatus
  createdAt: string
  items: SaleItem[]
}

export type AppUser = {
  id: string
  name: string
  username: string
  role: UserRole
}

export type UserAccount = AppUser & {
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export type StoreSettings = {
  storeName: string
  storeAddress: string
  storePhone: string
  receiptFooter: string
  receiptPaperSize: '58mm' | '80mm'
  currency: string
  printerName?: string
  receiptLogoPath?: string
}

export type Printer = {
  name: string
}

export type StockMovement = {
  id: string
  productId: string
  productName: string
  movementType: 'IN' | 'OUT' | 'ADJUSTMENT' | 'SALE' | 'SALE_CANCEL'
  qty: number
  unitId?: string
  unitName?: string
  conversionToBase?: number
  qtyBase: number
  stockBefore: number
  stockAfter: number
  note?: string
  referenceType?: string
  referenceId?: string
  createdBy?: string
  createdAt: string
}

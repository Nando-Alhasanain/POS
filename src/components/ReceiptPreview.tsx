import type { PaymentMethod, Sale, StoreSettings } from '../types/pos'
import { formatCurrency, formatDateTime, formatQuantity } from '../utils/format'
import { fileAssetSrc } from '../utils/productImage'

const paymentMethodLabels: Record<PaymentMethod, string> = {
  CASH: 'Tunai',
  TRANSFER: 'Transfer',
  QRIS: 'QRIS',
  DEBIT: 'Debit',
  CREDIT: 'Kredit',
  OTHER: 'Lainnya',
}

type ReceiptPreviewProps = {
  sale: Sale
  settings: StoreSettings
}

export function ReceiptPreview({ sale, settings }: ReceiptPreviewProps) {
  const receiptLogoSrc = fileAssetSrc(settings.receiptLogoPath)

  return (
    <div className="receipt-preview">
      {receiptLogoSrc ? <img className="receipt-logo" src={receiptLogoSrc} alt="Logo toko" /> : null}
      <strong>{settings.storeName}</strong>
      <span>{settings.storeAddress}</span>
      <span>Telp: {settings.storePhone}</span>
      <hr />
      <span>Invoice: {sale.invoiceNumber}</span>
      <span>Tanggal: {formatDateTime(sale.createdAt)}</span>
      <span>Kasir: {sale.cashierName}</span>
      <span>Pembayaran: {paymentMethodLabels[sale.paymentMethod] ?? sale.paymentMethod}</span>
      <hr />
      {sale.items.map((item) => (
        <div className="receipt-item" key={item.id}>
          <span>{item.productNameSnapshot}</span>
          <small>{formatQuantity(item.qty)} {item.unitNameSnapshot} x {formatCurrency(item.price)}</small>
          <b>{formatCurrency(item.subtotal)}</b>
        </div>
      ))}
      <hr />
      <div className="receipt-line"><span>Subtotal</span><b>{formatCurrency(sale.totalGross)}</b></div>
      {sale.discount > 0 ? <div className="receipt-line"><span>Diskon</span><b>{formatCurrency(sale.discount)}</b></div> : null}
      <div className="receipt-line"><span>Total</span><b>{formatCurrency(sale.totalNet)}</b></div>
      <div className="receipt-line"><span>Bayar</span><b>{formatCurrency(sale.paidAmount)}</b></div>
      <div className="receipt-line"><span>Kembali</span><b>{formatCurrency(sale.changeAmount)}</b></div>
      <hr />
      <span>{settings.receiptFooter}</span>
    </div>
  )
}

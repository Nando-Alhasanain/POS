import { useEffect, useMemo, useState } from 'react'
import { Card } from '../components/Card'
import { StatCard } from '../components/StatCard'
import { posApi } from '../services/posApi'
import type { AppUser, PageKey, Product, Sale } from '../types/pos'
import { dateInputFromTimestamp, formatCurrency, formatQuantity, todayDateInput } from '../utils/format'

type DashboardPageProps = {
  user: AppUser
  sales: Sale[]
  onNavigate: (page: PageKey) => void
}

export function DashboardPage({ user, sales, onNavigate }: DashboardPageProps) {
  const [productRows, setProductRows] = useState<Product[]>([])

  useEffect(() => {
    let isMounted = true

    posApi.listProducts().then((nextProducts) => {
      if (isMounted) {
        setProductRows(nextProducts)
      }
    })

    return () => {
      isMounted = false
    }
  }, [])

  const today = todayDateInput()
  const completedSalesToday = sales.filter((sale) => sale.status === 'COMPLETED' && dateInputFromTimestamp(sale.createdAt) === today)
  const totalSales = completedSalesToday.reduce((total, sale) => total + sale.totalNet, 0)
  const lowStockProducts = productRows.filter((product) => product.stockBase <= product.minimumStock)
  const topProducts = useMemo(() => {
    const map = new Map<string, { name: string; unitName: string; qty: number; subtotal: number }>()

    completedSalesToday.forEach((sale) => {
      sale.items.forEach((item) => {
        const key = `${item.productNameSnapshot}__${item.unitNameSnapshot}`
        const current = map.get(key) ?? {
          name: item.productNameSnapshot,
          unitName: item.unitNameSnapshot,
          qty: 0,
          subtotal: 0,
        }
        current.qty += item.qty
        current.subtotal += item.subtotal
        map.set(key, current)
      })
    })

    return Array.from(map.values())
      .sort((a, b) => b.subtotal - a.subtotal)
      .slice(0, 5)
  }, [completedSalesToday])

  return (
    <div className="page-stack">
      <div className="stats-grid">
        <StatCard label="Penjualan hari ini" value={formatCurrency(totalSales)} helper="Dari transaksi selesai" tone="green" />
        <StatCard label="Transaksi" value={`${completedSalesToday.length}`} helper="Hari ini" tone="blue" />
        <StatCard label="Stok rendah" value={`${lowStockProducts.length}`} helper="Perlu dicek" tone="amber" />
        <StatCard label="Produk aktif" value={`${productRows.filter((item) => item.isActive).length}`} helper="SQLite lokal" tone="green" />
      </div>

      <section className="dashboard-grid">
        <Card>
          <div className="section-header">
            <div>
              <span className="eyebrow">Shortcut</span>
              <h2>Aksi cepat</h2>
            </div>
          </div>
          <div className="shortcut-grid">
            <button type="button" onClick={() => onNavigate('sales')}>Transaksi baru</button>
            <button type="button" onClick={() => onNavigate('transactions')}>Riwayat transaksi</button>
            {user.role === 'admin' ? <button type="button" onClick={() => onNavigate('products')}>Kelola produk</button> : null}
            {user.role === 'admin' ? <button type="button" onClick={() => onNavigate('reports')}>Lihat laporan</button> : null}
          </div>
        </Card>

        <Card>
          <div className="section-header">
            <div>
              <span className="eyebrow">Produk terlaris</span>
              <h2>Hari ini</h2>
            </div>
          </div>
          <div className="product-rank">
            {topProducts.length === 0 ? (
              <div className="empty-state">Belum ada produk terjual hari ini.</div>
            ) : topProducts.map((item, index) => (
              <div className="rank-row" key={`${item.name}-${item.unitName}`}>
                <span>{index + 1}</span>
                <strong>{item.name}</strong>
                <small>{formatQuantity(item.qty)} {item.unitName}</small>
                <b>{formatCurrency(item.subtotal)}</b>
              </div>
            ))}
          </div>
        </Card>

        <Card className="wide-card">
          <div className="section-header">
            <div>
              <span className="eyebrow">Stok rendah</span>
              <h2>Perlu restock</h2>
            </div>
          </div>
          <div className="list-stack">
            {lowStockProducts.length === 0 ? (
              <div className="empty-state">Tidak ada produk di bawah minimum stok.</div>
            ) : (
              lowStockProducts.map((product) => (
                <div className="compact-row low-stock-row" key={product.id}>
                  <div className="low-stock-product">
                    <strong>{product.name}</strong>
                    <span>SKU: {product.sku || '-'}</span>
                  </div>
                  <div className="low-stock-qty">
                    <b>{formatQuantity(product.stockBase)} {product.baseUnitName}</b>
                    <span>Min. {formatQuantity(product.minimumStock)} {product.baseUnitName}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </section>
    </div>
  )
}

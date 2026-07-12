import { useEffect, useMemo, useState, type ReactNode } from 'react'

type Column<T> = {
  key: string
  header: string
  render: (item: T) => ReactNode
  align?: 'left' | 'right' | 'center'
}

type DataTableProps<T> = {
  columns: Column<T>[]
  data: T[]
  emptyLabel?: string
  pagination?: boolean
  pageSize?: number
}

export function DataTable<T>({ columns, data, emptyLabel = 'Belum ada data', pagination = false, pageSize = 10 }: DataTableProps<T>) {
  const [currentPage, setCurrentPage] = useState(1)
  const safePageSize = Math.max(1, pageSize)
  const totalPages = Math.max(1, Math.ceil(data.length / safePageSize))

  useEffect(() => {
    setCurrentPage(1)
  }, [data, safePageSize])

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages)
    }
  }, [currentPage, totalPages])

  const visibleData = useMemo(() => {
    if (!pagination) return data
    const start = (currentPage - 1) * safePageSize
    return data.slice(start, start + safePageSize)
  }, [currentPage, data, pagination, safePageSize])

  const firstRow = data.length === 0 ? 0 : (currentPage - 1) * safePageSize + 1
  const lastRow = pagination ? Math.min(currentPage * safePageSize, data.length) : data.length

  return (
    <div className="table-shell">
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column.key} className={column.align ? `text-${column.align}` : undefined}>
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="empty-cell">
                  {emptyLabel}
                </td>
              </tr>
            ) : (
              visibleData.map((item, index) => (
                <tr key={(currentPage - 1) * safePageSize + index}>
                  {columns.map((column) => (
                    <td key={column.key} className={column.align ? `text-${column.align}` : undefined}>
                      {column.render(item)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {pagination && data.length > 0 ? (
        <div className="pagination-bar">
          <span>
            Menampilkan {firstRow}-{lastRow} dari {data.length} data
          </span>
          <div className="pagination-actions">
            <button type="button" onClick={() => setCurrentPage((page) => Math.max(1, page - 1))} disabled={currentPage === 1}>
              Sebelumnya
            </button>
            <strong>{currentPage} / {totalPages}</strong>
            <button type="button" onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))} disabled={currentPage === totalPages}>
              Berikutnya
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

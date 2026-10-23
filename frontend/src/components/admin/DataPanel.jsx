import { useEffect, useState } from 'react'
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Database,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { getDataTables, getTableRow, listTableRows } from '@/lib/adminApi'
import { getErrorMessage, truncate } from '@/lib/adminUtils'
import AdminAlert from './AdminAlert'
import DataFormDialog, { getColumnLabel } from './DataFormDialog'
import DeleteRowDialog from './DeleteRowDialog'

const PAGE_SIZE = 25

function renderCell(row, column) {
  const key = column.listOmit ? `${column.name}_preview` : column.name
  const value = row[key]

  if (value === null || value === undefined || value === '') {
    return <span className="text-muted-foreground">—</span>
  }

  const text = typeof value === 'object' ? JSON.stringify(value) : String(value)

  return (
    <span className={column.type === 'text' || column.listOmit ? 'font-mono text-xs' : ''}>
      {column.listOmit ? truncate(text, 160) : text}
    </span>
  )
}

export default function DataPanel() {
  const [tables, setTables] = useState([])
  const [tablesError, setTablesError] = useState('')
  const [selected, setSelected] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [sort, setSort] = useState('')
  const [order, setOrder] = useState('asc')
  const [result, setResult] = useState({ data: [], total: 0, page: 1, limit: PAGE_SIZE })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [actionError, setActionError] = useState('')
  const [notice, setNotice] = useState(null)
  const [refreshKey, setRefreshKey] = useState(0)

  const [creating, setCreating] = useState(false)
  const [editingRow, setEditingRow] = useState(null)
  const [deletingRow, setDeletingRow] = useState(null)

  const meta = tables.find((table) => table.table === selected) || null

  useEffect(() => {
    let active = true

    getDataTables()
      .then((response) => {
        if (!active) return
        const list = response.data.data
        setTables(list)
        if (list.length > 0) setSelected((current) => current || list[0].table)
      })
      .catch((requestError) => {
        if (active) setTablesError(getErrorMessage(requestError, 'Không thể tải danh mục bảng.'))
      })

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setQuery(searchInput.trim())
      setPage(1)
    }, 350)
    return () => window.clearTimeout(timer)
  }, [searchInput])

  useEffect(() => {
    if (!selected) return undefined

    let active = true
    setLoading(true)
    setError('')

    listTableRows(selected, {
      search: query,
      page,
      limit: PAGE_SIZE,
      ...(sort ? { sort, order } : {}),
    })
      .then((response) => {
        if (active) setResult(response.data)
      })
      .catch((requestError) => {
        if (active) setError(getErrorMessage(requestError, 'Không thể tải dữ liệu bảng.'))
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [selected, query, page, sort, order, refreshKey])

  const refresh = () => setRefreshKey((value) => value + 1)

  const handleSelectTable = (table) => {
    setSelected(table)
    setSearchInput('')
    setQuery('')
    setPage(1)
    setSort('')
    setOrder('asc')
    setNotice(null)
    setActionError('')
  }

  const handleSort = (column) => {
    if (!column.sortable) return

    if (sort === column.name) {
      setOrder((current) => (current === 'asc' ? 'desc' : 'asc'))
    } else {
      setSort(column.name)
      setOrder('asc')
    }
    setPage(1)
  }

  const handleEdit = async (row) => {
    setActionError('')
    try {
      const response = await getTableRow(selected, row.id)
      setEditingRow(response.data.data)
    } catch (requestError) {
      setActionError(getErrorMessage(requestError, 'Không thể tải chi tiết dòng dữ liệu.'))
    }
  }

  const handleSaved = ({ warning }) => {
    setCreating(false)
    setEditingRow(null)
    setNotice({
      variant: warning ? 'warning' : 'success',
      message: warning ? `Đã lưu thay đổi. Lưu ý: ${warning}` : 'Đã lưu thay đổi dữ liệu.',
    })
    refresh()
  }

  const handleDeleted = () => {
    setDeletingRow(null)
    setNotice({ variant: 'success', message: 'Đã xóa dòng dữ liệu và tạo bản sao lưu.' })
    refresh()
  }

  const totalPages = Math.max(1, Math.ceil(result.total / (result.limit || PAGE_SIZE)))
  const rows = result.data || []
  const activeSort = sort || meta?.defaultSort || 'id'

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Quản lý dữ liệu tuyển sinh</h1>
          <p className="text-sm text-muted-foreground">
            Xem, thêm, sửa và xóa dữ liệu trong 5 bảng của hệ thống.
          </p>
        </div>
        <Button type="button" onClick={() => setCreating(true)} disabled={!meta}>
          <Plus className="mr-2 h-4 w-4" />
          Thêm dòng
        </Button>
      </div>

      {tablesError && <AdminAlert variant="error">{tablesError}</AdminAlert>}
      {notice && <AdminAlert variant={notice.variant}>{notice.message}</AdminAlert>}
      {error && <AdminAlert variant="error">{error}</AdminAlert>}
      {actionError && <AdminAlert variant="error">{actionError}</AdminAlert>}

      <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-white p-3">
        <select
          value={selected}
          onChange={(event) => handleSelectTable(event.target.value)}
          className="h-10 min-w-[200px] rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Chọn bảng dữ liệu"
        >
          {tables.map((table) => (
            <option key={table.table} value={table.table}>
              {table.label}
            </option>
          ))}
        </select>

        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Tìm kiếm trong bảng..."
            className="pl-9"
            aria-label="Tìm kiếm dữ liệu"
            disabled={!meta}
          />
        </div>

        <Button
          type="button"
          variant="outline"
          onClick={refresh}
          disabled={loading || !meta}
          aria-label="Làm mới dữ liệu"
        >
          <RefreshCw className={loading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
        </Button>
      </div>

      {meta && (
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1 rounded-full border bg-white px-2 py-1">
            <Database className="h-3.5 w-3.5" />
            Bảng <code className="font-mono">{meta.table}</code>
          </span>
          <span>{meta.columns.length} cột</span>
          <span>·</span>
          <span>{result.total.toLocaleString('vi-VN')} dòng</span>
        </div>
      )}

      <div className="overflow-hidden rounded-lg border bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-left">
              <tr>
                {(meta?.columns || []).map((column) => {
                  const isActive = activeSort === column.name
                  const Icon = !isActive ? ArrowUpDown : order === 'asc' ? ArrowUp : ArrowDown

                  return (
                    <th key={column.name} className="whitespace-nowrap px-3 py-2 font-medium">
                      <button
                        type="button"
                        onClick={() => handleSort(column)}
                        disabled={!column.sortable}
                        title={column.name}
                        className={
                          column.sortable
                            ? 'inline-flex items-center gap-1 hover:text-foreground'
                            : 'inline-flex items-center gap-1 text-muted-foreground'
                        }
                      >
                        {getColumnLabel(column)}
                        {column.listOmit ? ' (tóm tắt)' : ''}
                        {column.sortable && <Icon className="h-3.5 w-3.5" />}
                      </button>
                    </th>
                  )
                })}
                <th className="px-3 py-2 text-right font-medium">Thao tác</th>
              </tr>
            </thead>

            <tbody>
              {loading && rows.length === 0 && (
                <tr>
                  <td
                    colSpan={(meta?.columns.length || 1) + 1}
                    className="px-3 py-10 text-center text-muted-foreground"
                  >
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Đang tải dữ liệu...
                    </span>
                  </td>
                </tr>
              )}

              {!loading && rows.length === 0 && (
                <tr>
                  <td
                    colSpan={(meta?.columns.length || 1) + 1}
                    className="px-3 py-10 text-center text-muted-foreground"
                  >
                    Không có dòng dữ liệu nào khớp điều kiện.
                  </td>
                </tr>
              )}

              {rows.map((row) => (
                <tr key={row.id} className="border-t align-top">
                  {(meta?.columns || []).map((column) => (
                    <td key={column.name} className="max-w-[320px] px-3 py-2">
                      {renderCell(row, column)}
                    </td>
                  ))}
                  <td className="whitespace-nowrap px-3 py-2">
                    <div className="flex justify-end gap-1">
                      <Button type="button" variant="outline" size="sm" onClick={() => handleEdit(row)}>
                        <Pencil className="mr-1 h-3.5 w-3.5" />
                        Sửa
                      </Button>
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={() => setDeletingRow(row)}
                      >
                        <Trash2 className="mr-1 h-3.5 w-3.5" />
                        Xóa
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t px-3 py-2 text-sm">
          <span className="text-muted-foreground">
            Tổng {result.total.toLocaleString('vi-VN')} dòng · Trang {page}/{totalPages}
          </span>
          <div className="flex gap-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setPage((value) => Math.max(1, value - 1))}
              disabled={page <= 1 || loading}
            >
              <ChevronLeft className="mr-1 h-4 w-4" />
              Trước
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
              disabled={page >= totalPages || loading}
            >
              Sau
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <DataFormDialog
        open={creating}
        tableMeta={meta}
        row={null}
        onClose={() => setCreating(false)}
        onSaved={handleSaved}
      />

      <DataFormDialog
        open={Boolean(editingRow)}
        tableMeta={meta}
        row={editingRow}
        onClose={() => setEditingRow(null)}
        onSaved={handleSaved}
      />

      <DeleteRowDialog
        open={Boolean(deletingRow)}
        tableMeta={meta}
        row={deletingRow}
        onClose={() => setDeletingRow(null)}
        onDeleted={handleDeleted}
      />
    </div>
  )
}

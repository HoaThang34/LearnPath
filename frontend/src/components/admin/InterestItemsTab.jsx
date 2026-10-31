import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertCircle, CheckCircle2, FileJson, Loader2, Plus, RefreshCw, Rocket, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import AdminAlert from './AdminAlert'
import ConfirmDialog from './ConfirmDialog'
import {
  activateInterestInstrument,
  createInterestInstrument,
  getInterestInstrumentItems,
  importInterestInstrument,
  listInterestInstruments,
  saveInterestInstrumentItems,
} from '@/lib/adminApi'
import { cn } from '@/lib/utils'

const GROUP_ORDER = ['R', 'I', 'A', 'S', 'E', 'C']
const PAIR_ORDER = ['EI', 'SN', 'TF', 'JP']

function countItems(items) {
  const part1 = items.filter((item) => item.part === 'riasec')
  const part2 = items.filter((item) => item.part === 'pairs')
  const even = part2.filter((item) => item.itemNo % 2 === 0).length
  const odd = part2.filter((item) => item.itemNo % 2 === 1).length
  return { total: items.length, part1: part1.length, part2: part2.length, even, odd }
}

function statusBadge(status) {
  if (status === 'active') return 'border-emerald-200 bg-emerald-50 text-emerald-700'
  if (status === 'draft') return 'border-amber-200 bg-amber-50 text-amber-700'
  return 'border-slate-200 bg-slate-100 text-slate-600'
}

export default function InterestItemsTab() {
  const [instruments, setInstruments] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [detail, setDetail] = useState(null)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [importText, setImportText] = useState('')
  const [importErrors, setImportErrors] = useState([])
  const [showImport, setShowImport] = useState(false)
  const [draftForm, setDraftForm] = useState({ code: '', title: '', version: '', sourceNote: '' })
  const [activateTarget, setActivateTarget] = useState(null)

  const counts = useMemo(() => countItems(items), [items])
  const isDraft = detail?.instrument?.status === 'draft'

  const loadList = useCallback(async (preferredId = null) => {
    const response = await listInterestInstruments()
    const list = response.data?.data || []
    setInstruments(list)
    const active = list.find((row) => row.status === 'active')
    const nextId = preferredId || active?.id || list[0]?.id || null
    setSelectedId(nextId)
    return nextId
  }, [])

  const loadDetail = useCallback(async (id) => {
    if (!id) {
      setDetail(null)
      setItems([])
      return
    }
    const response = await getInterestInstrumentItems(id)
    setDetail(response.data?.data || null)
    setItems(response.data?.data?.items || [])
  }, [])

  useEffect(() => {
    let active = true
    const run = async () => {
      setLoading(true)
      setError('')
      try {
        const id = await loadList()
        if (!active) return
        await loadDetail(id)
      } catch (err) {
        if (active) setError(err.response?.data?.error || 'Không thể tải bộ câu hỏi sở thích.')
      } finally {
        if (active) setLoading(false)
      }
    }
    run()
    return () => {
      active = false
    }
  }, [loadList, loadDetail])

  const refresh = async (preferredId = selectedId) => {
    setError('')
    try {
      const id = await loadList(preferredId)
      await loadDetail(id)
    } catch (err) {
      setError(err.response?.data?.error || 'Không thể làm mới dữ liệu.')
    }
  }

  const handleSelect = async (event) => {
    const id = Number(event.target.value)
    setSelectedId(id)
    setError('')
    try {
      await loadDetail(id)
    } catch (err) {
      setError(err.response?.data?.error || 'Không thể tải bộ câu hỏi đã chọn.')
    }
  }

  const handleImport = async () => {
    setError('')
    setSuccess('')
    setImportErrors([])
    let parsed
    try {
      parsed = JSON.parse(importText)
    } catch (err) {
      setError('Nội dung JSON không hợp lệ.')
      return
    }
    setSaving(true)
    try {
      const response = await importInterestInstrument({ instrument: parsed })
      const imported = response.data?.data?.instrument
      setSuccess(`Đã nhập ${response.data?.data?.counts?.total || 0} câu vào bản nháp ${imported?.code} v${imported?.version}.`)
      setShowImport(false)
      setImportText('')
      await refresh(imported?.id)
    } catch (err) {
      const details = err.response?.data?.details
      if (Array.isArray(details)) setImportErrors(details)
      setError(err.response?.data?.error || 'Không thể nhập bộ câu hỏi.')
    } finally {
      setSaving(false)
    }
  }

  const handleCreateDraft = async () => {
    setError('')
    setSuccess('')
    setSaving(true)
    try {
      const response = await createInterestInstrument({
        code: draftForm.code,
        title: draftForm.title,
        version: Number(draftForm.version),
        sourceNote: draftForm.sourceNote || detail?.instrument?.sourceNote,
        copyFromId: selectedId,
      })
      const created = response.data?.data?.instrument
      setSuccess(`Đã tạo bản nháp ${created?.code} v${created?.version}.`)
      setDraftForm({ code: '', title: '', version: '', sourceNote: '' })
      await refresh(created?.id)
    } catch (err) {
      setError(err.response?.data?.error || 'Không thể tạo bản nháp.')
    } finally {
      setSaving(false)
    }
  }

  const handleSaveItems = async () => {
    if (!selectedId) return
    setError('')
    setSuccess('')
    setSaving(true)
    try {
      const response = await saveInterestInstrumentItems(selectedId, items)
      setDetail(response.data?.data || detail)
      setItems(response.data?.data?.items || items)
      setSuccess('Đã lưu 108 câu của bản nháp.')
    } catch (err) {
      setError(err.response?.data?.error || 'Không thể lưu câu hỏi.')
    } finally {
      setSaving(false)
    }
  }

  const handleActivate = async () => {
    if (!activateTarget) return
    setSaving(true)
    setError('')
    try {
      await activateInterestInstrument(activateTarget.id)
      setSuccess(`Đã kích hoạt ${activateTarget.code} v${activateTarget.version}. Bản đang chạy trước đó đã được lưu trữ.`)
      setActivateTarget(null)
      await refresh(activateTarget.id)
    } catch (err) {
      setError(err.response?.data?.error || 'Không thể kích hoạt bộ câu hỏi.')
    } finally {
      setSaving(false)
    }
  }

  const updateItem = (id, field, value) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, [field]: value } : item)))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-slate-500">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span>Đang tải bộ câu hỏi sở thích...</span>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {error && <AdminAlert variant="error">{error}</AdminAlert>}
      {success && <AdminAlert variant="success">{success}</AdminAlert>}

      <div className="flex flex-wrap items-center gap-2">
        <select
          value={selectedId || ''}
          onChange={handleSelect}
          className="h-9 min-w-[240px] rounded-md border border-input bg-background px-2 text-sm"
        >
          {instruments.map((row) => (
            <option key={row.id} value={row.id}>
              {row.code} · v{row.version} · {row.status} · {row.riasecCount + row.pairsCount} câu
            </option>
          ))}
        </select>
        <Button type="button" variant="outline" size="sm" onClick={() => refresh()}>
          <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
          Làm mới
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => setShowImport((prev) => !prev)}>
          <FileJson className="mr-1.5 h-3.5 w-3.5" />
          Import JSON
        </Button>
        {isDraft && (
          <Button type="button" size="sm" onClick={handleSaveItems} disabled={saving}>
            {saving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-1.5 h-3.5 w-3.5" />}
            Lưu 108 câu
          </Button>
        )}
        {detail?.instrument && detail.instrument.status !== 'active' && (
          <Button
            type="button"
            size="sm"
            className="bg-emerald-600 text-white hover:bg-emerald-700"
            onClick={() => setActivateTarget(detail.instrument)}
            disabled={saving}
          >
            <Rocket className="mr-1.5 h-3.5 w-3.5" />
            Kích hoạt
          </Button>
        )}
      </div>

      {detail?.instrument && (
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
          <span className={cn('rounded-full border px-2 py-0.5 font-semibold', statusBadge(detail.instrument.status))}>
            {detail.instrument.status}
          </span>
          <span>{detail.instrument.title}</span>
          <span className="text-slate-400">·</span>
          <span>
            Đối chiếu: {counts.total}/108 · {counts.part1} Phần 1 · {counts.part2} Phần 2 · {counts.even}/{counts.odd} chẵn/lẻ
          </span>
          {!detail.instrument.sourceNote?.toLowerCase().includes('tự biên soạn') && (
            <span className="inline-flex items-center gap-1 rounded bg-amber-50 px-2 py-0.5 text-amber-700">
              <AlertCircle className="h-3 w-3" /> Thiếu ghi chú "tự biên soạn" — không kích hoạt được
            </span>
          )}
        </div>
      )}

      {showImport && (
        <div className="space-y-2 rounded-lg border bg-slate-50 p-3">
          <Label htmlFor="interest-import-json">Dán nội dung JSON của bộ câu hỏi (all-or-nothing)</Label>
          <textarea
            id="interest-import-json"
            rows={8}
            value={importText}
            onChange={(event) => setImportText(event.target.value)}
            placeholder='{"code":"holland-pairs-v2","title":"...","version":2,"part1":[...],"part2":[...]}'
            className="w-full rounded-md border border-input bg-white px-3 py-2 font-mono text-xs"
          />
          {importErrors.length > 0 && (
            <ul className="max-h-40 space-y-1 overflow-auto rounded border border-rose-200 bg-rose-50 p-2 text-xs text-rose-700">
              {importErrors.map((row, index) => (
                <li key={`${row.line}-${row.field}-${index}`}>
                  Dòng {row.line} · {row.field}: {row.message}
                </li>
              ))}
            </ul>
          )}
          <Button type="button" size="sm" onClick={handleImport} disabled={saving || !importText.trim()}>
            {saving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <FileJson className="mr-1.5 h-3.5 w-3.5" />}
            Nhập vào bản nháp mới
          </Button>
        </div>
      )}

      <div className="rounded-lg border bg-white p-3">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Tạo bản nháp từ bản đang chọn</p>
        <div className="grid gap-2 sm:grid-cols-4">
          <Input
            placeholder="Mã, vd holland-pairs-v2"
            value={draftForm.code}
            onChange={(event) => setDraftForm({ ...draftForm, code: event.target.value })}
          />
          <Input
            placeholder="Tên bộ câu hỏi"
            value={draftForm.title}
            onChange={(event) => setDraftForm({ ...draftForm, title: event.target.value })}
          />
          <Input
            type="number"
            min="1"
            placeholder="Phiên bản"
            value={draftForm.version}
            onChange={(event) => setDraftForm({ ...draftForm, version: event.target.value })}
          />
          <Button
            type="button"
            variant="outline"
            onClick={handleCreateDraft}
            disabled={saving || !draftForm.code || !draftForm.title || !draftForm.version}
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Tạo bản nháp
          </Button>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-slate-500">
          Bộ câu hỏi này chưa có item. Dùng “Import JSON” hoặc tạo bản nháp từ một phiên bản khác.
        </div>
      ) : (
        <div className="max-h-[65vh] overflow-auto rounded-lg border">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 z-10 bg-slate-50 text-[11px] uppercase text-slate-600">
              <tr>
                <th className="px-2 py-2">#</th>
                <th className="px-2 py-2">Nhóm</th>
                <th className="px-2 py-2">Nội dung</th>
                <th className="px-2 py-2">Trái / Phải</th>
                <th className="px-2 py-2">Khoá</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {items.map((item) => (
                <tr key={item.id} className="align-top hover:bg-slate-50/70">
                  <td className="px-2 py-1.5 font-mono text-slate-500">
                    <input
                      type="number"
                      min="1"
                      max="108"
                      value={item.orderIndex}
                      readOnly={!isDraft}
                      onChange={(event) => updateItem(item.id, 'orderIndex', Number(event.target.value))}
                      className="h-7 w-14 rounded border border-input bg-background px-1 text-xs read-only:bg-slate-50"
                    />
                    <label className="mt-1 flex items-center gap-1 text-[10px] text-slate-500">
                      <input
                        type="checkbox"
                        checked={Boolean(item.isActive)}
                        disabled={!isDraft}
                        onChange={(event) => updateItem(item.id, 'isActive', event.target.checked)}
                      />
                      bật
                    </label>
                  </td>
                  <td className="px-2 py-1.5 font-semibold">
                    {item.groupCode}
                    <div className="text-[10px] font-normal text-slate-400">{item.part === 'riasec' ? 'Phần 1' : 'Phần 2'}</div>
                  </td>
                  <td className="px-2 py-1.5">
                    {item.part === 'riasec' ? (
                      <textarea
                        rows={1}
                        value={item.promptText || ''}
                        readOnly={!isDraft}
                        onChange={(event) => updateItem(item.id, 'promptText', event.target.value)}
                        className="w-full min-w-[260px] rounded border border-input bg-background px-1.5 py-1 text-xs read-only:bg-slate-50"
                      />
                    ) : (
                      <span className="text-slate-500">Câu {item.itemNo}</span>
                    )}
                  </td>
                  <td className="px-2 py-1.5">
                    {item.part === 'pairs' ? (
                      <div className="grid min-w-[320px] gap-1">
                        <textarea
                          rows={1}
                          value={item.leftText || ''}
                          readOnly={!isDraft}
                          onChange={(event) => updateItem(item.id, 'leftText', event.target.value)}
                          className="w-full rounded border border-input bg-background px-1.5 py-1 text-xs read-only:bg-slate-50"
                        />
                        <textarea
                          rows={1}
                          value={item.rightText || ''}
                          readOnly={!isDraft}
                          onChange={(event) => updateItem(item.id, 'rightText', event.target.value)}
                          className="w-full rounded border border-input bg-background px-1.5 py-1 text-xs read-only:bg-slate-50"
                        />
                      </div>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-2 py-1.5 font-mono text-[11px] text-slate-600">
                    {item.part === 'pairs' ? (
                      <div className="flex items-center gap-1">
                        <select
                          value={item.leftKey || ''}
                          disabled={!isDraft}
                          onChange={(event) => updateItem(item.id, 'leftKey', event.target.value)}
                          className="h-7 rounded border border-input bg-background px-1 text-xs"
                        >
                          {(item.groupCode || '').split('').map((letter) => (
                            <option key={`l-${letter}`} value={letter}>{letter}</option>
                          ))}
                        </select>
                        <span>/</span>
                        <select
                          value={item.rightKey || ''}
                          disabled={!isDraft}
                          onChange={(event) => updateItem(item.id, 'rightKey', event.target.value)}
                          className="h-7 rounded border border-input bg-background px-1 text-xs"
                        >
                          {(item.groupCode || '').split('').map((letter) => (
                            <option key={`r-${letter}`} value={letter}>{letter}</option>
                          ))}
                        </select>
                      </div>
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(activateTarget)}
        title="Kích hoạt bộ câu hỏi"
        description={`Kích hoạt ${activateTarget?.code || ''} v${activateTarget?.version || ''}? Bộ đang chạy sẽ bị lưu trữ; kết quả cũ vẫn giữ instrument_id cũ.`}
        confirmLabel={saving ? 'Đang kích hoạt...' : 'Kích hoạt'}
        onConfirm={handleActivate}
        onClose={() => setActivateTarget(null)}
      />
    </div>
  )
}

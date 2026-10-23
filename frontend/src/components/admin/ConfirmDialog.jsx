import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import AdminAlert from './AdminAlert'
import AdminDialog from './AdminDialog'
import { getErrorMessage } from '@/lib/adminUtils'

export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Xác nhận',
  cancelLabel = 'Hủy',
  destructive = false,
  requireText = null,
  onConfirm,
  onClose,
  children,
}) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setText('')
    setBusy(false)
    setError('')
  }, [open])

  const canConfirm = !requireText || text.trim() === requireText

  const handleConfirm = async () => {
    if (!canConfirm || busy) return

    setBusy(true)
    setError('')
    try {
      await onConfirm()
    } catch (requestError) {
      setError(getErrorMessage(requestError))
    } finally {
      setBusy(false)
    }
  }

  return (
    <AdminDialog
      open={open}
      title={title}
      description={description}
      onClose={busy ? undefined : onClose}
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={destructive ? 'destructive' : 'default'}
            onClick={handleConfirm}
            disabled={!canConfirm || busy}
          >
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {busy ? 'Đang xử lý...' : confirmLabel}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {children}
        {error && <AdminAlert variant="error">{error}</AdminAlert>}
        {requireText && (
          <div className="space-y-2">
            <Label htmlFor="confirm-text">
              Nhập <strong className="font-mono">{requireText}</strong> để xác nhận
            </Label>
            <Input
              id="confirm-text"
              value={text}
              onChange={(event) => setText(event.target.value)}
              autoComplete="off"
              spellCheck={false}
              autoFocus
            />
          </div>
        )}
      </div>
    </AdminDialog>
  )
}

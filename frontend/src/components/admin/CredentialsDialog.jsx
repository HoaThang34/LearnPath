import { useState } from 'react'
import { Check, Copy, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import AdminAlert from './AdminAlert'
import AdminDialog from './AdminDialog'
import { copyText, downloadCsv } from '@/lib/adminUtils'

export default function CredentialsDialog({
  open,
  title = 'Mật khẩu tạm',
  entries = [],
  skipped = [],
  onClose,
}) {
  const [copiedIndex, setCopiedIndex] = useState(null)
  const [copyError, setCopyError] = useState('')

  const handleCopy = async (entry, index) => {
    setCopyError('')
    const copied = await copyText(entry.password)
    if (copied) {
      setCopiedIndex(index)
      window.setTimeout(() => setCopiedIndex(null), 2000)
    } else {
      setCopyError('Không thể sao chép tự động. Hãy chọn và sao chép mật khẩu bằng tay.')
    }
  }

  const handleCopyAll = async () => {
    setCopyError('')
    const content = entries
      .map((entry) => `${entry.username}\t${entry.password}`)
      .join('\n')
    const copied = await copyText(content)
    if (!copied) {
      setCopyError('Không thể sao chép tự động. Hãy chọn và sao chép bằng tay.')
    }
  }

  const handleDownload = () => {
    downloadCsv(
      'learnpath-tai-khoan-tam.csv',
      [['username', 'password'], ...entries.map((entry) => [entry.username, entry.password])]
    )
  }

  return (
    <AdminDialog
      open={open}
      title={title}
      description="Mật khẩu chỉ hiển thị một lần. Hãy sao chép hoặc tải xuống trước khi đóng."
      onClose={onClose}
      size="lg"
      footer={
        <>
          <Button type="button" variant="outline" onClick={handleCopyAll} disabled={entries.length === 0}>
            <Copy className="mr-2 h-4 w-4" />
            Sao chép tất cả
          </Button>
          <Button type="button" variant="outline" onClick={handleDownload} disabled={entries.length === 0}>
            <Download className="mr-2 h-4 w-4" />
            Tải CSV
          </Button>
          <Button type="button" onClick={onClose}>
            Đã lưu, đóng
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <AdminAlert variant="warning">
          Không lưu mật khẩu tạm vào trình duyệt. Người dùng sẽ phải đổi mật khẩu ở lần đăng nhập đầu tiên.
        </AdminAlert>

        {copyError && <AdminAlert variant="error">{copyError}</AdminAlert>}

        {entries.length > 0 && (
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted/60 text-left">
                <tr>
                  <th className="px-3 py-2 font-medium">Tên đăng nhập</th>
                  <th className="px-3 py-2 font-medium">Mật khẩu tạm</th>
                  <th className="px-3 py-2 font-medium">Sao chép</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry, index) => (
                  <tr key={`${entry.username}-${index}`} className="border-t">
                    <td className="px-3 py-2 font-mono">{entry.username}</td>
                    <td className="px-3 py-2 font-mono">{entry.password}</td>
                    <td className="px-3 py-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleCopy(entry, index)}
                      >
                        {copiedIndex === index ? (
                          <>
                            <Check className="mr-2 h-4 w-4" />
                            Đã chép
                          </>
                        ) : (
                          <>
                            <Copy className="mr-2 h-4 w-4" />
                            Chép
                          </>
                        )}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {skipped.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-semibold">Mục bị bỏ qua ({skipped.length})</h3>
            <ul className="max-h-48 space-y-1 overflow-y-auto rounded-md border bg-muted/30 p-3 text-sm">
              {skipped.map((item, index) => (
                <li key={`${item.username}-${index}`} className="break-words">
                  <span className="font-mono">{item.username}</span>
                  <span className="text-muted-foreground"> — {item.reason}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </AdminDialog>
  )
}

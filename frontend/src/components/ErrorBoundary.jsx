import React from 'react'
import { AlertCircle, RefreshCw, Home } from 'lucide-react'
import { Button } from './ui/button'

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary] Caught rendering error:', error, errorInfo)
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null })
    window.location.reload()
  }

  handleGoHome = () => {
    this.setState({ hasError: false, error: null })
    window.location.href = '/'
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-[50vh] flex-col items-center justify-center p-6 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10 text-destructive mb-4">
            <AlertCircle className="h-8 w-8" />
          </div>
          <h2 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl mb-2">
            Đã xảy ra lỗi khi hiển thị trang
          </h2>
          <p className="max-w-md text-sm text-muted-foreground mb-6">
            Rất tiếc, hệ thống gặp sự cố không mong muốn khi tải giao diện phần này. Vui lòng thử tải lại hoặc quay về trang chủ.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button onClick={this.handleReload} variant="default" className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Tải lại trang
            </Button>
            <Button onClick={this.handleGoHome} variant="outline" className="gap-2">
              <Home className="h-4 w-4" />
              Về trang chủ
            </Button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

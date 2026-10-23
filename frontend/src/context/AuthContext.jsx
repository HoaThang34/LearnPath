import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import {
  changePassword as changePasswordRequest,
  getCurrentUser,
  loginUser,
  logoutUser,
  registerUser,
} from '@/lib/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true

    getCurrentUser()
      .then((response) => {
        if (active) setUser(response.data.data.user)
      })
      .catch((error) => {
        if (error.response?.status !== 401) {
          console.error('[auth] Không thể kiểm tra phiên đăng nhập:', error.message)
        }
        if (active) setUser(null)
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    const handleUnauthorized = () => {
      setUser(null)
      setLoading(false)
    }

    window.addEventListener('auth:unauthorized', handleUnauthorized)
    return () => window.removeEventListener('auth:unauthorized', handleUnauthorized)
  }, [])

  const login = useCallback(async (credentials) => {
    const response = await loginUser(credentials)
    const nextUser = response.data.data.user
    setUser(nextUser)
    return nextUser
  }, [])

  const register = useCallback(async (payload) => {
    const response = await registerUser(payload)
    const nextUser = response.data.data.user
    setUser(nextUser)
    return nextUser
  }, [])

  const logout = useCallback(async () => {
    await logoutUser()
    setUser(null)
  }, [])

  const changePassword = useCallback(async (payload) => {
    const response = await changePasswordRequest(payload)
    const nextUser = response.data.data.user
    setUser(nextUser)
    return nextUser
  }, [])

  const value = useMemo(
    () => ({ user, loading, login, register, logout, changePassword }),
    [user, loading, login, register, logout, changePassword]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth phải được dùng bên trong AuthProvider')
  }
  return context
}

import { createContext, useContext, useState, useEffect } from 'react'

const AuthContext = createContext()

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('token')
    const username = localStorage.getItem('username')
    const isAdmin = localStorage.getItem('is_admin') === '1'
    if (token && username) setUser({ token, username, is_admin: isAdmin })
    setLoading(false)
  }, [])

  const login = (token, username, is_admin) => {
    localStorage.setItem('token', token)
    localStorage.setItem('username', username)
    localStorage.setItem('is_admin', is_admin ? '1' : '0')
    setUser({ token, username, is_admin: !!is_admin })
  }

  const logout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('username')
    localStorage.removeItem('is_admin')
    localStorage.removeItem('apiKey')
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)

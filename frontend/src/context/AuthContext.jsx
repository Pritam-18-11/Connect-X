import { createContext, useContext, useState, useEffect } from 'react'
import api from '../utils/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  // Restore user session
  useEffect(() => {
    const token = sessionStorage.getItem('token')
    const savedUser = sessionStorage.getItem('user')

    if (token && savedUser) {
      try {
        setUser(JSON.parse(savedUser))
      } catch (err) {
        console.error('Failed to parse user session:', err)
        sessionStorage.clear()
      }
    }

    setLoading(false)
  }, [])

  const register = async ({ name, email, password }) => {
    const { data } = await api.post('/auth/register', {
      name,
      email,
      password,
    })

    return data
  }

  const login = async ({ email, password }) => {
    const { data } = await api.post('/auth/login', {
      email,
      password,
    })

    // Store separately per tab/window
    sessionStorage.setItem('token', data.token)
    sessionStorage.setItem('user', JSON.stringify(data.user))

    setUser(data.user)

    return data
  }

  const logout = () => {
    sessionStorage.removeItem('token')
    sessionStorage.removeItem('user')
    setUser(null)
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
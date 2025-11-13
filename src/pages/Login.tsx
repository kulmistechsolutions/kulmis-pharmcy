import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Pill } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card } from '@/components/ui/Card'
import { api } from '@/lib/api'
import { useUser } from '@/contexts/UserContext'

export const Login: React.FC = () => {
  const navigate = useNavigate()
  const { refreshUser } = useUser()
  const [loginMethod, setLoginMethod] = useState<'email' | 'otp'>('email')
  const [formData, setFormData] = useState({
    email: '',
    phone: '',
    password: '',
    otp: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (loginMethod === 'email') {
        if (!formData.email || !formData.password) {
          setError('Email and password are required')
          setLoading(false)
          return
        }
        await api.login({ email: formData.email, password: formData.password })
        // Refresh user context to get updated user data
        await refreshUser()
      } else {
        // OTP login would be implemented here
        setError('OTP login not yet implemented')
        setLoading(false)
        return
      }
      navigate('/dashboard')
    } catch (error: any) {
      console.error('Login error:', error)
      let errorMessage = error.message || 'Login failed'
      
      if (errorMessage.includes('Cannot connect')) {
        errorMessage = 'Backend server is not running. Please start the server first.'
      } else if (errorMessage.includes('fetch')) {
        errorMessage = 'Network error. Check if backend server is running on http://localhost:5000'
      }
      
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-primary-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-500 rounded-2xl mb-4 shadow-lg">
            <Pill className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Kulmis Pharmacy</h1>
          <p className="text-gray-600">Sign in to your account</p>
        </div>

        <Card>
          {/* Login Method Toggle */}
          <div className="flex space-x-2 mb-6 p-1 bg-gray-100 rounded-xl">
            <button
              onClick={() => setLoginMethod('email')}
              className={`flex-1 py-2 px-4 rounded-lg font-medium transition-all ${
                loginMethod === 'email'
                  ? 'bg-white text-primary-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Email
            </button>
            <button
              onClick={() => setLoginMethod('otp')}
              className={`flex-1 py-2 px-4 rounded-lg font-medium transition-all ${
                loginMethod === 'otp'
                  ? 'bg-white text-primary-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              OTP
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {loginMethod === 'email' ? (
              <>
                <Input
                  label="Email"
                  type="email"
                  placeholder="Enter your email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
                <Input
                  label="Password"
                  type="password"
                  placeholder="Enter your password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                />
              </>
            ) : (
              <>
                <Input
                  label="Phone Number"
                  type="tel"
                  placeholder="Enter your phone number"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
                <Input
                  label="OTP Code"
                  type="text"
                  placeholder="Enter OTP"
                  value={formData.otp}
                  onChange={(e) => setFormData({ ...formData, otp: e.target.value })}
                />
                <Button type="button" variant="outline" className="w-full">
                  Send OTP
                </Button>
              </>
            )}

            {loginMethod === 'email' && (
              <div className="flex items-center justify-between">
                <Link to="/forgot-password" className="text-sm text-primary-600 hover:underline">
                  Forgot password?
                </Link>
              </div>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              Don't have an account?{' '}
              <Link to="/register" className="text-primary-600 font-medium hover:underline">
                Sign up
              </Link>
            </p>
          </div>
        </Card>
      </div>
    </div>
  )
}


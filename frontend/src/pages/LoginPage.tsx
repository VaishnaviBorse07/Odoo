import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Building2, Lock, Mail } from 'lucide-react'
import { authService } from '../services/authService'
import { useAuthStore } from '../store/authStore'

interface FormData {
  email: string
  password: string
}

export default function LoginPage() {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>()
  const setAuth = useAuthStore((s) => s.setAuth)
  const navigate = useNavigate()

  const onSubmit = async (data: FormData) => {
    try {
      const res = await authService.login(data)
      setAuth(res.user, res.access_token, res.refresh_token)
      toast.success(`Welcome back, ${res.user.first_name}!`)
      navigate('/dashboard')
    } catch (err: any) {
      toast.error(err.response?.data?.detail ?? 'Login failed')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-900 via-primary-800 to-primary-700 px-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white/10 mb-4">
            <Building2 className="text-white" size={32} />
          </div>
          <h1 className="text-3xl font-bold text-white">ReimburseMe</h1>
          <p className="text-primary-200 mt-1">Sign in to your account</p>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div>
              <label className="label">Email address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-2.5 text-gray-400" size={16} />
                <input
                  {...register('email', { required: 'Email is required' })}
                  type="email"
                  placeholder="you@company.com"
                  className="input pl-9"
                />
              </div>
              {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
            </div>

            <div>
              <label className="label">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-2.5 text-gray-400" size={16} />
                <input
                  {...register('password', { required: 'Password is required' })}
                  type="password"
                  placeholder="••••••••"
                  className="input pl-9"
                />
              </div>
              {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>}
            </div>

            <button type="submit" disabled={isSubmitting} className="btn-primary w-full justify-center py-2.5">
              {isSubmitting ? 'Signing in…' : 'Sign In'}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-6">
            New company?{' '}
            <Link to="/signup" className="text-primary-600 font-medium hover:underline">
              Create account
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}

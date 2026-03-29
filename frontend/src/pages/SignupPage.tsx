import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Building2 } from 'lucide-react'
import { authService } from '../services/authService'
import { useAuthStore } from '../store/authStore'

interface FormData {
  first_name: string
  last_name: string
  email: string
  password: string
  company_name: string
  country: string
  currency_code: string
  currency_symbol: string
}

interface Country {
  name: { common: string }
  currencies: Record<string, { name: string; symbol: string }>
}

export default function SignupPage() {
  const { register, handleSubmit, watch, setValue, formState: { errors, isSubmitting } } = useForm<FormData>()
  const setAuth = useAuthStore((s) => s.setAuth)
  const navigate = useNavigate()
  const [countries, setCountries] = useState<Country[]>([])
  const [loadingCountries, setLoadingCountries] = useState(true)
  const [countryLoadError, setCountryLoadError] = useState(false)

  useEffect(() => {
    setLoadingCountries(true)
    setCountryLoadError(false)
    authService.getCountries().then((data: Country[]) => {
      const sorted = [...data].sort((a, b) => (a.name.common || '').localeCompare(b.name.common || ''))
      setCountries(sorted)
    }).catch((err) => {
      console.error('Failed to load countries:', err)
      setCountryLoadError(true)
    }).finally(() => {
      setLoadingCountries(false)
    })
  }, [])

  const selectedCountry = watch('country')
  useEffect(() => {
    if (!selectedCountry) return
    const country = countries.find((c) => c.name.common === selectedCountry)
    if (country?.currencies) {
      const code = Object.keys(country.currencies)[0]
      const symbol = country.currencies[code]?.symbol ?? ''
      setValue('currency_code', code)
      setValue('currency_symbol', symbol)
    }
  }, [selectedCountry, countries, setValue])

  const onSubmit = async (data: FormData) => {
    try {
      const res = await authService.signup(data)
      setAuth(res.user, res.access_token, res.refresh_token)
      toast.success('Company & account created!')
      navigate('/dashboard')
    } catch (err: any) {
      toast.error(err.response?.data?.detail ?? 'Signup failed')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-900 via-primary-800 to-primary-700 px-4 py-10">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white/10 mb-4">
            <Building2 className="text-white" size={32} />
          </div>
          <h1 className="text-3xl font-bold text-white">Create Your Company</h1>
          <p className="text-primary-200 mt-1">Get started with expense management</p>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">First Name</label>
                <input {...register('first_name', { required: true })} className="input" placeholder="Alice" />
                {errors.first_name && <p className="text-red-500 text-xs mt-1">Required</p>}
              </div>
              <div>
                <label className="label">Last Name</label>
                <input {...register('last_name', { required: true })} className="input" placeholder="Smith" />
                {errors.last_name && <p className="text-red-500 text-xs mt-1">Required</p>}
              </div>
            </div>

            <div>
              <label className="label">Email Address</label>
              <input {...register('email', { required: true })} type="email" className="input" placeholder="admin@company.com" />
              {errors.email && <p className="text-red-500 text-xs mt-1">Required</p>}
            </div>

            <div>
              <label className="label">Password</label>
              <input {...register('password', { required: true, minLength: 8 })} type="password" className="input" placeholder="Min 8 characters" />
              {errors.password && <p className="text-red-500 text-xs mt-1">Min 8 characters required</p>}
            </div>

            <div>
              <label className="label">Company Name</label>
              <input {...register('company_name', { required: true })} className="input" placeholder="Acme Corp" />
              {errors.company_name && <p className="text-red-500 text-xs mt-1">Required</p>}
            </div>

            <div>
              <label className="label">Country</label>
              <select
                {...register('country', { required: true })}
                className="input"
                disabled={loadingCountries || countryLoadError}
              >
                <option value="">
                  {loadingCountries ? 'Loading countries…' : countryLoadError ? 'Unable to load countries' : 'Select country…'}
                </option>
                {countries.map((c) => (
                  <option key={c.name.common} value={c.name.common}>{c.name.common}</option>
                ))}
              </select>
              {errors.country && <p className="text-red-500 text-xs mt-1">Required</p>}
              {countryLoadError && (
                <p className="text-red-500 text-xs mt-1">Unable to load countries. Refresh the page or try again later.</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Currency Code</label>
                <input {...register('currency_code', { required: true })} className="input bg-gray-50" readOnly placeholder="Auto-filled" />
              </div>
              <div>
                <label className="label">Currency Symbol</label>
                <input {...register('currency_symbol')} className="input bg-gray-50" readOnly placeholder="Auto-filled" />
              </div>
            </div>

            <button type="submit" disabled={isSubmitting} className="btn-primary w-full justify-center py-2.5 mt-2">
              {isSubmitting ? 'Creating account…' : 'Create Account & Company'}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-6">
            Already have an account?{' '}
            <Link to="/login" className="text-primary-600 font-medium hover:underline">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  )
}

import api from './api'

export interface LoginPayload {
  email: string
  password: string
}

export interface SignupPayload {
  email: string
  password: string
  first_name: string
  last_name: string
  company_name: string
  country: string
  currency_code: string
  currency_symbol?: string
}

export const authService = {
  login: (data: LoginPayload) => api.post('/auth/login', data).then((r) => r.data),
  signup: (data: SignupPayload) => api.post('/auth/signup', data).then((r) => r.data),
  logout: (refresh_token: string) => api.post('/auth/logout', { refresh_token }),
  getCountries: () => api.get('/company/countries').then((r) => r.data),
}

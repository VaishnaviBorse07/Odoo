import api from './api'

export const expenseService = {
  list: (params?: Record<string, unknown>) =>
    api.get('/expenses/', { params }).then((r) => r.data),

  get: (id: string) => api.get(`/expenses/${id}`).then((r) => r.data),

  create: (data: Record<string, unknown>) =>
    api.post('/expenses/', data).then((r) => r.data),

  update: (id: string, data: Record<string, unknown>) =>
    api.patch(`/expenses/${id}`, data).then((r) => r.data),

  delete: (id: string) => api.delete(`/expenses/${id}`),

  uploadReceipt: (id: string, file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    return api.post(`/expenses/${id}/receipt`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then((r) => r.data)
  },

  override: (id: string, action: 'approve' | 'reject', notes?: string) =>
    api.post(`/expenses/${id}/override`, null, { params: { action, notes } }).then((r) => r.data),

  listCategories: () => api.get('/expenses/categories').then((r) => r.data),

  createCategory: (data: { name: string; description?: string }) =>
    api.post('/expenses/categories', data).then((r) => r.data),
}

import api from './api'

export const userService = {
  me: () => api.get('/users/me').then((r) => r.data),
  list: () => api.get('/users/').then((r) => r.data),
  get: (id: string) => api.get(`/users/${id}`).then((r) => r.data),
  create: (data: Record<string, unknown>) => api.post('/users/', data).then((r) => r.data),
  update: (id: string, data: Record<string, unknown>) =>
    api.patch(`/users/${id}`, data).then((r) => r.data),
  delete: (id: string) => api.delete(`/users/${id}`),
  assignManager: (userId: string, managerId: string) =>
    api.post(`/users/${userId}/managers`, { manager_id: managerId }).then((r) => r.data),
  removeManager: (userId: string, managerId: string) =>
    api.delete(`/users/${userId}/managers/${managerId}`),
  getManagers: (userId: string) =>
    api.get(`/users/${userId}/managers`).then((r) => r.data),
}

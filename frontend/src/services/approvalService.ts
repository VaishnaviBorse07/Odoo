import api from './api'

export const approvalService = {
  listRules: () => api.get('/approvals/rules').then((r) => r.data),
  createRule: (data: Record<string, unknown>) =>
    api.post('/approvals/rules', data).then((r) => r.data),
  updateRule: (id: string, data: Record<string, unknown>) =>
    api.patch(`/approvals/rules/${id}`, data).then((r) => r.data),
  deleteRule: (id: string) => api.delete(`/approvals/rules/${id}`),

  pendingApprovals: () => api.get('/approvals/pending').then((r) => r.data),
  takeAction: (approvalId: string, action: 'approve' | 'reject', comments?: string) =>
    api.post(`/approvals/${approvalId}/action`, { action, comments }).then((r) => r.data),
  expenseHistory: (expenseId: string) =>
    api.get(`/approvals/expense/${expenseId}`).then((r) => r.data),
}

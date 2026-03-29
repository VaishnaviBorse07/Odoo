import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { CheckCircle, XCircle, Eye, MessageSquare } from 'lucide-react'
import toast from 'react-hot-toast'
import { approvalService } from '../services/approvalService'
import { expenseService } from '../services/expenseService'
import { formatCurrency, formatDate } from '../utils/helpers'
import ExpenseDetail from '../components/Expenses/ExpenseDetail'

export default function ApprovalsPage() {
  const qc = useQueryClient()
  const [selectedExpenseId, setSelectedExpenseId] = useState<string | null>(null)
  const [commentModal, setCommentModal] = useState<{ id: string; action: 'approve' | 'reject' } | null>(null)
  const [comment, setComment] = useState('')

  const { data: pendingApprovals, isLoading } = useQuery({
    queryKey: ['approvals', 'pending'],
    queryFn: approvalService.pendingApprovals,
    staleTime: 15_000,
  })

  const actionMut = useMutation({
    mutationFn: ({ id, action, comments }: { id: string; action: 'approve' | 'reject'; comments?: string }) =>
      approvalService.takeAction(id, action, comments),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['approvals', 'pending'] })
      qc.invalidateQueries({ queryKey: ['expenses'] })
      toast.success(`Expense ${vars.action}d successfully`)
      setCommentModal(null)
      setComment('')
    },
    onError: (err: any) => toast.error(err.response?.data?.detail ?? 'Action failed'),
  })

  const expenseIdsKey = useMemo(
    () => (pendingApprovals ?? []).map((a: any) => a.expense_id).sort().join(','),
    [pendingApprovals]
  )

  const { data: expenseMap } = useQuery({
    queryKey: ['expenses-for-approvals', expenseIdsKey],
    queryFn: async () => {
      if (!pendingApprovals?.length) return {}
      const map: Record<string, any> = {}
      await Promise.allSettled(
        pendingApprovals.map(async (a: any) => {
          map[a.expense_id] = await expenseService.get(a.expense_id)
        })
      )
      return map
    },
    enabled: !!pendingApprovals?.length,
    staleTime: 30_000,
  })

  const handleQuickAction = (id: string, action: 'approve' | 'reject') => {
    if (action === 'reject') {
      setCommentModal({ id, action })
    } else {
      actionMut.mutate({ id, action })
    }
  }

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Pending Approvals</h1>
        <p className="text-gray-500 text-sm mt-0.5">{pendingApprovals?.length ?? 0} expense(s) awaiting your action</p>
      </div>

      {isLoading ? (
        <div className="text-center py-16 text-gray-400">Loading approvals…</div>
      ) : pendingApprovals?.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-20">
          <CheckCircle size={48} className="text-green-400 mb-3" />
          <h3 className="text-lg font-semibold text-gray-700">You're all caught up!</h3>
          <p className="text-gray-400 text-sm">No pending approvals at the moment</p>
        </div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['Employee', 'Expense', 'Amount', 'Date', 'Step', 'Actions'].map((h) => (
                  <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {pendingApprovals?.map((approval: any) => {
                const expense = expenseMap?.[approval.expense_id]
                return (
                  <tr key={approval.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-4">
                      <p className="font-medium text-gray-900">{expense?.employee_name ?? '—'}</p>
                    </td>
                    <td className="px-5 py-4">
                      <p className="font-medium text-gray-800">{expense?.title ?? '…'}</p>
                      <p className="text-xs text-gray-400">{expense?.category_name ?? ''}</p>
                    </td>
                    <td className="px-5 py-4">
                      <p className="font-semibold text-gray-900">
                        {expense ? formatCurrency(expense.amount_in_company_currency ?? expense.amount) : '—'}
                      </p>
                      {expense?.currency_code !== 'USD' && expense?.amount_in_company_currency && (
                        <p className="text-xs text-gray-400">{formatCurrency(expense.amount, expense.currency_code)}</p>
                      )}
                    </td>
                    <td className="px-5 py-4 text-gray-500">
                      {expense ? formatDate(expense.expense_date) : '—'}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex flex-col items-start gap-1">
                        <span className="badge bg-primary-100 text-primary-700">Step {approval.step_number}</span>
                        {approval.approver_role_label && (
                          <span className="text-xs text-gray-500">{approval.approver_role_label}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setSelectedExpenseId(approval.expense_id)}
                          className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg"
                          title="View expense"
                        >
                          <Eye size={15} />
                        </button>
                        <button
                          onClick={() => handleQuickAction(approval.id, 'approve')}
                          disabled={actionMut.isPending}
                          className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg"
                          title="Approve"
                        >
                          <CheckCircle size={15} />
                        </button>
                        <button
                          onClick={() => setCommentModal({ id: approval.id, action: 'reject' })}
                          disabled={actionMut.isPending}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                          title="Reject"
                        >
                          <XCircle size={15} />
                        </button>
                        <button
                          onClick={() => setCommentModal({ id: approval.id, action: 'approve' })}
                          disabled={actionMut.isPending}
                          className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                          title="Approve with comment"
                        >
                          <MessageSquare size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Comment Modal */}
      {commentModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-1 capitalize">{commentModal.action} Expense</h3>
            <p className="text-sm text-gray-500 mb-4">Add an optional comment for this decision.</p>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
              className="input resize-none mb-4"
              placeholder={commentModal.action === 'reject' ? 'Reason for rejection…' : 'Optional comment…'}
            />
            <div className="flex gap-3">
              <button onClick={() => { setCommentModal(null); setComment('') }} className="btn-secondary flex-1 justify-center">Cancel</button>
              <button
                onClick={() => actionMut.mutate({ id: commentModal.id, action: commentModal.action, comments: comment })}
                disabled={actionMut.isPending}
                className={`flex-1 justify-center ${commentModal.action === 'approve' ? 'btn-success' : 'btn-danger'}`}
              >
                {commentModal.action === 'approve' ? 'Approve' : 'Reject'}
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedExpenseId && (
        <ExpenseDetail expenseId={selectedExpenseId} onClose={() => setSelectedExpenseId(null)} />
      )}
    </div>
  )
}

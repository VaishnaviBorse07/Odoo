import { useQuery } from '@tanstack/react-query'
import { X, FileText, Clock, CheckCircle, XCircle, CircleDashed, Ban } from 'lucide-react'
import { expenseService } from '../../services/expenseService'
import { approvalService } from '../../services/approvalService'
import { formatCurrency, formatDate, statusColor } from '../../utils/helpers'

interface Props {
  expenseId: string
  onClose: () => void
}

export default function ExpenseDetail({ expenseId, onClose }: Props) {
  const { data: expense } = useQuery({
    queryKey: ['expense', expenseId],
    queryFn: () => expenseService.get(expenseId),
  })

  const { data: approvals } = useQuery({
    queryKey: ['approvals', 'expense', expenseId],
    queryFn: () => approvalService.expenseHistory(expenseId),
  })

  if (!expense) return null

  const stepIcon = (status: string) => {
    if (status === 'approved') return <CheckCircle size={16} className="text-green-500" />
    if (status === 'rejected') return <XCircle size={16} className="text-red-500" />
    if (status === 'waiting') return <CircleDashed size={16} className="text-gray-400" />
    if (status === 'cancelled') return <Ban size={16} className="text-gray-300" />
    return <Clock size={16} className="text-yellow-500" />
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{expense.title}</h2>
            <span className={`${statusColor(expense.status)} mt-1`}>{expense.status.replace('_', ' ')}</span>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg"><X size={18} /></button>
        </div>

        <div className="p-6 space-y-6">
          {/* Details Grid */}
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: 'Amount', value: formatCurrency(expense.amount, expense.currency_code) },
              { label: 'Company Currency', value: expense.amount_in_company_currency ? formatCurrency(expense.amount_in_company_currency) : '—' },
              { label: 'Exchange Rate', value: expense.exchange_rate ? `1 ${expense.currency_code} = ${expense.exchange_rate}` : '—' },
              { label: 'Date', value: formatDate(expense.expense_date) },
              { label: 'Category', value: expense.category_name ?? '—' },
              { label: 'Submitted by', value: expense.employee_name ?? '—' },
            ].map((item) => (
              <div key={item.label} className="bg-gray-50 rounded-xl p-3">
                <p className="text-xs text-gray-500 mb-0.5">{item.label}</p>
                <p className="text-sm font-medium text-gray-900">{item.value}</p>
              </div>
            ))}
          </div>

          {expense.description && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-1">Description</h3>
              <p className="text-sm text-gray-600 bg-gray-50 rounded-xl p-3">{expense.description}</p>
            </div>
          )}

          {/* OCR Data */}
          {expense.ocr_data && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                <FileText size={15} /> OCR Extracted Data
              </h3>
              <div className="bg-blue-50 rounded-xl p-3 space-y-1">
                {Object.entries(expense.ocr_data).map(([k, v]) => (
                  <div key={k} className="flex justify-between text-sm">
                    <span className="text-gray-500 capitalize">{k}</span>
                    <span className="font-medium text-gray-800">{String(v)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Receipt */}
          {expense.receipt_url && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Receipt</h3>
              <img src={expense.receipt_url} alt="Receipt" className="max-w-full rounded-xl border border-gray-200" />
            </div>
          )}

          {/* Approval Timeline */}
          {approvals && approvals.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Approval Timeline</h3>
              <div className="space-y-3">
                {approvals.map((a: any, i: number) => (
                  <div key={a.id} className="flex items-start gap-3">
                    <div className="flex flex-col items-center">
                      {stepIcon(a.status)}
                      {i < approvals.length - 1 && <div className="w-px h-6 bg-gray-200 mt-1" />}
                    </div>
                    <div className="flex-1 pb-3">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-gray-800">
                          Step {a.step_number}
                          {a.approver_role_label ? ` - ${a.approver_role_label}` : ''}
                          {a.approver_name ? `: ${a.approver_name}` : ''}
                        </p>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          a.status === 'approved' ? 'bg-green-100 text-green-700' :
                          a.status === 'rejected' ? 'bg-red-100 text-red-700' :
                          a.status === 'waiting' ? 'bg-gray-100 text-gray-500' :
                          a.status === 'cancelled' ? 'bg-gray-100 text-gray-400' :
                          'bg-yellow-100 text-yellow-700'
                        }`}>{a.status}</span>
                      </div>
                      {a.comments && <p className="text-xs text-gray-500 mt-0.5">"{a.comments}"</p>}
                      {a.action_at && <p className="text-xs text-gray-400 mt-0.5">{formatDate(a.action_at)}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {expense.admin_notes && (
            <div className="bg-orange-50 rounded-xl p-3">
              <p className="text-xs font-semibold text-orange-700 mb-1">Admin Notes</p>
              <p className="text-sm text-orange-800">{expense.admin_notes}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

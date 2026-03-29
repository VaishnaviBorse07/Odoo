import { useState } from 'react'
import { keepPreviousData, useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Eye, Trash2, Filter } from 'lucide-react'
import toast from 'react-hot-toast'
import { expenseService } from '../services/expenseService'
import { formatCurrency, formatDate, statusColor } from '../utils/helpers'
import { useAuthStore } from '../store/authStore'
import ExpenseForm from '../components/Expenses/ExpenseForm'
import ExpenseDetail from '../components/Expenses/ExpenseDetail'

const STATUS_FILTERS = ['', 'pending', 'in_review', 'approved', 'rejected']

export default function ExpensesPage() {
  const qc = useQueryClient()
  const user = useAuthStore((s) => s.user)
  const [showForm, setShowForm] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(1)

  const { data, isLoading } = useQuery({
    queryKey: ['expenses', statusFilter, page],
    queryFn: () => expenseService.list({ status: statusFilter || undefined, page, page_size: 15 }),
    placeholderData: keepPreviousData,
  })

  const deleteMut = useMutation({
    mutationFn: expenseService.delete,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['expenses'] }); toast.success('Expense deleted') },
  })

  const expenses = data?.items ?? []
  const total = data?.total ?? 0
  const totalPages = Math.ceil(total / 15)

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Expenses</h1>
          <p className="text-gray-500 text-sm mt-0.5">{total} expense{total !== 1 ? 's' : ''} total</p>
        </div>
        <button onClick={() => setShowForm(true)} className="btn-primary">
          <Plus size={16} /> New Expense
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-5">
        <Filter size={16} className="text-gray-400" />
        <span className="text-sm text-gray-600">Status:</span>
        {STATUS_FILTERS.map((s) => (
          <button
            key={s}
            onClick={() => { setStatusFilter(s); setPage(1) }}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
              statusFilter === s
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {s === '' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1).replace('_', ' ')}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {['Title', 'Category', 'Date', 'Amount', 'Company Currency', 'Status', 'Actions'].map((h) => (
                <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? (
              <tr><td colSpan={7} className="text-center py-12 text-gray-400">Loading…</td></tr>
            ) : expenses.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-12 text-gray-400">No expenses found</td></tr>
            ) : (
              expenses.map((e: any) => (
                <tr key={e.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3.5 font-medium text-gray-900">{e.title}</td>
                  <td className="px-5 py-3.5 text-gray-500">{e.category_name ?? '—'}</td>
                  <td className="px-5 py-3.5 text-gray-500">{formatDate(e.expense_date)}</td>
                  <td className="px-5 py-3.5 font-medium">{formatCurrency(e.amount, e.currency_code)}</td>
                  <td className="px-5 py-3.5 text-gray-500">
                    {e.amount_in_company_currency ? formatCurrency(e.amount_in_company_currency) : '—'}
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={statusColor(e.status)}>{e.status.replace('_', ' ')}</span>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2">
                      <button onClick={() => setSelectedId(e.id)} className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg" title="View">
                        <Eye size={15} />
                      </button>
                      {e.status === 'pending' && e.employee_id === user?.id && (
                        <button
                          onClick={() => { if (confirm('Delete this expense?')) deleteMut.mutate(e.id) }}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                          title="Delete"
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100">
            <p className="text-sm text-gray-500">Page {page} of {totalPages}</p>
            <div className="flex gap-2">
              <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="btn-secondary text-xs py-1.5 px-3 disabled:opacity-40">← Prev</button>
              <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)} className="btn-secondary text-xs py-1.5 px-3 disabled:opacity-40">Next →</button>
            </div>
          </div>
        )}
      </div>

      {showForm && <ExpenseForm onClose={() => setShowForm(false)} />}
      {selectedId && <ExpenseDetail expenseId={selectedId} onClose={() => setSelectedId(null)} />}
    </div>
  )
}

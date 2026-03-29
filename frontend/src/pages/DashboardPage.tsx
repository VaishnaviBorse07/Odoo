import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Receipt, CheckSquare, Clock, XCircle, TrendingUp } from 'lucide-react'
import { expenseService } from '../services/expenseService'
import { approvalService } from '../services/approvalService'
import { useAuthStore } from '../store/authStore'
import { formatCurrency } from '../utils/helpers'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user)
  const isManagerOrAdmin = user?.role !== 'employee'

  const { data: expenseData } = useQuery({
    queryKey: ['expenses', 'all'],
    queryFn: () => expenseService.list({ page_size: 100 }),
    staleTime: 60_000,
  })

  const { data: pendingApprovals } = useQuery({
    queryKey: ['approvals', 'pending'],
    queryFn: approvalService.pendingApprovals,
    enabled: isManagerOrAdmin,
    staleTime: 15_000,
  })

  const expenses = expenseData?.items ?? []
  const metrics = useMemo(() => {
    const monthlyMap: Record<string, number> = {}
    let pending = 0
    let inReview = 0
    let approved = 0
    let rejected = 0
    let totalApproved = 0

    for (const expense of expenses) {
      const amount = Number(expense.amount_in_company_currency ?? expense.amount)
      if (expense.status === 'pending') pending += 1
      else if (expense.status === 'in_review') inReview += 1
      else if (expense.status === 'approved') {
        approved += 1
        totalApproved += amount
      } else if (expense.status === 'rejected') rejected += 1

      const month = expense.expense_date?.slice(0, 7)
      if (month) monthlyMap[month] = (monthlyMap[month] ?? 0) + amount
    }

    const chartData = Object.entries(monthlyMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6)
      .map(([month, amount]) => ({ month, amount }))

    return { pending, inReview, approved, rejected, totalApproved, chartData }
  }, [expenses])

  const stats = [
    { label: 'Total Approved', value: formatCurrency(metrics.totalApproved), icon: TrendingUp, color: 'text-green-600', bg: 'bg-green-50' },
    { label: 'Pending', value: metrics.pending, icon: Clock, color: 'text-yellow-600', bg: 'bg-yellow-50' },
    { label: 'In Review', value: metrics.inReview, icon: Receipt, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Rejected', value: metrics.rejected, icon: XCircle, color: 'text-red-600', bg: 'bg-red-50' },
  ]

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">
          Welcome back, {user?.first_name}! 👋
        </h1>
        <p className="text-gray-500 mt-1">Here's an overview of your expenses</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        {stats.map((s) => (
          <div key={s.label} className="card flex items-center gap-4">
            <div className={`p-3 rounded-xl ${s.bg}`}>
              <s.icon className={s.color} size={24} />
            </div>
            <div>
              <p className="text-sm text-gray-500">{s.label}</p>
              <p className="text-2xl font-bold text-gray-900">{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart */}
        <div className="card lg:col-span-2">
          <h2 className="text-base font-semibold text-gray-800 mb-4">Monthly Expense Trend</h2>
          {metrics.chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={metrics.chartData}>
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v: number) => formatCurrency(v)} />
                <Bar dataKey="amount" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-52 flex items-center justify-center text-gray-400 text-sm">No data yet</div>
          )}
        </div>

        {/* Pending Approvals */}
        {isManagerOrAdmin && (
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-gray-800">Pending My Approval</h2>
              <span className="badge bg-orange-100 text-orange-700">{pendingApprovals?.length ?? 0}</span>
            </div>
            {pendingApprovals?.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-gray-400">
                <CheckSquare size={32} className="mb-2 opacity-50" />
                <p className="text-sm">All caught up!</p>
              </div>
            ) : (
              <ul className="space-y-3">
                {pendingApprovals?.slice(0, 5).map((a: any) => (
                  <li key={a.id} className="flex items-center justify-between py-2 border-b border-gray-100">
                    <div>
                      <p className="text-sm font-medium text-gray-800">Step {a.step_number}</p>
                      <p className="text-xs text-gray-500">Expense #{a.expense_id.slice(-6)}</p>
                    </div>
                    <span className="badge-pending text-xs">Pending</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

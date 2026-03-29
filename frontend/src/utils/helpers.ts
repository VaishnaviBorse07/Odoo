export function formatCurrency(amount: number | string, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(Number(amount))
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export function statusColor(status: string): string {
  const map: Record<string, string> = {
    pending: 'badge-pending',
    in_review: 'badge-in_review',
    approved: 'badge-approved',
    rejected: 'badge-rejected',
  }
  return map[status] ?? 'badge'
}

export function roleBadge(role: string): string {
  const map: Record<string, string> = {
    admin: 'bg-purple-100 text-purple-800',
    manager: 'bg-blue-100 text-blue-800',
    employee: 'bg-gray-100 text-gray-800',
  }
  return map[role] ?? 'bg-gray-100 text-gray-700'
}

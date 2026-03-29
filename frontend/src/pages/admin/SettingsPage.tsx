import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import api from '../../services/api'
import { expenseService } from '../../services/expenseService'

interface CompanyForm {
  name: string
  country: string
  currency_code: string
  currency_symbol: string
}

interface CategoryForm {
  name: string
  description: string
}

export default function SettingsPage() {
  const qc = useQueryClient()

  const { data: company } = useQuery({
    queryKey: ['company'],
    queryFn: () => api.get('/company/').then((r) => r.data),
  })

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: expenseService.listCategories,
  })

  const { register: regComp, handleSubmit: hsComp, formState: { isSubmitting: csub } } = useForm<CompanyForm>({
    values: company,
  })

  const { register: regCat, handleSubmit: hsCat, reset: resetCat, formState: { isSubmitting: catsub } } = useForm<CategoryForm>()

  const companyMut = useMutation({
    mutationFn: (d: CompanyForm) => api.patch('/company/', d).then((r) => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['company'] }); toast.success('Company updated') },
  })

  const catMut = useMutation({
    mutationFn: expenseService.createCategory,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['categories'] }); toast.success('Category added'); resetCat() },
    onError: (e: any) => toast.error(e.response?.data?.detail ?? 'Failed'),
  })

  return (
    <div className="p-8 max-w-3xl space-y-8">
      <h1 className="text-2xl font-bold text-gray-900">Settings</h1>

      {/* Company Settings */}
      <div className="card">
        <h2 className="text-base font-semibold text-gray-800 mb-4">Company Settings</h2>
        <form onSubmit={hsComp((d) => companyMut.mutate(d))} className="space-y-4">
          <div>
            <label className="label">Company Name</label>
            <input {...regComp('name')} className="input" />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="label">Country</label>
              <input {...regComp('country')} className="input" />
            </div>
            <div>
              <label className="label">Currency Code</label>
              <input {...regComp('currency_code')} className="input" placeholder="INR" />
            </div>
            <div>
              <label className="label">Currency Symbol</label>
              <input {...regComp('currency_symbol')} className="input" placeholder="₹" />
            </div>
          </div>
          <button type="submit" disabled={csub} className="btn-primary">Save Company Settings</button>
        </form>
      </div>

      {/* Expense Categories */}
      <div className="card">
        <h2 className="text-base font-semibold text-gray-800 mb-4">Expense Categories</h2>
        <form onSubmit={hsCat((d) => catMut.mutate(d))} className="flex gap-3 mb-4">
          <input {...regCat('name', { required: true })} className="input" placeholder="New category name" />
          <input {...regCat('description')} className="input" placeholder="Description (optional)" />
          <button type="submit" disabled={catsub} className="btn-primary whitespace-nowrap">Add Category</button>
        </form>
        <div className="space-y-2">
          {categories?.map((c: any) => (
            <div key={c.id} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
              <div>
                <span className="text-sm font-medium text-gray-800">{c.name}</span>
                {c.description && <span className="text-xs text-gray-400 ml-2">— {c.description}</span>}
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full ${c.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-500'}`}>
                {c.is_active ? 'Active' : 'Inactive'}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

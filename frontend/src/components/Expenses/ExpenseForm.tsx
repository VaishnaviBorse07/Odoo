import { useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { X, Upload, Loader2 } from 'lucide-react'
import { expenseService } from '../../services/expenseService'

interface Props { onClose: () => void }

interface FormData {
  title: string
  description: string
  expense_date: string
  amount: number
  currency_code: string
  category_id: string
}

export default function ExpenseForm({ onClose }: Props) {
  const qc = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [receipt, setReceipt] = useState<File | null>(null)
  const [ocrLoading, setOcrLoading] = useState(false)

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: expenseService.listCategories,
  })

  const { register, handleSubmit, setValue, formState: { errors, isSubmitting } } = useForm<FormData>({
    defaultValues: { currency_code: 'USD', expense_date: new Date().toISOString().slice(0, 10) },
  })

  const createMut = useMutation({
    mutationFn: (data: FormData) => expenseService.create({
      ...data,
      amount: Number(data.amount),
      category_id: data.category_id || undefined,
    }),
    onSuccess: async (expense) => {
      if (receipt) {
        try {
          setOcrLoading(true)
          const updated = await expenseService.uploadReceipt(expense.id, receipt)
          if (updated.ocr_data?.status === 'failed') {
            toast.error(updated.ocr_data.error ?? 'Receipt OCR failed')
          } else if (updated.ocr_data) {
            const merchant = updated.ocr_data.merchant ? ` for ${updated.ocr_data.merchant}` : ''
            const warnings = Array.isArray(updated.ocr_data.warnings) ? updated.ocr_data.warnings : []
            toast.success(`Receipt processed via OCR${merchant}!`)
            if (warnings.length > 0) {
              toast((t) => (
                <span className="text-sm">
                  {warnings[0]}
                  <button className="ml-3 font-semibold text-primary-700" onClick={() => toast.dismiss(t.id)}>
                    Dismiss
                  </button>
                </span>
              ))
            }
          }
        } catch (err: any) {
          toast.error(err.response?.data?.detail ?? 'Receipt upload failed')
        } finally { setOcrLoading(false) }
      }
      qc.invalidateQueries({ queryKey: ['expenses'] })
      toast.success('Expense submitted!')
      onClose()
    },
    onError: (err: any) => toast.error(err.response?.data?.detail ?? 'Failed to submit'),
  })

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) setReceipt(file)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">Submit New Expense</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg"><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit((d) => createMut.mutate(d))} className="p-6 space-y-4">
          <div>
            <label className="label">Title *</label>
            <input {...register('title', { required: true })} className="input" placeholder="E.g. Team lunch" />
            {errors.title && <p className="text-red-500 text-xs mt-1">Required</p>}
          </div>

          <div>
            <label className="label">Category</label>
            <select {...register('category_id')} className="input">
              <option value="">Select category…</option>
              {categories?.map((c: any) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">Description</label>
            <textarea {...register('description')} rows={2} className="input resize-none" placeholder="Optional details…" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Amount *</label>
              <input {...register('amount', { required: true, min: 0.01 })} type="number" step="0.01" className="input" placeholder="0.00" />
              {errors.amount && <p className="text-red-500 text-xs mt-1">Required</p>}
            </div>
            <div>
              <label className="label">Currency *</label>
              <input {...register('currency_code', { required: true })} className="input" placeholder="USD" />
            </div>
          </div>

          <div>
            <label className="label">Expense Date *</label>
            <input {...register('expense_date', { required: true })} type="date" className="input" />
            {errors.expense_date && <p className="text-red-500 text-xs mt-1">Required</p>}
          </div>

          {/* Receipt Upload */}
          <div>
            <label className="label">Receipt (optional – OCR enabled)</label>
            <div
              onClick={() => fileRef.current?.click()}
              className="border-2 border-dashed border-gray-300 rounded-xl p-4 text-center cursor-pointer hover:border-primary-400 hover:bg-primary-50 transition-all"
            >
              {receipt ? (
                <p className="text-sm text-primary-700 font-medium">{receipt.name}</p>
              ) : (
                <div className="flex flex-col items-center gap-1">
                  <Upload size={20} className="text-gray-400" />
                  <p className="text-sm text-gray-500">Click to upload receipt image</p>
                  <p className="text-xs text-gray-400">JPG, PNG, PDF</p>
                </div>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/*,.pdf" className="hidden" onChange={handleFileChange} />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
            <button type="submit" disabled={isSubmitting || ocrLoading} className="btn-primary flex-1 justify-center">
              {(isSubmitting || ocrLoading) && <Loader2 size={15} className="animate-spin" />}
              {isSubmitting ? 'Submitting…' : ocrLoading ? 'Processing OCR…' : 'Submit Expense'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

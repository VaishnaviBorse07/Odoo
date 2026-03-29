import { useState } from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { approvalService } from '../../services/approvalService'
import { userService } from '../../services/userService'

interface Step {
  step_number: number
  approver_user_id: string
  approver_role_label: string
  is_manager_of_employee: boolean
  is_key_approver: boolean
}

interface FormData {
  name: string
  description: string
  min_amount: string
  max_amount: string
  rule_type: string
  percentage_threshold: string
  steps: Step[]
}

interface Props {
  rule?: any
  onClose: () => void
}

const getApiErrorMessage = (error: any) => {
  const detail = error?.response?.data?.detail
  if (Array.isArray(detail) && detail.length > 0) {
    return detail[0]?.msg ?? 'Validation failed'
  }
  return detail ?? 'Failed'
}

export default function ApprovalRuleForm({ rule, onClose }: Props) {
  const qc = useQueryClient()
  const { data: users } = useQuery({ queryKey: ['users'], queryFn: userService.list })

  const { register, handleSubmit, control, watch, formState: { errors, isSubmitting } } = useForm<FormData>({
    defaultValues: rule ? {
      name: rule.name,
      description: rule.description ?? '',
      min_amount: rule.min_amount ?? '',
      max_amount: rule.max_amount ?? '',
      rule_type: rule.rule_type,
      percentage_threshold: rule.percentage_threshold ?? '',
      steps: rule.steps.map((s: any) => ({
        step_number: s.step_number,
        approver_user_id: s.approver_user_id ?? '',
        approver_role_label: s.approver_role_label ?? '',
        is_manager_of_employee: s.is_manager_of_employee,
        is_key_approver: s.is_key_approver,
      })),
    } : {
      name: '',
      description: '',
      min_amount: '',
      max_amount: '',
      rule_type: 'sequential',
      percentage_threshold: '',
      steps: [{ step_number: 1, approver_user_id: '', approver_role_label: '', is_manager_of_employee: true, is_key_approver: false }],
    },
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'steps' })
  const ruleType = watch('rule_type')

  const createMut = useMutation({
    mutationFn: (d: any) => approvalService.createRule(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['approval-rules'] }); toast.success('Rule created'); onClose() },
    onError: (e: any) => toast.error(getApiErrorMessage(e)),
  })

  const updateMut = useMutation({
    mutationFn: (d: any) => approvalService.updateRule(rule.id, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['approval-rules'] }); toast.success('Rule updated'); onClose() },
    onError: (e: any) => toast.error(getApiErrorMessage(e)),
  })

  const onSubmit = (data: FormData) => {
    const payload = {
      name: data.name,
      description: data.description || undefined,
      min_amount: data.min_amount ? Number(data.min_amount) : null,
      max_amount: data.max_amount ? Number(data.max_amount) : null,
      rule_type: data.rule_type,
      percentage_threshold: data.percentage_threshold ? Number(data.percentage_threshold) : null,
      steps: data.steps.map((s, i) => ({
        step_number: i + 1,
        approver_user_id: s.approver_user_id || null,
        approver_role_label: s.approver_role_label || null,
        is_manager_of_employee: s.is_manager_of_employee,
        is_key_approver: s.is_key_approver,
      })),
    }
    if (rule) updateMut.mutate(payload)
    else createMut.mutate(payload)
  }

  const managers = users?.filter((u: any) => u.role !== 'employee') ?? []

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">{rule ? 'Edit' : 'Create'} Approval Rule</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg"><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-5">
          <div>
            <label className="label">Rule Name *</label>
            <input {...register('name', { required: true })} className="input" placeholder="E.g. Standard Approval" />
          </div>

          <div>
            <label className="label">Description</label>
            <textarea {...register('description')} rows={2} className="input resize-none" placeholder="Optional description…" />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="label">Min Amount</label>
              <input {...register('min_amount')} type="number" step="0.01" className="input" placeholder="No limit" />
            </div>
            <div>
              <label className="label">Max Amount</label>
              <input {...register('max_amount')} type="number" step="0.01" className="input" placeholder="No limit" />
            </div>
            <div>
              <label className="label">Rule Type *</label>
              <select {...register('rule_type')} className="input">
                <option value="sequential">Sequential</option>
                <option value="percentage">Percentage</option>
                <option value="specific_approver">Specific Approver</option>
                <option value="hybrid">Hybrid</option>
              </select>
            </div>
          </div>

          {(ruleType === 'percentage' || ruleType === 'hybrid') && (
            <div>
              <label className="label">Approval Threshold (%)</label>
              <input {...register('percentage_threshold')} type="number" min="1" max="100" className="input" placeholder="E.g. 60 for 60%" />
              <p className="text-xs text-gray-400 mt-1">Expense is approved when this % of approvers approve</p>
            </div>
          )}

          <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-900">
            Each stage must be either the employee&apos;s direct manager or one specific approver.
            Use a key approver for CFO-style auto-approval, and use Hybrid to combine sequence with conditional approval.
          </div>

          {/* Steps */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="label mb-0">Approval Steps</label>
              <button
                type="button"
                onClick={() => append({ step_number: fields.length + 1, approver_user_id: '', approver_role_label: '', is_manager_of_employee: false, is_key_approver: false })}
                className="btn-secondary text-xs py-1.5"
              >
                <Plus size={13} /> Add Step
              </button>
            </div>

            <div className="space-y-3">
              {fields.map((field, idx) => (
                <div key={field.id} className="border border-gray-200 rounded-xl p-4 bg-gray-50">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-semibold text-gray-700">Step {idx + 1}</span>
                    {fields.length > 1 && (
                      <button type="button" onClick={() => remove(idx)} className="p-1 text-gray-400 hover:text-red-500"><Trash2 size={14} /></button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="label text-xs">Specific Approver</label>
                      <select {...register(`steps.${idx}.approver_user_id`)} className="input text-sm">
                        <option value="">None / Dynamic</option>
                        {managers.map((m: any) => (
                          <option key={m.id} value={m.id}>{m.first_name} {m.last_name} ({m.role})</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="label text-xs">Role Label</label>
                      <input {...register(`steps.${idx}.approver_role_label`)} className="input text-sm" placeholder="E.g. Finance, Director" />
                    </div>
                  </div>

                  <div className="flex gap-5 mt-3">
                    <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                      <input {...register(`steps.${idx}.is_manager_of_employee`)} type="checkbox" className="w-4 h-4 accent-primary-600" />
                      Employee's Direct Manager
                    </label>
                    <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                      <input {...register(`steps.${idx}.is_key_approver`)} type="checkbox" className="w-4 h-4 accent-purple-600" />
                      Key Approver (auto-approves)
                    </label>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
            <button type="submit" disabled={isSubmitting} className="btn-primary flex-1 justify-center">
              {rule ? 'Save Changes' : 'Create Rule'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

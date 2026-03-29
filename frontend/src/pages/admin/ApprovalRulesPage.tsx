import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil, Trash2, ChevronDown, ChevronUp } from 'lucide-react'
import toast from 'react-hot-toast'
import { approvalService } from '../../services/approvalService'
import { userService } from '../../services/userService'
import { formatCurrency } from '../../utils/helpers'
import ApprovalRuleForm from '../../components/Admin/ApprovalRuleForm'

export default function ApprovalRulesPage() {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [editRule, setEditRule] = useState<any>(null)
  const [expanded, setExpanded] = useState<string | null>(null)

  const { data: rules, isLoading } = useQuery({ queryKey: ['approval-rules'], queryFn: approvalService.listRules })
  const { data: users } = useQuery({ queryKey: ['users'], queryFn: userService.list })

  const deleteMut = useMutation({
    mutationFn: approvalService.deleteRule,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['approval-rules'] }); toast.success('Rule deleted') },
  })

  const toggleMut = useMutation({
    mutationFn: ({ id, is_active }: any) => approvalService.updateRule(id, { is_active }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['approval-rules'] }); toast.success('Rule updated') },
  })

  const getUserName = (id: string) => {
    const u = users?.find((u: any) => u.id === id)
    return u ? `${u.first_name} ${u.last_name}` : id?.slice(-6)
  }

  const ruleTypeLabel: Record<string, string> = {
    sequential: 'Sequential',
    percentage: 'Percentage',
    specific_approver: 'Specific Approver',
    hybrid: 'Hybrid',
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Approval Rules</h1>
          <p className="text-gray-500 text-sm mt-0.5">Define multi-step approval workflows for expense claims</p>
        </div>
        <button onClick={() => setShowForm(true)} className="btn-primary"><Plus size={16} /> New Rule</button>
      </div>

      {isLoading ? (
        <div className="text-center py-16 text-gray-400">Loading…</div>
      ) : rules?.length === 0 ? (
        <div className="card text-center py-16 text-gray-400">
          <p className="text-lg font-medium text-gray-700 mb-1">No approval rules yet</p>
          <p className="text-sm">Create your first rule to define how expenses get approved</p>
        </div>
      ) : (
        <div className="space-y-3">
          {rules?.map((rule: any) => (
            <div key={rule.id} className={`card p-0 overflow-hidden border-l-4 ${rule.is_active ? 'border-l-green-500' : 'border-l-gray-300'}`}>
              <div className="flex items-center justify-between px-5 py-4">
                <div className="flex items-center gap-4">
                  <button onClick={() => setExpanded(expanded === rule.id ? null : rule.id)} className="p-1 hover:bg-gray-100 rounded">
                    {expanded === rule.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </button>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-gray-900">{rule.name}</h3>
                      <span className="badge bg-indigo-100 text-indigo-700">{ruleTypeLabel[rule.rule_type]}</span>
                      {!rule.is_active && <span className="badge bg-gray-100 text-gray-500">Inactive</span>}
                    </div>
                    {rule.description && <p className="text-sm text-gray-500 mt-0.5">{rule.description}</p>}
                    <div className="flex gap-4 mt-1 text-xs text-gray-400">
                      {rule.min_amount !== null && <span>Min: {formatCurrency(rule.min_amount)}</span>}
                      {rule.max_amount !== null && <span>Max: {formatCurrency(rule.max_amount)}</span>}
                      {rule.percentage_threshold && <span>Threshold: {rule.percentage_threshold}%</span>}
                      <span>{rule.steps.length} step{rule.steps.length !== 1 ? 's' : ''}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleMut.mutate({ id: rule.id, is_active: !rule.is_active })}
                    className={`text-xs px-3 py-1.5 rounded-full font-medium transition-all ${rule.is_active ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                  >
                    {rule.is_active ? 'Active' : 'Inactive'}
                  </button>
                  <button onClick={() => setEditRule(rule)} className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg"><Pencil size={14} /></button>
                  <button onClick={() => { if (confirm('Delete this rule?')) deleteMut.mutate(rule.id) }} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={14} /></button>
                </div>
              </div>

              {/* Steps Expansion */}
              {expanded === rule.id && (
                <div className="border-t border-gray-100 px-5 py-4 bg-gray-50">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Approval Steps</p>
                  <div className="space-y-2">
                    {rule.steps.map((step: any) => (
                      <div key={step.id} className="flex items-center gap-3 bg-white border border-gray-200 rounded-xl px-4 py-3">
                        <span className="w-7 h-7 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-xs font-bold flex-shrink-0">
                          {step.step_number}
                        </span>
                        <div className="text-sm">
                          {step.is_manager_of_employee && (
                            <p className="font-medium text-gray-800">Employee's Direct Manager</p>
                          )}
                          {step.approver_user_id && (
                            <p className="font-medium text-gray-800">{getUserName(step.approver_user_id)}</p>
                          )}
                          {step.approver_role_label && (
                            <p className="text-gray-500">Role: {step.approver_role_label}</p>
                          )}
                          <div className="flex gap-3 mt-0.5">
                            {step.is_key_approver && <span className="text-xs text-purple-600 font-medium">★ Key Approver</span>}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showForm && <ApprovalRuleForm onClose={() => setShowForm(false)} />}
      {editRule && <ApprovalRuleForm rule={editRule} onClose={() => setEditRule(null)} />}
    </div>
  )
}

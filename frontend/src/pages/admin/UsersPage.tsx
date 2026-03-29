import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil, Trash2, UserCheck } from 'lucide-react'
import toast from 'react-hot-toast'
import { useForm } from 'react-hook-form'
import { userService } from '../../services/userService'
import { formatDate, roleBadge } from '../../utils/helpers'

interface UserFormData {
  first_name: string
  last_name: string
  email: string
  password: string
  role: string
  is_manager_approver: boolean
}

export default function UsersPage() {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [editUser, setEditUser] = useState<any>(null)
  const [managerModal, setManagerModal] = useState<any>(null)
  const [selectedManager, setSelectedManager] = useState('')

  const { data: users, isLoading } = useQuery({ queryKey: ['users'], queryFn: userService.list })

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<UserFormData>()

  const createMut = useMutation({
    mutationFn: userService.create,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); toast.success('User created'); setShowForm(false); reset() },
    onError: (e: any) => toast.error(e.response?.data?.detail ?? 'Failed'),
  })

  const updateMut = useMutation({
    mutationFn: ({ id, data }: any) => userService.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); toast.success('User updated'); setEditUser(null) },
  })

  const deleteMut = useMutation({
    mutationFn: userService.delete,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); toast.success('User deleted') },
  })

  const assignMut = useMutation({
    mutationFn: ({ userId, managerId }: any) => userService.assignManager(userId, managerId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); toast.success('Manager assigned'); setManagerModal(null) },
    onError: (e: any) => toast.error(e.response?.data?.detail ?? 'Failed'),
  })

  const managers = users?.filter((u: any) => u.role === 'manager' || u.role === 'admin') ?? []

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
          <p className="text-gray-500 text-sm mt-0.5">Manage employees, managers, and admins</p>
        </div>
        <button onClick={() => setShowForm(true)} className="btn-primary"><Plus size={16} /> Add User</button>
      </div>

      <div className="card p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {['Name', 'Email', 'Role', 'Manager Approver', 'Joined', 'Actions'].map((h) => (
                <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? (
              <tr><td colSpan={6} className="text-center py-10 text-gray-400">Loading…</td></tr>
            ) : users?.map((u: any) => (
              <tr key={u.id} className="hover:bg-gray-50">
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-bold text-xs">
                      {u.first_name[0]}{u.last_name[0]}
                    </div>
                    <span className="font-medium text-gray-900">{u.first_name} {u.last_name}</span>
                  </div>
                </td>
                <td className="px-5 py-3.5 text-gray-500">{u.email}</td>
                <td className="px-5 py-3.5">
                  <span className={`badge ${roleBadge(u.role)}`}>{u.role}</span>
                </td>
                <td className="px-5 py-3.5">
                  <span className={`text-xs font-medium ${u.is_manager_approver ? 'text-green-600' : 'text-gray-400'}`}>
                    {u.is_manager_approver ? '✓ Yes' : 'No'}
                  </span>
                </td>
                <td className="px-5 py-3.5 text-gray-400 text-xs">{formatDate(u.created_at)}</td>
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-2">
                    <button onClick={() => setEditUser(u)} className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg" title="Edit"><Pencil size={14} /></button>
                    {u.role === 'employee' && (
                      <button onClick={() => { setManagerModal(u); setSelectedManager('') }} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg" title="Assign Manager"><UserCheck size={14} /></button>
                    )}
                    <button onClick={() => { if (confirm(`Delete ${u.first_name}?`)) deleteMut.mutate(u.id) }} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg" title="Delete"><Trash2 size={14} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Create User Modal */}
      {showForm && (
        <Modal title="Create User" onClose={() => { setShowForm(false); reset() }}>
          <form onSubmit={handleSubmit((d) => createMut.mutate(d))} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">First Name</label>
                <input {...register('first_name', { required: true })} className="input" />
              </div>
              <div>
                <label className="label">Last Name</label>
                <input {...register('last_name', { required: true })} className="input" />
              </div>
            </div>
            <div>
              <label className="label">Email</label>
              <input {...register('email', { required: true })} type="email" className="input" />
            </div>
            <div>
              <label className="label">Password</label>
              <input {...register('password', { required: true, minLength: 8 })} type="password" className="input" />
            </div>
            <div>
              <label className="label">Role</label>
              <select {...register('role', { required: true })} className="input">
                <option value="employee">Employee</option>
                <option value="manager">Manager</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <input {...register('is_manager_approver')} type="checkbox" id="ima" className="w-4 h-4 accent-primary-600" />
              <label htmlFor="ima" className="text-sm text-gray-700">Is Manager Approver (must approve expenses first)</label>
            </div>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => { setShowForm(false); reset() }} className="btn-secondary flex-1 justify-center">Cancel</button>
              <button type="submit" disabled={isSubmitting} className="btn-primary flex-1 justify-center">Create User</button>
            </div>
          </form>
        </Modal>
      )}

      {/* Edit User Modal */}
      {editUser && (
        <Modal title={`Edit: ${editUser.first_name}`} onClose={() => setEditUser(null)}>
          <div className="space-y-4">
            <div>
              <label className="label">Role</label>
              <select
                value={editUser.role}
                onChange={(e) => setEditUser({ ...editUser, role: e.target.value })}
                className="input"
              >
                <option value="employee">Employee</option>
                <option value="manager">Manager</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={editUser.is_manager_approver}
                onChange={(e) => setEditUser({ ...editUser, is_manager_approver: e.target.checked })}
                id="edit-ima"
                className="w-4 h-4 accent-primary-600"
              />
              <label htmlFor="edit-ima" className="text-sm text-gray-700">Is Manager Approver</label>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={editUser.is_active}
                onChange={(e) => setEditUser({ ...editUser, is_active: e.target.checked })}
                id="edit-active"
                className="w-4 h-4 accent-primary-600"
              />
              <label htmlFor="edit-active" className="text-sm text-gray-700">Active</label>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setEditUser(null)} className="btn-secondary flex-1 justify-center">Cancel</button>
              <button
                onClick={() => updateMut.mutate({ id: editUser.id, data: { role: editUser.role, is_manager_approver: editUser.is_manager_approver, is_active: editUser.is_active } })}
                className="btn-primary flex-1 justify-center"
              >
                Save Changes
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Assign Manager Modal */}
      {managerModal && (
        <Modal title={`Assign Manager to ${managerModal.first_name}`} onClose={() => setManagerModal(null)}>
          <div className="space-y-4">
            <div>
              <label className="label">Select Manager</label>
              <select value={selectedManager} onChange={(e) => setSelectedManager(e.target.value)} className="input">
                <option value="">Choose…</option>
                {managers.map((m: any) => (
                  <option key={m.id} value={m.id}>{m.first_name} {m.last_name} ({m.role})</option>
                ))}
              </select>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setManagerModal(null)} className="btn-secondary flex-1 justify-center">Cancel</button>
              <button
                disabled={!selectedManager}
                onClick={() => assignMut.mutate({ userId: managerModal.id, managerId: selectedManager })}
                className="btn-primary flex-1 justify-center disabled:opacity-40"
              >
                Assign Manager
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">{title}</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500">✕</button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  )
}

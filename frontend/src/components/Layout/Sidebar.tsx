import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  Receipt,
  CheckSquare,
  Users,
  Settings,
  LogOut,
  Building2,
  ShieldCheck,
} from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import { authService } from '../../services/authService'
import toast from 'react-hot-toast'

const navItem = 'flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all'
const active = 'bg-primary-700 text-white'
const inactive = 'text-primary-100 hover:bg-primary-700/60 hover:text-white'

export default function Sidebar() {
  const { user, refreshToken, logout } = useAuthStore()
  const navigate = useNavigate()

  const handleLogout = async () => {
    if (refreshToken) await authService.logout(refreshToken).catch(() => {})
    logout()
    navigate('/login')
    toast.success('Logged out')
  }

  const isAdmin = user?.role === 'admin'
  const isManagerOrAdmin = user?.role === 'admin' || user?.role === 'manager'

  return (
    <aside className="w-64 min-h-screen bg-primary-800 flex flex-col">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-primary-700">
        <div className="flex items-center gap-2">
          <Building2 className="text-primary-200" size={22} />
          <span className="text-white font-bold text-lg">ReimburseMe</span>
        </div>
        <p className="text-primary-300 text-xs mt-0.5 truncate">{user?.email}</p>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-4 space-y-1">
        <NavLink to="/dashboard" className={({ isActive }) => `${navItem} ${isActive ? active : inactive}`}>
          <LayoutDashboard size={18} /> Dashboard
        </NavLink>

        <NavLink to="/expenses" className={({ isActive }) => `${navItem} ${isActive ? active : inactive}`}>
          <Receipt size={18} /> My Expenses
        </NavLink>

        {isManagerOrAdmin && (
          <NavLink to="/approvals" className={({ isActive }) => `${navItem} ${isActive ? active : inactive}`}>
            <CheckSquare size={18} /> Approvals
          </NavLink>
        )}

        {isAdmin && (
          <>
            <div className="pt-3 pb-1 px-1">
              <p className="text-primary-400 text-xs uppercase tracking-wider font-semibold">Admin</p>
            </div>
            <NavLink to="/admin/users" className={({ isActive }) => `${navItem} ${isActive ? active : inactive}`}>
              <Users size={18} /> User Management
            </NavLink>
            <NavLink to="/admin/rules" className={({ isActive }) => `${navItem} ${isActive ? active : inactive}`}>
              <ShieldCheck size={18} /> Approval Rules
            </NavLink>
            <NavLink to="/admin/settings" className={({ isActive }) => `${navItem} ${isActive ? active : inactive}`}>
              <Settings size={18} /> Settings
            </NavLink>
          </>
        )}
      </nav>

      {/* User footer */}
      <div className="p-4 border-t border-primary-700">
        <div className="flex items-center gap-3 mb-3 px-1">
          <div className="w-9 h-9 rounded-full bg-primary-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
            {user?.first_name?.[0]}{user?.last_name?.[0]}
          </div>
          <div className="overflow-hidden">
            <p className="text-white text-sm font-medium truncate">{user?.first_name} {user?.last_name}</p>
            <p className="text-primary-300 text-xs capitalize">{user?.role}</p>
          </div>
        </div>
        <button onClick={handleLogout} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-primary-200 hover:bg-primary-700 hover:text-white text-sm transition-all">
          <LogOut size={16} /> Sign out
        </button>
      </div>
    </aside>
  )
}

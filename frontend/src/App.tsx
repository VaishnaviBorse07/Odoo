import { Suspense, lazy } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import MainLayout from './components/Layout/MainLayout'
import { useAuthStore } from './store/authStore'

const LoginPage = lazy(() => import('./pages/LoginPage'))
const SignupPage = lazy(() => import('./pages/SignupPage'))
const DashboardPage = lazy(() => import('./pages/DashboardPage'))
const ExpensesPage = lazy(() => import('./pages/ExpensesPage'))
const ApprovalsPage = lazy(() => import('./pages/ApprovalsPage'))
const UsersPage = lazy(() => import('./pages/admin/UsersPage'))
const ApprovalRulesPage = lazy(() => import('./pages/admin/ApprovalRulesPage'))
const SettingsPage = lazy(() => import('./pages/admin/SettingsPage'))

function AuthBootstrap({ children }: { children: React.ReactNode }) {
  const hasHydrated = useAuthStore((s) => s.hasHydrated)
  if (!hasHydrated) return <div className="min-h-screen grid place-items-center text-gray-500">Loading session...</div>
  return <>{children}</>
}

function PublicOnlyRoute({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user)
  const accessToken = useAuthStore((s) => s.accessToken)
  if (user && accessToken) return <Navigate to="/dashboard" replace />
  return <>{children}</>
}

function RequireAdmin({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user)
  if (user?.role !== 'admin') return <Navigate to="/dashboard" replace />
  return <>{children}</>
}

function RequireManagerOrAdmin({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user)
  if (user?.role === 'employee') return <Navigate to="/dashboard" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <AuthBootstrap>
      <Suspense fallback={<div className="min-h-screen grid place-items-center text-gray-500">Loading page...</div>}>
        <Routes>
          <Route path="/login" element={<PublicOnlyRoute><LoginPage /></PublicOnlyRoute>} />
          <Route path="/signup" element={<PublicOnlyRoute><SignupPage /></PublicOnlyRoute>} />

          <Route element={<MainLayout />}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/expenses" element={<ExpensesPage />} />
            <Route path="/approvals" element={
              <RequireManagerOrAdmin><ApprovalsPage /></RequireManagerOrAdmin>
            } />
            <Route path="/admin/users" element={
              <RequireAdmin><UsersPage /></RequireAdmin>
            } />
            <Route path="/admin/rules" element={
              <RequireAdmin><ApprovalRulesPage /></RequireAdmin>
            } />
            <Route path="/admin/settings" element={
              <RequireAdmin><SettingsPage /></RequireAdmin>
            } />
          </Route>

          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </Suspense>
    </AuthBootstrap>
  )
}

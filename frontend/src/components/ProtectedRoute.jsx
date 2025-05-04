import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const ProtectedRoute = ({ allowedRoles = [], redirectPath = '/' }) => {
  const { user } = useAuth()

  if (!user) {
    return <Navigate to={redirectPath} replace />
  }

  if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    return <Navigate to="/not-authorized" replace />
  }

  return <Outlet />
}

export default ProtectedRoute

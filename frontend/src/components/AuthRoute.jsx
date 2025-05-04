// src/components/AuthRoute.js
import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const AuthRoute = ({ redirectPath = '/' }) => {
  const { user } = useAuth()

  if (user) {
    return <Navigate to={redirectPath} replace />
  }

  return <Outlet />
}

export default AuthRoute

import React from 'react'
import Navbar from '../components/Navbar'
import { useAuth } from '../context/AuthContext'

const RecruiterDashboard = () => {
  const { user } = useAuth()

  return (
    <>
      <Navbar userType={user.role} />
      <div>RecruiterDashboard</div>
    </>
  )
}

export default RecruiterDashboard

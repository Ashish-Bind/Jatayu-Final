import React from 'react'
import Navbar from '../components/Navbar'
import { useAuth } from '../context/AuthContext'

const AssessmentDashboard = () => {
  const { user } = useAuth()

  return (
    <>
      <Navbar userType={user.role} />
      <div>AssessmentDashboard</div>
    </>
  )
}

export default AssessmentDashboard

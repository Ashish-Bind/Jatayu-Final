import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import Navbar from './components/Navbar'
import { Briefcase, ChevronRight, X, Check } from 'lucide-react'

const RecruiterDashboard = () => {
  const { user } = useAuth()
  const [assessments, setAssessments] = useState([])
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [formData, setFormData] = useState({
    job_title: '',
    company: '',
    experience_min: '',
    experience_max: '',
    duration: '',
    num_questions: '',
    schedule: '',
    degree_required: '',
    description: '',
  })

  useEffect(() => {
    if (!user || user.role !== 'recruiter') return

    fetch(`http://localhost:5000/api/recruiter/assessments/${user.id}`, {
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    })
      .then((response) => response.json())
      .then((data) => setAssessments(data))
      .catch((error) => {
        console.error('Error fetching assessments:', error)
        setError('Failed to load assessments.')
      })
  }, [user])

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData({ ...formData, [name]: value })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    try {
      const response = await fetch(
        'http://localhost:5000/api/recruiter/assessments',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ ...formData, recruiter_id: user.id }),
        }
      )

      const data = await response.json()
      if (response.ok) {
        setSuccess('Assessment created successfully!')
        setAssessments([...assessments, { ...formData, job_id: data.job_id }])
        setFormData({
          job_title: '',
          company: '',
          experience_min: '',
          experience_max: '',
          duration: '',
          num_questions: '',
          schedule: '',
          degree_required: '',
          description: '',
        })
        setIsFormOpen(false)
      } else {
        setError(data.error || 'Failed to create assessment.')
      }
    } catch (err) {
      setError('An error occurred. Please try again.')
    }
  }

  // Segregate assessments
  const currentDate = new Date('2025-05-04T00:00:00Z')
  const activeAssessments = assessments?.filter(
    (assessment) => new Date(assessment.schedule) > currentDate
  )
  const pastAssessments = assessments?.filter(
    (assessment) => new Date(assessment.schedule) <= currentDate
  )

  console.log(activeAssessments, pastAssessments)

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <Navbar />
      <div className="min-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">
          Recruiter Dashboard
        </h1>

        {error && (
          <div
            className="bg-red-50 border-l-4 border-red-500 text-red-700 p-3 mb-6 rounded-md text-sm flex items-center gap-2"
            role="alert"
          >
            <X className="w-4 h-4" />
            {error}
          </div>
        )}
        {success && (
          <div
            className="bg-green-50 border-l-4 border-green-500 text-green-700 p-3 mb-6 rounded-md text-sm flex items-center gap-2"
            role="alert"
          >
            <Check className="w-4 h-4" />
            {success}
          </div>
        )}

        <button
          onClick={() => setIsFormOpen(!isFormOpen)}
          className="mb-6 flex items-center justify-center px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-600 gap-2"
        >
          {isFormOpen ? 'Cancel' : 'Create New Assessment'}
          {isFormOpen ? (
            <X className="w-4 h-4" />
          ) : (
            <Briefcase className="w-4 h-4" />
          )}
        </button>

        {isFormOpen && (
          <div className="bg-white p-6 sm:p-8 rounded-lg shadow-sm border border-gray-200 mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Briefcase className="w-5 h-5 text-indigo-600" />
              Create New Assessment
            </h2>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="job_title"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Job Title
                  </label>
                  <input
                    type="text"
                    name="job_title"
                    id="job_title"
                    value={formData.job_title}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-200 rounded-md focus:ring-indigo-600 focus:border-indigo-600 text-sm placeholder-gray-400"
                    placeholder="Software Engineer"
                    required
                  />
                </div>
                <div>
                  <label
                    htmlFor="company"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Company
                  </label>
                  <input
                    type="text"
                    name="company"
                    id="company"
                    value={formData.company}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-200 rounded-md focus:ring-indigo-600 focus:border-indigo-600 text-sm placeholder-gray-400"
                    placeholder="Tech Corp"
                    required
                  />
                </div>
                <div>
                  <label
                    htmlFor="experience_min"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Min Experience (years)
                  </label>
                  <input
                    type="number"
                    name="experience_min"
                    id="experience_min"
                    value={formData.experience_min}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-200 rounded-md focus:ring-indigo-600 focus:border-indigo-600 text-sm placeholder-gray-400"
                    min="0"
                    step="0.1"
                    placeholder="2"
                    required
                  />
                </div>
                <div>
                  <label
                    htmlFor="experience_max"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Max Experience (years)
                  </label>
                  <input
                    type="number"
                    name="experience_max"
                    id="experience_max"
                    value={formData.experience_max}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-200 rounded-md focus:ring-indigo-600 focus:border-indigo-600 text-sm placeholder-gray-400"
                    min="0"
                    step="0.1"
                    placeholder="5"
                    required
                  />
                </div>
                <div>
                  <label
                    htmlFor="duration"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Duration (minutes)
                  </label>
                  <input
                    type="number"
                    name="duration"
                    id="duration"
                    value={formData.duration}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-200 rounded-md focus:ring-indigo-600 focus:border-indigo-600 text-sm placeholder-gray-400"
                    min="1"
                    placeholder="30"
                    required
                  />
                </div>
                <div>
                  <label
                    htmlFor="num_questions"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Number of Questions
                  </label>
                  <input
                    type="number"
                    name="num_questions"
                    id="num_questions"
                    value={formData.num_questions}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-200 rounded-md focus:ring-indigo-600 focus:border-indigo-600 text-sm placeholder-gray-400"
                    min="1"
                    placeholder="10"
                    required
                  />
                </div>
                <div>
                  <label
                    htmlFor="schedule"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Schedule
                  </label>
                  <input
                    type="datetime-local"
                    name="schedule"
                    id="schedule"
                    value={formData.schedule}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-200 rounded-md focus:ring-indigo-600 focus:border-indigo-600 text-sm"
                    required
                  />
                </div>
                <div>
                  <label
                    htmlFor="degree_required"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Required Degree
                  </label>
                  <input
                    type="text"
                    name="degree_required"
                    id="degree_required"
                    value={formData.degree_required}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-200 rounded-md focus:ring-indigo-600 focus:border-indigo-600 text-sm placeholder-gray-400"
                    placeholder="B.Tech in Computer Science"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label
                    htmlFor="description"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Description
                  </label>
                  <textarea
                    name="description"
                    id="description"
                    value={formData.description}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-200 rounded-md focus:ring-indigo-600 focus:border-indigo-600 text-sm placeholder-gray-400"
                    rows="4"
                    placeholder="Describe the job role and requirements..."
                  />
                </div>
              </div>
              <div className="flex justify-end mt-4">
                <button
                  type="submit"
                  className="flex items-center justify-center px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-600 gap-2"
                >
                  Create Assessment
                  <Briefcase className="w-4 h-4" />
                </button>
              </div>
            </form>
          </div>
        )}

        <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Briefcase className="w-5 h-5 text-indigo-600" />
          Active Assessments
        </h2>
        {activeAssessments.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
            {activeAssessments.map((assessment) => (
              <div
                key={assessment.job_id}
                className="bg-white p-5 rounded-lg shadow-sm hover:shadow-md transition-shadow border border-gray-200"
              >
                <div className="flex items-start gap-3 mb-3">
                  <div className="bg-indigo-50 p-2 rounded-md">
                    <Briefcase className="w-4 h-4 text-indigo-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      {assessment.job_title}
                    </h3>
                    <p className="text-sm text-gray-700">
                      Company: {assessment.company}
                    </p>
                  </div>
                </div>
                <div className="space-y-2 mb-4 text-sm text-gray-700">
                  <p>
                    Experience: {assessment.experience_min}-
                    {assessment.experience_max} years
                  </p>
                  <p>
                    Schedule: {new Date(assessment.schedule).toLocaleString()}
                  </p>
                </div>
                <Link
                  to={`/recruiter/candidates/${assessment.job_id}`}
                  className="inline-flex items-center text-indigo-600 hover:text-indigo-800 font-medium text-sm"
                >
                  View Candidates
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Link>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white p-6 rounded-lg shadow-sm text-center border border-gray-200 mb-8">
            <p className="text-sm text-gray-700">No active assessments.</p>
          </div>
        )}

        <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Briefcase className="w-5 h-5 text-indigo-600" />
          Past Assessments
        </h2>
        {pastAssessments.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {pastAssessments.map((assessment) => (
              <div
                key={assessment.job_id}
                className="bg-white p-5 rounded-lg shadow-sm hover:shadow-md transition-shadow border border-gray-200"
              >
                <div className="flex items-start gap-3 mb-3">
                  <div className="bg-indigo-50 p-2 rounded-md">
                    <Briefcase className="w-4 h-4 text-indigo-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      {assessment.job_title}
                    </h3>
                    <p className="text-sm text-gray-700">
                      Company: {assessment.company}
                    </p>
                  </div>
                </div>
                <div className="space-y-2 mb-4 text-sm text-gray-700">
                  <p>
                    Experience: {assessment.experience_min}-
                    {assessment.experience_max} years
                  </p>
                  <p>
                    Schedule: {new Date(assessment.schedule).toLocaleString()}
                  </p>
                </div>
                <Link
                  to={`/recruiter/candidates/${assessment.job_id}`}
                  className="inline-flex items-center text-indigo-600 hover:text-indigo-800 font-medium text-sm"
                >
                  View Candidates
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Link>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white p-6 rounded-lg shadow-sm text-center border border-gray-200">
            <p className="text-sm text-gray-700">No past assessments.</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default RecruiterDashboard

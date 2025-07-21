import React, { useState, useEffect, useContext } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Modal from 'react-modal'
import { useAuth } from './context/AuthContext'
import {
  Award,
  Clock,
  AlertCircle,
  ChevronRight,
  ArrowRight,
  BookOpen,
  Briefcase,
  Calendar,
  FileText,
  X,
  Check,
  Loader2,
  Code,
} from 'lucide-react'
import Navbar from './components/Navbar'
import { ThemeContext } from './context/ThemeContext'
import { format } from 'date-fns'
import LinkButton from './components/LinkButton'
import Button from './components/Button'
import { baseUrl } from './utils/utils'

// Bind modal to your appElement (for accessibility)
Modal.setAppElement('#root')

const formatDate = (date) => {
  return format(new Date(date), 'MMM d, yyyy')
}

const getPriorityColor = (priority) => {
  switch (priority) {
    case 5:
      return 'bg-gradient-to-r from-green-400 to-emerald-600 text-white'
    case 3:
      return 'bg-gradient-to-r from-blue-400 to-indigo-600 text-white'
    case 2:
      return 'bg-gradient-to-r from-yellow-400 to-amber-600 text-white'
    default:
      return 'bg-gradient-to-r from-gray-300 to-gray-500 text-gray-800'
  }
}

const CandidateDashboard = () => {
  const { user } = useAuth()
  const { theme } = useContext(ThemeContext)
  const navigate = useNavigate()
  const [candidate, setCandidate] = useState(null)
  const [assessments, setAssessments] = useState({
    eligible: [],
    all: [],
    attempted: [],
  })
  const [selectedAssessment, setSelectedAssessment] = useState(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isIneligibleModalOpen, setIsIneligibleModalOpen] = useState(false)
  const [ineligibleMessage, setIneligibleMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [activeTab, setActiveTab] = useState('recommended')

  useEffect(() => {
    if (!user || user.role !== 'candidate') {
      navigate('/candidate/login')
      return
    }

    // Fetch candidate data
    fetch(`${baseUrl}/candidate/profile/${user.id}`, {
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error(
            `Failed to fetch profile: ${response.status} ${response.statusText}`
          )
        }
        return response.json()
      })
      .then((data) => {
        setCandidate(data)
        if (!data.is_profile_complete) {
          navigate('/candidate/complete-profile')
        }
      })
      .catch((error) => {
        console.error('Error fetching candidate:', error)
        setErrorMessage(`Failed to load candidate profile: ${error.message}`)
      })

    // Fetch assessments
    fetch(`${baseUrl}/candidate/eligible-assessments/${user.id}`, {
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error(
            `Failed to fetch assessments: ${response.status} ${response.statusText}`
          )
        }
        return response.json()
      })
      .then((data) => {
        setAssessments({
          eligible: data.eligible_assessments || [],
          all: data.all_assessments || [],
          attempted: data.attempted_assessments || [],
        })
      })
      .catch((error) => {
        console.error('Error fetching assessments:', error)
        setErrorMessage(`Failed to load assessments: ${error.message}`)
      })
  }, [navigate, user])

  const handleRegisterAssessment = (assessment) => {
    setErrorMessage('')
    setSuccessMessage('')
    setIneligibleMessage('')
    if (!assessment.is_eligible) {
      setIneligibleMessage(
        `You are not eligible for this job. Required: ${
          assessment.experience_min
        }-${assessment.experience_max} years of experience, Degree: ${
          assessment.degree_required || 'None'
        }`
      )
      setIsIneligibleModalOpen(true)
      return
    }

    fetch(`${baseUrl}/candidate/register-assessment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        candidate_id: user.id,
        job_id: assessment.job_id,
      }),
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error(
            `Registration failed: ${response.status} ${response.statusText}`
          )
        }
        return response.json()
      })
      .then((data) => {
        if (data.message) {
          setSuccessMessage(data.message)
          // Refresh assessments
          fetch(`${baseUrl}/candidate/eligible-assessments/${user.id}`, {
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
          })
            .then((response) => {
              if (!response.ok) {
                throw new Error(
                  `Failed to refresh assessments: ${response.status} ${response.statusText}`
                )
              }
              return response.json()
            })
            .then((data) => {
              setAssessments({
                eligible: data.eligible_assessments || [],
                all: data.all_assessments || [],
                attempted: data.attempted_assessments || [],
              })
            })
            .catch((error) => {
              console.error('Error refreshing assessments:', error)
              setErrorMessage(`Failed to refresh assessments: ${error.message}`)
            })
        } else {
          setErrorMessage(
            data.error || 'Failed to register for the assessment.'
          )
        }
      })
      .catch((error) => {
        console.error('Error registering for assessment:', error)
        setErrorMessage(
          `Failed to register for the assessment: ${error.message}`
        )
      })
  }

  const handleStartAssessment = (assessment) => {
    const scheduleTime = new Date(
      assessment.schedule || assessment.schedule_start
    )
    const currentTime = new Date()

    if (currentTime < scheduleTime) {
      setErrorMessage(
        `This assessment has not yet started. It is scheduled for ${scheduleTime.toLocaleString()}.`
      )
      setSelectedAssessment(null)
      return
    }

    setSelectedAssessment(assessment)
    setErrorMessage('')
    setSuccessMessage('')
    setIsModalOpen(true)
  }

  const confirmStartAssessment = () => {
    if (!selectedAssessment) return

    fetch(`${baseUrl}/candidate/start-assessment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        user_id: user.id,
        job_id: selectedAssessment.job_id,
      }),
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error(
            `Failed to start assessment: ${response.status} ${response.statusText}`
          )
        }
        return response.json()
      })
      .then((data) => {
        if (data.attempt_id) {
          navigate(`/candidate/assessment/${data.attempt_id}`)
        } else {
          setErrorMessage(data.error || 'Failed to start the assessment.')
        }
      })
      .catch((error) => {
        console.error('Error starting assessment:', error)
        setErrorMessage(`Failed to start the assessment: ${error.message}`)
      })

    setIsModalOpen(false)
  }

  if (!candidate) {
    return (
      <div className="flex justify-center items-center h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-gray-900 dark:via-slate-900 dark:to-indigo-950">
        <Loader2 className="w-8 h-8 text-indigo-600 dark:text-indigo-300 animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-gray-900 dark:via-slate-900 dark:to-indigo-950 font-sans flex flex-col">
      <Navbar />
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-800 bg-clip-text text-transparent mb-6">
          Candidate Dashboard
        </h1>

        {errorMessage && (
          <div
            className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-lg border-l-4 border-red-500 text-red-700 dark:text-red-300 p-4 mb-6 rounded-2xl shadow-lg flex items-center gap-2"
            role="alert"
          >
            <AlertCircle className="w-5 h-5" />
            {errorMessage}
          </div>
        )}

        {successMessage && (
          <div
            className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-lg border-l-4 border-green-500 text-green-700 dark:text-green-300 p-4 mb-6 rounded-2xl shadow-lg flex items-center gap-2"
            role="alert"
          >
            <Check className="w-5 h-5" />
            {successMessage}
          </div>
        )}

        {!candidate.is_profile_complete ? (
          <div
            className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-lg border-l-4 border-yellow-500 text-yellow-700 dark:text-yellow-300 p-4 mb-6 rounded-2xl shadow-lg flex items-center gap-2"
            role="alert"
          >
            <AlertCircle className="w-5 h-5" />
            <div>
              <p>Please complete your profile to access assessments.</p>
              <LinkButton
                to="/candidate/complete-profile"
                className="inline-flex items-center mt-2 text-yellow-700 dark:text-yellow-300 hover:text-yellow-800 dark:hover:text-yellow-400 font-medium text-sm"
              >
                Complete Profile <ChevronRight className="w-4 h-4 ml-1" />
              </LinkButton>
            </div>
          </div>
        ) : (
          <>
            <div className="mb-6">
              <div className="flex border-b border-gray-200/50 dark:border-gray-700/50 gap-4">
                {['recommended', 'explore', 'attempted'].map((tab) => (
                  <button
                    key={tab}
                    className={`px-4 py-2 text-base font-medium transition-all duration-200 ${
                      activeTab === tab
                        ? 'border-b-2 border-indigo-600 text-indigo-600 dark:text-indigo-300'
                        : 'text-gray-600 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/50'
                    }`}
                    onClick={() => setActiveTab(tab)}
                  >
                    {tab === 'recommended'
                      ? 'Recommended Jobs'
                      : tab === 'explore'
                      ? 'Explore Jobs'
                      : 'Attempted Assessments'}
                  </button>
                ))}
              </div>
            </div>

            {activeTab === 'recommended' && (
              <>
                <h2 className="text-xl font-semibold bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-800 bg-clip-text text-transparent mb-4 flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                  Recommended Jobs
                </h2>
                {assessments.eligible.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {assessments.eligible.map((assessment) => (
                      <div
                        key={assessment.job_id}
                        className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-lg p-6 rounded-2xl shadow-lg hover:shadow-2xl hover:scale-105 transition-all duration-300 border border-gray-200/50 dark:border-gray-700/50 max-w-md w-full"
                      >
                        {assessment.logo && (
                          <img
                            src={`http://localhost:5000/static/uploads/${assessment.logo}`}
                            alt="Company Logo"
                            className="w-full h-32 object-cover rounded-xl mb-4 border border-gray-200/50 dark:border-gray-700/50"
                          />
                        )}
                        <div className="flex items-center gap-4 mb-4">
                          <div className="p-3 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl">
                            <Briefcase className="w-8 h-8 text-white" />
                          </div>
                          <div>
                            <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                              {assessment.job_title}
                            </h3>
                            <p className="text-base text-gray-600 dark:text-gray-400">
                              Company: {assessment.company}
                            </p>
                          </div>
                        </div>
                        <div className="space-y-3 text-base text-gray-600 dark:text-gray-400 mb-4">
                          <div className="flex items-center gap-2">
                            <Award className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                            <span>
                              {assessment.experience_min}-
                              {assessment.experience_max} years
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <FileText className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                            <span>
                              Degree: {assessment.degree_required || 'None'}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <FileText className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                            <span>Questions: {assessment.num_questions}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                            <span>Duration: {assessment.duration} minutes</span>
                          </div>
                          {assessment.schedule_start && (
                            <div className="flex items-center gap-2">
                              <Calendar className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                              <span>
                                {formatDate(assessment.schedule_start)} -{' '}
                                {assessment.schedule_end
                                  ? formatDate(assessment.schedule_end)
                                  : 'Ongoing'}
                              </span>
                            </div>
                          )}
                          {assessment.skills &&
                            assessment.skills.length > 0 && (
                              <div className="flex flex-wrap gap-2 items-center">
                                <Code className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                                {assessment.skills.map((skill, index) => (
                                  <span
                                    key={index}
                                    className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${getPriorityColor(
                                      skill.priority
                                    )}`}
                                  >
                                    {skill.name}
                                  </span>
                                ))}
                              </div>
                            )}
                        </div>
                        <Button
                          onClick={() => {
                            if (assessment.is_registered) {
                              handleStartAssessment(assessment)
                            } else {
                              handleRegisterAssessment(assessment)
                            }
                          }}
                          className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-6 py-3 rounded-xl flex items-center justify-center gap-2 hover:from-indigo-700 hover:to-purple-700 transition-all duration-300 shadow-lg hover:shadow-xl"
                          disabled={
                            !assessment.is_eligible &&
                            !candidate.is_profile_complete
                          }
                        >
                          {assessment.is_registered
                            ? 'Start Assessment'
                            : 'Register'}
                          <ArrowRight className="w-5 h-5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-lg p-6 rounded-2xl shadow-lg text-center border border-gray-200/50 dark:border-gray-700/50">
                    <p className="text-base text-gray-600 dark:text-gray-400 mb-3">
                      No recommended jobs available at the moment.
                    </p>
                    <LinkButton
                      to="/candidate/complete-profile"
                      className="inline-flex items-center text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 font-medium text-base"
                    >
                      Update your profile for more opportunities
                      <ChevronRight className="w-5 h-5 ml-1" />
                    </LinkButton>
                  </div>
                )}
              </>
            )}

            {activeTab === 'explore' && (
              <>
                <h2 className="text-xl font-semibold bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-800 bg-clip-text text-transparent mb-4 flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                  Explore Jobs
                </h2>
                {assessments.all.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {assessments.all.map((assessment) => (
                      <div
                        key={assessment.job_id}
                        className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-lg p-6 rounded-2xl shadow-lg hover:shadow-2xl hover:scale-105 transition-all duration-300 border border-gray-200/50 dark:border-gray-700/50 max-w-md w-full"
                      >
                        {assessment.logo && (
                          <img
                            src={`http://localhost:5000/static/uploads/${assessment.logo}`}
                            alt="Company Logo"
                            className="w-full h-32 object-cover rounded-xl mb-4 border border-gray-200/50 dark:border-gray-700/50"
                          />
                        )}
                        <div className="flex items-center gap-4 mb-4">
                          <div className="p-3 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl">
                            <Briefcase className="w-8 h-8 text-white" />
                          </div>
                          <div>
                            <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                              {assessment.job_title}
                            </h3>
                            <p className="text-base text-gray-600 dark:text-gray-400">
                              Company: {assessment.company}
                            </p>
                          </div>
                        </div>
                        <div className="space-y-3 text-base text-gray-600 dark:text-gray-400 mb-4">
                          <div className="flex items-center gap-2">
                            <Award className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                            <span>
                              {assessment.experience_min}-
                              {assessment.experience_max} years
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <FileText className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                            <span>
                              Degree: {assessment.degree_required || 'None'}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <FileText className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                            <span>Questions: {assessment.num_questions}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                            <span>Duration: {assessment.duration} minutes</span>
                          </div>
                          {assessment.schedule_start && (
                            <div className="flex items-center gap-2">
                              <Calendar className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                              <span>
                                {formatDate(assessment.schedule_start)} -{' '}
                                {assessment.schedule_end
                                  ? formatDate(assessment.schedule_end)
                                  : 'Ongoing'}
                              </span>
                            </div>
                          )}
                          {assessment.skills &&
                            assessment.skills.length > 0 && (
                              <div className="flex flex-wrap gap-2 items-center">
                                <Code className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                                {assessment.skills.map((skill, index) => (
                                  <span
                                    key={index}
                                    className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${getPriorityColor(
                                      skill.priority
                                    )}`}
                                  >
                                    {skill.name}
                                  </span>
                                ))}
                              </div>
                            )}
                        </div>
                        <Button
                          onClick={() => {
                            if (assessment.is_registered) {
                              handleStartAssessment(assessment)
                            } else {
                              handleRegisterAssessment(assessment)
                            }
                          }}
                          className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-6 py-3 rounded-xl flex items-center justify-center gap-2 hover:from-indigo-700 hover:to-purple-700 transition-all duration-300 shadow-lg hover:shadow-xl"
                          disabled={
                            !assessment.is_eligible &&
                            !candidate.is_profile_complete
                          }
                        >
                          {assessment.is_registered
                            ? 'Start Assessment'
                            : 'Register'}
                          <ArrowRight className="w-5 h-5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-lg p-6 rounded-2xl shadow-lg text-center border border-gray-200/50 dark:border-gray-700/50">
                    <p className="text-base text-gray-600 dark:text-gray-400 mb-3">
                      No jobs available at the moment.
                    </p>
                    <LinkButton
                      to="/candidate/complete-profile"
                      className="inline-flex items-center text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 font-medium text-base"
                    >
                      Update your profile for more opportunities
                      <ChevronRight className="w-5 h-5 ml-1" />
                    </LinkButton>
                  </div>
                )}
              </>
            )}

            {activeTab === 'attempted' && assessments.attempted.length > 0 && (
              <>
                <h2 className="text-xl font-semibold bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-800 bg-clip-text text-transparent mb-4 flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                  Attempted Assessments
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {assessments.attempted.map((assessment) => (
                    <div
                      key={assessment.attempt_id}
                      className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-lg p-6 rounded-2xl shadow-lg hover:shadow-2xl hover:scale-105 transition-all duration-300 border border-gray-200/50 dark:border-gray-700/50 max-w-md w-full"
                    >
                      {assessment.logo && (
                        <img
                          src={`http://localhost:5000/static/uploads/${assessment.logo}`}
                          alt="Company Logo"
                          className="w-full h-32 object-cover rounded-xl mb-4 border border-gray-200/50 dark:border-gray-700/50"
                        />
                      )}
                      <div className="flex items-center gap-4 mb-4">
                        <div className="p-3 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl">
                          <Briefcase className="w-8 h-8 text-white" />
                        </div>
                        <div>
                          <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                            {assessment.job_title}
                          </h3>
                          <p className="text-base text-gray-600 dark:text-gray-400">
                            Company: {assessment.company}
                          </p>
                        </div>
                      </div>
                      <div className="space-y-3 text-base text-gray-600 dark:text-gray-400 mb-4">
                        <div className="flex items-center gap-2">
                          <Check className="w-4 h-4 text-green-600 dark:text-green-400" />
                          <span>Status: {assessment.status}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                          <span>
                            Attempted:{' '}
                            {format(
                              new Date(assessment.attempt_date),
                              'MMM d, yyyy'
                            )}
                          </span>
                        </div>
                      </div>
                      <LinkButton
                        to={`/candidate/assessment/${assessment.attempt_id}/results`}
                        className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-6 py-3 rounded-xl flex items-center justify-center gap-2 hover:from-indigo-700 hover:to-purple-700 transition-all duration-300 shadow-lg hover:shadow-xl"
                      >
                        View Report
                        <ChevronRight className="w-5 h-5" />
                      </LinkButton>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}

        <Modal
          isOpen={isModalOpen}
          onRequestClose={() => setIsModalOpen(false)}
          className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-lg p-6 sm:p-8 rounded-2xl shadow-lg border border-gray-200/50 dark:border-gray-700/50 max-w-5xl mx-auto mt-20 outline-none"
          overlayClassName="fixed inset-0 bg-black bg-opacity-50 dark:bg-opacity-75 flex justify-center items-center p-4 z-50"
        >
          <div className="flex justify-between items-start mb-6">
            <h2 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-800 bg-clip-text text-transparent flex items-center gap-3">
              <BookOpen className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
              Start Assessment
            </h2>
            <button
              onClick={() => setIsModalOpen(false)}
              className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-all duration-200"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {selectedAssessment && (
            <div>
              <div className="space-y-4 text-base mb-6">
                <div>
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase">
                    Job Title
                  </h3>
                  <p className="text-gray-900 dark:text-gray-100">
                    {selectedAssessment.job_title}
                  </p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase">
                    Company
                  </h3>
                  <p className="text-gray-900 dark:text-gray-100">
                    {selectedAssessment.company}
                  </p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase">
                    Duration
                  </h3>
                  <p className="text-gray-900 dark:text-gray-100">
                    {selectedAssessment.duration} minutes
                  </p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase">
                    Questions
                  </h3>
                  <p className="text-gray-900 dark:text-gray-100">
                    {selectedAssessment.num_questions}
                  </p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase">
                    Description
                  </h3>
                  <p className="text-gray-900 dark:text-gray-100 bg-white/50 dark:bg-gray-700/50 p-3 rounded-xl border border-gray-200/50 dark:border-gray-700/50 overflow-auto max-h-[15rem]">
                    {selectedAssessment.job_description ||
                      'No description provided.'}
                  </p>
                </div>
              </div>

              <div className="bg-white/50 dark:bg-gray-700/50 backdrop-blur-lg p-4 rounded-xl border border-gray-200/50 dark:border-gray-700/50 mb-6">
                <h3 className="text-base font-medium text-indigo-600 dark:text-indigo-300 mb-3">
                  Important Notes:
                </h3>
                <ul className="text-base text-gray-700 dark:text-gray-200 space-y-2">
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    <span>Ensure you have a stable internet connection</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    <span>Find a quiet environment without distractions</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    <span>You cannot pause once started</span>
                  </li>
                </ul>
              </div>

              <div className="flex justify-end gap-4">
                <Button
                  onClick={() => setIsModalOpen(false)}
                  className="px-6 py-3 bg-white/50 dark:bg-gray-700/50 text-gray-700 dark:text-gray-200 rounded-xl border border-gray-200/50 dark:border-gray-700/50 hover:bg-gray-100/50 dark:hover:bg-gray-600/50 transition-all duration-200"
                >
                  Cancel
                </Button>
                <Button
                  onClick={confirmStartAssessment}
                  className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl flex items-center justify-center gap-2 hover:from-indigo-700 hover:to-purple-700 transition-all duration-300 shadow-lg hover:shadow-xl"
                >
                  Start Now
                  <ArrowRight className="w-5 h-5" />
                </Button>
              </div>
            </div>
          )}
        </Modal>

        <Modal
          isOpen={isIneligibleModalOpen}
          onRequestClose={() => setIsIneligibleModalOpen(false)}
          className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-lg p-6 sm:p-8 rounded-2xl shadow-lg border border-gray-200/50 dark:border-gray-700/50 max-w-md mx-auto mt-20 outline-none"
          overlayClassName="fixed inset-0 bg-black bg-opacity-50 dark:bg-opacity-75 flex justify-center items-center p-4 z-50"
        >
          <div className="flex justify-between items-start mb-6">
            <h2 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-800 bg-clip-text text-transparent flex items-center gap-3">
              <AlertCircle className="w-6 h-6 text-red-600 dark:text-red-400" />
              Not Eligible
            </h2>
            <button
              onClick={() => setIsIneligibleModalOpen(false)}
              className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-all duration-200"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <p className="text-base text-gray-700 dark:text-gray-200 mb-6">
            {ineligibleMessage}
          </p>
          <div className="flex justify-end gap-4">
            <LinkButton
              to="/candidate/complete-profile"
              className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl flex items-center justify-center gap-2 hover:from-indigo-700 hover:to-purple-700 transition-all duration-300 shadow-lg hover:shadow-xl"
            >
              Update Profile
              <ArrowRight className="w-5 h-5" />
            </LinkButton>
            <Button
              onClick={() => setIsIneligibleModalOpen(false)}
              className="px-6 py-3 bg-white/50 dark:bg-gray-700/50 text-gray-700 dark:text-gray-200 rounded-xl border border-gray-200/50 dark:border-gray-700/50 hover:bg-gray-100/50 dark:hover:bg-gray-600/50 transition-all duration-200"
            >
              Close
            </Button>
          </div>
        </Modal>
      </div>
    </div>
  )
}

export default CandidateDashboard

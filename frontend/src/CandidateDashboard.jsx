import React, { useState, useEffect, useContext, useRef } from 'react'
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
  Camera,
} from 'lucide-react'
import Navbar from './components/Navbar'
import { ThemeContext } from './context/ThemeContext'
import { format } from 'date-fns'
import LinkButton from './components/LinkButton'
import Button from './components/Button'
import { baseUrl } from './utils/utils'
import * as cocoSsd from '@tensorflow-models/coco-ssd'
import '@tensorflow/tfjs'
import Webcam from 'react-webcam'

// Bind modal to your appElement (for accessibility)
Modal.setAppElement('#root')

const VIDEO_WIDTH = 400
const VIDEO_HEIGHT = 300
const videoConstraints = {
  width: VIDEO_WIDTH,
  height: VIDEO_HEIGHT,
  facingMode: 'environment',
}

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
      return 'bg-gradient-to-r from-gray-300 to-gray-500 text-white'
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
  const [modalStep, setModalStep] = useState(1)
  const [webcamError, setWebcamError] = useState('')
  const [webcamStream, setWebcamStream] = useState(null)
  const [modelLoading, setModelLoading] = useState(false)
  const [modelLoaded, setModelLoaded] = useState(false)
  const [cameraVerified, setCameraVerified] = useState(false)
  const [faceVerified, setFaceVerified] = useState(false)
  const webcamRef = useRef(null)
  const streamRef = useRef(null)

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

    // Cleanup webcam stream on unmount
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop())
      }
    }
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
    setModalStep(1)
    setWebcamError('')
    setWebcamStream(null)
    setModelLoading(false)
    setModelLoaded(false)
    setCameraVerified(false)
    setFaceVerified(false)
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
    }
    setIsModalOpen(true)
  }

  const handleNextStep = async () => {
    if (modalStep === 2) {
      // Request camera permission
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
        })
        setWebcamStream(stream)
        streamRef.current = stream
        if (webcamRef.current) webcamRef.current.video.srcObject = stream
        setWebcamError('')
        setModalStep(modalStep + 1)
      } catch (error) {
        setWebcamError(
          'Webcam access denied. Please allow webcam access to continue.'
        )
      }
    } else if (modalStep === 3) {
      // Load TensorFlow model
      setModelLoading(true)
      try {
        const loadedModel = await cocoSsd.load()
        setModelLoaded(true)
        setModelLoading(false)
        setModalStep(modalStep + 1)
      } catch (error) {
        setModelLoading(false)
        setErrorMessage('Failed to load object detection model.')
      }
    } else if (modalStep === 4) {
      // Camera verification
      if (webcamStream) {
        setCameraVerified(true)
        setModalStep(modalStep + 1)
      } else {
        setWebcamError('No webcam feed detected. Please try again.')
      }
    } else if (modalStep === 5) {
      // Face verification
      if (webcamRef.current && webcamStream) {
        const imageSrc = webcamRef.current.getScreenshot()
        if (!imageSrc) {
          setErrorMessage('Could not capture webcam image')
          return
        }

        const blob = await fetch(imageSrc).then((r) => r.blob())
        const formData = new FormData()
        formData.append('webcam_image', blob, 'webcam.jpg')

        try {
          const response = await fetch(`${baseUrl}/candidate/verify-face`, {
            method: 'POST',
            body: formData,
            credentials: 'include',
          })

          const data = await response.json()
          if (data.success) {
            setFaceVerified(true)
            setModalStep((prev) => prev + 1)
          } else {
            setErrorMessage(data.error || 'Face verification failed.')
          }
        } catch (error) {
          console.error('Error during face verification:', error)
          setErrorMessage(`Face verification failed: ${error.message}`)
        }
      } else {
        setErrorMessage('No webcam feed available for face verification.')
      }
    } else if (modalStep === 6) {
      // Start assessment
      if (selectedAssessment && cameraVerified && modelLoaded && faceVerified) {
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
              setIsModalOpen(false)
              navigate(`/candidate/assessment/${data.attempt_id}`)
            } else {
              setErrorMessage(data.error || 'Failed to start the assessment.')
            }
          })
          .catch((error) => {
            console.error('Error starting assessment:', error)
            setErrorMessage(`Failed to start the assessment: ${error.message}`)
          })
      }
    } else {
      setModalStep(modalStep + 1)
    }
  }

  const handleBackStep = () => {
    if (modalStep > 1) {
      setModalStep(modalStep - 1)
      setErrorMessage('')
      if (modalStep === 3 && streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop())
        setWebcamStream(null)
      }
      if (modalStep === 5) {
        setFaceVerified(false)
      }
    }
  }

  if (!candidate) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-gray-900 dark:via-slate-900 dark:to-indigo-950 flex justify-center items-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-indigo-500 border-t-transparent mx-auto mb-4"></div>
          <p className="text-gray-900 dark:text-gray-100 text-xl font-medium">
            Loading...
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-gray-900 dark:via-slate-900 dark:to-indigo-950 flex flex-col font-sans">
      <Navbar />
      <div className="flex-grow py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-800 bg-clip-text text-transparent mb-8 text-center">
            Welcome, {candidate?.name?.split(' ')[0]}! Explore Your Job
            Opportunities
          </h1>

          {errorMessage && (
            <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-lg rounded-2xl shadow-xl border border-gray-200/50 dark:border-gray-700/50 p-8 mb-8 text-center">
              <div className="text-red-500 dark:text-red-400 text-6xl mb-4">
                ⚠️
              </div>
              <p className="text-red-600 dark:text-red-400 text-xl font-medium">
                {errorMessage}
              </p>
            </div>
          )}

          {successMessage && (
            <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-lg rounded-2xl shadow-xl border border-gray-200/50 dark:border-gray-700/50 p-8 mb-8">
              <p className="text-green-600 dark:text-green-300 text-xl font-medium flex items-center gap-2 justify-center">
                <Check className="w-6 h-6" />
                {successMessage}
              </p>
            </div>
          )}

          {!candidate.is_profile_complete ? (
            <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-lg rounded-2xl shadow-xl border border-gray-200/50 dark:border-gray-700/50 p-8 mb-8">
              <p className="text-yellow-600 dark:text-yellow-300 text-xl font-medium flex items-center gap-2 justify-center">
                <AlertCircle className="w-6 h-6" />
                Please complete your profile to access assessments.
              </p>
              <div className="flex justify-center mt-4">
                <LinkButton
                  to="/candidate/complete-profile"
                  className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-6 py-3 rounded-xl flex items-center hover:from-indigo-700 hover:to-purple-700 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105"
                >
                  Complete Profile
                  <ChevronRight className="w-5 h-5 ml-2" />
                </LinkButton>
              </div>
            </div>
          ) : (
            <div className="space-y-12">
              <div className="flex border-b border-gray-200/50 dark:border-gray-700/50 gap-4 mb-8">
                {['recommended', 'explore', 'attempted'].map((tab) => (
                  <button
                    key={tab}
                    className={`px-4 py-2 text-base font-medium transition-all duration-200 ${
                      activeTab === tab
                        ? 'border-b-2 border-indigo-600 text-indigo-600 dark:text-indigo-300'
                        : 'text-gray-600 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-300 hover:bg-indigo-50/50 dark:hover:bg-indigo-900/50'
                    } rounded-t-lg`}
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

              {activeTab === 'recommended' && (
                <div>
                  {assessments.eligible.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                      {assessments.eligible.map((assessment) => (
                        <div
                          key={assessment.job_id}
                          className="group bg-white/70 dark:bg-gray-800/70 backdrop-blur-lg rounded-2xl shadow-lg border border-gray-200/50 dark:border-gray-700/50 p-6 hover:shadow-2xl hover:scale-105 transition-all duration-300"
                        >
                          {assessment.logo && (
                            <img
                              src={`https://storage.googleapis.com/gen-ai-quiz/uploads/${assessment.logo}`}
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
                          <div className="space-y-3 text-base text-gray-600 dark:text-gray-400 mb-6">
                            <div className="flex items-center gap-2">
                              <Award className="w-4 h-4 text-indigo-600 dark:text-indigo-300" />
                              <span>
                                {assessment.experience_min}-
                                {assessment.experience_max} years
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <FileText className="w-4 h-4 text-indigo-600 dark:text-indigo-300" />
                              <span>
                                Degree: {assessment.degree_required || 'None'}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <FileText className="w-4 h-4 text-indigo-600 dark:text-indigo-300" />
                              <span>Questions: {assessment.num_questions}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Clock className="w-4 h-4 text-indigo-600 dark:text-indigo-300" />
                              <span>
                                Duration: {assessment.duration} minutes
                              </span>
                            </div>
                            {assessment.schedule_start && (
                              <div className="flex items-center gap-2">
                                <Calendar className="w-4 h-4 text-indigo-600 dark:text-indigo-300" />
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
                                  <Code className="w-4 h-4 text-indigo-600 dark:text-indigo-300" />
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
                          <button
                            onClick={() => {
                              if (assessment.is_registered) {
                                handleStartAssessment(assessment)
                              } else {
                                handleRegisterAssessment(assessment)
                              }
                            }}
                            className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-6 py-3 rounded-xl flex items-center justify-center gap-2 hover:from-indigo-700 hover:to-purple-700 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105"
                            disabled={
                              !assessment.is_eligible &&
                              !candidate.is_profile_complete
                            }
                          >
                            {assessment.is_registered
                              ? 'Start Assessment'
                              : 'Register'}
                            <ArrowRight className="w-5 h-5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-lg rounded-2xl shadow-lg border border-gray-200/50 dark:border-gray-700/50 p-8 text-center">
                      <p className="text-lg text-gray-600 dark:text-gray-400 mb-4">
                        No recommended jobs available at the moment.
                      </p>
                      <div className="flex justify-center">
                        <LinkButton
                          to="/candidate/complete-profile"
                          className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-6 py-3 rounded-xl inline-flex items-center justify-center gap-2 hover:from-indigo-700 hover:to-purple-700 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105"
                        >
                          Update Profile
                          <ChevronRight className="w-5 h-5" />
                        </LinkButton>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'explore' && (
                <div>
                  {assessments.all.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                      {assessments.all.map((assessment) => (
                        <div
                          key={assessment.job_id}
                          className="group bg-white/70 dark:bg-gray-800/70 backdrop-blur-lg rounded-2xl shadow-lg border border-gray-200/50 dark:border-gray-700/50 p-6 hover:shadow-2xl hover:scale-105 transition-all duration-300"
                        >
                          {assessment.logo && (
                            <img
                              src={`https://storage.googleapis.com/gen-ai-quiz/uploads/${assessment.logo}`}
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
                          <div className="space-y-3 text-base text-gray-600 dark:text-gray-400 mb-6">
                            <div className="flex items-center gap-2">
                              <Award className="w-4 h-4 text-indigo-600 dark:text-indigo-300" />
                              <span>
                                {assessment.experience_min}-
                                {assessment.experience_max} years
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <FileText className="w-4 h-4 text-indigo-600 dark:text-indigo-300" />
                              <span>
                                Degree: {assessment.degree_required || 'None'}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <FileText className="w-4 h-4 text-indigo-600 dark:text-indigo-300" />
                              <span>Questions: {assessment.num_questions}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Clock className="w-4 h-4 text-indigo-600 dark:text-indigo-300" />
                              <span>
                                Duration: {assessment.duration} minutes
                              </span>
                            </div>
                            {assessment.schedule_start && (
                              <div className="flex items-center gap-2">
                                <Calendar className="w-4 h-4 text-indigo-600 dark:text-indigo-300" />
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
                                  <Code className="w-4 h-4 text-indigo-600 dark:text-indigo-300" />
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
                          {assessment.is_eligible ? (
                            <button
                              onClick={() => {
                                if (assessment.is_registered) {
                                  handleStartAssessment(assessment)
                                } else {
                                  handleRegisterAssessment(assessment)
                                }
                              }}
                              className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-6 py-3 rounded-xl flex items-center justify-center gap-2 hover:from-indigo-700 hover:to-purple-700 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105"
                              disabled={!candidate.is_profile_complete}
                            >
                              {assessment.is_registered
                                ? 'Start Assessment'
                                : 'Register'}
                              <ArrowRight className="w-5 h-5" />
                            </button>
                          ) : (
                            <div>
                              <p className="text-sm text-red-600 dark:text-red-400 mb-4">
                                Ineligible: Requires {assessment.experience_min}
                                -{assessment.experience_max} years of
                                experience, Degree:{' '}
                                {assessment.degree_required || 'None'}
                              </p>
                              <LinkButton
                                to="/candidate/complete-profile"
                                className="w-full bg-gradient-to-r from-gray-500 to-gray-600 text-white px-6 py-3 rounded-xl flex items-center justify-center gap-2 hover:from-gray-600 hover:to-gray-700 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105"
                              >
                                Update Profile to Become Eligible
                                <ChevronRight className="w-5 h-5" />
                              </LinkButton>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-lg rounded-2xl shadow-lg border border-gray-200/50 dark:border-gray-700/50 p-8 text-center">
                      <p className="text-lg text-gray-600 dark:text-gray-400 mb-4">
                        No jobs available at the moment.
                      </p>
                      <LinkButton
                        to="/candidate/complete-profile"
                        className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-6 py-3 rounded-xl flex items-center justify-center gap-2 hover:from-indigo-700 hover:to-purple-700 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105 mx-auto"
                      >
                        Update Profile
                        <ChevronRight className="w-5 h-5" />
                      </LinkButton>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'attempted' &&
                assessments.attempted.length > 0 && (
                  <div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                      {assessments.attempted.map((assessment) => (
                        <div
                          key={assessment.attempt_id}
                          className="group bg-white/70 dark:bg-gray-800/70 backdrop-blur-lg rounded-2xl shadow-lg border border-gray-200/50 dark:border-gray-700/50 p-6 hover:shadow-2xl hover:scale-105 transition-all duration-300"
                        >
                          {assessment.logo && (
                            <img
                              src={`https://storage.googleapis.com/gen-ai-quiz/uploads/${assessment.logo}`}
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
                          <div className="space-y-3 text-base text-gray-600 dark:text-gray-400 mb-6">
                            <div className="flex items-center gap-2">
                              <Check className="w-4 h-4 text-green-600 dark:text-green-300" />
                              <span>Status: {assessment.status}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Calendar className="w-4 h-4 text-indigo-600 dark:text-indigo-300" />
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
                            className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-6 py-3 rounded-xl flex items-center justify-center gap-2 hover:from-indigo-700 hover:to-purple-700 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105"
                          >
                            View Report
                            <ChevronRight className="w-5 h-5" />
                          </LinkButton>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
            </div>
          )}

          <Modal
            isOpen={isModalOpen}
            onRequestClose={() => {
              setIsModalOpen(false)
              if (streamRef.current) {
                streamRef.current.getTracks().forEach((track) => track.stop())
              }
            }}
            className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-lg p-8 rounded-3xl shadow-xl border border-gray-200/50 dark:border-gray-700/50 max-w-5xl mx-auto mt-20 outline-none h-[90vh] overflow-y-auto"
            overlayClassName="fixed inset-0 bg-black bg-opacity-50 dark:bg-opacity-75 flex justify-center items-center p-4 z-50"
            aria={{
              labelledby: 'assessment-modal-title',
              describedby: 'assessment-modal-desc',
            }}
          >
            <div className="flex justify-between items-start mb-8">
              <div className="flex items-center">
                <div className="p-3 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl mr-4">
                  <BookOpen className="w-8 h-8 text-white" />
                </div>
                <h2
                  id="assessment-modal-title"
                  className="text-2xl font-bold text-gray-900 dark:text-white"
                >
                  {modalStep === 1 && 'Assessment Details'}
                  {modalStep === 2 && 'Camera Permission'}
                  {modalStep === 3 && 'Load Object Detection Model'}
                  {modalStep === 4 && 'Camera Verification'}
                  {modalStep === 5 && 'Face Verification'}
                  {modalStep === 6 && 'Start Assessment'}
                </h2>
              </div>
              <button
                onClick={() => {
                  setIsModalOpen(false)
                  if (streamRef.current) {
                    streamRef.current
                      .getTracks()
                      .forEach((track) => track.stop())
                  }
                }}
                className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-all duration-200"
                aria-label="Close modal"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {selectedAssessment && (
              <div id="assessment-modal-desc">
                {/* Stepper */}
                <div className="flex items-center justify-between mb-8">
                  {[
                    'Details',
                    'Camera Permission',
                    'Model Loading',
                    'Camera Verification',
                    'Face Verification',
                    'Start',
                  ].map((label, index) => (
                    <div key={index} className="flex items-center flex-1">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                          modalStep > index + 1
                            ? 'bg-green-500 text-white'
                            : modalStep === index + 1
                            ? 'bg-indigo-600 text-white'
                            : 'bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300'
                        }`}
                      >
                        {modalStep > index + 1 ? (
                          <Check className="w-4 h-4" />
                        ) : (
                          index + 1
                        )}
                      </div>
                      <span
                        className={`ml-2 text-sm ${
                          modalStep >= index + 1
                            ? 'text-gray-900 dark:text-gray-100'
                            : 'text-gray-500 dark:text-gray-400'
                        }`}
                      >
                        {label}
                      </span>
                      {index < 5 && (
                        <div className="flex-1 h-1 bg-gray-200 dark:bg-gray-700 mx-2">
                          <div
                            className={`h-full ${
                              modalStep > index + 1
                                ? 'bg-green-500'
                                : 'bg-gray-200 dark:bg-gray-700'
                            }`}
                          ></div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Step 1: Job Details and Instructions */}
                {modalStep === 1 && (
                  <div className="space-y-6 text-base mb-8">
                    <div>
                      <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase">
                        Job Title
                      </h3>
                      <p className="text-gray-900 dark:text-gray-100 text-lg">
                        {selectedAssessment.job_title}
                      </p>
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase">
                        Company
                      </h3>
                      <p className="text-gray-900 dark:text-gray-100 text-lg">
                        {selectedAssessment.company}
                      </p>
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase">
                        Duration
                      </h3>
                      <p className="text-gray-900 dark:text-gray-100 text-lg">
                        {selectedAssessment.duration} minutes
                      </p>
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase">
                        Questions
                      </h3>
                      <p className="text-gray-900 dark:text-gray-100 text-lg">
                        {selectedAssessment.num_questions}
                      </p>
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase">
                        Prerequisites
                      </h3>
                      <div className="space-y-3 text-gray-900 dark:text-gray-100">
                        <div className="flex items-center gap-2">
                          <Award className="w-4 h-4 text-indigo-600 dark:text-indigo-300" />
                          <span>
                            Experience: {selectedAssessment.experience_min}-
                            {selectedAssessment.experience_max} years
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-indigo-600 dark:text-indigo-300" />
                          <span>
                            Degree:{' '}
                            {selectedAssessment.degree_required || 'None'}
                          </span>
                        </div>
                        {selectedAssessment.skills &&
                          selectedAssessment.skills.length > 0 && (
                            <div className="flex flex-wrap gap-2 items-center">
                              <Code className="w-4 h-4 text-indigo-600 dark:text-indigo-300" />
                              {selectedAssessment.skills.map((skill, index) => (
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
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase">
                        Description
                      </h3>
                      <p className="text-gray-900 dark:text-gray-100 bg-white/50 dark:bg-gray-700/50 p-4 rounded-xl border border-gray-200/50 dark:border-gray-700/50 overflow-auto max-h-[15rem]">
                        {selectedAssessment.job_description ||
                          'No description provided.'}
                      </p>
                    </div>
                    <div className="bg-white/50 dark:bg-gray-700/50 backdrop-blur-lg p-6 rounded-xl border border-gray-200/50 dark:border-gray-700/50">
                      <h3 className="text-lg font-medium text-indigo-600 dark:text-indigo-300 mb-4">
                        Important Instructions:
                      </h3>
                      <ul className="text-base text-gray-700 dark:text-gray-200 space-y-3">
                        <li className="flex items-center gap-2">
                          <Check className="w-5 h-5 text-indigo-600 dark:text-indigo-300" />
                          <span>Ensure a stable internet connection.</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <Check className="w-5 h-5 text-indigo-600 dark:text-indigo-300" />
                          <span>Find a quiet, well-lit environment.</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <Check className="w-5 h-5 text-indigo-600 dark:text-indigo-300" />
                          <span>Allow webcam access for proctoring.</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <Check className="w-5 h-5 text-indigo-600 dark:text-indigo-300" />
                          <span>
                            Do not switch tabs or exit fullscreen mode.
                          </span>
                        </li>
                        <li className="flex items-center gap-2">
                          <Check className="w-5 h-5 text-indigo-600 dark:text-indigo-300" />
                          <span>
                            You cannot pause the assessment once started.
                          </span>
                        </li>
                      </ul>
                    </div>
                  </div>
                )}

                {/* Step 2: Camera Permission */}
                {modalStep === 2 && (
                  <div className="space-y-6 text-base mb-8">
                    <p className="text-gray-900 dark:text-gray-100">
                      This assessment requires webcam access for proctoring.
                      Please allow camera access to proceed.
                    </p>
                    {webcamError && (
                      <div className="bg-red-50/80 dark:bg-red-900/20 border border-red-200/50 dark:border-red-700/50 text-red-700 dark:text-red-300 p-4 rounded-xl flex items-center gap-3">
                        <X className="w-5 h-5" />
                        <span>{webcamError}</span>
                      </div>
                    )}
                    {webcamStream && (
                      <div className="bg-green-50/80 dark:bg-green-900/20 border border-green-200/50 dark:border-green-700/50 text-green-700 dark:text-green-300 p-4 rounded-xl flex items-center gap-3">
                        <Check className="w-5 h-5" />
                        <span>Camera permission granted successfully.</span>
                      </div>
                    )}
                    <Button
                      onClick={handleNextStep}
                      className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-6 py-3 rounded-xl flex items-center justify-center gap-2 hover:from-indigo-700 hover:to-purple-700 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105"
                      disabled={webcamStream}
                    >
                      Request Camera Access
                      <Camera className="w-5 h-5" />
                    </Button>
                  </div>
                )}

                {/* Step 3: Load TensorFlow Model */}
                {modalStep === 3 && (
                  <div className="space-y-6 text-base mb-8">
                    <p className="text-gray-900 dark:text-gray-100">
                      The assessment requires an object detection model for
                      proctoring. Please load the model to proceed.
                    </p>
                    {errorMessage && (
                      <div className="bg-red-50/80 dark:bg-red-900/20 border border-red-200/50 dark:border-red-700/50 text-red-700 dark:text-red-300 p-4 rounded-xl flex items-center gap-3">
                        <X className="w-5 h-5" />
                        <span>{errorMessage}</span>
                      </div>
                    )}
                    {modelLoaded && (
                      <div className="bg-green-50/80 dark:bg-green-900/20 border border-green-200/50 dark:border-green-700/50 text-green-700 dark:text-green-300 p-4 rounded-xl flex items-center gap-3">
                        <Check className="w-5 h-5" />
                        <span>Model loaded successfully.</span>
                      </div>
                    )}
                    {modelLoading && (
                      <div className="flex items-center gap-3 justify-center">
                        <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
                        <span className="text-gray-700 dark:text-gray-200">
                          Loading object detection model...
                        </span>
                      </div>
                    )}
                    <Button
                      onClick={handleNextStep}
                      className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-6 py-3 rounded-xl flex items-center justify-center gap-2 hover:from-indigo-700 hover:to-purple-700 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105"
                      disabled={modelLoading || modelLoaded}
                    >
                      Load Model
                      <ArrowRight className="w-5 h-5" />
                    </Button>
                  </div>
                )}

                {/* Step 4: Camera Verification */}
                {modalStep === 4 && (
                  <div className="space-y-6 text-base mb-8">
                    <p className="text-gray-900 dark:text-gray-100">
                      Please verify that your webcam is working correctly. You
                      should see your video feed below.
                    </p>
                    {webcamError && (
                      <div className="bg-red-50/80 dark:bg-red-900/20 border border-red-200/50 dark:border-red-700/50 text-red-700 dark:text-red-300 p-4 rounded-xl flex items-center gap-3">
                        <X className="w-5 h-5" />
                        <span>{webcamError}</span>
                      </div>
                    )}
                    <div className="relative w-full aspect-video bg-gray-100/80 dark:bg-gray-700/80 rounded-2xl overflow-hidden border border-gray-200/50 dark:border-gray-700/50 shadow-inner">
                      {webcamStream && (
                        <Webcam
                          ref={webcamRef}
                          width={VIDEO_WIDTH}
                          height={VIDEO_HEIGHT}
                          audio={false}
                          screenshotFormat="image/jpeg"
                          videoConstraints={videoConstraints}
                          className="absolute top-0 left-0 w-full h-full object-cover"
                        />
                      )}
                    </div>
                    <Button
                      onClick={() => {
                        setCameraVerified(true)
                        handleNextStep()
                      }}
                      className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-6 py-3 rounded-xl flex items-center justify-center gap-2 hover:from-indigo-700 hover:to-purple-700 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105"
                      disabled={!webcamStream}
                    >
                      Verify Camera
                      <Camera className="w-5 h-5" />
                    </Button>
                  </div>
                )}

                {/* Step 5: Face Verification */}
                {modalStep === 5 && (
                  <div className="space-y-6 text-base mb-8">
                    <p className="text-gray-900 dark:text-gray-100">
                      Please verify your identity using facial recognition.
                      Ensure your face is clearly visible in the webcam feed
                      below.
                    </p>
                    {errorMessage && (
                      <div className="bg-red-50/80 dark:bg-red-900/20 border border-red-200/50 dark:border-red-700/50 text-red-700 dark:text-red-300 p-4 rounded-xl flex items-center gap-3">
                        <X className="w-5 h-5" />
                        <span>{errorMessage}</span>
                      </div>
                    )}
                    {faceVerified && (
                      <div className="bg-green-50/80 dark:bg-green-900/20 border border-green-200/50 dark:border-green-700/50 text-green-700 dark:text-green-300 p-4 rounded-xl flex items-center gap-3">
                        <Check className="w-5 h-5" />
                        <span>Face verified successfully.</span>
                      </div>
                    )}
                    <div className="relative w-full aspect-video bg-gray-100/80 dark:bg-gray-700/80 rounded-2xl overflow-hidden border border-gray-200/50 dark:border-gray-700/50 shadow-inner">
                      {webcamStream && (
                        <Webcam
                          ref={webcamRef}
                          width={VIDEO_WIDTH}
                          height={VIDEO_HEIGHT}
                          audio={false}
                          screenshotFormat="image/jpeg"
                          videoConstraints={videoConstraints}
                          className="absolute top-0 left-0 w-full h-full object-cover"
                        />
                      )}
                    </div>
                    <Button
                      onClick={handleNextStep}
                      className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-6 py-3 rounded-xl flex items-center justify-center gap-2 hover:from-indigo-700 hover:to-purple-700 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105"
                      disabled={!webcamStream || faceVerified}
                    >
                      Verify Face
                      <Camera className="w-5 h-5" />
                    </Button>
                  </div>
                )}

                {/* Step 6: Start Assessment */}
                {modalStep === 6 && (
                  <div className="space-y-6 text-base mb-8">
                    <p className="text-gray-900 dark:text-gray-100">
                      All prerequisites are complete. You are ready to start the
                      assessment for {selectedAssessment.job_title} at{' '}
                      {selectedAssessment.company}.
                    </p>
                    {errorMessage && (
                      <div className="bg-red-50/80 dark:bg-red-900/20 border border-red-200/50 dark:border-red-700/50 text-red-700 dark:text-red-300 p-4 rounded-xl flex items-center gap-3">
                        <X className="w-5 h-5" />
                        <span>{errorMessage}</span>
                      </div>
                    )}
                    <div className="bg-green-50/80 dark:bg-green-900/20 border border-green-200/50 dark:border-green-700/50 text-green-700 dark:text-green-300 p-4 rounded-xl">
                      <ul className="space-y-3">
                        <li className="flex items-center gap-2">
                          <Check className="w-5 h-5" />
                          Camera permission granted
                        </li>
                        <li className="flex items-center gap-2">
                          <Check className="w-5 h-5" />
                          Object detection model loaded
                        </li>
                        <li className="flex items-center gap-2">
                          <Check className="w-5 h-5" />
                          Camera verified
                        </li>
                        <li className="flex items-center gap-2">
                          <Check className="w-5 h-5" />
                          Face verified
                        </li>
                      </ul>
                    </div>
                  </div>
                )}

                <div className="flex justify-between gap-4">
                  {modalStep > 1 && (
                    <Button
                      onClick={handleBackStep}
                      className="bg-gradient-to-r from-gray-500 to-gray-600 text-white px-6 py-3 rounded-xl hover:from-gray-600 hover:to-gray-700 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105"
                    >
                      Back
                    </Button>
                  )}
                  <div className="flex justify-end gap-4 flex-1">
                    <Button
                      onClick={() => {
                        setIsModalOpen(false)
                        if (streamRef.current) {
                          streamRef.current
                            .getTracks()
                            .forEach((track) => track.stop())
                        }
                      }}
                      className="bg-gradient-to-r from-gray-500 to-gray-600 text-white px-6 py-3 rounded-xl hover:from-gray-600 hover:to-gray-700 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleNextStep}
                      className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-6 py-3 rounded-xl flex items-center justify-center gap-2 hover:from-indigo-700 hover:to-purple-700 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105"
                      disabled={
                        (modalStep === 2 && webcamStream) ||
                        (modalStep === 3 && (modelLoading || modelLoaded)) ||
                        (modalStep === 4 && !webcamStream) ||
                        (modalStep === 5 && (!webcamStream || faceVerified)) ||
                        (modalStep === 6 &&
                          !(cameraVerified && modelLoaded && faceVerified))
                      }
                    >
                      {modalStep === 6 ? 'Start Assessment' : 'Next'}
                      <ArrowRight className="w-5 h-5" />
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </Modal>

          <Modal
            isOpen={isIneligibleModalOpen}
            onRequestClose={() => setIsIneligibleModalOpen(false)}
            className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-lg p-8 rounded-3xl shadow-xl border border-gray-200/50 dark:border-gray-700/50 max-w-md mx-auto mt-20 outline-none"
            overlayClassName="fixed inset-0 bg-black bg-opacity-50 dark:bg-opacity-75 flex justify-center items-center p-4 z-50"
          >
            <div className="flex justify-between items-start mb-8">
              <div className="flex items-center">
                <div className="p-3 bg-gradient-to-r from-red-500 to-pink-600 rounded-xl mr-4">
                  <AlertCircle className="w-8 h-8 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Not Eligible
                </h2>
              </div>
              <button
                onClick={() => setIsIneligibleModalOpen(false)}
                className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-all duration-200"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <p className="text-lg text-gray-700 dark:text-gray-200 mb-8">
              {ineligibleMessage}
            </p>
            <div className="flex justify-end gap-4">
              <LinkButton
                to="/candidate/complete-profile"
                className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-6 py-3 rounded-xl flex items-center justify-center gap-2 hover:from-indigo-700 hover:to-purple-700 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105"
              >
                Update Profile
                <ArrowRight className="w-5 h-5" />
              </LinkButton>
              <button
                onClick={() => setIsIneligibleModalOpen(false)}
                className="bg-gradient-to-r from-gray-500 to-gray-600 text-white px-6 py-3 rounded-xl hover:from-gray-600 hover:to-gray-700 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105"
              >
                Close
              </button>
            </div>
          </Modal>
        </div>
      </div>
    </div>
  )
}

export default CandidateDashboard

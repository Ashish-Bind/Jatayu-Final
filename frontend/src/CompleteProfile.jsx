import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import {
  User,
  Phone,
  MapPin,
  Linkedin,
  Github,
  GraduationCap,
  Briefcase,
  FileText,
  ArrowRight,
  Check,
  X,
  Loader2,
  Camera,
  Calendar,
  Mail,
} from 'lucide-react'
import Navbar from './components/Navbar'
import LinkButton from './components/LinkButton'
import Button from './components/Button'
import Select from 'react-select'
import { baseUrl } from './utils/utils'

const CompleteProfile = () => {
  const { user } = useAuth()
  const [candidate, setCandidate] = useState(null)
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    location: '',
    linkedin: '',
    github: '',
    degree_id: '',
    branch_id: '',
    passout_year: '',
    years_of_experience: '',
    resume: '',
  })
  const [degrees, setDegrees] = useState([])
  const [branches, setBranches] = useState([])
  const [resume, setResume] = useState(null)
  const [profilePicture, setProfilePicture] = useState(null)
  const [profilePreview, setProfilePreview] = useState(null)
  const [webcamImage, setWebcamImage] = useState(null)
  const [webcamPreview, setWebcamPreview] = useState(null)
  const [message, setMessage] = useState({ text: '', type: '' })
  const [isLoading, setIsLoading] = useState(false)
  const [isWebcamActive, setIsWebcamActive] = useState(false)
  const [enforceOtpVerification, setEnforceOtpVerification] = useState(false)
  const [otp, setOtp] = useState('')
  const [otpSent, setOtpSent] = useState(false)
  const [otpVerified, setOtpVerified] = useState(false)
  const navigate = useNavigate()
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)

  useEffect(() => {
    // Fetch profile data
    fetch(`${baseUrl}/candidate/profile/${user.id}`, {
      credentials: 'include',
    })
      .then((response) => {
        if (!response.ok) throw new Error('Failed to fetch profile')
        return response.json()
      })
      .then((data) => {
        setCandidate(data)
        setFormData({
          name: data.name || '',
          phone: data.phone || '',
          location: data.location || '',
          linkedin: data.linkedin || '',
          github: data.github || '',
          degree_id: data.degree_id || '',
          branch_id: data.branch_id || '',
          passout_year: data.passout_year || '',
          years_of_experience: data.years_of_experience || '',
          resume: data.resume || '',
        })
        if (data.profile_picture) {
          setProfilePreview(
            `https://storage.googleapis.com/gen-ai-quiz/uploads/${data.profile_picture}`
          )
        }
        if (data.camera_image) {
          setWebcamPreview(
            `https://storage.googleapis.com/gen-ai-quiz/uploads/${data.camera_image}`
          )
        }
        setEnforceOtpVerification(data.requires_otp_verification)
        if (data.requires_otp_verification) {
          setMessage({
            text: "New location detected. Please verify it's you by requesting an OTP.",
            type: 'info',
          })
        }
      })
      .catch((error) => {
        console.error('Error fetching candidate:', error)
        setMessage({
          text: 'Failed to fetch profile data. Please try again.',
          type: 'error',
        })
      })

    // Fetch degrees
    fetch(`${baseUrl}/candidate/degrees`, { credentials: 'include' })
      .then((response) => {
        if (!response.ok) throw new Error('Failed to fetch degrees')
        return response.json()
      })
      .then((data) => {
        setDegrees(
          data.map((degree) => ({
            value: degree.degree_id,
            label: degree.degree_name,
          }))
        )
      })
      .catch((error) => {
        console.error('Error fetching degrees:', error)
        setMessage({
          text: 'Failed to fetch degree options. Please try again.',
          type: 'error',
        })
      })

    // Fetch branches
    fetch(`${baseUrl}/candidate/branches`, { credentials: 'include' })
      .then((response) => {
        if (!response.ok) throw new Error('Failed to fetch branches')
        return response.json()
      })
      .then((data) => {
        setBranches(
          data.map((branch) => ({
            value: branch.branch_id,
            label: branch.branch_name,
          }))
        )
      })
      .catch((error) => {
        console.error('Error fetching branches:', error)
        setMessage({
          text: 'Failed to fetch branch options. Please try again.',
          type: 'error',
        })
      })

    // Cleanup webcam stream
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop())
      }
    }
  }, [user.id])

  useEffect(() => {
    if (isWebcamActive && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current
    }
  }, [isWebcamActive])

  const requestOtp = async () => {
    try {
      setIsLoading(true)
      const response = await fetch(`${baseUrl}/candidate/auth/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ user_id: user.id }),
      })
      const result = await response.json()
      if (response.ok) {
        setOtpSent(true)
        setMessage({
          text: 'OTP sent to your email. Please check your inbox.',
          type: 'success',
        })
      } else {
        setMessage({
          text: result.error || 'Failed to send OTP. Please try again.',
          type: 'error',
        })
      }
    } catch (error) {
      console.error('Error requesting OTP:', error)
      setMessage({
        text: 'An unexpected error occurred while requesting OTP.',
        type: 'error',
      })
    } finally {
      setIsLoading(false)
    }
  }

  const verifyOtp = async () => {
    try {
      setIsLoading(true)
      const response = await fetch(`${baseUrl}/candidate/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ user_id: user.id, otp }),
      })
      const result = await response.json()
      if (response.ok) {
        setOtpVerified(true)
        setMessage({
          text: 'OTP verified successfully! You can now update your profile.',
          type: 'success',
        })
      } else {
        setMessage({
          text: result.error || 'Invalid OTP. Please try again.',
          type: 'error',
        })
      }
    } catch (error) {
      console.error('Error verifying OTP:', error)
      setMessage({
        text: 'An unexpected error occurred while verifying OTP.',
        type: 'error',
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData({ ...formData, [name]: value })
  }

  const handleOtpChange = (e) => {
    setOtp(e.target.value)
  }

  const handleDegreeChange = (selectedOption) => {
    setFormData({
      ...formData,
      degree_id: selectedOption ? selectedOption.value : '',
    })
  }

  const handleBranchChange = (selectedOption) => {
    setFormData({
      ...formData,
      branch_id: selectedOption ? selectedOption.value : '',
    })
  }

  const handleFileChange = (e) => {
    const { name, files } = e.target
    if (name === 'resume') {
      setResume(files[0])
      setFormData({
        ...formData,
        resume: files[0] ? files[0].name : formData.resume,
      })
    }
    if (name === 'profile_picture') {
      const file = files[0]
      setProfilePicture(file)
      if (file) {
        const reader = new FileReader()
        reader.onloadend = () => {
          setProfilePreview(reader.result)
        }
        reader.readAsDataURL(file)
      }
    }
  }

  const startWebcam = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true })
      streamRef.current = stream
      setIsWebcamActive(true)
    } catch (err) {
      setMessage({
        text: `Failed to access webcam: ${err.message}`,
        type: 'error',
      })
    }
  }

  const captureWebcamImage = () => {
    if (!videoRef.current || !canvasRef.current) {
      setMessage({
        text: 'Webcam is not ready. Please try again.',
        type: 'error',
      })
      return
    }
    const canvas = canvasRef.current
    const video = videoRef.current
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d').drawImage(video, 0, 0)
    canvas.toBlob((blob) => {
      const file = new File([blob], `webcam_${user.id}.jpg`, {
        type: 'image/jpeg',
      })
      setWebcamImage(file)
      setWebcamPreview(URL.createObjectURL(file))
    }, 'image/jpeg')
  }

  const stopWebcam = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
      setIsWebcamActive(false)
    }
  }

  const validateForm = () => {
    if (
      !formData.years_of_experience ||
      isNaN(formData.years_of_experience) ||
      formData.years_of_experience < 0
    ) {
      setMessage({
        text: 'Years of experience must be a valid number (e.g., 3.5).',
        type: 'error',
      })
      return false
    }

    if (!formData.degree_id) {
      setMessage({
        text: 'Please select a valid degree.',
        type: 'error',
      })
      return false
    }

    if (!formData.branch_id) {
      setMessage({
        text: 'Please select a valid branch/specialization.',
        type: 'error',
      })
      return false
    }

    if (formData.passout_year && !/^\d{4}$/.test(formData.passout_year)) {
      setMessage({
        text: 'Passout year must be a valid 4-digit year (e.g., 2023).',
        type: 'error',
      })
      return false
    }

    if (
      !formData.name ||
      !formData.phone ||
      !formData.location ||
      !formData.linkedin ||
      !formData.github
    ) {
      setMessage({
        text: 'Please fill in all required fields.',
        type: 'error',
      })
      return false
    }

    if (enforceOtpVerification && !otpVerified) {
      setMessage({
        text: 'Please verify OTP before updating your profile.',
        type: 'error',
      })
      return false
    }

    if (!candidate.resume && !resume) {
      setMessage({
        text: 'Please upload a resume.',
        type: 'error',
      })
      return false
    }

    return true
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setIsLoading(true)
    setMessage({ text: '', type: '' })

    if (!validateForm()) {
      setIsLoading(false)
      return
    }

    const data = new FormData()
    for (const key in formData) {
      if (key !== 'resume') {
        data.append(key === 'branch_id' ? 'degree_branch' : key, formData[key])
      }
    }
    if (resume) data.append('resume', resume)
    if (profilePicture) data.append('profile_picture', profilePicture)
    if (webcamImage) data.append('webcam_image', webcamImage)

    try {
      const response = await fetch(`${baseUrl}/candidate/profile/${user.id}`, {
        method: 'POST',
        credentials: 'include',
        body: data,
      })

      const result = await response.json()
      if (response.ok) {
        setMessage({
          text: 'Profile updated successfully!',
          type: 'success',
        })
        setTimeout(() => navigate('/candidate/dashboard'), 1500)
      } else {
        setMessage({
          text:
            result.error ||
            'An error occurred while updating your profile. Please try again.',
          type: 'error',
        })
      }
    } catch (error) {
      console.error('Submission Error:', error)
      setMessage({
        text: 'An unexpected error occurred. Please try again.',
        type: 'error',
      })
    } finally {
      setIsLoading(false)
      stopWebcam()
    }
  }

  if (!candidate) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gray-100 dark:bg-gradient-to-br dark:from-gray-900 dark:to-gray-800">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-gray-900 dark:via-slate-900 dark:to-indigo-950 flex flex-col font-[Inter]">
      <Navbar />
      <div className="flex-grow py-10 px-2 sm:px-10 lg:px-24">
        <div className="max-w-7xl mx-auto bg-white dark:bg-gray-900 rounded-2xl shadow-md border border-gray-200 dark:border-gray-800 flex flex-col md:flex-row">
          <div className="w-full md:w-1/3 border-b md:border-b-0 md:border-r border-gray-200 dark:border-gray-700 p-10 flex flex-col items-center gap-8">
            <div className="relative w-28 h-28 mb-4 group">
              <div className="w-full h-full rounded-full overflow-hidden border-4 border-indigo-500 dark:border-indigo-600 group-hover:border-indigo-600 dark:group-hover:border-indigo-500 shadow-sm transition-all">
                {profilePreview ? (
                  <img
                    src={profilePreview}
                    alt="Profile preview"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                    <User className="w-12 h-12 text-indigo-400 dark:text-indigo-300" />
                  </div>
                )}
              </div>
              <label
                htmlFor="profile_picture"
                className="absolute bottom-0 right-0 bg-indigo-600 dark:bg-indigo-600 text-white p-1.5 rounded-full cursor-pointer shadow-sm hover:bg-indigo-700 dark:hover:bg-indigo-500 transition-all group-hover:scale-110"
              >
                <Camera className="w-4 h-4" />
                <input
                  type="file"
                  name="profile_picture"
                  id="profile_picture"
                  className="hidden"
                  accept="image/*"
                  onChange={handleFileChange}
                  disabled={
                    isLoading || (enforceOtpVerification && !otpVerified)
                  }
                />
              </label>
            </div>
            <div className="text-center">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                {formData.name || 'Your Name'}
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-300">
                {candidate?.email || user?.email}
              </p>
            </div>
            <div className="mt-8 w-full">
              <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-2">
                My Email Address
              </h3>
              <div className="flex items-center gap-2 mb-2">
                <span className="inline-flex items-center">
                  <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-indigo-100 dark:bg-indigo-900/30">
                    <svg
                      className="w-4 h-4 text-indigo-600 dark:text-indigo-300"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      viewBox="0 0 24 24"
                    >
                      <path d="M4 4h16v16H4z" stroke="none" />
                      <path d="M22 6l-10 7L2 6" />
                    </svg>
                  </span>
                  <span className="text-sm text-gray-700 dark:text-gray-200 ml-2">
                    {candidate?.email || user?.email}
                  </span>
                </span>
              </div>
            </div>
            <div className="w-full mt-6">
              <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-2">
                Top Skills
              </h3>
              <div className="flex flex-wrap gap-2">
                {candidate?.skills && candidate.skills.length > 0 ? (
                  candidate.skills.slice(0, 5).map(({ skill_name }, i) => (
                    <span
                      key={skill_name}
                      className={`px-3 py-1 rounded-full text-sm font-medium bg-gradient-to-r ${
                        [
                          'from-blue-400 to-indigo-600',
                          'from-purple-400 to-indigo-600',
                          'from-green-400 to-emerald-600',
                          'from-yellow-400 to-amber-600',
                          'from-red-400 to-rose-600',
                        ][i % 5]
                      } text-white`}
                    >
                      {skill_name}
                    </span>
                  ))
                ) : (
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    No skills added yet.
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="w-full md:w-2/3 p-10">
            <div className="mb-10">
              <h1 className="text-3xl md:text-3xl font-extrabold mb-3 tracking-tight flex items-center gap-3 bg-gradient-to-r from-indigo-600 via-purple to-indigo-800 bg-clip-text text-transparent">
                {candidate.is_profile_complete
                  ? 'Edit Your Profile'
                  : 'Complete Your Profile'}
                <span className="inline-block animate-pulse">👤</span>
              </h1>
              <p className="text-lg text-gray-700 dark:text-gray-200 font-medium">
                {candidate.is_profile_complete
                  ? 'Update your details to keep your profile current and access more job opportunities.'
                  : 'Fill in your details to get the most out of our platform.'}
              </p>
            </div>
            {message.text && (
              <div
                className={`mb-6 p-3 rounded-md flex items-center text-base ${
                  message.type === 'success'
                    ? 'bg-green-100 dark:bg-green-800 border border-green-500 text-green-700 dark:text-green-300'
                    : message.type === 'info'
                    ? 'bg-blue-100 dark:bg-blue-800 border border-blue-500 text-blue-700 dark:text-blue-300'
                    : 'bg-red-100 dark:bg-red-800 border border-red-500 dark:border-red-400 text-red-700 dark:text-red-300'
                }`}
              >
                {message.type === 'success' ? (
                  <Check className="w-4 h-4 mr-2" />
                ) : message.type === 'info' ? (
                  <svg
                    className="w-4 h-4 mr-2"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                      clipRule="evenodd"
                    />
                  </svg>
                ) : (
                  <X className="w-4 h-4 mr-2" />
                )}
                {message.text}
              </div>
            )}
            {enforceOtpVerification && !otpVerified && (
              <div className="mb-8 p-6 bg-gray-100 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
                  <Mail className="w-5 h-5 mr-2 text-indigo-600 dark:text-indigo-400" />
                  Verify Your Identity
                </h3>
                <p className="text-base text-gray-700 dark:text-gray-200 mb-4">
                  New location detected. Please verify it's you by requesting an
                  OTP.
                </p>
                {!otpSent ? (
                  <button
                    type="button"
                    onClick={requestOtp}
                    className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-6 py-2 rounded-md flex items-center hover:from-indigo-700 hover:to-purple-700 transition-all duration-300"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        Sending OTP...
                      </>
                    ) : (
                      <>
                        <Mail className="w-4 h-4 mr-2" />
                        Send OTP to Email
                      </>
                    )}
                  </button>
                ) : (
                  <div className="flex flex-col gap-4">
                    <div>
                      <label
                        htmlFor="otp"
                        className="block text-base font-medium text-gray-700 dark:text-gray-200 mb-1"
                      >
                        <span className="flex items-center">
                          <Mail className="w-4 h-4 mr-2 text-indigo-600 dark:text-indigo-400" />
                          Enter OTP
                        </span>
                      </label>
                      <input
                        type="text"
                        id="otp"
                        value={otp}
                        onChange={handleOtpChange}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-indigo-600 focus:border-indigo-600 dark:bg-gray-700 dark:text-gray-200 text-base placeholder-gray-400 dark:placeholder-gray-500"
                        placeholder="Enter 6-digit OTP"
                        maxLength={6}
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={verifyOtp}
                        className="bg-gradient-to-r from-green-600 to-emerald-600 text-white px-6 py-2 rounded-md flex items-center hover:from-green-700 hover:to-emerald-700 transition-all duration-300"
                        disabled={isLoading || !otp.length}
                      >
                        {isLoading ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin mr-2" />
                            Verifying...
                          </>
                        ) : (
                          <>
                            <Check className="w-4 h-4 mr-2" />
                            Verify OTP
                          </>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={requestOtp}
                        className="text-indigo-600 dark:text-indigo-400 hover:underline flex items-center"
                        disabled={isLoading}
                      >
                        Resend OTP
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
            <form
              onSubmit={handleSubmit}
              encType="multipart/form-data"
              className="space-y-6"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label
                    htmlFor="name"
                    className="block text-base font-medium text-gray-700 dark:text-gray-200 mb-1"
                  >
                    <span className="flex items-center">
                      <User className="w-4 h-4 mr-2 text-indigo-600 dark:text-indigo-400" />
                      Full Name
                    </span>
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-indigo-600 focus:border-indigo-600 dark:bg-gray-700 dark:text-gray-200 text-base placeholder-gray-400 dark:placeholder-gray-500"
                    placeholder="Your Full Name"
                    disabled={
                      isLoading || (enforceOtpVerification && !otpVerified)
                    }
                  />
                </div>
                <div>
                  <label
                    htmlFor="phone"
                    className="block text-base font-medium text-gray-700 dark:text-gray-200 mb-1"
                  >
                    <span className="flex items-center">
                      <Phone className="w-4 h-4 mr-2 text-indigo-600 dark:text-indigo-400" />
                      Phone Number
                    </span>
                  </label>
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-indigo-600 focus:border-indigo-600 dark:bg-gray-700 dark:text-gray-200 text-base placeholder-gray-400 dark:placeholder-gray-500"
                    placeholder="+91 123 456 7890"
                    disabled={
                      isLoading || (enforceOtpVerification && !otpVerified)
                    }
                  />
                </div>
              </div>
              <div>
                <label
                  htmlFor="location"
                  className="block text-base font-medium text-gray-700 dark:text-gray-200 mb-1"
                >
                  <span className="flex items-center">
                    <MapPin className="w-4 h-4 mr-2 text-indigo-600 dark:text-indigo-400" />
                    Location
                  </span>
                </label>
                <input
                  type="text"
                  name="location"
                  value={formData.location}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-indigo-600 focus:border-indigo-600 dark:bg-gray-700 dark:text-gray-200 text-base placeholder-gray-400 dark:placeholder-gray-500"
                  placeholder="City, Country"
                  disabled={
                    isLoading || (enforceOtpVerification && !otpVerified)
                  }
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label
                    htmlFor="linkedin"
                    className="block text-base font-medium text-gray-700 dark:text-gray-200 mb-1"
                  >
                    <span className="flex items-center">
                      <Linkedin className="w-4 h-4 mr-2 text-indigo-600 dark:text-indigo-400" />
                      LinkedIn Profile
                    </span>
                  </label>
                  <input
                    type="url"
                    name="linkedin"
                    value={formData.linkedin}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-indigo-600 focus:border-indigo-600 dark:bg-gray-700 dark:text-gray-200 text-base placeholder-gray-400 dark:placeholder-gray-500"
                    placeholder="https://linkedin.com/in/your-profile"
                    disabled={
                      isLoading || (enforceOtpVerification && !otpVerified)
                    }
                  />
                </div>
                <div>
                  <label
                    htmlFor="github"
                    className="block text-base font-medium text-gray-700 dark:text-gray-200 mb-1"
                  >
                    <span className="flex items-center">
                      <Github className="w-4 h-4 mr-2 text-indigo-600 dark:text-indigo-400" />
                      GitHub Profile
                    </span>
                  </label>
                  <input
                    type="url"
                    name="github"
                    value={formData.github}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-indigo-600 focus:border-indigo-600 dark:bg-gray-700 dark:text-gray-200 text-base placeholder-gray-400 dark:placeholder-gray-500"
                    placeholder="https://github.com/your-profile"
                    disabled={
                      isLoading || (enforceOtpVerification && !otpVerified)
                    }
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label
                    htmlFor="degree_id"
                    className="block text-base font-medium text-gray-700 dark:text-gray-200 mb-1"
                  >
                    <span className="flex items-center">
                      <GraduationCap className="w-4 h-4 mr-2 text-indigo-600 dark:text-indigo-400" />
                      Degree
                    </span>
                  </label>
                  <Select
                    options={degrees}
                    value={degrees.find((d) => d.value === formData.degree_id)}
                    onChange={handleDegreeChange}
                    className="text-base"
                    placeholder="Select your degree"
                    isDisabled={
                      isLoading || (enforceOtpVerification && !otpVerified)
                    }
                    styles={{
                      control: (provided, state) => ({
                        ...provided,
                        backgroundColor: state.isFocused
                          ? '#ffffff'
                          : '#f9fafb',
                        borderColor: state.isFocused ? '#4f46e5' : '#d1d5db',
                        color: '#1f2937',
                        '&:hover': {
                          borderColor: '#4f46e5',
                        },
                        '.dark &': {
                          backgroundColor: '#1f2937',
                          borderColor: '#4b5563',
                          color: '#e5e7eb',
                          '&:hover': {
                            borderColor: '#4f46e5',
                          },
                        },
                      }),
                      singleValue: (provided) => ({
                        ...provided,
                        color: '#1f2937',
                        '.dark &': {
                          color: '#e5e7eb',
                        },
                      }),
                      menu: (provided) => ({
                        ...provided,
                        backgroundColor: '#ffffff',
                        color: '#1f2937',
                        '.dark &': {
                          backgroundColor: '#1f2937',
                          color: '#e5e7eb',
                        },
                      }),
                      option: (provided, state) => ({
                        ...provided,
                        backgroundColor: state.isSelected
                          ? '#4f46e5'
                          : state.isFocused
                          ? '#f3f4f6'
                          : '#ffffff',
                        color: state.isSelected ? '#ffffff' : '#1f2937',
                        '&:hover': {
                          backgroundColor: '#f3f4f6',
                        },
                        '.dark &': {
                          backgroundColor: state.isSelected
                            ? '#4f46e5'
                            : state.isFocused
                            ? '#374151'
                            : '#1f2937',
                          color: '#e5e7eb',
                          '&:hover': {
                            backgroundColor: '#374151',
                          },
                        },
                      }),
                      placeholder: (provided) => ({
                        ...provided,
                        color: '#6b7280',
                        '.dark &': {
                          color: '#9ca3af',
                        },
                      }),
                    }}
                  />
                </div>
                <div>
                  <label
                    htmlFor="branch_id"
                    className="block text-base font-medium text-gray-700 dark:text-gray-200 mb-1"
                  >
                    <span className="flex items-center">
                      <GraduationCap className="w-4 h-4 mr-2 text-indigo-600 dark:text-indigo-400" />
                      Branch/Specialization
                    </span>
                  </label>
                  <Select
                    options={branches}
                    value={branches.find((b) => b.value === formData.branch_id)}
                    onChange={handleBranchChange}
                    className="text-base"
                    placeholder="Select your branch"
                    isDisabled={
                      isLoading || (enforceOtpVerification && !otpVerified)
                    }
                    styles={{
                      control: (provided, state) => ({
                        ...provided,
                        backgroundColor: state.isFocused
                          ? '#ffffff'
                          : '#f9fafb',
                        borderColor: state.isFocused ? '#4f46e5' : '#d1d5db',
                        color: '#1f2937',
                        '&:hover': {
                          borderColor: '#4f46e5',
                        },
                        '.dark &': {
                          backgroundColor: '#1f2937',
                          borderColor: '#4b5563',
                          color: '#e5e7eb',
                          '&:hover': {
                            borderColor: '#4f46e5',
                          },
                        },
                      }),
                      singleValue: (provided) => ({
                        ...provided,
                        color: '#1f2937',
                        '.dark &': {
                          color: '#e5e7eb',
                        },
                      }),
                      menu: (provided) => ({
                        ...provided,
                        backgroundColor: '#ffffff',
                        color: '#1f2937',
                        '.dark &': {
                          backgroundColor: '#1f2937',
                          color: '#e5e7eb',
                        },
                      }),
                      option: (provided, state) => ({
                        ...provided,
                        backgroundColor: state.isSelected
                          ? '#4f46e5'
                          : state.isFocused
                          ? '#f3f4f6'
                          : '#ffffff',
                        color: state.isSelected ? '#ffffff' : '#1f2937',
                        '&:hover': {
                          backgroundColor: '#f3f4f6',
                        },
                        '.dark &': {
                          backgroundColor: state.isSelected
                            ? '#4f46e5'
                            : state.isFocused
                            ? '#374151'
                            : '#1f2937',
                          color: '#e5e7eb',
                          '&:hover': {
                            backgroundColor: '#374151',
                          },
                        },
                      }),
                      placeholder: (provided) => ({
                        ...provided,
                        color: '#6b7280',
                        '.dark &': {
                          color: '#9ca3af',
                        },
                      }),
                    }}
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label
                    htmlFor="passout_year"
                    className="block text-base font-medium text-gray-700 dark:text-gray-200 mb-1"
                  >
                    <span className="flex items-center">
                      <Calendar className="w-4 h-4 mr-2 text-indigo-600 dark:text-indigo-400" />
                      Passout Year
                    </span>
                  </label>
                  <input
                    type="number"
                    name="passout_year"
                    value={formData.passout_year}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-indigo-600 focus:border-indigo-600 dark:bg-gray-700 dark:text-gray-200 text-base placeholder-gray-400 dark:placeholder-gray-500"
                    placeholder="e.g., 2023"
                    disabled={
                      isLoading || (enforceOtpVerification && !otpVerified)
                    }
                  />
                </div>
                <div>
                  <label
                    htmlFor="years_of_experience"
                    className="block text-base font-medium text-gray-700 dark:text-gray-200 mb-1"
                  >
                    <span className="flex items-center">
                      <Briefcase className="w-4 h-4 mr-2 text-indigo-600 dark:text-indigo-400" />
                      Years of Experience
                    </span>
                  </label>
                  <input
                    type="number"
                    name="years_of_experience"
                    value={formData.years_of_experience}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-indigo-600 focus:border-indigo-600 dark:bg-gray-700 dark:text-gray-200 text-base placeholder-gray-400 dark:placeholder-gray-500"
                    placeholder="e.g., 3.5"
                    step="0.1"
                    disabled={
                      isLoading || (enforceOtpVerification && !otpVerified)
                    }
                  />
                </div>
              </div>
              <div>
                <label
                  htmlFor="resume"
                  className="block text-base font-medium text-gray-700 dark:text-gray-200 mb-1"
                >
                  <span className="flex items-center">
                    <FileText className="w-4 h-4 mr-2 text-indigo-600 dark:text-indigo-400" />
                    Resume (PDF)
                  </span>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Upload your resume in PDF format and make sure it contains
                    mobile number.
                  </p>
                </label>
                <input
                  type="file"
                  name="resume"
                  id="resume"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-indigo-600 focus:border-indigo-600 dark:bg-gray-700 dark:text-gray-200 text-base file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-600 hover:file:bg-indigo-100 dark:file:bg-indigo-900/30 dark:file:text-indigo-300 dark:hover:file:bg-indigo-900/50"
                  accept="application/pdf"
                  onChange={handleFileChange}
                  disabled={
                    isLoading || (enforceOtpVerification && !otpVerified)
                  }
                />
                {formData.resume && (
                  <a
                    className="mt-1 text-sm text-gray-500 dark:text-gray-400 hover:cursor-pointer hover:underline"
                    target="_blank"
                    href={`https://storage.googleapis.com/gen-ai-quiz/uploads/${formData.resume}`}
                  >
                    Current: {formData.resume}
                  </a>
                )}
              </div>
              <div>
                <label className="block text-base font-medium text-gray-700 dark:text-gray-200 mb-1">
                  <span className="flex items-center">
                    <Camera className="w-4 h-4 mr-2 text-indigo-600 dark:text-indigo-400" />
                    Webcam Capture
                  </span>
                </label>
                <div className="relative w-full max-w-md h-64 bg-gray-100 dark:bg-gray-800 rounded-md overflow-hidden">
                  {isWebcamActive ? (
                    <video
                      ref={videoRef}
                      autoPlay
                      className="w-full h-full object-cover"
                    />
                  ) : webcamPreview ? (
                    <img
                      src={webcamPreview}
                      alt="Webcam capture preview"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gray-200 dark:bg-gray-700">
                      <Camera className="w-12 h-12 text-gray-400 dark:text-gray-500" />
                    </div>
                  )}
                </div>
                <div className="mt-2 flex gap-2">
                  {!isWebcamActive ? (
                    <button
                      type="button"
                      onClick={startWebcam}
                      className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-4 py-2 rounded-md flex items-center hover:from-indigo-700 hover:to-purple-700 transition-all duration-300"
                      disabled={
                        isLoading || (enforceOtpVerification && !otpVerified)
                      }
                    >
                      <Camera className="w-4 h-4 mr-2" />
                      Start Webcam
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={captureWebcamImage}
                        className="bg-gradient-to-r from-green-600 to-emerald-600 text-white px-4 py-2 rounded-md flex items-center hover:from-green-700 hover:to-emerald-700 transition-all duration-300"
                        disabled={isLoading}
                      >
                        <Camera className="w-4 h-4 mr-2" />
                        Capture Image
                      </button>
                      <button
                        type="button"
                        onClick={stopWebcam}
                        className="bg-gradient-to-r from-red-600 to-rose-600 text-white px-4 py-2 rounded-md flex items-center hover:from-red-700 hover:to-rose-700 transition-all duration-300"
                        disabled={isLoading}
                      >
                        <X className="w-4 h-4 mr-2" />
                        Stop Webcam
                      </button>
                    </>
                  )}
                </div>
                <canvas ref={canvasRef} className="hidden" />
              </div>
              <div className="flex gap-4">
                <Button
                  type="submit"
                  className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-6 py-2 rounded-md flex items-center hover:from-indigo-700 hover:to-purple-700 transition-all duration-300"
                  disabled={
                    isLoading || (enforceOtpVerification && !otpVerified)
                  }
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      Saving...
                    </>
                  ) : (
                    <>
                      Save Profile
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </>
                  )}
                </Button>
                {candidate.is_profile_complete && (
                  <LinkButton
                    to="/candidate/dashboard"
                    className="bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 px-6 py-2 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition-all duration-300"
                  >
                    Back to Dashboard
                  </LinkButton>
                )}
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}

export default CompleteProfile

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
  const [enforceFaceVerification, setEnforceFaceVerification] = useState(false)
  const navigate = useNavigate()
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)

  useEffect(() => {
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
      })
      .catch((error) => {
        console.error('Error fetching candidate:', error)
        setMessage({
          text: 'Failed to fetch profile data. Please try again.',
          type: 'error',
        })
      })

    fetch(`${baseUrl}/auth/check`, { credentials: 'include' })
      .then((response) => {
        if (!response.ok) throw new Error('Failed to check auth')
        return response.json()
      })
      .then((data) => {
        if (data.user && data.user.enforce_face_verification) {
          setEnforceFaceVerification(true)
        }
      })
      .catch((error) => {
        console.error('Error checking face verification requirement:', error)
      })

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

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData({ ...formData, [name]: value })
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

    if (enforceFaceVerification && (!profilePicture || !webcamImage)) {
      setMessage({
        text: 'Both profile picture and webcam image are required for verification.',
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
    data.append('enforce_face_verification', enforceFaceVerification)

    try {
      const response = await fetch(`${baseUrl}/candidate/profile/${user.id}`, {
        method: 'POST',
        credentials: 'include',
        body: data,
      })

      const result = await response.json()
      if (response.ok) {
        setMessage({
          text: `Profile updated successfully! ${
            result.face_verification
              ? `Face verification: ${result.face_verification.similarity}% similarity.`
              : ''
          }`,
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
          <div className="w-full md:w-1/3 border-b md:border-b-0 md:border-r border-gray-200 dark:border-gray-800 p-10 flex flex-col items-center gap-8">
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
              <div className="flex items-center gap-2 mb-1">
                <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/30">
                  <Mail className="w-5 h-5 text-indigo-600 dark:text-indigo-300" />
                </div>
                <span className="text-sm text-gray-700 dark:text-gray-200">
                  {candidate?.email || user?.email}
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
              <h1 className="text-3xl md:text-4xl font-extrabold mb-3 tracking-tight flex items-center gap-3 bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-800 bg-clip-text text-transparent">
                {candidate.is_profile_complete
                  ? 'Edit Your Profile'
                  : 'Complete Your Profile'}
                <span className="inline-block animate-pulse">👤</span>
              </h1>
              <p className="text-lg text-gray-700 dark:text-gray-200 font-medium">
                {candidate.is_profile_complete
                  ? 'Update your details to keep your profile current and access more job opportunities'
                  : 'Fill in your details to get the most out of our platform'}
              </p>
              {enforceFaceVerification && (
                <p className="text-base text-red-500 font-semibold mt-2">
                  Face verification required due to location change.
                </p>
              )}
            </div>
            {message.text && (
              <div
                className={`mb-6 p-3 rounded-md flex items-center text-base ${
                  message.type === 'success'
                    ? 'bg-green-50 dark:bg-green-900/30 border-l-4 border-green-500 text-green-700 dark:text-green-300'
                    : 'bg-red-50 dark:bg-red-900/30 border-l-4 border-red-500 text-red-700 dark:text-red-300'
                }`}
              >
                {message.type === 'success' ? (
                  <Check className="w-4 h-4 mr-2" />
                ) : (
                  <X className="w-4 h-4 mr-2" />
                )}
                {message.text}
              </div>
            )}
            <form onSubmit={handleSubmit} className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-8">
                <div>
                  <label
                    htmlFor="name"
                    className="block text-base font-medium text-gray-700 dark:text-gray-200 mb-1"
                  >
                    <span className="flex items-center">
                      <User className="w-4 h-4 mr-2 text-indigo-600 dark:text-indigo-300" />
                      Full Name
                      <span className="text-red-500 ml-1">*</span>
                    </span>
                  </label>
                  <input
                    type="text"
                    name="name"
                    id="name"
                    className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-md focus:ring-indigo-600 focus:border-indigo-600 dark:bg-gray-800 dark:text-gray-200 text-base placeholder-gray-400 dark:placeholder-gray-300"
                    placeholder="John Doe"
                    value={formData.name}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div>
                  <label
                    htmlFor="phone"
                    className="block text-base font-medium text-gray-700 dark:text-gray-200 mb-1"
                  >
                    <span className="flex items-center">
                      <Phone className="w-4 h-4 mr-2 text-indigo-600 dark:text-indigo-300" />
                      Phone Number
                      <span className="text-red-500 ml-1">*</span>
                    </span>
                  </label>
                  <input
                    type="text"
                    name="phone"
                    id="phone"
                    className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-md focus:ring-indigo-600 focus:border-indigo-600 dark:bg-gray-800 dark:text-gray-200 text-base placeholder-gray-400 dark:placeholder-gray-300"
                    placeholder="+1234567890"
                    value={formData.phone}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div>
                  <label
                    htmlFor="location"
                    className="block text-base font-medium text-gray-700 dark:text-gray-200 mb-1"
                  >
                    <span className="flex items-center">
                      <MapPin className="w-4 h-4 mr-2 text-indigo-600 dark:text-indigo-300" />
                      Location
                      <span className="text-red-500 ml-1">*</span>
                    </span>
                  </label>
                  <input
                    type="text"
                    name="location"
                    id="location"
                    className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-md focus:ring-indigo-600 focus:border-indigo-600 dark:bg-gray-800 dark:text-gray-200 text-base placeholder-gray-400 dark:placeholder-gray-300"
                    placeholder="New York, NY"
                    value={formData.location}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div>
                  <label
                    htmlFor="linkedin"
                    className="block text-base font-medium text-gray-700 dark:text-gray-200 mb-1"
                  >
                    <span className="flex items-center">
                      <Linkedin className="w-4 h-4 mr-2 text-indigo-600 dark:text-indigo-300" />
                      LinkedIn Profile
                      <span className="text-red-500 ml-1">*</span>
                    </span>
                  </label>
                  <input
                    type="url"
                    name="linkedin"
                    id="linkedin"
                    className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-md focus:ring-indigo-600 focus:border-indigo-600 dark:bg-gray-800 dark:text-gray-200 text-base placeholder-gray-400 dark:placeholder-gray-300"
                    placeholder="https://linkedin.com/in/johndoe"
                    value={formData.linkedin}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div>
                  <label
                    htmlFor="github"
                    className="block text-base font-medium text-gray-700 dark:text-gray-200 mb-1"
                  >
                    <span className="flex items-center">
                      <Github className="w-4 h-4 mr-2 text-indigo-600 dark:text-indigo-300" />
                      GitHub Profile
                      <span className="text-red-500 ml-1">*</span>
                    </span>
                  </label>
                  <input
                    type="url"
                    name="github"
                    id="github"
                    className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-md focus:ring-indigo-600 focus:border-indigo-600 dark:bg-gray-800 dark:text-gray-200 text-base placeholder-gray-400 dark:placeholder-gray-300"
                    placeholder="https://github.com/johndoe"
                    value={formData.github}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div>
                  <label
                    htmlFor="degree_id"
                    className="block text-base font-medium text-gray-700 dark:text-gray-200 mb-1"
                  >
                    <span className="flex items-center">
                      <GraduationCap className="w-4 h-4 mr-2 text-indigo-600 dark:text-indigo-300" />
                      Degree
                      <span className="text-red-500 ml-1">*</span>
                    </span>
                  </label>
                  <Select
                    options={degrees}
                    value={
                      degrees.find(
                        (option) => option.value === formData.degree_id
                      ) || null
                    }
                    onChange={handleDegreeChange}
                    placeholder="Select your degree..."
                    className="text-base"
                    classNamePrefix="react-select"
                    styles={{
                      control: (provided) => ({
                        ...provided,
                        borderColor: '#e5e7eb',
                        borderRadius: '0.375rem',
                        padding: '2px',
                        backgroundColor: '#fff',
                        '&:hover': { borderColor: '#6366f1' },
                      }),
                      menu: (provided) => ({
                        ...provided,
                        backgroundColor: '#fff',
                      }),
                      option: (provided, state) => ({
                        ...provided,
                        backgroundColor: state.isSelected
                          ? '#6366f1'
                          : state.isFocused
                          ? '#e0e7ff'
                          : '#fff',
                        color: state.isSelected ? '#fff' : '#374151',
                      }),
                      singleValue: (provided) => ({
                        ...provided,
                        color: '#374151',
                      }),
                    }}
                    theme={(theme) => ({
                      ...theme,
                      colors: {
                        ...theme.colors,
                        primary: '#6366f1',
                        primary25: '#e0e7ff',
                      },
                    })}
                    required
                  />
                </div>
                <div>
                  <label
                    htmlFor="branch_id"
                    className="block text-base font-medium text-gray-700 dark:text-gray-200 mb-1"
                  >
                    <span className="flex items-center">
                      <GraduationCap className="w-4 h-4 mr-2 text-indigo-600 dark:text-indigo-300" />
                      Branch/Specialization
                      <span className="text-red-500 ml-1">*</span>
                    </span>
                  </label>
                  {console.log(formData)}
                  <Select
                    options={branches}
                    value={
                      branches.find(
                        (option) => option.value === formData.branch_id
                      ) || null
                    }
                    onChange={handleBranchChange}
                    placeholder="Select your branch..."
                    className="text-base"
                    classNamePrefix="react-select"
                    styles={{
                      control: (provided) => ({
                        ...provided,
                        borderColor: '#e5e7eb',
                        borderRadius: '0.375rem',
                        padding: '2px',
                        backgroundColor: '#fff',
                        '&:hover': { borderColor: '#6366f1' },
                      }),
                      menu: (provided) => ({
                        ...provided,
                        backgroundColor: '#fff',
                      }),
                      option: (provided, state) => ({
                        ...provided,
                        backgroundColor: state.isSelected
                          ? '#6366f1'
                          : state.isFocused
                          ? '#e0e7ff'
                          : '#fff',
                        color: state.isSelected ? '#fff' : '#374151',
                      }),
                      singleValue: (provided) => ({
                        ...provided,
                        color: '#374151',
                      }),
                    }}
                    theme={(theme) => ({
                      ...theme,
                      colors: {
                        ...theme.colors,
                        primary: '#6366f1',
                        primary25: '#e0e7ff',
                      },
                    })}
                    required
                  />
                </div>
                <div>
                  <label
                    htmlFor="passout_year"
                    className="block text-base font-medium text-gray-700 dark:text-gray-200 mb-1"
                  >
                    <span className="flex items-center">
                      <Calendar className="w-4 h-4 mr-2 text-indigo-600 dark:text-indigo-300" />
                      Passout Year
                      <span className="text-red-500 ml-1">*</span>
                    </span>
                  </label>
                  <input
                    type="number"
                    name="passout_year"
                    id="passout_year"
                    className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-md focus:ring-indigo-600 focus:border-indigo-600 dark:bg-gray-800 dark:text-gray-200 text-base placeholder-gray-400 dark:placeholder-gray-300"
                    placeholder="2023"
                    value={formData.passout_year}
                    onChange={handleChange}
                    min="1900"
                    max={new Date().getFullYear() + 5}
                    required
                  />
                </div>
                <div>
                  <label
                    htmlFor="years_of_experience"
                    className="block text-base font-medium text-gray-700 dark:text-gray-200 mb-1"
                  >
                    <span className="flex items-center">
                      <Briefcase className="w-4 h-4 mr-2 text-indigo-600 dark:text-indigo-300" />
                      Years of Experience
                      <span className="text-red-500 ml-1">*</span>
                    </span>
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    name="years_of_experience"
                    id="years_of_experience"
                    className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-md focus:ring-indigo-600 focus:border-indigo-600 dark:bg-gray-800 dark:text-gray-200 text-base placeholder-gray-400 dark:placeholder-gray-300"
                    placeholder="3.5"
                    value={formData.years_of_experience}
                    onChange={handleChange}
                    min="0"
                    required
                  />
                </div>
                <div className="md:col-span-2">
                  <label
                    htmlFor="resume"
                    className="block text-base font-medium text-gray-700 dark:text-gray-200 mb-1"
                  >
                    <span className="flex items-center">
                      <FileText className="w-4 h-4 mr-2 text-indigo-600 dark:text-indigo-300" />
                      Resume (PDF)
                      <span className="text-red-500 ml-1">*</span>
                    </span>
                  </label>
                  <div className="w-full flex flex-col sm:flex-row gap-2 items-start sm:items-center">
                    {formData.resume && (
                      <LinkButton
                        variant="link"
                        to={`https://storage.googleapis.com/gen-ai-quiz/uploads/${formData.resume}`}
                        className="text-base text-indigo-600 dark:text-indigo-300 hover:underline"
                        target="_blank"
                      >
                        {formData.resume.split('/')[1]}
                      </LinkButton>
                    )}
                    <input
                      type="file"
                      name="resume"
                      id="resume"
                      className="w-content text-base text-gray-700 dark:text-gray-200 file:mr-4 file:py-1 file:px-4 file:rounded-md file:border-0 file:text-base file:font-medium file:bg-indigo-50 dark:file:bg-indigo-900/30 file:text-indigo-700 dark:file:text-indigo-300 hover:file:bg-indigo-100 dark:hover:file:bg-indigo-800/30"
                      accept=".pdf"
                      onChange={handleFileChange}
                      required={!formData.resume}
                    />
                  </div>
                </div>
                <div className="md:col-span-2">
                  <label
                    htmlFor="webcam_image"
                    className="block text-base font-medium text-gray-700 dark:text-gray-200 mb-1"
                  >
                    <span className="flex items-center">
                      <Camera className="w-4 h-4 mr-2 text-indigo-600 dark:text-indigo-300" />
                      Webcam Image
                      <span className="text-red-500 ml-1">*</span>
                    </span>
                  </label>
                  <div className="flex flex-col md:flex-row md:items-start gap-6">
                    <div className="flex flex-col items-start min-w-[140px]">
                      {!isWebcamActive ? (
                        <button
                          type="button"
                          onClick={startWebcam}
                          className="mt-0 bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-6 py-3 rounded-xl flex items-center hover:from-indigo-700 hover:to-purple-700 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105"
                        >
                          <Camera className="w-4 h-4 mr-2" />
                          Start Webcam
                        </button>
                      ) : (
                        <div className="flex flex-col gap-2 mt-0">
                          <button
                            type="button"
                            onClick={captureWebcamImage}
                            className="bg-gradient-to-r from-emerald-600 to-green-600 text-white px-6 py-3 rounded-xl flex items-center hover:from-emerald-700 hover:to-green-700 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105"
                          >
                            <Camera className="w-4 h-4 mr-2" />
                            Capture Image
                          </button>
                          <button
                            type="button"
                            onClick={stopWebcam}
                            className="bg-gradient-to-r from-gray-500 to-gray-600 text-white px-6 py-3 rounded-xl flex items-center hover:from-gray-600 hover:to-gray-700 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105"
                          >
                            Stop Webcam
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="flex-1 flex flex-row gap-4 justify-center">
                      {isWebcamActive && (
                        <div className="bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-md p-3 flex flex-col items-center w-[220px]">
                          <video
                            ref={videoRef}
                            autoPlay
                            className="rounded-lg shadow-md border border-indigo-200 dark:border-indigo-700 bg-black"
                            style={{
                              width: '200px',
                              height: '150px',
                              objectFit: 'cover',
                              background: '#222',
                            }}
                          />
                          <canvas ref={canvasRef} className="hidden" />
                        </div>
                      )}
                      {webcamPreview && (
                        <div className="bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-md p-3 flex flex-col items-center w-[220px]">
                          <img
                            src={webcamPreview}
                            alt="Webcam preview"
                            className="rounded-lg shadow-md border border-indigo-200 dark:border-indigo-700"
                            style={{
                              width: '200px',
                              height: '150px',
                              objectFit: 'cover',
                              background: '#222',
                            }}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex justify-end mt-10">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-8 py-3 rounded-xl flex items-center hover:from-indigo-700 hover:to-purple-700 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105 disabled:opacity-60"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      Save Profile
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}

export default CompleteProfile

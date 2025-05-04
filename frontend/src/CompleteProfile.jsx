import React, { useState, useEffect } from 'react'
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
  Image as ImageIcon,
  ArrowRight,
  Check,
  X,
  Loader2,
  Camera,
} from 'lucide-react'
import Navbar from './components/Navbar'

const CompleteProfile = () => {
  const { user } = useAuth()
  const [candidate, setCandidate] = useState(null)
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    location: '',
    linkedin: '',
    github: '',
    degree: '',
    years_of_experience: '',
  })
  const [resume, setResume] = useState(null)
  const [profilePicture, setProfilePicture] = useState(null)
  const [profilePreview, setProfilePreview] = useState(null)
  const [message, setMessage] = useState({ text: '', type: '' })
  const [isLoading, setIsLoading] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    fetch(`http://localhost:5000/api/candidate/profile/${user.id}`)
      .then((response) => response.json())
      .then((data) => {
        setCandidate(data)
        setFormData({
          name: data.name || '',
          phone: data.phone || '',
          location: data.location || '',
          linkedin: data.linkedin || '',
          github: data.github || '',
          degree: data.degree || '',
          years_of_experience: data.years_of_experience || '',
        })
        if (data.profile_picture) {
          setProfilePreview(
            `http://localhost:5000/static/uploads/${data.profile_picture}`
          )
        }
      })
      .catch((error) => console.error('Error fetching candidate:', error))
  }, [user.id])

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData({ ...formData, [name]: value })
  }

  const handleFileChange = (e) => {
    const { name, files } = e.target
    if (name === 'resume') {
      setResume(files[0])
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

  const handleSubmit = async (e) => {
    e.preventDefault()
    setIsLoading(true)
    const data = new FormData()
    for (const key in formData) {
      data.append(key, formData[key])
    }
    if (resume) data.append('resume', resume)
    if (profilePicture) data.append('profile_picture', profilePicture)

    try {
      const response = await fetch(
        `http://localhost:5000/api/candidate/profile/${candidate.candidate_id}`,
        {
          method: 'POST',
          body: data,
        }
      )
      const result = await response.json()
      if (response.ok) {
        setMessage({
          text: 'Profile updated successfully! Skills have been extracted from your resume.',
          type: 'success',
        })
        setTimeout(() => navigate('/candidate/dashboard'), 1500)
      } else {
        setMessage({
          text:
            result.error || 'An error occurred while updating your profile.',
          type: 'error',
        })
      }
    } catch (error) {
      setMessage({
        text: 'An error occurred while updating your profile.',
        type: 'error',
      })
    } finally {
      setIsLoading(false)
    }
  }

  if (!candidate)
    return (
      <div className="flex justify-center items-center min-h-screen bg-gray-100">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
      </div>
    )

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <Navbar />
      <div className="flex-grow py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-8">
            <div className="relative mx-auto w-24 h-24 mb-4 group">
              <div className="w-full h-full rounded-full overflow-hidden border-4 border-indigo-200 group-hover:border-indigo-400 shadow-sm transition-all">
                {profilePreview ? (
                  <img
                    src={profilePreview}
                    alt="Profile preview"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-indigo-100 flex items-center justify-center">
                    <User className="w-12 h-12 text-indigo-400" />
                  </div>
                )}
              </div>
              <label
                htmlFor="profile_picture"
                className="absolute bottom-0 right-0 bg-indigo-600 text-white p-1.5 rounded-full cursor-pointer shadow-sm hover:bg-indigo-700 transition-all group-hover:scale-110"
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
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Complete Your Profile
            </h1>
            <p className="text-sm text-gray-700">
              Fill in your details to get the most out of our platform
            </p>
          </div>

          {message.text && (
            <div
              className={`mb-6 p-3 rounded-md flex items-center text-sm ${
                message.type === 'success'
                  ? 'bg-green-50 border-l-4 border-green-500 text-green-700'
                  : 'bg-red-50 border-l-4 border-red-500 text-red-700'
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

          <div className="bg-white p-6 sm:p-8 rounded-lg shadow-sm border border-gray-200">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="col-span-2">
                  <label
                    htmlFor="name"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    <span className="flex items-center">
                      <User className="w-4 h-4 mr-2 text-indigo-600" />
                      Full Name
                    </span>
                  </label>
                  <input
                    type="text"
                    name="name"
                    id="name"
                    className="w-full px-3 py-2 border border-gray-200 rounded-md focus:ring-indigo-600 focus:border-indigo-600 text-sm placeholder-gray-400"
                    placeholder="John Doe"
                    value={formData.name}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div>
                  <label
                    htmlFor="phone"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    <span className="flex items-center">
                      <Phone className="w-4 h-4 mr-2 text-indigo-600" />
                      Phone Number
                    </span>
                  </label>
                  <input
                    type="text"
                    name="phone"
                    id="phone"
                    className="w-full px-3 py-2 border border-gray-200 rounded-md focus:ring-indigo-600 focus:border-indigo-600 text-sm placeholder-gray-400"
                    placeholder="+1234567890"
                    value={formData.phone}
                    onChange={handleChange}
                  />
                </div>
                <div>
                  <label
                    htmlFor="location"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    <span className="flex items-center">
                      <MapPin className="w-4 h-4 mr-2 text-indigo-600" />
                      Location
                    </span>
                  </label>
                  <input
                    type="text"
                    name="location"
                    id="location"
                    className="w-full px-3 py-2 border border-gray-200 rounded-md focus:ring-indigo-600 focus:border-indigo-600 text-sm placeholder-gray-400"
                    placeholder="New York, NY"
                    value={formData.location}
                    onChange={handleChange}
                  />
                </div>
                <div>
                  <label
                    htmlFor="linkedin"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    <span className="flex items-center">
                      <Linkedin className="w-4 h-4 mr-2 text-indigo-600" />
                      LinkedIn Profile
                    </span>
                  </label>
                  <input
                    type="url"
                    name="linkedin"
                    id="linkedin"
                    className="w-full px-3 py-2 border border-gray-200 rounded-md focus:ring-indigo-600 focus:border-indigo-600 text-sm placeholder-gray-400"
                    placeholder="https://linkedin.com/in/johndoe"
                    value={formData.linkedin}
                    onChange={handleChange}
                  />
                </div>
                <div>
                  <label
                    htmlFor="github"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    <span className="flex items-center">
                      <Github className="w-4 h-4 mr-2 text-indigo-600" />
                      GitHub Profile
                    </span>
                  </label>
                  <input
                    type="url"
                    name="github"
                    id="github"
                    className="w-full px-3 py-2 border border-gray-200 rounded-md focus:ring-indigo-600 focus:border-indigo-600 text-sm placeholder-gray-400"
                    placeholder="https://github.com/johndoe"
                    value={formData.github}
                    onChange={handleChange}
                  />
                </div>
                <div>
                  <label
                    htmlFor="degree"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    <span className="flex items-center">
                      <GraduationCap className="w-4 h-4 mr-2 text-indigo-600" />
                      Degree
                    </span>
                  </label>
                  <input
                    type="text"
                    name="degree"
                    id="degree"
                    className="w-full px-3 py-2 border border-gray-200 rounded-md focus:ring-indigo-600 focus:border-indigo-600 text-sm placeholder-gray-400"
                    placeholder="B.Tech in Computer Science"
                    value={formData.degree}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div>
                  <label
                    htmlFor="years_of_experience"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    <span className="flex items-center">
                      <Briefcase className="w-4 h-4 mr-2 text-indigo-600" />
                      Years of Experience
                    </span>
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    name="years_of_experience"
                    id="years_of_experience"
                    className="w-full px-3 py-2 border border-gray-200 rounded-md focus:ring-indigo-600 focus:border-indigo-600 text-sm placeholder-gray-400"
                    placeholder="3.5"
                    value={formData.years_of_experience}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div>
                  <label
                    htmlFor="resume"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    <span className="flex items-center">
                      <FileText className="w-4 h-4 mr-2 text-indigo-600" />
                      Resume (PDF)
                    </span>
                  </label>
                  <input
                    type="file"
                    name="resume"
                    id="resume"
                    className="w-full text-sm text-gray-700 file:mr-4 file:py-1 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                    accept=".pdf"
                    onChange={handleFileChange}
                  />
                </div>
                <div className="hidden">
                  <label
                    htmlFor="profile_picture"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    <span className="flex items-center">
                      <ImageIcon className="w-4 h-4 mr-2 text-indigo-600" />
                      Profile Picture
                    </span>
                  </label>
                  <input
                    type="file"
                    name="profile_picture"
                    id="profile_picture"
                    className="w-full text-sm text-gray-700 file:mr-4 file:py-1 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                    accept="image/*"
                    onChange={handleFileChange}
                  />
                </div>
              </div>
              <div className="flex justify-center mt-6">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-600 disabled:bg-indigo-400 disabled:cursor-not-allowed gap-2"
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

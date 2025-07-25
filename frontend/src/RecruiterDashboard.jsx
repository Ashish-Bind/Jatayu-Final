import React, { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import Navbar from './components/Navbar'
import {
  Briefcase,
  ChevronRight,
  X,
  Check,
  Plus,
  Trash2,
  Calendar,
  User2,
  Award,
  Code,
  User,
  GraduationCap,
  BrainCircuit,
} from 'lucide-react'
import Button from './components/Button'
import { format } from 'date-fns'
import LinkButton from './components/LinkButton'
import FormInput from './components/FormInput'
import Select from 'react-select'
import { baseUrl } from './utils/utils'

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

const RecruiterDashboard = () => {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [isLoading, setIsLoading] = useState(false)
  const [assessments, setAssessments] = useState([])
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [degrees, setDegrees] = useState([])
  const [branches, setBranches] = useState([])
  const [formData, setFormData] = useState({
    job_title: '',
    experience_min: '',
    experience_max: '',
    duration: '',
    num_questions: '',
    schedule_start: '',
    schedule_end: '',
    degree_required: '',
    degree_branch: '',
    passout_year: '',
    passout_year_required: false,
    job_description: '',
    custom_prompt: '',
    skills: [],
  })
  const [newSkill, setNewSkill] = useState({ name: '', priority: 'low' })
  const [activeTab, setActiveTab] = useState('create')

  useEffect(() => {
    if (!user || user.role !== 'recruiter') {
      navigate('/recruiter/login')
      return
    }

    // Fetch assessments
    fetch(`${baseUrl}/recruiter/assessments`, {
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Failed to fetch assessments: ${response.statusText}`)
        }
        return response.json()
      })
      .then((data) => {
        setAssessments([...data.active_assessments, ...data.past_assessments])
      })
      .catch((error) => {
        console.error('Error fetching assessments:', error)
        setError(`Failed to load assessments: ${error.message}`)
      })

    // Fetch degrees
    fetch(`${baseUrl}/recruiter/degrees`)
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
        setError('Failed to fetch degree options. Please try again.')
      })

    // Fetch branches
    fetch(`${baseUrl}/recruiter/branches`)
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
        setError('Failed to fetch branch options. Please try again.')
      })
  }, [user, navigate])

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value,
    })
  }

  const handleDegreeChange = (selectedOption) => {
    setFormData({
      ...formData,
      degree_required: selectedOption ? selectedOption.value : '',
    })
  }

  const handleBranchChange = (selectedOption) => {
    setFormData({
      ...formData,
      degree_branch: selectedOption ? selectedOption.value : '',
    })
  }

  const handleSkillChange = (e) => {
    const { name, value } = e.target
    setNewSkill({ ...newSkill, [name]: value })
  }

  const addSkill = () => {
    if (!newSkill.name.trim()) {
      setError('Skill name is required')
      return
    }
    setFormData({
      ...formData,
      skills: [
        ...formData.skills,
        { name: newSkill.name.trim(), priority: newSkill.priority },
      ],
    })
    setNewSkill({ name: '', priority: 'low' })
    setError('')
  }

  const removeSkill = (index) => {
    setFormData({
      ...formData,
      skills: formData.skills.filter((_, i) => i !== index),
    })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setIsLoading(true)

    // Validate required fields
    const requiredFields = [
      'job_title',
      'experience_min',
      'experience_max',
      'duration',
      'num_questions',
      'schedule_start',
      'schedule_end',
    ]
    if (requiredFields.some((field) => !formData[field])) {
      setError('Please fill in all required fields')
      setIsLoading(false)
      return
    }

    // Validate skills
    if (formData.skills.length === 0) {
      setError('At least one skill is required')
      setIsLoading(false)
      return
    }

    // Validate schedule_end >= schedule_start
    if (formData.schedule_start && formData.schedule_end) {
      const start = new Date(formData.schedule_start)
      const end = new Date(formData.schedule_end)
      if (end < start) {
        setError('End date must be after start date')
        setIsLoading(false)
        return
      }
    }

    // Validate passout_year
    if (formData.passout_year && !/^\d{4}$/.test(formData.passout_year)) {
      setError('Passout year must be a valid 4-digit year')
      setIsLoading(false)
      return
    }

    try {
      const response = await fetch(`${baseUrl}/recruiter/assessments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(formData),
      })

      const data = await response.json()
      if (response.ok) {
        setSuccess('Assessment created successfully!')
        setAssessments([...assessments, { ...formData, job_id: data.job_id }])
        setFormData({
          job_title: '',
          experience_min: '',
          experience_max: '',
          duration: '',
          num_questions: '',
          schedule_start: '',
          schedule_end: '',
          degree_required: '',
          degree_branch: '',
          passout_year: '',
          passout_year_required: false,
          job_description: '',
          custom_prompt: '',
          skills: [],
        })
        setNewSkill({ name: '', priority: 'low' })
        setIsFormOpen(false)
      } else {
        setError(data.error || 'Failed to create assessment.')
      }
    } catch (err) {
      setError(`Network error: ${err.message}. Is the backend running?`)
    } finally {
      setIsLoading(false)
    }
  }

  const currentDate = new Date()
  const activeAssessments = assessments.filter(
    (assessment) =>
      new Date(assessment.schedule_end || assessment.schedule) >= currentDate
  )
  const pastAssessments = assessments.filter(
    (assessment) =>
      new Date(assessment.schedule_end || assessment.schedule) < currentDate
  )

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-gray-900 dark:via-slate-900 dark:to-indigo-950 font-sans flex flex-col">
      <Navbar />
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-800 bg-clip-text text-transparent mb-6">
          Recruiter Dashboard
        </h1>

        {error && (
          <div
            className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-lg border-l-4 border-red-500 text-red-700 dark:text-red-300 p-4 mb-6 rounded-2xl shadow-lg flex items-center gap-2"
            role="alert"
          >
            <X className="w-5 h-5" />
            {error}
          </div>
        )}
        {success && (
          <div
            className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-lg border-l-4 border-green-500 text-green-700 dark:text-green-300 p-4 mb-6 rounded-2xl shadow-lg flex items-center gap-2"
            role="alert"
          >
            <Check className="w-5 h-5" />
            {success}
          </div>
        )}

        <div className="mb-6">
          <div className="flex border-b border-gray-200/50 dark:border-gray-700/50 gap-4">
            {['create', 'active', 'past'].map((tab) => (
              <button
                key={tab}
                className={`px-4 py-2 text-base font-medium transition-all duration-200 ${
                  activeTab === tab
                    ? 'border-b-2 border-indigo-600 text-indigo-600 dark:text-indigo-300'
                    : 'text-gray-600 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/50'
                }`}
                onClick={() => setActiveTab(tab)}
              >
                {tab === 'create'
                  ? 'Create Assessment'
                  : tab === 'active'
                  ? 'Active Assessments'
                  : 'Past Assessments'}
              </button>
            ))}
          </div>
        </div>

        {activeTab === 'create' && (
          <div>
            <Button
              onClick={() => setIsFormOpen(!isFormOpen)}
              className="mb-6 bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-6 py-3 rounded-xl flex items-center justify-center gap-2 hover:from-indigo-700 hover:to-purple-700 transition-all duration-300 shadow-lg hover:shadow-xl"
            >
              {isFormOpen ? 'Cancel' : 'Create New Assessment'}
              {isFormOpen ? (
                <X className="w-5 h-5" />
              ) : (
                <Briefcase className="w-5 h-5" />
              )}
            </Button>

            {isFormOpen && (
              <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-lg p-6 sm:p-8 rounded-2xl shadow-lg border border-gray-200/50 dark:border-gray-700/50 mb-8">
                <h2 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-800 bg-clip-text text-transparent mb-6 flex items-center gap-3">
                  <Briefcase className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                  Create New Assessment
                </h2>
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div>
                      <FormInput
                        label="Job Title"
                        id="job_title"
                        name="job_title"
                        value={formData.job_title}
                        onChange={handleInputChange}
                        placeholder="Software Engineer"
                        required
                        className="bg-white/50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-600 focus:ring-indigo-600 focus:border-indigo-600"
                      />
                    </div>
                    <div>
                      <FormInput
                        label="Min Experience (years)"
                        id="experience_min"
                        type="number"
                        name="experience_min"
                        value={formData.experience_min}
                        onChange={handleInputChange}
                        min="0"
                        step="0.1"
                        placeholder="2"
                        required
                        className="bg-white/50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-600 focus:ring-indigo-600 focus:border-indigo-600"
                      />
                    </div>
                    <div>
                      <FormInput
                        label="Max Experience (years)"
                        id="experience_max"
                        type="number"
                        name="experience_max"
                        value={formData.experience_max}
                        onChange={handleInputChange}
                        min={formData.experience_min || 0}
                        step="0.1"
                        placeholder="5"
                        required
                        className="bg-white/50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-600 focus:ring-indigo-600 focus:border-indigo-600"
                      />
                    </div>
                    <div>
                      <FormInput
                        label="Duration (minutes)"
                        id="duration"
                        type="number"
                        name="duration"
                        value={formData.duration}
                        onChange={handleInputChange}
                        min="1"
                        placeholder="30"
                        required
                        className="bg-white/50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-600 focus:ring-indigo-600 focus:border-indigo-600"
                      />
                    </div>
                    <div>
                      <FormInput
                        label="Number of Questions"
                        id="num_questions"
                        type="number"
                        name="num_questions"
                        value={formData.num_questions}
                        onChange={handleInputChange}
                        min="1"
                        placeholder="10"
                        required
                        className="bg-white/50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-600 focus:ring-indigo-600 focus:border-indigo-600"
                      />
                    </div>
                    <div>
                      <FormInput
                        label="Start Date"
                        id="schedule_start"
                        type="datetime-local"
                        name="schedule_start"
                        value={
                          formData.schedule_start
                            ? new Date(formData.schedule_start)
                                .toISOString()
                                .slice(0, 16)
                            : ''
                        }
                        onChange={(e) => {
                          const date = new Date(e.target.value)
                          setFormData({
                            ...formData,
                            schedule_start: date.toISOString(),
                          })
                        }}
                        required
                        className="bg-white/50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-600 focus:ring-indigo-600 focus:border-indigo-600"
                      />
                    </div>
                    <div>
                      <FormInput
                        label="End Date"
                        id="schedule_end"
                        type="datetime-local"
                        name="schedule_end"
                        value={
                          formData.schedule_end
                            ? new Date(formData.schedule_end)
                                .toISOString()
                                .slice(0, 16)
                            : ''
                        }
                        onChange={(e) => {
                          const date = new Date(e.target.value)
                          setFormData({
                            ...formData,
                            schedule_end: date.toISOString(),
                          })
                        }}
                        required
                        className="bg-white/50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-600 focus:ring-indigo-600 focus:border-indigo-600"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="degree_required"
                        className="block text-base font-medium text-gray-700 dark:text-gray-200 mb-1"
                      >
                        Degree
                      </label>
                      <Select
                        options={degrees}
                        value={
                          degrees.find(
                            (option) =>
                              option.value === formData.degree_required
                          ) || null
                        }
                        onChange={handleDegreeChange}
                        placeholder="Select a degree..."
                        className="text-base"
                        classNamePrefix="react-select"
                        styles={{
                          control: (provided) => ({
                            ...provided,
                            borderColor: '#e5e7eb',
                            borderRadius: '0.5rem',
                            padding: '2px',
                            backgroundColor: 'rgba(255, 255, 255, 0.7)',
                            '&:hover': { borderColor: '#4f46e5' },
                          }),
                          menu: (provided) => ({
                            ...provided,
                            backgroundColor: 'rgba(255, 255, 255, 0.9)',
                          }),
                          option: (provided, state) => ({
                            ...provided,
                            backgroundColor: state.isSelected
                              ? '#4f46e5'
                              : state.isFocused
                              ? '#e0e7ff'
                              : 'rgba(255, 255, 255, 0.9)',
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
                            primary: '#4f46e5',
                            primary25: '#e0e7ff',
                          },
                        })}
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="degree_branch"
                        className="block text-base font-medium text-gray-700 dark:text-gray-200 mb-1"
                      >
                        Branch/Specialization
                      </label>
                      <Select
                        options={branches}
                        value={
                          branches.find(
                            (option) => option.value === formData.degree_branch
                          ) || null
                        }
                        onChange={handleBranchChange}
                        placeholder="Select a branch..."
                        className="text-base"
                        classNamePrefix="react-select"
                        styles={{
                          control: (provided) => ({
                            ...provided,
                            borderColor: '#e5e7eb',
                            borderRadius: '0.5rem',
                            padding: '2px',
                            backgroundColor: 'rgba(255, 255, 255, 0.7)',
                            '&:hover': { borderColor: '#4f46e5' },
                          }),
                          menu: (provided) => ({
                            ...provided,
                            backgroundColor: 'rgba(255, 255, 255, 0.9)',
                          }),
                          option: (provided, state) => ({
                            ...provided,
                            backgroundColor: state.isSelected
                              ? '#4f46e5'
                              : state.isFocused
                              ? '#e0e7ff'
                              : 'rgba(255, 255, 255, 0.9)',
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
                            primary: '#4f46e5',
                            primary25: '#e0e7ff',
                          },
                        })}
                      />
                    </div>
                    <div>
                      <FormInput
                        label="Passout Year"
                        id="passout_year"
                        type="number"
                        name="passout_year"
                        value={formData.passout_year}
                        onChange={handleInputChange}
                        min="1900"
                        max={new Date().getFullYear() + 5}
                        placeholder="2023"
                        className="bg-white/50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-600 focus:ring-indigo-600 focus:border-indigo-600"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="passout_year_required"
                        className="block text-base font-medium text-gray-700 dark:text-gray-200 mb-1"
                      >
                        Passout Year Required
                      </label>
                      <input
                        type="checkbox"
                        id="passout_year_required"
                        name="passout_year_required"
                        checked={formData.passout_year_required}
                        onChange={handleInputChange}
                        className="h-4 w-4 text-indigo-600 focus:ring-indigo-600 border-gray-300 dark:border-gray-600 rounded"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label
                        htmlFor="job_description"
                        className="block text-base font-medium text-gray-700 dark:text-gray-200 mb-1"
                      >
                        Description
                      </label>
                      <textarea
                        id="job_description"
                        name="job_description"
                        value={formData.job_description}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 bg-white/50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-indigo-600 focus:border-indigo-600 text-base placeholder-gray-400 dark:placeholder-gray-300 transition-all duration-200 resize-y"
                        rows="5"
                        placeholder="E.g., Looking for a backend engineer with experience in Django, REST APIs, and PostgreSQL..."
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label
                        htmlFor="custom_prompt"
                        className="block text-base font-medium text-gray-700 dark:text-gray-200 mb-1"
                      >
                        Customized Prompt
                      </label>
                      <textarea
                        id="custom_prompt"
                        name="custom_prompt"
                        value={formData.custom_prompt}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 bg-white/50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-indigo-600 focus:border-indigo-600 text-base placeholder-gray-400 dark:placeholder-gray-300 transition-all duration-200 resize-y"
                        rows="4"
                        placeholder="E.g., I want code snippet based questions..."
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-base font-medium text-gray-700 dark:text-gray-200 mb-1">
                        Skills
                      </label>
                      <div className="flex gap-4 mb-4">
                        <input
                          type="text"
                          name="name"
                          value={newSkill.name}
                          onChange={handleSkillChange}
                          className="flex-1 px-3 py-2 bg-white/50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-indigo-600 focus:border-indigo-600 text-base placeholder-gray-400 dark:placeholder-gray-300 transition-all duration-200"
                          placeholder="e.g., Python"
                        />
                        <select
                          name="priority"
                          value={newSkill.priority}
                          onChange={handleSkillChange}
                          className="px-3 py-2 bg-white/50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-indigo-600 focus:border-indigo-600 text-base text-gray-700 dark:text-gray-200"
                        >
                          <option value="low">Low</option>
                          <option value="medium">Medium</option>
                          <option value="high">High</option>
                        </select>
                        <Button
                          type="button"
                          onClick={addSkill}
                          className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-4 py-2 rounded-xl flex items-center gap-2 hover:from-indigo-700 hover:to-purple-700 transition-all duration-300 shadow-lg hover:shadow-xl"
                        >
                          Add
                          <Plus className="w-5 h-5" />
                        </Button>
                      </div>
                      {formData.skills.length > 0 && (
                        <ul className="space-y-3">
                          {formData.skills.map((skill, index) => (
                            <li
                              key={index}
                              className="flex items-center justify-between bg-white/50 dark:bg-gray-800/50 backdrop-blur-lg p-3 rounded-xl shadow-sm"
                            >
                              <span className="text-base text-gray-700 dark:text-gray-200">
                                {skill.name} ({skill.priority})
                              </span>
                              <button
                                type="button"
                                onClick={() => removeSkill(index)}
                                className="text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 transition-all duration-200"
                              >
                                <Trash2 className="w-5 h-5" />
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <Button
                      type="submit"
                      disabled={isLoading}
                      className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-6 py-3 rounded-xl flex items-center justify-center gap-2 hover:from-indigo-700 hover:to-purple-700 transition-all duration-300 shadow-lg hover:shadow-xl"
                    >
                      Create Assessment
                      <Briefcase className="w-5 h-5" />
                    </Button>
                  </div>
                </form>
              </div>
            )}
          </div>
        )}

        {activeTab === 'active' && (
          <div>
            <h2 className="text-xl font-semibold bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-800 bg-clip-text text-transparent mb-4 flex items-center gap-2">
              <Briefcase className="w-5 h-5 text-indigo-600 dark:text-indigo-300" />
              Active Assessments
            </h2>
            {activeAssessments.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {activeAssessments.map((assessment) => (
                  <div
                    key={assessment.job_id}
                    className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-lg p-6 rounded-2xl shadow-lg hover:shadow-2xl hover:scale-105 transition-all duration-300 border border-gray-200/50 dark:border-gray-700/50 max-w-md w-full"
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
                          {assessment.company}
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
                        <Calendar className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                        <span>
                          {formatDate(
                            assessment.schedule_start || assessment.schedule
                          )}{' '}
                          -{' '}
                          {formatDate(
                            assessment.schedule_end || assessment.schedule
                          )}
                        </span>
                      </div>
                      {assessment.degree_required && (
                        <div className="flex items-center gap-2">
                          <GraduationCap className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                          <span>{assessment.degree_required}</span>
                        </div>
                      )}
                      {assessment.degree_branch && (
                        <div className="flex items-center gap-2">
                          <BrainCircuit className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                          <span>{assessment.degree_branch}</span>
                        </div>
                      )}
                      {assessment.passout_year && (
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                          <span>
                            Passout Year: {assessment.passout_year}
                            {assessment.passout_year_required
                              ? ' (Required)'
                              : ' (Optional)'}
                          </span>
                        </div>
                      )}
                      {assessment.skills && assessment.skills.length > 0 && (
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
                    <LinkButton
                      to={`/recruiter/candidates/${assessment.job_id}`}
                      className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-6 py-3 rounded-xl flex items-center justify-center gap-2 hover:from-indigo-700 hover:to-purple-700 transition-all duration-300 shadow-lg hover:shadow-xl"
                    >
                      View Candidates
                      <ChevronRight className="w-5 h-5" />
                    </LinkButton>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-lg p-6 rounded-2xl shadow-lg text-center border border-gray-200/50 dark:border-gray-700/50">
                <p className="text-base text-gray-600 dark:text-gray-400">
                  No active assessments.
                </p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'past' && (
          <div>
            <h2 className="text-xl font-semibold bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-800 bg-clip-text text-transparent mb-4 flex items-center gap-2">
              <Briefcase className="w-5 h-5 text-indigo-600 dark:text-indigo-300" />
              Past Assessments
            </h2>
            {pastAssessments.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {pastAssessments.map((assessment) => (
                  <div
                    key={assessment.job_id}
                    className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-lg p-6 rounded-2xl shadow-lg hover:shadow-2xl hover:scale-105 transition-all duration-300 border border-gray-200/50 dark:border-gray-700/50 max-w-md w-full"
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
                          {assessment.company}
                        </p>
                      </div>
                    </div>
                    <div className="space-y-3 text-base text-gray-600 dark:text-gray-400 mb-4">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                        <span>
                          {assessment.experience_min}-
                          {assessment.experience_max} years
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                        <span>
                          {formatDate(
                            assessment.schedule_start || assessment.schedule
                          )}{' '}
                          -{' '}
                          {formatDate(
                            assessment.schedule_end || assessment.schedule
                          )}
                        </span>
                      </div>
                      {assessment.degree_required && (
                        <div className="flex items-center gap-2">
                          <GraduationCap className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                          <span>{assessment.degree_required}</span>
                        </div>
                      )}
                      {assessment.degree_branch && (
                        <div className="flex items-center gap-2">
                          <BrainCircuit className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                          <span>{assessment.degree_branch}</span>
                        </div>
                      )}
                      {assessment.passout_year && (
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                          <span>
                            Passout Year: {assessment.passout_year}
                            {assessment.passout_year_required
                              ? ' (Required)'
                              : ' (Optional)'}
                          </span>
                        </div>
                      )}
                      {assessment.skills && assessment.skills.length > 0 && (
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
                    <div className="flex flex-col gap-2">
                      <div className="flex gap-2 justify-between">
                        <LinkButton
                          to={`/recruiter/candidates/${assessment.job_id}`}
                          className="flex-1 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/50 px-4 py-2 rounded-xl text-center transition-all duration-200"
                        >
                          View Candidates
                        </LinkButton>
                        <LinkButton
                          to={`/recruiter/report/${assessment.job_id}`}
                          className="flex-1 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/50 px-4 py-2 rounded-xl text-center transition-all duration-200"
                        >
                          View Report
                        </LinkButton>
                      </div>
                      <LinkButton
                        to={`/recruiter/combined-report/${assessment.job_id}`}
                        className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-6 py-3 rounded-xl flex items-center justify-center gap-2 hover:from-indigo-700 hover:to-purple-700 transition-all duration-300 shadow-lg hover:shadow-xl"
                      >
                        View Combined Report
                        <ChevronRight className="w-5 h-5" />
                      </LinkButton>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-lg p-6 rounded-2xl shadow-lg text-center border border-gray-200/50 dark:border-gray-700/50">
                <p className="text-base text-gray-600 dark:text-gray-400">
                  No past assessments.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default RecruiterDashboard

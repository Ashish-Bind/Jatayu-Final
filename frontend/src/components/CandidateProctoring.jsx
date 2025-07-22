import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { FileText, Loader2, AlertCircle, Camera } from 'lucide-react'
import Navbar from './Navbar'
import Button from './Button'
import { baseUrl, downloadAsPDF } from '../utils/utils'

const CandidateProctoring = () => {
  const { candidateId } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [proctoringData, setProctoringData] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!user || user.role !== 'recruiter') {
      navigate('/recruiter/login')
      return
    }

    setIsLoading(true)
    fetch(
      `${baseUrl}/recruiter/analytics/candidate/${candidateId}/proctoring`,
      {
        credentials: 'include',
      }
    )
      .then((response) => {
        if (!response.ok) throw new Error('Failed to fetch proctoring data')
        return response.json()
      })
      .then((data) => setProctoringData(data))
      .catch((err) =>
        setError('Error fetching proctoring data: ' + err.message)
      )
      .finally(() => setIsLoading(false))
  }, [user, navigate, candidateId])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-100 to-blue-50 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-indigo-600 dark:text-indigo-400 mx-auto mb-4" />
          <p className="text-gray-900 dark:text-gray-100 text-xl font-medium">
            Loading proctoring data...
          </p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-100 to-blue-50 dark:from-gray-900 dark:to-gray-800 flex flex-col">
        <Navbar />
        <div className="flex-grow py-8 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            <div className="p-6 bg-red-50/70 dark:bg-red-900/30 backdrop-blur-lg rounded-2xl shadow-lg border border-red-200/50 dark:border-red-700/50">
              <div className="flex items-center">
                <AlertCircle className="w-8 h-8 text-red-500 dark:text-red-400 mr-4" />
                <p className="text-red-600 dark:text-red-300 text-lg font-medium">
                  {error}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!proctoringData || !proctoringData.proctoring_data.length) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-100 to-blue-50 dark:from-gray-900 dark:to-gray-800 flex flex-col">
        <Navbar />
        <div className="flex-grow py-8 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-12">
              <div className="flex items-center justify-center mb-6">
                <div className="p-4 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl shadow-lg">
                  <FileText className="w-12 h-12 text-white" />
                </div>
              </div>
              <h1 className="text-5xl font-bold bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-800 bg-clip-text text-transparent mb-4">
                Proctoring Data for {proctoringData?.name || 'Candidate'}
              </h1>
              <p className="text-gray-600 dark:text-gray-400 text-lg max-w-2xl mx-auto">
                No proctoring data available.
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-100 to-blue-50 dark:from-gray-900 dark:to-gray-800 flex flex-col">
      <Navbar />
      <div className="flex-grow py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          {/* <div className="text-center mb-12">
            <div className="flex items-center justify-center mb-6">
              <div className="p-4 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl shadow-lg">
                <FileText className="w-12 h-12 text-white" />
              </div>
            </div>
            <h1 className="text-5xl font-bold bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-800 bg-clip-text text-transparent mb-4">
              Proctoring Data for {proctoringData.name}
            </h1>
            <p className="text-gray-600 dark:text-gray-400 text-lg max-w-2xl mx-auto">
              Detailed proctoring analytics for candidate assessments
            </p>
          </div> */}

          {proctoringData.proctoring_data.map((data) => (
            <div
              key={data.attempt_id}
              className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-lg rounded-3xl shadow-xl border border-gray-200/50 dark:border-gray-700/50 p-8 mb-8 hover:shadow-2xl transition-all duration-300"
            >
              <div className="flex items-center mb-6">
                <div className="p-3 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl mr-4">
                  <FileText className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                    Attempt for {data.job_title}
                  </h2>
                  <p className="text-gray-600 dark:text-gray-400">
                    Proctoring details for this assessment attempt
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                <div className="bg-gradient-to-br from-gray-50 to-blue-50 dark:from-gray-800 dark:to-gray-900 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    Tab Switches
                  </p>
                  <p className="text-xl font-bold text-gray-900 dark:text-white">
                    {data.tab_switches}
                  </p>
                </div>
                <div className="bg-gradient-to-br from-gray-50 to-blue-50 dark:from-gray-800 dark:to-gray-900 p-4 rounded-2xl border border-gray-200 dark:border-gray-700">
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    Fullscreen Warnings
                  </p>
                  <p className="text-xl font-bold text-gray-900 dark:text-white">
                    {data.fullscreen_warnings}
                  </p>
                </div>
                <div className="bg-gradient-to-br from-gray-50 to-blue-50 dark:from-gray-800 dark:to-gray-900 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    Forced Termination
                  </p>
                  <p className="text-xl font-bold text-gray-900 dark:text-white">
                    {data.forced_termination
                      ? `Yes (${data.termination_reason})`
                      : 'No'}
                  </p>
                </div>
              </div>

              {/* Violations Section */}
              <div className="mb-6">
                <div className="flex items-center mb-4">
                  <div className="p-2 bg-gradient-to-r from-red-500 to-pink-600 rounded-xl mr-3">
                    <AlertCircle className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-lg font-semibold text-red-600 dark:text-red-400">
                    Violations
                  </h3>
                </div>
                {data.violations && data.violations.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                    {data.violations.map((violation) => (
                      <div key={violation.violation_id} className="relative">
                        <img
                          src={`http://localhost:5000/static/uploads/${violation.snapshot_path}`}
                          alt="Violation Snapshot"
                          className="w-full h-32 object-cover rounded-lg"
                        />
                        <span className="absolute top-2 left-2 text-sm text-white bg-black bg-opacity-50 px-2 py-1 rounded">
                          {new Date(violation.timestamp).toLocaleString()}
                        </span>
                        <span className="absolute top-2 right-2 text-sm text-white bg-indigo-600 dark:bg-indigo-800 px-2 py-1 rounded">
                          {violation.violation_type}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    No violations recorded.
                  </p>
                )}
              </div>

              {/* Snapshots Section */}
              <div className="mb-6">
                <div className="flex items-center mb-4">
                  <div className="p-2 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl mr-3">
                    <Camera className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Snapshots
                  </h3>
                </div>
                {data.snapshots.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                    {data.snapshots.map((snapshot, index) => (
                      <div key={index} className="relative">
                        <img
                          src={`http://localhost:5000/static/uploads/${snapshot.path}`}
                          alt={`Snapshot ${index + 1}`}
                          className="w-full h-32 object-cover rounded-lg"
                        />
                        <span className="absolute top-2 left-2 text-sm text-white bg-black bg-opacity-50 px-2 py-1 rounded">
                          {new Date(snapshot.timestamp).toLocaleString()}
                        </span>
                        <span
                          className={`absolute top-2 right-2 text-sm text-white px-2 py-1 rounded ${
                            snapshot.is_valid
                              ? 'bg-emerald-600 dark:bg-emerald-800'
                              : 'bg-red-600 dark:bg-red-800'
                          }`}
                        >
                          {snapshot.is_valid ? 'Valid' : 'Invalid'}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    No snapshots available.
                  </p>
                )}
              </div>

              {/* Remarks Section */}
              <div>
                <div className="flex items-center mb-4">
                  <div className="p-2 bg-gradient-to-r from-amber-500 to-orange-600 rounded-xl mr-3">
                    <FileText className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Remarks
                  </h3>
                </div>
                {data.remarks.length > 0 ? (
                  <ul className="list-disc pl-5 text-sm text-gray-600 dark:text-gray-300">
                    {data.remarks.map((remark, index) => (
                      <li key={index} className="mb-2">
                        {remark}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    No remarks available.
                  </p>
                )}
              </div>
            </div>
          ))}

          <Button
            variant="primary"
            onClick={() =>
              downloadAsPDF(
                `proctoring-report-${candidateId}`,
                `Proctoring_Report_${candidateId}`
              )
            }
            className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-6 py-3 rounded-xl flex items-center hover:from-indigo-700 hover:to-purple-700 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105"
          >
            <FileText className="w-5 h-5 mr-2" />
            Download Proctoring Report
          </Button>
          <div id={`proctoring-report-${candidateId}`} className="hidden">
            <h1>Proctoring Report for {proctoringData.name}</h1>
            {proctoringData.proctoring_data.map((data) => (
              <div key={data.attempt_id}>
                <h2>Attempt for {data.job_title}</h2>
                <p>Tab Switches: {data.tab_switches}</p>
                <p>Fullscreen Warnings: {data.fullscreen_warnings}</p>
                <p>
                  Forced Termination:{' '}
                  {data.forced_termination
                    ? `Yes (${data.termination_reason})`
                    : 'No'}
                </p>
                <p>
                  Remarks:{' '}
                  {data.remarks.length ? data.remarks.join('; ') : 'None'}
                </p>
                <p>Snapshots: {data.snapshots.length}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default CandidateProctoring

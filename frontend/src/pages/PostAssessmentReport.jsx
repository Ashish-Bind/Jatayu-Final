import React, { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import axios from 'axios'
import { Bar } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js'
import { Briefcase, X, ChevronRight } from 'lucide-react'
import Navbar from '../components/Navbar'

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend)

const PostAssessmentReport = () => {
  const { job_id } = useParams()
  const [report, setReport] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    axios
      .get(`http://localhost:5000/api/recruiter/report/${job_id}`, {
        withCredentials: true, // Ensure cookies are sent
      })
      .then((response) => {
        setReport(response.data)
      })
      .catch((error) => {
        console.error('Error fetching report:', error)
        setError(error.response?.data?.error || 'Failed to fetch report')
      })
  }, [job_id])

  if (error) {
    return (
      <div className="min-h-screen bg-gray-100 flex flex-col">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div
            className="bg-red-50 border-l-4 border-red-500 text-red-700 p-3 mb-6 rounded-md text-sm flex items-center gap-2"
            role="alert"
          >
            <X className="w-4 h-4" />
            {error}
          </div>
          <Link
            to="/recruiter/dashboard"
            className="inline-flex items-center text-indigo-600 hover:text-indigo-800 font-medium text-sm"
          >
            Back to Dashboard
            <ChevronRight className="w-4 h-4 ml-1" />
          </Link>
        </div>
      </div>
    )
  }

  if (!report)
    return (
      <div className="min-h-screen bg-gray-100 flex flex-col">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 text-center text-gray-700 text-sm">
          Loading...
        </div>
      </div>
    )

  // Chart data for Accuracy
  const chartData = {
    labels: report.candidates.map((candidate) => candidate.name),
    datasets: [
      {
        label: 'Accuracy (%)',
        data: report.candidates.map((candidate) => candidate.accuracy),
        backgroundColor: 'rgba(79, 70, 229, 0.6)', // indigo-600
        borderColor: 'rgba(79, 70, 229, 1)',
        borderWidth: 1,
      },
      {
        label: 'Avg Time per Question (s)',
        data: report.candidates.map(
          (candidate) => candidate.avg_time_per_question
        ),
        backgroundColor: 'rgba(16, 185, 129, 0.6)', // green-500
        borderColor: 'rgba(16, 185, 129, 1)',
        borderWidth: 1,
      },
    ],
  }

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top',
        labels: {
          font: {
            size: 12,
          },
          color: '#374151', // gray-700
        },
      },
      title: {
        display: true,
        text: `Post-Assessment Metrics for ${report.job_title}`,
        font: {
          size: 18,
          weight: '600',
        },
        color: '#111827', // gray-900
        padding: {
          bottom: 20,
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          color: '#374151', // gray-700
        },
        grid: {
          color: '#E5E7EB', // gray-200
        },
      },
      x: {
        ticks: {
          color: '#374151', // gray-700
        },
        grid: {
          display: false,
        },
      },
    },
  }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <Navbar />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">
          Post-Assessment Report for {report.job_title}
        </h1>
        <Link
          to="/recruiter/dashboard"
          className="inline-flex items-center text-indigo-600 hover:text-indigo-800 font-medium text-sm mb-6"
        >
          Back to Dashboard
          <ChevronRight className="w-4 h-4 ml-1" />
        </Link>

        {report.candidates.length > 0 ? (
          <>
            {/* Chart Section */}
            <div className="bg-white p-6 sm:p-8 rounded-lg shadow-sm border border-gray-200 mb-8">
              <Bar data={chartData} options={chartOptions} />
            </div>

            {/* Table Section */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-8 overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="py-3 px-6 text-left text-sm font-medium text-gray-700 border-b border-gray-200">
                      Name
                    </th>
                    <th className="py-3 px-6 text-left text-sm font-medium text-gray-700 border-b border-gray-200">
                      Email
                    </th>
                    <th className="py-3 px-6 text-left text-sm font-medium text-gray-700 border-b border-gray-200">
                      Status
                    </th>
                    <th className="py-3 px-6 text-left text-sm font-medium text-gray-700 border-b border-gray-200">
                      Accuracy (%)
                    </th>
                    <th className="py-3 px-6 text-left text-sm font-medium text-gray-700 border-b border-gray-200">
                      Questions Attempted
                    </th>
                    <th className="py-3 px-6 text-left text-sm font-medium text-gray-700 border-b border-gray-200">
                      Avg Time/Question (s)
                    </th>
                    <th className="py-3 px-6 text-left text-sm font-medium text-gray-700 border-b border-gray-200">
                      Final Bands
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {report.candidates.map((candidate) => (
                    <tr
                      key={candidate.candidate_id}
                      className="hover:bg-gray-50"
                    >
                      <td className="py-3 px-6 text-sm text-gray-700 border-b border-gray-200">
                        {candidate.name}
                      </td>
                      <td className="py-3 px-6 text-sm text-gray-700 border-b border-gray-200">
                        {candidate.email}
                      </td>
                      <td className="py-3 px-6 text-sm text-gray-700 border-b border-gray-200">
                        {candidate.status}
                      </td>
                      <td className="py-3 px-6 text-sm text-gray-700 border-b border-gray-200">
                        {candidate.accuracy}
                      </td>
                      <td className="py-3 px-6 text-sm text-gray-700 border-b border-gray-200">
                        {candidate.total_questions}
                      </td>
                      <td className="py-3 px-6 text-sm text-gray-700 border-b border-gray-200">
                        {candidate.avg_time_per_question}
                      </td>
                      <td className="py-3 px-6 text-sm text-gray-700 border-b border-gray-200">
                        {Object.entries(candidate.final_bands).map(
                          ([skill, band]) => (
                            <span key={skill} className="mr-2">
                              {skill}: {band}
                            </span>
                          )
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Card Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {report.candidates.map((candidate) => (
                <div
                  key={candidate.candidate_id}
                  className="bg-white p-5 rounded-lg shadow-sm hover:shadow-md transition-shadow border border-gray-200"
                >
                  <div className="flex items-start gap-3 mb-3">
                    <div className="bg-indigo-50 p-2 rounded-md">
                      <Briefcase className="w-4 h-4 text-indigo-600" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">
                        {candidate.name}
                      </h3>
                      <p className="text-sm text-gray-700">
                        Email: {candidate.email}
                      </p>
                    </div>
                  </div>
                  <div className="space-y-2 text-sm text-gray-700">
                    <p>Status: {candidate.status}</p>
                    <p>Accuracy: {candidate.accuracy}%</p>
                    <p>Questions Attempted: {candidate.total_questions}</p>
                    <p>Avg Time/Question: {candidate.avg_time_per_question}s</p>
                    <p>
                      Final Bands:{' '}
                      {Object.entries(candidate.final_bands).map(
                        ([skill, band]) => (
                          <span key={skill} className="mr-2">
                            {skill}: {band}
                          </span>
                        )
                      )}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="bg-white p-6 rounded-lg shadow-sm text-center border border-gray-200">
            <p className="text-sm text-gray-700">No candidates found.</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default PostAssessmentReport

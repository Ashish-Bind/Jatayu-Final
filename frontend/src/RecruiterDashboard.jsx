import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

const RecruiterDashboard = () => {
  const [assessments, setAssessments] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    // Fetch assessments for recruiter (mocked recruiter_id=1 for now)
    fetch('http://localhost:5000/api/recruiter/assessments/1')
      .then((response) => response.json())
      .then((data) => setAssessments(data))
      .catch((error) => {
        console.error('Error fetching assessments:', error);
        setError('Failed to load assessments.');
      });
  }, []);

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Recruiter Dashboard</h1>

      {error && (
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-6" role="alert">
          <p>{error}</p>
        </div>
      )}

      <h2 className="text-2xl font-semibold mb-4">Your Assessments</h2>
      {assessments.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {assessments.map((assessment) => (
            <div key={assessment.job_id} className="bg-white p-4 rounded-lg shadow-md">
              <h3 className="text-xl font-semibold">{assessment.job_title}</h3>
              <p className="text-gray-600">Company: {assessment.company}</p>
              <p className="text-gray-600">
                Experience: {assessment.experience_min}-{assessment.experience_max} years
              </p>
              <p className="text-gray-600">
                Schedule: {new Date(assessment.schedule).toLocaleString()}
              </p>
              <Link
                to={`/recruiter/candidates/${assessment.job_id}`}
                className="text-blue-500 hover:underline mt-2 inline-block"
              >
                View Candidates
              </Link>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-gray-600">No assessments created yet.</p>
      )}
    </div>
  );
};

export default RecruiterDashboard;
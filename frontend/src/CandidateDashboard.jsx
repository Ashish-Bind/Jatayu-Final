import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Modal from 'react-modal';

// Bind modal to your appElement (for accessibility)
Modal.setAppElement('#root');

const CandidateDashboard = () => {
  const [candidate, setCandidate] = useState(null);
  const [assessments, setAssessments] = useState([]);
  const [selectedAssessment, setSelectedAssessment] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    // Fetch candidate data (mocked candidate_id=1 for now)
    fetch('http://localhost:5000/api/candidate/profile/1')
      .then((response) => response.json())
      .then((data) => {
        setCandidate(data);
        if (!data.is_profile_complete) {
          navigate('/candidate/complete-profile');
        }
      })
      .catch((error) => console.error('Error fetching candidate:', error));

    // Fetch eligible assessments
    fetch('http://localhost:5000/api/candidate/eligible-assessments/1')
      .then((response) => response.json())
      .then((data) => setAssessments(data))
      .catch((error) => console.error('Error fetching assessments:', error));
  }, [navigate]);

  const handleStartAssessment = (assessment) => {
    const scheduleTime = new Date(assessment.schedule);
    const currentTime = new Date();

    if (currentTime < scheduleTime) {
      setErrorMessage(
        `This assessment has not yet started. It is scheduled for ${scheduleTime.toLocaleString()}.`
      );
      setSelectedAssessment(null);
      return;
    }

    setSelectedAssessment(assessment);
    setErrorMessage('');
    setIsModalOpen(true);
  };

  const confirmStartAssessment = () => {
    if (!selectedAssessment) return;

    // Start the assessment by creating an attempt
    fetch('http://localhost:5000/api/candidate/start-assessment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        candidate_id: 1, // Mocked for now
        job_id: selectedAssessment.job_id,
      }),
    })
      .then((response) => response.json())
      .then((data) => {
        if (data.attempt_id) {
          // Redirect to the MCQ chatbot page with the attempt ID
          navigate(`/candidate/assessment/${data.attempt_id}`);
        } else {
          setErrorMessage('Failed to start the assessment.');
        }
      })
      .catch((error) => {
        console.error('Error starting assessment:', error);
        setErrorMessage('An error occurred while starting the assessment.');
      });

    setIsModalOpen(false);
  };

  if (!candidate) return <div>Loading...</div>;

  return (
    <div className="container mx-auto p-6">
      <header className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Candidate Dashboard</h1>
        <div className="flex items-center">
          {candidate.profile_picture ? (
            <Link to="/candidate/complete-profile">
              <img
                src={`http://localhost:5000/static/uploads/${candidate.profile_picture}`}
                alt="Profile Picture"
                className="w-12 h-12 rounded-full mr-4 cursor-pointer"
                onError={(e) => {
                  e.target.src = 'https://via.placeholder.com/48';
                  e.target.alt = 'Failed to load profile picture';
                }}
              />
            </Link>
          ) : (
            <Link to="/candidate/complete-profile" className="text-blue-500 hover:underline">
              <svg
                className="w-12 h-12 mr-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M5.121 19.879A4.5 4.5 0 019 18h6a4.5 4.5 0 013.879 1.879M15 13a3 3 0 01-3 3 3 3 0 01-3-3 3 3 0 013-3 3 3 0 013 3z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M12 12a4 4 0 100-8 4 4 0 000 8z"
                />
              </svg>
            </Link>
          )}
        </div>
      </header>

      {errorMessage && (
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-6" role="alert">
          <p>{errorMessage}</p>
        </div>
      )}

      {!candidate.is_profile_complete ? (
        <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 mb-6" role="alert">
          <p>Please complete your profile to access assessments.</p>
          <Link to="/candidate/complete-profile" className="underline">
            Complete Profile
          </Link>
        </div>
      ) : (
        <>
          <h2 className="text-2xl font-semibold mb-4">Available Assessments</h2>
          {assessments.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {assessments.map((assessment) => (
                <div key={assessment.job_id} className="bg-white p-4 rounded-lg shadow-md">
                  <h3 className="text-xl font-semibold">{assessment.job_title}</h3>
                  <p className="text-gray-600">Company: {assessment.company}</p>
                  <p className="text-gray-600">
                    Experience: {assessment.experience_min}-{assessment.experience_max} years
                  </p>
                  <button
                    onClick={() => handleStartAssessment(assessment)}
                    className="text-blue-500 hover:underline mt-2"
                  >
                    Take Assessment
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-600">No assessments available at the moment.</p>
          )}
        </>
      )}

      {/* Confirmation Modal */}
      <Modal
        isOpen={isModalOpen}
        onRequestClose={() => setIsModalOpen(false)}
        className="bg-white p-6 rounded-lg shadow-lg max-w-md mx-auto mt-20"
        overlayClassName="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center"
      >
        <h2 className="text-2xl font-semibold mb-4">Start Assessment</h2>
        {selectedAssessment && (
          <div>
            <p className="mb-2">
              <strong>Job Title:</strong> {selectedAssessment.job_title}
            </p>
            <p className="mb-2">
              <strong>Company:</strong> {selectedAssessment.company}
            </p>
            <p className="mb-2">
              <strong>Duration:</strong> {selectedAssessment.duration} minutes
            </p>
            <p className="mb-2">
              <strong>Number of Questions:</strong> {selectedAssessment.num_questions}
            </p>
            <p className="mb-4">
              <strong>Description:</strong> {selectedAssessment.description || 'No description provided.'}
            </p>
            <div className="flex justify-end">
              <button
                onClick={() => setIsModalOpen(false)}
                className="mr-4 text-gray-500"
              >
                Cancel
              </button>
              <button
                onClick={confirmStartAssessment}
                className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
              >
                Start
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default CandidateDashboard;
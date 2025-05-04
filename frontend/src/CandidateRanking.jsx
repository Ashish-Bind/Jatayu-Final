import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

const CandidateRanking = () => {
  const { jobId } = useParams();
  const [rankingData, setRankingData] = useState(null);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    // Fetch ranked candidates
    fetch(`http://localhost:5000/api/recruiter/candidates/${jobId}`)
      .then((response) => response.json())
      .then((data) => setRankingData(data))
      .catch((error) => {
        console.error('Error fetching candidates:', error);
        setError('Failed to load candidate rankings.');
      });
  }, [jobId]);

  if (!rankingData) return <div>Loading...</div>;

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Candidate Rankings for {rankingData.job_title}</h1>

      {error && (
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-6" role="alert">
          <p>{error}</p>
        </div>
      )}

      {rankingData.candidates.length > 0 ? (
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-2xl font-semibold mb-4">Ranked Candidates</h2>
          <div className="space-y-4">
            {rankingData.candidates.map((candidate) => (
              <div key={candidate.candidate_id} className="border p-4 rounded-lg">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-xl font-semibold">
                      Rank {candidate.rank}: {candidate.name}
                    </h3>
                    <p className="text-gray-600">Email: {candidate.email}</p>
                    <p className="text-gray-600">Total Score: {candidate.total_score}</p>
                    <p className="text-gray-600">Skill Score: {candidate.skill_score}</p>
                    <p className="text-gray-600">Experience Score: {candidate.experience_score}</p>
                    <p className="text-gray-700 mt-2">{candidate.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <button
            onClick={() => navigate('/recruiter/dashboard')}
            className="mt-6 bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
          >
            Back to Dashboard
          </button>
        </div>
      ) : (
        <p className="text-gray-600">No candidates registered for this assessment.</p>
      )}
    </div>
  );
};

export default CandidateRanking;
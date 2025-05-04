import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import RecruiterDashboard from './RecruiterDashboard';
import CandidateDashboard from './CandidateDashboard';
import CompleteProfile from './CompleteProfile';
import AssessmentChatbot from './AssessmentChatbot';
import CandidateRanking from './CandidateRanking';

const App = () => {
  return (
    <Router>
      <Routes>
        {/* Recruiter Routes */}
        <Route path="/recruiter/dashboard" element={<RecruiterDashboard />} />
        <Route path="/recruiter/candidates/:jobId" element={<CandidateRanking />} />

        {/* Candidate Routes */}
        <Route path="/candidate/dashboard" element={<CandidateDashboard />} />
        <Route path="/candidate/complete-profile" element={<CompleteProfile />} />
        <Route path="/candidate/assessment/:attemptId" element={<AssessmentChatbot />} />

        {/* Default Route */}
        <Route
          path="/"
          element={
            <div className="container mx-auto p-6">
              <h1 className="text-3xl font-bold mb-4">Welcome to Jatayu</h1>
              <div className="flex space-x-4">
                <a
                  href="/recruiter/dashboard"
                  className="text-blue-500 hover:underline"
                >
                  Recruiter Dashboard
                </a>
                <a
                  href="/candidate/dashboard"
                  className="text-blue-500 hover:underline"
                >
                  Candidate Dashboard
                </a>
              </div>
            </div>
          }
        />
      </Routes>
    </Router>
  );
};

export default App;
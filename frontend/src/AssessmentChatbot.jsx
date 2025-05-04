import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

const AssessmentChatbot = () => {
  const { attemptId } = useParams();
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [questionNumber, setQuestionNumber] = useState(0);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [skill, setSkill] = useState('');
  const [message, setMessage] = useState('');
  const [userAnswer, setUserAnswer] = useState('');
  const [isAssessmentComplete, setIsAssessmentComplete] = useState(false);
  const [candidateReport, setCandidateReport] = useState(null);
  const [timeLeft, setTimeLeft] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    // Start the assessment session
    fetch(`http://localhost:5000/api/assessment/start/${attemptId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    })
      .then((response) => response.json())
      .then((data) => {
        setTotalQuestions(data.total_questions);
        setTimeLeft(data.test_duration);
        fetchNextQuestion();
      })
      .catch((error) => {
        console.error('Error starting assessment session:', error);
        setMessage('Failed to start the assessment.');
      });

    // Timer countdown
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 0) {
          clearInterval(timer);
          endAssessment();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [attemptId]);

  const fetchNextQuestion = () => {
    fetch(`http://localhost:5000/api/assessment/next-question/${attemptId}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    })
      .then((response) => response.json())
      .then((data) => {
        if (data.message === 'Assessment completed') {
          setIsAssessmentComplete(true);
          setCandidateReport(data.candidate_report);
          endAssessment();
        } else {
          setCurrentQuestion(data.question);
          setSkill(data.skill);
          setQuestionNumber(data.question_number);
          setMessage('');
        }
      })
      .catch((error) => {
        console.error('Error fetching next question:', error);
        setMessage('Failed to fetch the next question.');
      });
  };

  const handleAnswerSubmit = (e) => {
    e.preventDefault();
    if (!userAnswer) return;

    const startTime = Date.now();
    fetch(`http://localhost:5000/api/assessment/submit-answer/${attemptId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        skill: skill,
        answer: userAnswer,
        time_taken: (Date.now() - startTime) / 1000, // Time in seconds
      }),
    })
      .then((response) => response.json())
      .then((data) => {
        setMessage(data.feedback);
        setUserAnswer('');
        fetchNextQuestion();
      })
      .catch((error) => {
        console.error('Error submitting answer:', error);
        setMessage('Failed to submit your answer.');
      });
  };

  const endAssessment = () => {
    fetch(`http://localhost:5000/api/assessment/end/${attemptId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    })
      .then((response) => response.json())
      .then((data) => {
        if (!isAssessmentComplete) {
          setIsAssessmentComplete(true);
          setCandidateReport(data.candidate_report);
        }
      })
      .catch((error) => console.error('Error ending assessment:', error));
  };

  const formatTime = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs < 10 ? '0' : ''}${secs}`;
  };

  if (isAssessmentComplete) {
    return (
      <div className="container mx-auto p-6">
        <h1 className="text-3xl font-bold mb-6">Assessment Completed</h1>
        <p className="text-green-600 mb-4">✅ Assessment Completed. Good luck for your results!</p>
        {candidateReport && (
          <div>
            <h2 className="text-2xl font-semibold mb-4">📊 Candidate Report</h2>
            {Object.entries(candidateReport).map(([skill, stats]) => (
              <div key={skill} className="mb-4">
                <h3 className="text-xl font-semibold">🔹 {skill.replace('_', ' ')}</h3>
                <p>Questions: {stats.questions_attempted} | Correct: {stats.correct_answers} | Accuracy: {stats.accuracy_percent}%</p>
              </div>
            ))}
          </div>
        )}
        <button
          onClick={() => navigate('/candidate/dashboard')}
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 mt-4"
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Assessment</h1>
      <p className="text-gray-600 mb-4">Time Left: {formatTime(timeLeft)}</p>
      {message && (
        <p className={`mb-4 ${message.includes('✅') ? 'text-green-600' : 'text-red-600'}`}>
          {message}
        </p>
      )}
      {currentQuestion && (
        <div className="bg-white p-4 rounded-lg shadow-md mb-4">
          <h2 className="text-xl font-semibold mb-2">
            Q{questionNumber}: {currentQuestion.question}
          </h2>
          <p className="text-gray-600 mb-2">Skill: {skill.replace('_', ' ')}</p>
          <form onSubmit={handleAnswerSubmit}>
            {currentQuestion.options.map((option, index) => (
              <div key={index} className="mb-2">
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="answer"
                    value={index + 1}
                    checked={userAnswer === (index + 1).toString()}
                    onChange={(e) => setUserAnswer(e.target.value)}
                    className="mr-2"
                  />
                  {index + 1}. {option}
                </label>
              </div>
            ))}
            <button
              type="submit"
              className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 mt-2"
            >
              Submit Answer
            </button>
          </form>
        </div>
      )}
    </div>
  );
};

export default AssessmentChatbot;
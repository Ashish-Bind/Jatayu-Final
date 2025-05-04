import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Modal from 'react-modal';

// Bind modal to your appElement (for accessibility)
Modal.setAppElement('#root');

const RecruiterDashboard = () => {
  const [pastAssessments, setPastAssessments] = useState([]);
  const [activeAssessments, setActiveAssessments] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    test_name: '',
    company: '',
    location: '',
    required_degree: '',
    description: '',
    skills: [{ name: '', priority: 'low' }],
    experience_min: '',
    experience_max: '',
    duration: '',
    num_questions: '',
    schedule: '',
  });
  const [error, setError] = useState('');

  // Fetch assessments on component mount
  useEffect(() => {
    axios.get('http://localhost:5000/api/recruiter/assessments')
      .then(response => {
        setPastAssessments(response.data.past_assessments);
        setActiveAssessments(response.data.active_assessments);
      })
      .catch(err => {
        console.error('Error fetching assessments:', err);
        setError('Failed to load assessments');
      });
  }, []);

  // Handle form input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  // Handle skill input changes
  const handleSkillChange = (index, e) => {
    const { name, value } = e.target;
    const updatedSkills = [...formData.skills];
    updatedSkills[index] = { ...updatedSkills[index], [name]: value };
    setFormData({ ...formData, skills: updatedSkills });
  };

  // Add a new skill field
  const addSkill = () => {
    setFormData({ ...formData, skills: [...formData.skills, { name: '', priority: 'low' }] });
  };

  // Remove a skill field
  const removeSkill = (index) => {
    const updatedSkills = formData.skills.filter((_, i) => i !== index);
    setFormData({ ...formData, skills: updatedSkills });
  };

  // Handle form submission
  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    axios.post('http://localhost:5000/api/recruiter/assessments', formData)
      .then(response => {
        alert('Assessment created successfully!');
        setIsModalOpen(false);
        // Refresh assessments
        axios.get('http://localhost:5000/api/recruiter/assessments')
          .then(res => {
            setPastAssessments(res.data.past_assessments);
            setActiveAssessments(res.data.active_assessments);
          });
        // Reset form
        setFormData({
          test_name: '',
          company: '',
          location: '',
          required_degree: '',
          description: '',
          skills: [{ name: '', priority: 'low' }],
          experience_min: '',
          experience_max: '',
          duration: '',
          num_questions: '',
          schedule: '',
        });
      })
      .catch(err => {
        console.error('Error creating assessment:', err);
        setError(err.response?.data?.error || 'Failed to create assessment');
      });
  };

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Recruiter Dashboard</h1>

      {error && <p className="text-red-500 mb-4">{error}</p>}

      {/* Active Assessments Table */}
      <h2 className="text-2xl font-semibold mb-4">Active Assessments</h2>
      {activeAssessments.length > 0 ? (
        <table className="w-full border-collapse mb-6">
          <thead>
            <tr className="bg-gray-200">
              <th className="border p-2">Test Name</th>
              <th className="border p-2">Company</th>
              <th className="border p-2">Schedule</th>
              <th className="border p-2">Questions</th>
              <th className="border p-2">Duration (min)</th>
              <th className="border p-2">Experience Range</th>
              <th className="border p-2">Skills</th>
            </tr>
          </thead>
          <tbody>
            {activeAssessments.map(assessment => (
              <tr key={assessment.id}>
                <td className="border p-2">{assessment.test_name}</td>
                <td className="border p-2">{assessment.company}</td>
                <td className="border p-2">{new Date(assessment.schedule).toLocaleString()}</td>
                <td className="border p-2">{assessment.num_questions}</td>
                <td className="border p-2">{assessment.duration}</td>
                <td className="border p-2">{`${assessment.experience_min}-${assessment.experience_max} years`}</td>
                <td className="border p-2">
                  {assessment.skills.map(skill => (
                    <span key={skill.name} className="mr-2">{`${skill.name} (${skill.priority})`}</span>
                  ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p>No active assessments found.</p>
      )}

      {/* Past Assessments Table */}
      <h2 className="text-2xl font-semibold mb-4">Past Assessments</h2>
      {pastAssessments.length > 0 ? (
        <table className="w-full border-collapse mb-6">
          <thead>
            <tr className="bg-gray-200">
              <th className="border p-2">Test Name</th>
              <th className="border p-2">Company</th>
              <th className="border p-2">Schedule</th>
              <th className="border p-2">Questions</th>
              <th className="border p-2">Duration (min)</th>
              <th className="border p-2">Experience Range</th>
              <th className="border p-2">Skills</th>
            </tr>
          </thead>
          <tbody>
            {pastAssessments.map(assessment => (
              <tr key={assessment.id}>
                <td className="border p-2">{assessment.test_name}</td>
                <td className="border p-2">{assessment.company}</td>
                <td className="border p-2">{new Date(assessment.schedule).toLocaleString()}</td>
                <td className="border p-2">{assessment.num_questions}</td>
                <td className="border p-2">{assessment.duration}</td>
                <td className="border p-2">{`${assessment.experience_min}-${assessment.experience_max} years`}</td>
                <td className="border p-2">
                  {assessment.skills.map(skill => (
                    <span key={skill.name} className="mr-2">{`${skill.name} (${skill.priority})`}</span>
                  ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p>No past assessments found.</p>
      )}

      {/* Create Assessment Button */}
      <button
        onClick={() => setIsModalOpen(true)}
        className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
      >
        Create Assessment
      </button>

      {/* Modal for Creating Assessment */}
      <Modal
        isOpen={isModalOpen}
        onRequestClose={() => setIsModalOpen(false)}
        className="bg-white p-6 rounded-lg shadow-lg max-w-2xl mx-auto mt-20"
        overlayClassName="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center"
      >
        <h2 className="text-2xl font-semibold mb-4">Create New Assessment</h2>
        <form onSubmit={handleSubmit}>
          {/* Test Name */}
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">Test Name</label>
            <input
              type="text"
              name="test_name"
              value={formData.test_name}
              onChange={handleInputChange}
              className="w-full border p-2 rounded"
              required
            />
          </div>

          {/* Company */}
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">Company</label>
            <input
              type="text"
              name="company"
              value={formData.company}
              onChange={handleInputChange}
              className="w-full border p-2 rounded"
              required
            />
          </div>

          {/* Location */}
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">Location</label>
            <input
              type="text"
              name="location"
              value={formData.location}
              onChange={handleInputChange}
              className="w-full border p-2 rounded"
            />
          </div>

          {/* Required Degree */}
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">Required Degree</label>
            <input
              type="text"
              name="required_degree"
              value={formData.required_degree}
              onChange={handleInputChange}
              className="w-full border p-2 rounded"
            />
          </div>

          {/* Description */}
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">Description</label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              className="w-full border p-2 rounded"
            />
          </div>

          {/* Skills */}
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">Skills</label>
            {formData.skills.map((skill, index) => (
              <div key={index} className="flex mb-2">
                <input
                  type="text"
                  name="name"
                  value={skill.name}
                  onChange={(e) => handleSkillChange(index, e)}
                  placeholder="Skill name"
                  className="w-1/2 border p-2 rounded mr-2"
                  required
                />
                <select
                  name="priority"
                  value={skill.priority}
                  onChange={(e) => handleSkillChange(index, e)}
                  className="w-1/4 border p-2 rounded mr-2"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
                <button
                  type="button"
                  onClick={() => removeSkill(index)}
                  className="text-red-500"
                  disabled={formData.skills.length === 1}
                >
                  Remove
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={addSkill}
              className="text-blue-500"
            >
              Add Skill
            </button>
          </div>

          {/* Experience Range */}
          <div className="mb-4 flex">
            <div className="w-1/2 mr-2">
              <label className="block text-sm font-medium mb-1">Experience Min (years)</label>
              <input
                type="number"
                name="experience_min"
                value={formData.experience_min}
                onChange={handleInputChange}
                className="w-full border p-2 rounded"
                required
                min="0"
              />
            </div>
            <div className="w-1/2">
              <label className="block text-sm font-medium mb-1">Experience Max (years)</label>
              <input
                type="number"
                name="experience_max"
                value={formData.experience_max}
                onChange={handleInputChange}
                className="w-full border p-2 rounded"
                required
                min={formData.experience_min || 0}
              />
            </div>
          </div>

          {/* Duration */}
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">Duration (minutes)</label>
            <input
              type="number"
              name="duration"
              value={formData.duration}
              onChange={handleInputChange}
              className="w-full border p-2 rounded"
              required
              min="1"
            />
          </div>

          {/* Number of Questions */}
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">Number of Questions</label>
            <input
              type="number"
              name="num_questions"
              value={formData.num_questions}
              onChange={handleInputChange}
              className="w-full border p-2 rounded"
              required
              min="1"
            />
          </div>

          {/* Schedule */}
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">Schedule (ISO format)</label>
            <input
              type="datetime-local"
              name="schedule"
              value={formData.schedule ? formData.schedule.slice(0, 16) : ''}
              onChange={(e) => {
                const date = new Date(e.target.value);
                setFormData({ ...formData, schedule: date.toISOString() });
              }}
              className="w-full border p-2 rounded"
              required
            />
          </div>

          {/* Submit and Cancel Buttons */}
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="mr-4 text-gray-500"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
            >
              Create
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default RecruiterDashboard;
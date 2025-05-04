import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const CompleteProfile = () => {
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    location: '',
    linkedin: '',
    github: '',
    degree: '',
    years_of_experience: '',
    resume: null,
    profile_picture: null,
  });
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [candidate, setCandidate] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    // Fetch candidate data (mocked candidate_id=1 for now)
    fetch('http://localhost:5000/api/candidate/profile/1')
      .then((response) => response.json())
      .then((data) => {
        setCandidate(data);
        setFormData({
          name: data.name || '',
          phone: data.phone || '',
          location: data.location || '',
          linkedin: data.linkedin || '',
          github: data.github || '',
          degree: data.degree || '',
          years_of_experience: data.years_of_experience || '',
          resume: null,
          profile_picture: null,
        });
        // If profile is incomplete, enable editing mode by default
        if (!data.is_profile_complete) {
          setIsEditing(true);
        }
      })
      .catch((error) => {
        console.error('Error fetching candidate:', error);
        setError('Failed to load profile data.');
      });
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleFileChange = (e) => {
    const { name, files } = e.target;
    setFormData({ ...formData, [name]: files[0] });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const form = new FormData();
    for (const key in formData) {
      if (formData[key]) {
        form.append(key, formData[key]);
      }
    }

    fetch('http://localhost:5000/api/candidate/profile/1', {
      method: 'POST',
      body: form,
    })
      .then((response) => response.json())
      .then((data) => {
        if (data.message) {
          setSuccess('Profile updated successfully!');
          setIsEditing(false);
          // Refresh candidate data
          fetch('http://localhost:5000/api/candidate/profile/1')
            .then((res) => res.json())
            .then((updatedData) => setCandidate(updatedData));
          if (!candidate?.is_profile_complete) {
            navigate('/candidate/dashboard');
          }
        } else {
          setError(data.error || 'Failed to update profile.');
        }
      })
      .catch((error) => {
        console.error('Error updating profile:', error);
        setError('An error occurred while updating your profile.');
      });
  };

  if (!candidate) return <div>Loading...</div>;

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">
        {candidate.is_profile_complete ? 'Your Profile' : 'Complete Your Profile'}
      </h1>

      {error && (
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-6" role="alert">
          <p>{error}</p>
        </div>
      )}
      {success && (
        <div className="bg-green-100 border-l-4 border-green-500 text-green-700 p-4 mb-6" role="alert">
          <p>{success}</p>
        </div>
      )}

      <div className="bg-white p-6 rounded-lg shadow-md max-w-2xl mx-auto">
        {candidate.profile_picture && (
          <div className="mb-6">
            <img
              src={`http://localhost:5000/static/uploads/${candidate.profile_picture}`}
              alt="Profile Picture"
              className="w-24 h-24 rounded-full mx-auto"
              onError={(e) => {
                e.target.src = 'https://via.placeholder.com/96';
                e.target.alt = 'Failed to load profile picture';
              }}
            />
          </div>
        )}

        {isEditing ? (
          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">Name</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                className="w-full border p-2 rounded"
                required
              />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">Phone</label>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleInputChange}
                className="w-full border p-2 rounded"
                required
              />
            </div>
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
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">LinkedIn</label>
              <input
                type="url"
                name="linkedin"
                value={formData.linkedin}
                onChange={handleInputChange}
                className="w-full border p-2 rounded"
              />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">GitHub</label>
              <input
                type="url"
                name="github"
                value={formData.github}
                onChange={handleInputChange}
                className="w-full border p-2 rounded"
              />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">Degree</label>
              <input
                type="text"
                name="degree"
                value={formData.degree}
                onChange={handleInputChange}
                className="w-full border p-2 rounded"
              />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">Years of Experience</label>
              <input
                type="number"
                name="years_of_experience"
                value={formData.years_of_experience}
                onChange={handleInputChange}
                className="w-full border p-2 rounded"
                min="0"
                step="0.1"
                required
              />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">Resume</label>
              <input
                type="file"
                name="resume"
                onChange={handleFileChange}
                className="w-full border p-2 rounded"
                accept=".pdf"
              />
              {candidate.resume && (
                <p className="text-sm text-gray-600 mt-1">
                  Current: <a href={`http://localhost:5000/static/uploads/${candidate.resume}`} className="underline">View Resume</a>
                </p>
              )}
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">Profile Picture</label>
              <input
                type="file"
                name="profile_picture"
                onChange={handleFileChange}
                className="w-full border p-2 rounded"
                accept="image/*"
              />
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="mr-4 text-gray-500"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
              >
                Save Profile
              </button>
            </div>
          </form>
        ) : (
          <div>
            <div className="mb-4">
              <p><strong>Name:</strong> {candidate.name || 'Not provided'}</p>
            </div>
            <div className="mb-4">
              <p><strong>Phone:</strong> {candidate.phone || 'Not provided'}</p>
            </div>
            <div className="mb-4">
              <p><strong>Location:</strong> {candidate.location || 'Not provided'}</p>
            </div>
            <div className="mb-4">
              <p><strong>LinkedIn:</strong> {candidate.linkedin ? <a href={candidate.linkedin} className="underline">View LinkedIn</a> : 'Not provided'}</p>
            </div>
            <div className="mb-4">
              <p><strong>GitHub:</strong> {candidate.github ? <a href={candidate.github} className="underline">View GitHub</a> : 'Not provided'}</p>
            </div>
            <div className="mb-4">
              <p><strong>Degree:</strong> {candidate.degree || 'Not provided'}</p>
            </div>
            <div className="mb-4">
              <p><strong>Years of Experience:</strong> {candidate.years_of_experience || 'Not provided'}</p>
            </div>
            <div className="mb-4">
              <p><strong>Resume:</strong> {candidate.resume ? <a href={`http://localhost:5000/static/uploads/${candidate.resume}`} className="underline">View Resume</a> : 'Not provided'}</p>
            </div>
            <div className="flex justify-end">
              <button
                onClick={() => setIsEditing(true)}
                className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
              >
                Edit Profile
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CompleteProfile;
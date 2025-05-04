import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const CompleteProfile = () => {
  const [candidate, setCandidate] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    location: '',
    linkedin: '',
    github: '',
    degree: '',
    years_of_experience: '',
  });
  const [resume, setResume] = useState(null);
  const [profilePicture, setProfilePicture] = useState(null);
  const [message, setMessage] = useState({ text: '', type: '' });
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
        });
      })
      .catch((error) => console.error('Error fetching candidate:', error));
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleFileChange = (e) => {
    const { name, files } = e.target;
    if (name === 'resume') setResume(files[0]);
    if (name === 'profile_picture') setProfilePicture(files[0]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const data = new FormData();
    for (const key in formData) {
      data.append(key, formData[key]);
    }
    if (resume) data.append('resume', resume);
    if (profilePicture) data.append('profile_picture', profilePicture);

    try {
      const response = await fetch('http://localhost:5000/api/candidate/profile/1', {
        method: 'POST',
        body: data,
      });
      const result = await response.json();
      if (response.ok) {
        setMessage({ text: 'Profile updated successfully!', type: 'success' });
        navigate('/candidate/dashboard');
      } else {
        setMessage({ text: result.error || 'An error occurred while updating your profile.', type: 'error' });
      }
    } catch (error) {
      setMessage({ text: 'An error occurred while updating your profile.', type: 'error' });
    }
  };

  if (!candidate) return <div>Loading...</div>;

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Complete Your Profile</h1>
      {message.text && (
        <div
          className={`mb-4 p-4 rounded ${
            message.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
          }`}
        >
          {message.text}
        </div>
      )}
      <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg shadow-md">
        <div className="mb-4">
          <label htmlFor="name" className="block text-gray-700 font-semibold mb-2">
            Full Name
          </label>
          <input
            type="text"
            name="name"
            id="name"
            className="w-full p-2 border rounded"
            placeholder="e.g., John Doe"
            value={formData.name}
            onChange={handleChange}
            required
          />
        </div>
        <div className="mb-4">
          <label htmlFor="phone" className="block text-gray-700 font-semibold mb-2">
            Phone Number
          </label>
          <input
            type="text"
            name="phone"
            id="phone"
            className="w-full p-2 border rounded"
            placeholder="e.g., +1234567890"
            value={formData.phone}
            onChange={handleChange}
          />
        </div>
        <div className="mb-4">
          <label htmlFor="location" className="block text-gray-700 font-semibold mb-2">
            Location
          </label>
          <input
            type="text"
            name="location"
            id="location"
            className="w-full p-2 border rounded"
            placeholder="e.g., New York, NY"
            value={formData.location}
            onChange={handleChange}
          />
        </div>
        <div className="mb-4">
          <label htmlFor="linkedin" className="block text-gray-700 font-semibold mb-2">
            LinkedIn Profile
          </label>
          <input
            type="url"
            name="linkedin"
            id="linkedin"
            className="w-full p-2 border rounded"
            placeholder="e.g., https://linkedin.com/in/johndoe"
            value={formData.linkedin}
            onChange={handleChange}
          />
        </div>
        <div className="mb-4">
          <label htmlFor="github" className="block text-gray-700 font-semibold mb-2">
            GitHub Profile
          </label>
          <input
            type="url"
            name="github"
            id="github"
            className="w-full p-2 border rounded"
            placeholder="e.g., https://github.com/johndoe"
            value={formData.github}
            onChange={handleChange}
          />
        </div>
        <div className="mb-4">
          <label htmlFor="degree" className="block text-gray-700 font-semibold mb-2">
            Degree
          </label>
          <input
            type="text"
            name="degree"
            id="degree"
            className="w-full p-2 border rounded"
            placeholder="e.g., B.Tech in Computer Science"
            value={formData.degree}
            onChange={handleChange}
            required
          />
        </div>
        <div className="mb-4">
          <label htmlFor="years_of_experience" className="block text-gray-700 font-semibold mb-2">
            Years of Experience
          </label>
          <input
            type="number"
            step="0.1"
            name="years_of_experience"
            id="years_of_experience"
            className="w-full p-2 border rounded"
            placeholder="e.g., 3.5"
            value={formData.years_of_experience}
            onChange={handleChange}
            required
          />
        </div>
        <div className="mb-4">
          <label htmlFor="resume" className="block text-gray-700 font-semibold mb-2">
            Resume (PDF)
          </label>
          <input
            type="file"
            name="resume"
            id="resume"
            className="w-full p-2 border rounded"
            accept=".pdf"
            onChange={handleFileChange}
          />
        </div>
        <div className="mb-4">
          <label htmlFor="profile_picture" className="block text-gray-700 font-semibold mb-2">
            Profile Picture (Image)
          </label>
          <input
            type="file"
            name="profile_picture"
            id="profile_picture"
            className="w-full p-2 border rounded"
            accept="image/*"
            onChange={handleFileChange}
          />
        </div>
        <button type="submit" className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600">
          Save Profile
        </button>
      </form>
    </div>
  );
};

export default CompleteProfile;
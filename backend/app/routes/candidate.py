from flask import Blueprint, jsonify, request
import os
from app import db
from app.models.candidate import Candidate
from app.models.job import JobDescription
from app.models.assessment_attempt import AssessmentAttempt
from sqlalchemy.exc import IntegrityError
from datetime import datetime

candidate_api_bp = Blueprint('candidate_api', __name__, url_prefix='/api/candidate')

@candidate_api_bp.route('/profile/<int:candidate_id>', methods=['GET'])
def get_profile(candidate_id):
    candidate = Candidate.query.get_or_404(candidate_id)
    return jsonify({
        'candidate_id': candidate.candidate_id,
        'name': candidate.name,
        'email': candidate.email,
        'phone': candidate.phone,
        'location': candidate.location,
        'linkedin': candidate.linkedin,
        'github': candidate.github,
        'degree': candidate.degree,
        'years_of_experience': candidate.years_of_experience,
        'resume': candidate.resume,
        'profile_picture': candidate.profile_picture,
        'is_profile_complete': candidate.is_profile_complete
    })

@candidate_api_bp.route('/profile/<int:candidate_id>', methods=['POST'])
def update_profile(candidate_id):
    candidate = Candidate.query.get_or_404(candidate_id)

    try:
        # Handle form data
        candidate.name = request.form.get('name')
        candidate.phone = request.form.get('phone')
        candidate.location = request.form.get('location')
        candidate.linkedin = request.form.get('linkedin')
        candidate.github = request.form.get('github')
        candidate.degree = request.form.get('degree')
        candidate.years_of_experience = float(request.form.get('years_of_experience'))
        
        # Handle file uploads (resume and profile picture)
        resume_file = request.files.get('resume')
        profile_pic_file = request.files.get('profile_picture')
        
        if resume_file:
            resume_filename = f"resumes/{candidate_id}_{resume_file.filename}"
            resume_path = os.path.join('app/static/uploads', resume_filename)
            resume_file.save(resume_path)
            candidate.resume = resume_filename
        
        if profile_pic_file:
            profile_pic_filename = f"profile_pics/{candidate_id}_{profile_pic_file.filename}"
            profile_pic_path = os.path.join('app/static/uploads', profile_pic_filename)
            profile_pic_file.save(profile_pic_path)
            candidate.profile_picture = profile_pic_filename

        candidate.is_profile_complete = True
        db.session.commit()

        return jsonify({'message': 'Profile updated successfully'}), 200

    except IntegrityError as e:
        db.session.rollback()
        if 'phone' in str(e):
            return jsonify({'error': 'This phone number is already in use.'}), 400
        elif 'linkedin' in str(e):
            return jsonify({'error': 'This LinkedIn profile is already in use.'}), 400
        elif 'github' in str(e):
            return jsonify({'error': 'This GitHub profile is already in use.'}), 400
        else:
            return jsonify({'error': 'An error occurred while updating your profile.'}), 400
    except ValueError:
        return jsonify({'error': 'Please enter a valid number for years of experience.'}), 400

@candidate_api_bp.route('/eligible-assessments/<int:candidate_id>', methods=['GET'])
def get_eligible_assessments(candidate_id):
    candidate = Candidate.query.get_or_404(candidate_id)

    if not candidate.is_profile_complete:
        return jsonify([]), 200

    assessments = JobDescription.query.all()
    eligible_assessments = []

    for assessment in assessments:
        # Check years of experience
        experience_match = (assessment.experience_min <= candidate.years_of_experience <= assessment.experience_max)

        # Check degree (case-insensitive match, allowing for None in required_degree)
        degree_match = False
        if assessment.degree_required and candidate.degree:
            degree_match = assessment.degree_required.lower() == candidate.degree.lower()
        elif not assessment.degree_required:
            degree_match = True  # No degree required, so candidate is eligible

        if experience_match and degree_match:
            eligible_assessments.append({
                'job_id': assessment.job_id,
                'job_title': assessment.job_title,
                'company': assessment.company,
                'experience_min': assessment.experience_min,
                'experience_max': assessment.experience_max,
                'required_degree': assessment.degree_required,
                'schedule': assessment.schedule.isoformat() if assessment.schedule else None,
                'duration': assessment.duration,
                'num_questions': assessment.num_questions,
                'description': assessment.description if hasattr(assessment, 'description') else None
            })

    return jsonify(eligible_assessments), 200

@candidate_api_bp.route('/start-assessment', methods=['POST'])
def start_assessment():
    data = request.get_json()
    candidate_id = data.get('candidate_id')
    job_id = data.get('job_id')

    if not candidate_id or not job_id:
        return jsonify({'error': 'Missing candidate_id or job_id'}), 400

    # Create a new assessment attempt
    attempt = AssessmentAttempt(
        candidate_id=candidate_id,
        job_id=job_id,
        start_time=datetime.utcnow(),
        status='started'
    )
    db.session.add(attempt)
    db.session.commit()

    return jsonify({'attempt_id': attempt.attempt_id}), 200
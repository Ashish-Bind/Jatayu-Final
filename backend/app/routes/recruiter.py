from flask import Blueprint, jsonify, request
from app import db
from app.models.user import User
from app.models.job import JobDescription, RequiredSkill
from app.models.skill import Skill
from datetime import datetime
from app.services import question_batches

recruiter_bp = Blueprint('recruiter', __name__)

# Fetch past and active assessments
@recruiter_bp.route('/assessments', methods=['GET'])
def get_assessments():
    # Temporarily hardcode recruiter_id for testing (replace with session['user_id'] after login is implemented)
    recruiter_id = 1
    current_time = datetime.utcnow()

    # Fetch jobs (assessments) for the recruiter
    jobs = JobDescription.query.filter_by(recruiter_id=recruiter_id).all()

    # Categorize into past and active assessments
    past_assessments = []
    active_assessments = []
    for job in jobs:
        assessment = {
            'id': job.job_id,
            'test_name': job.job_title,
            'company': job.company,
            'schedule': job.schedule.isoformat(),
            'num_questions': job.num_questions,
            'duration': job.duration,
            'experience_min': job.experience_min,
            'experience_max': job.experience_max,
            'skills': [{'name': skill.skill.name, 'priority': skill.priority} for skill in job.required_skills]
        }
        if job.schedule < current_time:
            past_assessments.append(assessment)
        else:
            active_assessments.append(assessment)

    return jsonify({
        'past_assessments': past_assessments,
        'active_assessments': active_assessments
    })

# Create a new assessment
@recruiter_bp.route('/assessments', methods=['POST'])
def create_assessment():
    data = request.json
    # Temporarily hardcode recruiter_id for testing (replace with session['user_id'] after login is implemented)
    recruiter_id = 1

    # Validate required fields
    required_fields = ['test_name', 'skills', 'experience_min', 'experience_max', 
                       'duration', 'num_questions', 'schedule']
    for field in required_fields:
        if field not in data:
            return jsonify({"error": f"Missing required field: {field}"}), 400

    # Validate skills format
    if not isinstance(data['skills'], list) or not all('name' in skill and 'priority' in skill for skill in data['skills']):
        return jsonify({"error": "Skills must be a list of objects with 'name' and 'priority'"}), 400

    try:
        # Parse schedule
        schedule = datetime.fromisoformat(data['schedule'].replace('Z', '+00:00'))

        # Create new job description
        job = JobDescription(
            recruiter_id=recruiter_id,
            job_title=data['test_name'],
            company=data.get('company', ''),
            location=data.get('location'),
            experience_min=data['experience_min'],
            experience_max=data['experience_max'],
            degree_required=data.get('required_degree'),
            description=data.get('description'),
            duration=data['duration'],
            num_questions=data['num_questions'],
            schedule=schedule
        )
        db.session.add(job)
        db.session.flush()  # Get job.job_id before committing

        # Add skills (create new skills if they don't exist)
        for skill_data in data['skills']:
            # Map priority (low: 1-2, medium: 3, high: 4-5)
            priority_map = {'low': 2, 'medium': 3, 'high': 5}
            priority = priority_map.get(skill_data['priority'].lower())
            if not priority:
                raise ValueError(f"Invalid priority: {skill_data['priority']}. Must be 'low', 'medium', or 'high'.")

            # Check if skill exists, otherwise create it
            skill = Skill.query.filter_by(name=skill_data['name']).first()
            if not skill:
                skill = Skill(name=skill_data['name'], category='technical')
                db.session.add(skill)
                db.session.flush()

            required_skill = RequiredSkill(
                job_id=job.job_id,
                skill_id=skill.skill_id,
                priority=priority
            )
            db.session.add(required_skill)

        db.session.commit()

        # Trigger question generation
        try:
            skills_with_priorities = [
                {"name": skill_data['name'], "priority": priority_map[skill_data['priority'].lower()]}
                for skill_data in data['skills']
            ]
            jd_experience_range = f"{data['experience_min']}-{data['experience_max']}"
            question_batches.prepare_question_batches(skills_with_priorities, jd_experience_range, job.job_id)
        except Exception as e:
            print(f"⚠️ Error generating questions: {e}")
            # Continue even if question generation fails (assessment is still created)
            pass

        return jsonify({"message": "Assessment created successfully", "job_id": job.job_id}), 201

    except ValueError as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500
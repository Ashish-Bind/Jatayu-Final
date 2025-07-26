from flask import Blueprint, jsonify, request, session
from app import db, mail
from app.models.candidate import Candidate
from app.models.job import JobDescription
from app.models.required_skill import RequiredSkill
from app.models.assessment_attempt import AssessmentAttempt
from app.models.assessment_registration import AssessmentRegistration
from app.models.skill import Skill
from app.models.candidate_skill import CandidateSkill
from app.models.assessment_state import AssessmentState
from app.models.degree import Degree
from app.models.degree_branch import DegreeBranch
from app.models.resume_json import ResumeJson
from app.models.recruiter import Recruiter
from sqlalchemy.exc import IntegrityError
from datetime import datetime, timezone, timedelta
from app.utils.gcs_upload import upload_to_gcs
from flask_mail import Message
from google.cloud import storage
import os
import re
import difflib
import pytz
import google.generativeai as genai
import logging
from io import BytesIO
from pdfminer.high_level import extract_text
from sqlalchemy.orm import joinedload
import json
import random
import string
from app.utils.face import compare_faces_from_files
import requests
from io import BytesIO

candidate_api_bp = Blueprint('candidate_api', __name__, url_prefix='/api/candidate')

# Configure logging
logging.basicConfig(level=logging.DEBUG, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Configure Gemini API
genai.configure(api_key=os.getenv('GOOGLE_API_KEY'))

def send_otp_email(email, otp):
    """Send OTP to the candidate's email using flask_mail."""
    try:
        msg = Message(
            subject='Profile Verification OTP',
            sender=os.getenv('MAIL_DEFAULT_SENDER'),
            recipients=[email],
            body=f"Your OTP for profile verification is: {otp}\nThis OTP is valid for 10 minutes."
        )
        mail.send(msg)
        logger.debug(f"OTP sent to {email}")
        return True
    except Exception as e:
        logger.error(f"Failed to send OTP to {email}: {str(e)}")
        return False

def generate_otp(length=6):
    """Generate a random OTP."""
    return ''.join(random.choices(string.digits, k=length))

def is_valid_pdf(file):
    """Check if the file is a valid PDF by verifying its magic number."""
    try:
        file.seek(0)
        magic = file.read(5)
        file.seek(0)
        return magic == b'%PDF-'
    except Exception:
        return False

def extract_text_from_pdf(pdf_file):
    try:
        if hasattr(pdf_file, 'read'):
            if not is_valid_pdf(pdf_file):
                raise ValueError("The uploaded file is not a valid PDF.")
            pdf_content = pdf_file.read()
            pdf_file.seek(0)
            pdf_stream = BytesIO(pdf_content)
            text = extract_text(pdf_stream)
        else:
            raise ValueError("pdf_file must be a file-like object with a read method.")
        return text
    except Exception:
        return None

def analyze_resume(resume_text):
    try:
        model = genai.GenerativeModel('gemini-1.5-flash')
        prompt = f"""
You are a JSON assistant. Extract and return ONLY valid JSON in the following format (no comments or explanations):

{{
  "name": "",
  "phone": "",
  "Skills": {{
    "Technical Skills": [],
    "Soft Skills": [],
    "Tools": []
  }},
  "Work Experience": [
    {{
      "Company": "",
      "Title": "",
      "Start Date": "",
      "End Date": "",
      "Description": "",
      "Technologies": ""
    }}
  ],
  "Projects": [
    {{
      "Title": "",
      "Description": "",
      "Technologies": ""
    }}
  ],
  "Education": [
    {{
      "Degree": "",
      "Institution": "",
      "Graduation Year": 0,
      "Certification": false
    }}
  ]
}}

Extract information from the resume as follows:
- Extract the candidate's full name and store it in "name".
- Extract the phone number and store it in "phone". Include the country code if present (e.g., +91).
- Under "Skills", categorize into "Technical Skills", "Soft Skills", and "Tools".
- Under "Work Experience", include each job with "Start Date" and "End Date" in "YYYY-MM" format. Use "Present" for ongoing roles.
- Under "Projects", list each project with its "Title", "Description", and "Technologies".
- Infer technologies for both "Work Experience" and "Projects":
  - If "Jupyter Notebook", "Google Collab", "Flask", or "Jupyter" is mentioned, include "Python".
  - If React is mentioned, include "JavaScript".
  - If terms like "deep learning", "reinforcement learning", "AIML", or "AI" are mentioned, include "Artificial Intelligence" and "Machine Learning".
  - If terms like "data structures", "algorithms", or "programming" are mentioned, include "Python" or "Java" if specified.
- Include skills like "Excel Pivoting" and "GitHub" in "Technical Skills" if mentioned.

Resume:
{resume_text}
        """
        response = model.generate_content(prompt)
        return response.text
    except Exception:
        return None

def parse_json_output(json_string):
    try:
        if not json_string:
            return None
        cleaned = json_string.strip().removeprefix("```json").removesuffix("```").strip()
        result = json.loads(cleaned)
        return result
    except json.JSONDecodeError as e:
        logger.error(f"JSON parsing error: {str(e)}")
        return None
    except Exception as e:
        logger.error(f"Unexpected error in parse_json_output: {str(e)}")
        return None

def normalize_phone_number(phone):
    if not phone:
        return None
    cleaned = re.sub(r'[^\d+]', '', phone)
    if cleaned.startswith('+91'):
        return cleaned
    elif cleaned.startswith('+'):
        return '+91' + cleaned[3:]
    else:
        return '+91' + cleaned

def compare_strings(str1, str2, threshold=0.8):
    if not str1 or not str2:
        return False
    str1 = str1.lower().strip()
    str2 = str2.lower().strip()
    similarity = difflib.SequenceMatcher(None, str1, str2).ratio()
    return similarity >= threshold

def calculate_total_experience(work_experience):
    """Calculate total work experience in years, handling overlaps."""
    if not work_experience:
        return 0.0

    intervals = []
    current_date = datetime.now(timezone.utc)

    for exp in work_experience:
        start_date_str = exp.get('Start Date', '')
        end_date_str = exp.get('End Date', '')

        try:
            if end_date_str.lower() == 'present':
                end_date = current_date
            else:
                if len(end_date_str) == 4:
                    end_date = datetime(int(end_date_str), 12, 31, tzinfo=timezone.utc)
                else:
                    end_date = datetime.strptime(end_date_str, '%Y-%m').replace(tzinfo=timezone.utc)

            if len(start_date_str) == 4:
                start_date = datetime(int(start_date_str), 1, 1, tzinfo=timezone.utc)
            else:
                start_date = datetime.strptime(start_date_str, '%Y-%m').replace(tzinfo=timezone.utc)

            if start_date > end_date:
                continue

            intervals.append((start_date, end_date))
        except ValueError:
            continue

    if not intervals:
        return 0.0

    intervals.sort(key=lambda x: x[0])
    merged = []
    current_start, current_end = intervals[0]

    for start, end in intervals[1:]:
        if start <= current_end:
            current_end = max(current_end, end)
        else:
            merged.append((current_start, current_end))
            current_start, current_end = start, end
    merged.append((current_start, current_end))

    total_days = sum((end - start).days for start, end in merged)
    total_years = total_days / 365.25
    return round(total_years, 2)

def infer_proficiency(skill, work_experience, education, projects):
    score = 0
    skill_lower = skill.lower()
    strong_keywords = ["developed", "built", "implemented", "designed", "used", "created", "led", "integrated", "deployed"]
    related_terms = {
        "artificial intelligence": ["ai", "aiml", "reinforcement learning", "deep learning"],
        "machine learning": ["ml", "aiml", "deep learning", "reinforcement learning"],
        "python": ["jupyter notebook", "google collab", "flask", "jupyter"],
        "javascript": ["react", "ajax"]
    }

    for exp in work_experience:
        combined = (str(exp.get("Title", "")) + " " + str(exp.get("Description", "")) + " " + str(exp.get("Technologies", ""))).lower()
        skill_found = False
        if skill_lower in combined:
            score += 2
            skill_found = True
        for related_term in related_terms.get(skill_lower, []):
            if related_term in combined:
                score += 2
                skill_found = True
                break
        if skill_found and any(kw in combined for kw in strong_keywords):
            score += 2
        if combined.count(skill_lower) >= 2:
            score += 1

    for proj in projects:
        proj_text = (str(proj.get("Title", "")) + " " + str(proj.get("Description", "")) + " " + str(proj.get("Technologies", ""))).lower()
        skill_found = False
        if skill_lower in proj_text:
            score += 2
            skill_found = True
        for related_term in related_terms.get(skill_lower, []):
            if related_term in proj_text:
                score += 2
                skill_found = True
                break
        if skill_found and any(kw in proj_text for kw in strong_keywords):
            score += 2
        if proj_text.count(skill_lower) >= 2:
            score += 1

    for edu in education:
        edu_text = (str(edu.get("Degree", "")) + " " + str(edu.get("Institution", ""))).lower()
        skill_found = False
        if skill_lower in edu_text:
            score += 1
            skill_found = True
        for related_term in related_terms.get(skill_lower, []):
            if related_term in edu_text:
                score += 1
                skill_found = True
                break
        if skill_found and "certification" in edu_text:
            score += 2

    if score >= 5:
        proficiency = 8
    elif score >= 2:
        proficiency = 6
    else:
        proficiency = 4
    return proficiency

@candidate_api_bp.route('/auth/send-otp', methods=['POST'])
def send_otp():
    """Send OTP to candidate's email."""
    data = request.get_json()
    user_id = data.get('user_id')
    if not user_id:
        return jsonify({'error': 'Missing user_id'}), 400

    candidate = Candidate.query.filter_by(user_id=user_id).first_or_404()
    if not candidate.email:
        return jsonify({'error': 'No email associated with this candidate'}), 400

    otp = generate_otp()
    session['otp'] = otp
    session['otp_expiry'] = (datetime.now(timezone.utc) + timedelta(minutes=10)).timestamp()
    session['otp_user_id'] = user_id

    if send_otp_email(candidate.email, otp):
        return jsonify({'message': 'OTP sent to your email'}), 200
    else:
        return jsonify({'error': 'Failed to send OTP. Please try again.'}), 500

@candidate_api_bp.route('/auth/verify-otp', methods=['POST'])
def verify_otp():
    """Verify OTP entered by candidate."""
    data = request.get_json()
    user_id = data.get('user_id')
    otp = data.get('otp')

    if not user_id or not otp:
        return jsonify({'error': 'Missing user_id or OTP'}), 400

    if 'otp' not in session or 'otp_expiry' not in session or 'otp_user_id' not in session:
        return jsonify({'error': 'No OTP session found. Please request a new OTP.'}), 400

    if session['otp_user_id'] != user_id:
        return jsonify({'error': 'Invalid user for this OTP session.'}), 400

    if datetime.now(timezone.utc).timestamp() > session['otp_expiry']:
        session.pop('otp', None)
        session.pop('otp_expiry', None)
        session.pop('otp_user_id', None)
        return jsonify({'error': 'OTP has expired. Please request a new OTP.'}), 400

    if session['otp'] != otp:
        return jsonify({'error': 'Invalid OTP.'}), 400

    # Clear the requires_otp_verification flag
    candidate = Candidate.query.filter_by(user_id=user_id).first_or_404()
    candidate.requires_otp_verification = False
    session['otp_verified'] = True
    session.pop('otp', None)
    session.pop('otp_expiry', None)
    session.pop('otp_user_id', None)

    try:
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error clearing requires_otp_verification: {str(e)}")
        return jsonify({'error': 'Failed to verify OTP due to a server error.'}), 500

    return jsonify({'message': 'OTP verified successfully'}), 200

@candidate_api_bp.route('/profile/<int:user_id>', methods=['GET'])
def get_profile_by_user(user_id):
    candidate = Candidate.query.filter_by(user_id=user_id).first_or_404()

    skills = [
        {
            'skill_id': cs.skill_id,
            'skill_name': cs.skill.name,
            'category': cs.skill.category,
            'proficiency': cs.proficiency
        }
        for cs in candidate.candidate_skills
    ]

    return jsonify({
        'candidate_id': candidate.candidate_id,
        'name': candidate.name,
        'email': candidate.email,
        'phone': candidate.phone,
        'location': candidate.location,
        'linkedin': candidate.linkedin,
        'github': candidate.github,
        'degree': candidate.degree.degree_name if candidate.degree else None,
        'degree_branch': candidate.branch.branch_name if candidate.branch else None,
        'branch_id': candidate.degree_branch if candidate.degree_branch else None,
        'degree_id': candidate.degree_id,
        'passout_year': candidate.passout_year,
        'years_of_experience': candidate.years_of_experience,
        'resume': candidate.resume,
        'profile_picture': candidate.profile_picture,
        'camera_image': candidate.camera_image,
        'is_profile_complete': candidate.is_profile_complete,
        'skills': skills,
        'requires_otp_verification': candidate.requires_otp_verification
    })

@candidate_api_bp.route('/degrees', methods=['GET'])
def get_degrees():
    """Retrieve the list of available degrees."""
    degrees = Degree.query.all()
    return jsonify([
        {'degree_id': degree.degree_id, 'degree_name': degree.degree_name}
        for degree in degrees
    ])

@candidate_api_bp.route('/branches', methods=['GET'])
def get_branches():
    """Retrieve the list of available degree branches."""
    branches = DegreeBranch.query.all()
    return jsonify([
        {'branch_id': branch.branch_id, 'branch_name': branch.branch_name}
        for branch in branches
    ])

def verify_faces(profile_file, webcam_file):
    try:
        result = compare_faces_from_files(profile_file, webcam_file)

        confidence = result.get("confidence")

        if confidence is not None:
            similarity = max(0.0, 100 - float(confidence))
        else:
            similarity = 0.0

        return {
            'verified': result.get("verified", False),
            'similarity': round(similarity, 2)
        }

    except Exception as e:
        print("Face comparison error:", str(e))
        return {'verified': False, 'similarity': 0.0}


@candidate_api_bp.route('/verify-face', methods=['POST'])
def verify_face():
    try:
        webcam_image_file = request.files.get('webcam_image')

        if 'user_id' not in session or not webcam_image_file:
            return jsonify({'success': False, 'error': 'No user logged in or webcam image'}), 400

        # Fetch user and profile picture
        candidate = Candidate.query.filter_by(user_id=session['user_id']).first()
        if not candidate or not candidate.profile_picture:
            return jsonify({'success': False, 'error': 'User or profile picture not found'}), 404

        profile_image_url = f'https://storage.googleapis.com/gen-ai-quiz/uploads/{candidate.profile_picture}'
        response = requests.get(profile_image_url)
        profile_image = BytesIO(response.content)
        profile_image.name = 'profile.jpg'

        # Ensure file pointers are reset
        profile_image.seek(0)
        webcam_image_file.seek(0)

        # Call custom face comparison
        result = verify_faces(profile_image, webcam_image_file)

        return jsonify({
            'success': result['verified'],
            'similarity': result['similarity']
        }), 200

    except Exception as e:
        print("Face verification API error:", str(e))
        return jsonify({'success': False, 'error': str(e)}), 500
    

@candidate_api_bp.route('/profile/<int:user_id>', methods=['POST'])
def update_profile(user_id):
    candidate = Candidate.query.filter_by(user_id=user_id).first_or_404()

    # Check if OTP verification is required and verified
    logger.debug(f"📸 Requires OTP Verification: {candidate.requires_otp_verification}, Session OTP Verified: {session.get('otp_verified')}")

    if candidate.requires_otp_verification and session.get('otp_verified', False) is not True:
        logger.debug(f"❌ OTP verification required but not verified for user_id={user_id}")
        return jsonify({'error': 'OTP verification required. Please verify OTP before updating profile.'}), 403

    form_name = request.form.get('name')
    form_phone = request.form.get('phone')
    form_experience = request.form.get('years_of_experience')
    form_location = request.form.get('location')
    form_linkedin = request.form.get('linkedin')
    form_github = request.form.get('github')
    form_degree_id = request.form.get('degree_id')
    form_degree_branch = request.form.get('degree_branch')
    form_passout_year = request.form.get('passout_year')
    resume_file = request.files.get('resume')
    profile_pic_file = request.files.get('profile_picture')
    webcam_image_file = request.files.get('webcam_image')

    if not form_name or not form_experience or not form_degree_id:
        return jsonify({'error': 'Name, years of experience, and degree are required.'}), 400
    try:
        form_experience = float(form_experience)
        form_degree_id = int(form_degree_id)
        form_degree_branch = int(form_degree_branch) if form_degree_branch else None
        form_passout_year = int(form_passout_year) if form_passout_year else None
        current_year = datetime.now(timezone.utc).year
        if form_passout_year and not (1900 <= form_passout_year <= current_year + 5):
            return jsonify({'error': f'Passout year must be between 1900 and {current_year + 5}.'}), 400
    except ValueError:
        return jsonify({'error': 'Years of experience must be a number, and degree_id/degree_branch/passout_year must be valid.'}), 400

    # Validate degree_id and degree_branch
    if not Degree.query.get(form_degree_id):
        return jsonify({'error': 'Invalid degree selected.'}), 400
    if form_degree_branch and not DegreeBranch.query.get(form_degree_branch):
        return jsonify({'error': 'Invalid degree branch selected.'}), 400

    try:
        # Validate name and phone against resume data
        parsed_data = None
        resume_json_entry = ResumeJson.query.filter_by(candidate_id=candidate.candidate_id).order_by(ResumeJson.created_at.desc()).first()

        if resume_file:
            resume_text = extract_text_from_pdf(resume_file)
            if not resume_text:
                return jsonify({'error': 'Failed to extract text from resume. Ensure it is a valid PDF.'}), 400

            gemini_output = analyze_resume(resume_text)
            if not gemini_output:
                return jsonify({'error': 'Failed to parse resume with Gemini API.'}), 400

            parsed_data = parse_json_output(gemini_output)
            if not parsed_data:
                return jsonify({'error': 'Failed to parse Gemini API output.'}), 400

            # Store the JSON string in resume_json table
            cleaned_resume_string = json.dumps(parsed_data)
            if resume_json_entry:
                resume_json_entry.raw_resume = cleaned_resume_string
            else:
                resume_json_entry = ResumeJson(
                    candidate_id=candidate.candidate_id,
                    raw_resume=cleaned_resume_string
                )
                db.session.add(resume_json_entry)

            # Upload new resume to GCS
            resume_file.seek(0)
            resume_filename = f"uploads/resumes/{candidate.candidate_id}_{resume_file.filename}"
            resume_url = upload_to_gcs(resume_file, resume_filename, content_type='application/pdf')
            candidate.resume = resume_filename
        elif candidate.resume:
            try:
                storage_client = storage.Client()
                bucket = storage_client.bucket('gen-ai-quiz')
                gcs_paths = [
                    f"uploads/{candidate.resume}" if not candidate.resume.startswith('uploads/') else candidate.resume,
                    candidate.resume
                ]
                blob = None
                gcs_resume_path = None

                for path in gcs_paths:
                    logger.debug(f"Attempting to fetch resume from GCS: gs://gen-ai-quiz/{path}")
                    blob = bucket.get_blob(path)
                    if blob:
                        gcs_resume_path = path
                        break

                if not blob:
                    logger.error(f"Resume not found in GCS at paths: {', '.join(gcs_paths)}")
                    return jsonify({'error': 'Resume not found in storage. Please upload a new resume.'}), 404

                resume_content = BytesIO()
                blob.download_to_file(resume_content)
                resume_content.seek(0)
                logger.debug(f"Successfully downloaded resume from gs://gen-ai-quiz/{gcs_resume_path}")

                resume_text = extract_text_from_pdf(resume_content)
                if not resume_text:
                    logger.error(f"Failed to extract text from resume at {gcs_resume_path}")
                    return jsonify({'error': 'Failed to extract text from stored resume.'}), 400

                gemini_output = analyze_resume(resume_text)
                if not gemini_output:
                    logger.error(f"Failed to parse resume with Gemini API for {gcs_resume_path}")
                    return jsonify({'error': 'Failed to parse stored resume with Gemini API.'}), 400

                parsed_data = parse_json_output(gemini_output)
                if not parsed_data:
                    logger.error(f"Failed to parse Gemini API output for {gcs_resume_path}")
                    return jsonify({'error': 'Failed to parse Gemini API output for stored resume.'}), 400

                cleaned_resume_string = json.dumps(parsed_data)
                if resume_json_entry:
                    resume_json_entry.raw_resume = cleaned_resume_string
                else:
                    resume_json_entry = ResumeJson(
                        candidate_id=candidate.candidate_id,
                        raw_resume=cleaned_resume_string
                    )
                    db.session.add(resume_json_entry)
            except Exception as e:
                logger.error(f"Error loading resume from GCS: {str(e)}")
                return jsonify({'error': f'Error loading resume from storage: {str(e)}'}), 500
        else:
            return jsonify({'error': 'No resume found. Please upload a resume.'}), 400

        resume_name = parsed_data.get("name", "")
        resume_phone = normalize_phone_number(parsed_data.get("phone", ""))
        if not compare_strings(form_name, resume_name):
            return jsonify({'error': 'Name in form does not match resume name (80% similarity required). Please verify.'}), 400
        if resume_phone and form_phone and resume_phone != normalize_phone_number(form_phone):
            return jsonify({'error': 'Phone number in form does not match resume. Please verify.'}), 400

        resume_experience = calculate_total_experience(parsed_data.get("Work Experience", []))
        if form_experience > 0 and resume_experience == 0:
            return jsonify({'error': 'No work experience found in resume, but form claims experience. Please verify.'}), 400
        elif form_experience > 0:
            min_allowed = 0.8 * form_experience
            if not (min_allowed <= resume_experience):
                return jsonify({
                    'error': f'Resume experience ({resume_experience:.2f} years) does not match form input ({form_experience:.2f} years). It should be at least 80% of the stated experience.'
                }), 400

        candidate.name = form_name
        candidate.phone = normalize_phone_number(form_phone)
        candidate.location = form_location
        candidate.linkedin = form_linkedin
        candidate.github = form_github
        candidate.degree_id = form_degree_id
        candidate.degree_branch = form_degree_branch
        candidate.passout_year = form_passout_year
        candidate.years_of_experience = form_experience

        if resume_file:
            skills_data = parsed_data.get("Skills", {})
            work_experience = parsed_data.get("Work Experience", [])
            projects = parsed_data.get("Projects", [])
            education = parsed_data.get("Education", [])

            all_skills = (
                skills_data.get("Technical Skills", []) +
                skills_data.get("Soft Skills", []) +
                skills_data.get("Tools", [])
            )

            for skill_name in all_skills:
                skill_name = skill_name.strip()
                if not skill_name:
                    continue

                skill = Skill.query.filter_by(name=skill_name).first()
                if not skill:
                    skill = Skill(name=skill_name, category='technical')
                    db.session.add(skill)
                    db.session.flush()

                proficiency = infer_proficiency(skill_name, work_experience, education, projects)

                existing_skill = CandidateSkill.query.filter_by(
                    candidate_id=candidate.candidate_id,
                    skill_id=skill.skill_id
                ).first()

                if existing_skill:
                    existing_skill.proficiency = proficiency
                else:
                    candidate_skill = CandidateSkill(
                        candidate_id=candidate.candidate_id,
                        skill_id=skill.skill_id,
                        proficiency=proficiency
                    )
                    db.session.add(candidate_skill)

        if profile_pic_file:
            profile_pic_filename = f"uploads/profile_pics/{candidate.candidate_id}_{profile_pic_file.filename}"
            profile_pic_url = upload_to_gcs(profile_pic_file, profile_pic_filename, content_type='image/jpeg')
            candidate.profile_picture = profile_pic_filename

        if webcam_image_file:
            webcam_image_filename = f"uploads/webcam_images/{candidate.candidate_id}_{webcam_image_file.filename}"
            webcam_image_url = upload_to_gcs(webcam_image_file, webcam_image_filename, content_type='image/jpeg')
            candidate.camera_image = webcam_image_filename

        candidate.is_profile_complete = True
        candidate.requires_otp_verification = False  # Clear the flag after successful update
        db.session.add(candidate)
        db.session.commit()

        # Clear OTP verification status and related session data after successful update
        session.pop('otp_verified', None)
        session.pop('enforce_otp_verification', None)
        session.pop('otp', None)
        session.pop('otp_expiry', None)
        session.pop('otp_user_id', None)

        logger.debug(f"✅ Profile updated successfully for candidate_id={candidate.candidate_id}")
        return jsonify({
            'message': 'Profile updated successfully',
            'parsed_data': {
                'name': parsed_data.get('name', ''),
                'phone': parsed_data.get('phone', '')
            }
        }), 200

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
    except ValueError as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        db.session.rollback()
        logger.error(f"❌ Unexpected error: {str(e)}")
        return jsonify({'error': f'An unexpected error occurred: {str(e)}'}), 500

@candidate_api_bp.route('/eligible-assessments/<int:user_id>', methods=['GET'])
def get_eligible_assessments(user_id):
    """Retrieve eligible and all assessments for a candidate."""
    candidate = Candidate.query.filter_by(user_id=user_id).first_or_404()

    current_time = datetime.now(pytz.UTC)

    assessments = JobDescription.query.options(
        joinedload(JobDescription.required_skills).joinedload(RequiredSkill.skill),
        joinedload(JobDescription.degree),
        joinedload(JobDescription.branch)
    ).all()
    eligible_assessments = []
    all_assessments = []
    attempted_assessments = set()

    attempts = AssessmentAttempt.query.filter_by(candidate_id=candidate.candidate_id).all()
    for attempt in attempts:
        if attempt.status in ['started', 'completed']:
            attempted_assessments.add(attempt.job_id)

    for assessment in assessments:
        schedule_start = assessment.schedule_start
        if schedule_start and schedule_start.tzinfo is None:
            schedule_start = schedule_start.replace(tzinfo=pytz.UTC)
        schedule_end = assessment.schedule_end
        if schedule_end and schedule_end.tzinfo is None:
            schedule_end = schedule_end.replace(tzinfo=pytz.UTC)

        if schedule_end and current_time > schedule_end:
            has_attempt = AssessmentAttempt.query.filter_by(
                candidate_id=candidate.candidate_id,
                job_id=assessment.job_id
            ).first() is not None
            if not has_attempt:
                continue

        experience_match = (
            assessment.experience_min <= candidate.years_of_experience <= assessment.experience_max
        )
        degree_match = (
            not assessment.degree_required or
            (candidate.degree_id and assessment.degree_required == candidate.degree_id)
        )
        branch_match = (
            not assessment.degree_branch or
            (candidate.degree_branch and assessment.degree_branch == candidate.degree_branch)
        )
        passout_year_match = (
            not assessment.passout_year_required or
            not assessment.passout_year or
            (candidate.passout_year and assessment.passout_year == candidate.passout_year)
        )

        recruiter = Recruiter.query.filter_by(recruiter_id=assessment.recruiter_id).first()
        logo = recruiter.logo if recruiter else None

        assessment_data = {
            'job_id': assessment.job_id,
            'job_title': assessment.job_title,
            'company': assessment.company,
            'logo': logo,
            'experience_min': assessment.experience_min,
            'experience_max': assessment.experience_max,
            'degree_required': assessment.degree.degree_name if assessment.degree else None,
            'degree_branch': assessment.branch.branch_name if assessment.branch else None,
            'passout_year': assessment.passout_year,
            'passout_year_required': assessment.passout_year_required,
            'schedule_start': schedule_start.isoformat() if schedule_start else None,
            'schedule_end': schedule_end.isoformat() if schedule_end else None,
            'duration': assessment.duration,
            'num_questions': assessment.num_questions,
            'job_description': assessment.job_description if hasattr(assessment, 'job_description') else None,
            'is_registered': AssessmentRegistration.query.filter_by(
                candidate_id=candidate.candidate_id,
                job_id=assessment.job_id
            ).first() is not None,
            'skills': [
                {'name': rs.skill.name, 'priority': rs.priority}
                for rs in assessment.required_skills
            ],
            'is_eligible': experience_match and degree_match and branch_match and passout_year_match and assessment.job_id not in attempted_assessments
        }

        all_assessments.append(assessment_data)
        if assessment_data['is_eligible'] and candidate.is_profile_complete:
            eligible_assessments.append(assessment_data)

    attempted_assessments_data = []
    for attempt in attempts:
        if attempt.status in ['started', 'completed']:
            job = JobDescription.query.get(attempt.job_id)
            if job:
                attempted_assessments_data.append({
                    'job_id': job.job_id,
                    'job_title': job.job_title,
                    'company': job.company,
                    'logo': logo,
                    'attempt_id': attempt.attempt_id,
                    'status': attempt.status,
                    'attempt_date': attempt.start_time.isoformat() if attempt.start_time else None
                })

    response = {
        'eligible_assessments': eligible_assessments,
        'all_assessments': all_assessments,
        'attempted_assessments': attempted_assessments_data
    }
    return jsonify(response), 200

@candidate_api_bp.route('/register-assessment', methods=['POST'])
def register_assessment():
    """Register a candidate for an assessment."""
    data = request.get_json()
    candidate_id = data.get('candidate_id')
    job_id = data.get('job_id')

    if not candidate_id or not job_id:
        return jsonify({'error': 'Missing candidate_id or job_id'}), 400

    candidate = Candidate.query.filter_by(user_id=candidate_id).first_or_404()
    job = JobDescription.query.get_or_404(job_id)

    experience_match = (
        job.experience_min <= candidate.years_of_experience <= job.experience_max
    )
    degree_match = (
        not job.degree_required or
        (candidate.degree_id and job.degree_required == candidate.degree_id)
    )
    branch_match = (
        not job.degree_branch or
        (candidate.degree_branch and job.degree_branch == candidate.degree_branch)
    )
    passout_year_match = (
        not job.passout_year_required or
        not job.passout_year or
        (candidate.passout_year and job.passout_year == candidate.passout_year)
    )

    if not (experience_match and degree_match and branch_match and passout_year_match):
        return jsonify({
            'error': 'You are not eligible for this job. Please update your profile to meet the requirements.',
            'requirements': {
                'experience_min': job.experience_min,
                'experience_max': job.experience_max,
                'degree_required': job.degree.degree_name if job.degree else None,
                'degree_branch': job.branch.branch_name if job.branch else None,
                'passout_year': job.passout_year if job.passout_year_required else None
            }
        }), 403

    existing_registration = AssessmentRegistration.query.filter_by(
        candidate_id=candidate.candidate_id,
        job_id=job_id
    ).first()
    if existing_registration:
        return jsonify({'error': 'Already registered for this assessment'}), 400

    registration = AssessmentRegistration(
        candidate_id=candidate.candidate_id,
        job_id=job_id,
        registration_date=datetime.now(timezone.utc)
    )
    db.session.add(registration)
    try:
        db.session.commit()
    except IntegrityError as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to register: Invalid data ({str(e)})'}), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to register: {str(e)}'}), 500

    return jsonify({'message': 'Successfully registered for assessment'}), 200

@candidate_api_bp.route('/start-assessment', methods=['POST'])
def start_assessment():
    """Start a new assessment attempt for a candidate."""
    data = request.get_json()
    user_id = data.get('user_id')
    job_id = data.get('job_id')

    candidate = Candidate.query.filter_by(user_id=user_id).first_or_404()
    candidate_id = candidate.candidate_id

    if not candidate_id or not job_id:
        return jsonify({'error': 'Missing candidate_id or job_id'}), 400

    registration = AssessmentRegistration.query.filter_by(
        candidate_id=candidate_id,
        job_id=job_id
    ).first()
    if not registration:
        return jsonify({'error': 'Candidate not registered for this assessment'}), 403

    job = JobDescription.query.get_or_404(job_id)
    current_time = datetime.now(timezone.utc)
    schedule_start = job.schedule_start
    if schedule_start and schedule_start.tzinfo is None:
        schedule_start = schedule_start.replace(tzinfo=pytz.UTC)
    schedule_end = job.schedule_end
    if schedule_end and schedule_end.tzinfo is None:
        schedule_end = schedule_end.replace(tzinfo=pytz.UTC)

    if schedule_start and current_time < schedule_start:
        return jsonify({'error': f'Assessment not yet started. Scheduled for {schedule_start.isoformat()}'}), 403
    if schedule_end and current_time > schedule_end:
        return jsonify({'error': f'Assessment period has ended. Ended at {schedule_end.isoformat()}'}), 403

    existing_attempt = AssessmentAttempt.query.filter_by(
        candidate_id=candidate_id,
        job_id=job_id,
        status='started'
    ).first()
    if existing_attempt:
        return jsonify({'attempt_id': existing_attempt.attempt_id}), 200

    attempt = AssessmentAttempt(
        candidate_id=candidate_id,
        job_id=job_id,
        start_time=datetime.now(timezone.utc),
        status='started'
    )
    db.session.add(attempt)
    db.session.commit()

    return jsonify({'attempt_id': attempt.attempt_id}), 200

import os
import json
import random
from datetime import datetime
from flask import Blueprint, jsonify, request
from app import db
from app.models.candidate import Candidate
from app.models.job import JobDescription
from app.models.assessment_attempt import AssessmentAttempt

assessment_api_bp = Blueprint('assessment_api', __name__, url_prefix='/api/assessment')

# --- Configuration ---
QUESTION_DIR = "app/question_batches"
BAND_ORDER = ["good", "better", "perfect"]

# In-memory state for each assessment attempt (in a production environment, use a proper state management solution)
assessment_states = {}

def load_question_bank():
    bank = {band: {} for band in BAND_ORDER}
    for fname in os.listdir(QUESTION_DIR):
        if fname.endswith(".json"):
            parts = fname[:-5].split("_")
            skill = "_".join(parts[:-1])
            band = parts[-1]
            with open(os.path.join(QUESTION_DIR, fname), "r") as f:
                questions = json.load(f)
            if skill not in bank[band]:
                bank[band][skill] = []
            random.shuffle(questions)
            bank[band][skill].extend(questions)
    return bank

def divide_experience_range(jd_range):
    start, end = map(float, jd_range.split("-"))
    interval = (end - start) / 3
    return {
        "good": (start, start + interval),
        "better": (start + interval, start + 2 * interval),
        "perfect": (start + 2 * interval, end)
    }

def get_base_band(candidate_exp, jd_range):
    bands = divide_experience_range(jd_range)
    for band, (low, high) in bands.items():
        if low <= candidate_exp <= high:
            return band
    return "good"

@assessment_api_bp.route('/start/<int:attempt_id>', methods=['POST'])
def start_assessment_session(attempt_id):
    attempt = AssessmentAttempt.query.get_or_404(attempt_id)
    candidate = Candidate.query.get_or_404(attempt.candidate_id)
    job = JobDescription.query.get_or_404(attempt.job_id)

    # Mock candidate proficiency and job priorities (replace with actual data from resume_data later)
    candidate_proficiency_per_skill = {
        "Machine_Learning": "mid",
        "Data_Science": "mid",
    }
    jd_priorities = {
        "Machine_Learning": 3,
        "Data_Science": 2,
    }
    proficiency_to_band = {"low": "good", "mid": "better", "high": "perfect"}

    # Initialize state
    total_questions = job.num_questions
    test_duration = job.duration * 60  # Convert minutes to seconds
    candidate_experience = candidate.years_of_experience
    jd_experience_range = f"{job.experience_min}-{job.experience_max}"

    question_bank = load_question_bank()
    base_band = get_base_band(candidate_experience, jd_experience_range)
    priority_sum = sum(jd_priorities.values())
    questions_per_skill = {
        skill: round((priority / priority_sum) * total_questions)
        for skill, priority in jd_priorities.items()
    }
    current_band_per_skill = {
        skill: proficiency_to_band.get(candidate_proficiency_per_skill.get(skill, "mid"), base_band)
        for skill in jd_priorities
    }
    initial_band_per_skill = current_band_per_skill.copy()
    performance_log = {skill: {
        "questions_attempted": 0,
        "correct_answers": 0,
        "incorrect_answers": 0,
        "final_band": None,
        "time_spent": 0,
        "responses": []
    } for skill in jd_priorities}
    
    # Store state
    assessment_states[attempt_id] = {
        'question_bank': question_bank,
        'questions_per_skill': questions_per_skill,
        'current_band_per_skill': current_band_per_skill,
        'initial_band_per_skill': initial_band_per_skill,
        'performance_log': performance_log,
        'question_count': 0,
        'total_questions': total_questions,
        'test_duration': test_duration,
        'start_time': datetime.utcnow().timestamp(),
        'asked_questions': [],
    }

    return jsonify({
        'total_questions': total_questions,
        'test_duration': test_duration,
    }), 200

@assessment_api_bp.route('/next-question/<int:attempt_id>', methods=['GET'])
def get_next_question(attempt_id):
    if attempt_id not in assessment_states:
        return jsonify({'error': 'Assessment session not found'}), 404

    state = assessment_states[attempt_id]
    question_count = state['question_count']
    total_questions = state['total_questions']
    test_duration = state['test_duration']
    start_time = state['start_time']
    questions_per_skill = state['questions_per_skill']

    # Check if time is up or all questions are asked
    elapsed_time = datetime.utcnow().timestamp() - start_time
    if question_count >= total_questions or elapsed_time >= test_duration:
        # Finalize performance log
        for skill in state['performance_log']:
            state['performance_log'][skill]["final_band"] = state['current_band_per_skill'][skill]
            correct = state['performance_log'][skill]["correct_answers"]
            total = state['performance_log'][skill]["questions_attempted"]
            state['performance_log'][skill]["accuracy_percent"] = round((correct / total) * 100, 2) if total > 0 else 0.0

        # Save performance log to the database
        attempt = AssessmentAttempt.query.get(attempt_id)
        attempt.performance_log = state['performance_log']
        attempt.end_time = datetime.utcnow()
        attempt.status = 'completed'
        db.session.commit()

        return jsonify({
            'message': 'Assessment completed',
            'candidate_report': state['performance_log']
        }), 200

    # Get the next question
    sorted_skills = sorted(questions_per_skill.items(), key=lambda x: -jd_priorities.get(x[0], 0))
    for skill, remaining in sorted_skills:
        if remaining <= 0:
            continue

        # Fetch question
        band = state['current_band_per_skill'][skill]
        available = state['question_bank'].get(band, {}).get(skill, [])
        if not available:
            continue

        question = available.pop(0)
        state['questions_per_skill'][skill] -= 1
        state['question_count'] += 1
        state['asked_questions'].append(question)

        return jsonify({
            'question': {
                'question': question['question'],
                'options': question['options']
            },
            'skill': skill,
            'question_number': state['question_count']
        }), 200

    return jsonify({'message': 'No more questions available'}), 200

@assessment_api_bp.route('/submit-answer/<int:attempt_id>', methods=['POST'])
def submit_answer(attempt_id):
    if attempt_id not in assessment_states:
        return jsonify({'error': 'Assessment session not found'}), 404

    state = assessment_states[attempt_id]
    data = request.get_json()
    skill = data.get('skill')
    user_input = data.get('answer')
    time_taken = data.get('time_taken')

    # Get the last asked question
    question = state['asked_questions'][-1]
    band = state['current_band_per_skill'][skill]
    user_option = question['options'][int(user_input) - 1]
    correct = user_option == question['answer']

    # Update performance log
    state['performance_log'][skill]["questions_attempted"] += 1
    state['performance_log'][skill]["time_spent"] += time_taken
    state['performance_log'][skill]["responses"].append({
        "question": question['question'],
        "chosen": user_option,
        "correct": question['answer'],
        "is_correct": correct,
        "band": band,
        "time_taken": time_taken
    })

    feedback = ''
    if correct:
        state['performance_log'][skill]["correct_answers"] += 1
        if BAND_ORDER.index(band) < 2:
            state['current_band_per_skill'][skill] = BAND_ORDER[BAND_ORDER.index(band) + 1]
        feedback = "✅ Nice one! That was spot on."
    else:
        state['performance_log'][skill]["incorrect_answers"] += 1
        if BAND_ORDER.index(band) > 0:
            state['current_band_per_skill'][skill] = BAND_ORDER[BAND_ORDER.index(band) - 1]
        feedback = f"❌ Oops! The correct answer was: {question['answer']}"

    return jsonify({'feedback': feedback}), 200

@assessment_api_bp.route('/end/<int:attempt_id>', methods=['POST'])
def end_assessment(attempt_id):
    if attempt_id not in assessment_states:
        return jsonify({'error': 'Assessment session not found'}), 404

    state = assessment_states[attempt_id]

    # Finalize performance log
    for skill in state['performance_log']:
        state['performance_log'][skill]["final_band"] = state['current_band_per_skill'][skill]
        correct = state['performance_log'][skill]["correct_answers"]
        total = state['performance_log'][skill]["questions_attempted"]
        state['performance_log'][skill]["accuracy_percent"] = round((correct / total) * 100, 2) if total > 0 else 0.0

    # Save to database
    attempt = AssessmentAttempt.query.get(attempt_id)
    attempt.performance_log = state['performance_log']
    attempt.end_time = datetime.utcnow()
    attempt.status = 'completed'
    db.session.commit()

    # Clean up state
    del assessment_states[attempt_id]

    return jsonify({
        'message': 'Assessment completed',
        'candidate_report': state['performance_log']
    }), 200
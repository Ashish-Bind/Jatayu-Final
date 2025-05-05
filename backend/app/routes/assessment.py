import random
import logging
from datetime import datetime
from flask import Blueprint, jsonify, request
from app import db
from app.models.candidate import Candidate
from app.models.job import JobDescription
from app.models.assessment_attempt import AssessmentAttempt
from app.models.required_skill import RequiredSkill
from app.models.skill import Skill
from app.models.candidate_skill import CandidateSkill
from app.models.mcq import MCQ
from app.models.assessment_registration import AssessmentRegistration

assessment_api_bp = Blueprint('assessment_api', __name__, url_prefix='/api/assessment')

logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

BAND_ORDER = ["good", "better", "perfect"]

GREETING_MESSAGES = [
    "Alright, let's get started with your assessment! Here's your first question.",
    "Ready to show your skills? Here's the next question for you!",
    "Time to shine! Let's dive into this question.",
    "Here comes a new challenge. You've got this!"
]
CORRECT_FEEDBACK = [
    "✅ Nice one! That was spot on.",
    "🎉 Great job! You nailed it!",
    "✅ Perfect! Keep it up!",
    "🌟 Awesome! That's correct."
]
INCORRECT_FEEDBACK = [
    "❌ Oops! The correct answer was: {answer}",
    "😅 Not quite. The right answer was: {answer}",
    "❌ Missed that one. Correct answer: {answer}",
    "😬 Close, but the answer was: {answer}"
]

assessment_states = {}

def load_question_bank(job_id):
    try:
        bank = {band: {} for band in BAND_ORDER}
        mcqs = MCQ.query.filter_by(job_id=job_id).join(Skill, Skill.skill_id == MCQ.skill_id).all()
        
        for mcq in mcqs:
            skill_name = mcq.skill.name
            band = mcq.difficulty_band
            if skill_name not in bank[band]:
                bank[band][skill_name] = []
            if mcq.correct_answer not in ['A', 'B', 'C', 'D']:
                logger.error(f"Invalid correct_answer '{mcq.correct_answer}' for MCQ mcq_id={mcq.mcq_id}")
                continue
            bank[band][skill_name].append({
                "mcq_id": mcq.mcq_id,
                "question": mcq.question,
                "options": [mcq.option_a, mcq.option_b, mcq.option_c, mcq.option_d],
                "answer": getattr(mcq, f"option_{mcq.correct_answer.lower()}")
            })
        
        for band in bank:
            for skill in bank[band]:
                random.shuffle(bank[band][skill])
        
        return bank
    except Exception as e:
        logger.error(f"Error in load_question_bank for job_id={job_id}: {str(e)}")
        raise

def divide_experience_range(jd_range):
    try:
        start, end = map(float, jd_range.split("-"))
        interval = (end - start) / 3
        return {
            "good": (start, start + interval),
            "better": (start + interval, start + 2 * interval),
            "perfect": (start + 2 * interval, end)
        }
    except Exception as e:
        logger.error(f"Error in divide_experience_range for jd_range={jd_range}: {str(e)}")
        raise

def get_base_band(candidate_exp, jd_range):
    try:
        bands = divide_experience_range(jd_range)
        for band, (low, high) in bands.items():
            if low <= candidate_exp <= high:
                return band
        return "good"
    except Exception as e:
        logger.error(f"Error in get_base_band for candidate_exp={candidate_exp}, jd_range={jd_range}: {str(e)}")
        raise

@assessment_api_bp.route('/start/<int:attempt_id>', methods=['POST'])
def start_assessment_session(attempt_id):
    try:
        logger.debug(f"Starting assessment for attempt_id={attempt_id}")
        attempt = AssessmentAttempt.query.get(attempt_id)
        if not attempt:
            logger.error(f"AssessmentAttempt not found for attempt_id={attempt_id}")
            return jsonify({'error': 'Assessment attempt not found'}), 404

        candidate = Candidate.query.get(attempt.candidate_id)
        if not candidate:
            logger.error(f"Candidate not found for candidate_id={attempt.candidate_id}")
            return jsonify({'error': 'Candidate not found'}), 404

        job = JobDescription.query.get(attempt.job_id)
        if not job:
            logger.error(f"JobDescription not found for job_id={attempt.job_id}")
            return jsonify({'error': 'Job description not found'}), 404

        if job.experience_min is None or job.experience_max is None:
            logger.error(f"Invalid experience range for job_id={job.job_id}: min={job.experience_min}, max={job.experience_max}")
            return jsonify({'error': 'Invalid job experience range'}), 400

        required_skills = RequiredSkill.query.filter_by(job_id=job.job_id).join(Skill, Skill.skill_id == RequiredSkill.skill_id).all()
        jd_priorities = {rs.skill.name: rs.priority for rs in required_skills}
        if not jd_priorities:
            logger.error(f"No required skills found for job_id={job.job_id}")
            return jsonify({'error': 'No required skills found for this job'}), 400

        proficiency_map = {4: "low", 6: "mid", 8: "high"}
        candidate_skills = CandidateSkill.query.filter_by(candidate_id=candidate.candidate_id).join(Skill, Skill.skill_id == CandidateSkill.skill_id).all()
        candidate_proficiency_per_skill = {
            cs.skill.name: proficiency_map.get(cs.proficiency, "mid")
            for cs in candidate_skills
            if cs.skill.name in jd_priorities
        }
        proficiency_to_band = {"low": "good", "mid": "better", "high": "perfect"}

        total_questions = job.num_questions
        test_duration = job.duration * 60
        candidate_experience = candidate.years_of_experience or 0
        jd_experience_range = f"{job.experience_min}-{job.experience_max}"

        question_bank = load_question_bank(job.job_id)
        if not any(bank for band in question_bank.values() for bank in band.values()):
            logger.error(f"No questions available for job_id={job.job_id}")
            return jsonify({'error': 'No questions available for this job'}), 400

        base_band = get_base_band(candidate_experience, jd_experience_range)
        priority_sum = sum(jd_priorities.values()) or 1
        questions_per_skill = {
            skill: max(1, round((priority / priority_sum) * total_questions))
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
        
        assessment_states[attempt_id] = {
            'job_id': job.job_id,
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
    except Exception as e:
        logger.error(f"Error in start_assessment_session for attempt_id={attempt_id}: {str(e)}")
        return jsonify({'error': f'Internal server error: {str(e)}'}), 500

@assessment_api_bp.route('/next-question/<int:attempt_id>', methods=['GET'])
def get_next_question(attempt_id):
    try:
        if attempt_id not in assessment_states:
            logger.error(f"Assessment session not found for attempt_id={attempt_id}")
            return jsonify({'error': 'Assessment session not found'}), 404

        state = assessment_states[attempt_id]
        question_count = state['question_count']
        total_questions = state['total_questions']
        test_duration = state['test_duration']
        start_time = state['start_time']
        questions_per_skill = state['questions_per_skill']

        elapsed_time = datetime.utcnow().timestamp() - start_time
        if question_count >= total_questions or elapsed_time >= test_duration:
            for skill in state['performance_log']:
                state['performance_log'][skill]["final_band"] = state['current_band_per_skill'][skill]
                correct = state['performance_log'][skill]["correct_answers"]
                total = state['performance_log'][skill]["questions_attempted"]
                state['performance_log'][skill]["accuracy_percent"] = round((correct / total) * 100, 2) if total > 0 else 0.0

            attempt = AssessmentAttempt.query.get(attempt_id)
            attempt.performance_log = state['performance_log']
            attempt.end_time = datetime.utcnow()
            attempt.status = 'completed'
            db.session.commit()

            return jsonify({
                'message': 'Assessment completed',
                'candidate_report': state['performance_log']
            }), 200

        required_skills = RequiredSkill.query.filter_by(job_id=state['job_id']).join(Skill, Skill.skill_id == RequiredSkill.skill_id).all()
        jd_priorities = {rs.skill.name: rs.priority for rs in required_skills}
        sorted_skills = sorted(questions_per_skill.items(), key=lambda x: -jd_priorities.get(x[0], 0))
        for skill, remaining in sorted_skills:
            if remaining <= 0:
                continue

            band = state['current_band_per_skill'][skill]
            available = state['question_bank'].get(band, {}).get(skill, [])
            if not available:
                continue

            question = available.pop(0)
            state['questions_per_skill'][skill] -= 1
            state['question_count'] += 1
            state['asked_questions'].append(question)

            return jsonify({
                'greeting': random.choice(GREETING_MESSAGES),
                'question': {
                    'mcq_id': question['mcq_id'],
                    'question': question['question'],
                    'options': question['options']
                },
                'skill': skill,
                'question_number': state['question_count']
            }), 200

        logger.warning(f"No more questions available for attempt_id={attempt_id}")
        return jsonify({'message': 'No more questions available'}), 200
    except Exception as e:
        logger.error(f"Error in get_next_question for attempt_id={attempt_id}: {str(e)}")
        return jsonify({'error': f'Internal server error: {str(e)}'}), 500

@assessment_api_bp.route('/submit-answer/<int:attempt_id>', methods=['POST'])
def submit_answer(attempt_id):
    try:
        if attempt_id not in assessment_states:
            logger.error(f"Assessment session not found for attempt_id={attempt_id}")
            return jsonify({'error': 'Assessment session not found'}), 404

        state = assessment_states[attempt_id]
        data = request.get_json()
        skill = data.get('skill')
        user_input = data.get('answer')
        time_taken = data.get('time_taken')

        if not skill or skill not in state['performance_log']:
            logger.error(f"Invalid skill '{skill}' for attempt_id={attempt_id}")
            return jsonify({'error': 'Invalid skill provided'}), 400

        if not user_input or user_input not in ['1', '2', '3', '4']:
            logger.error(f"Invalid answer '{user_input}' for attempt_id={attempt_id}")
            return jsonify({'error': 'Invalid answer provided'}), 400

        question = state['asked_questions'][-1]
        band = state['current_band_per_skill'][skill]
        
        input_map = {1: 'A', 2: 'B', 3: 'C', 4: 'D'}
        user_letter = input_map.get(int(user_input), '')
        user_option = question['options'][int(user_input) - 1]
        correct_letter = next(letter for letter, opt in zip(['A', 'B', 'C', 'D'], question['options']) if opt == question['answer'])
        correct = user_letter == correct_letter

        state['performance_log'][skill]["questions_attempted"] += 1
        state['performance_log'][skill]["time_spent"] += time_taken
        state['performance_log'][skill]["responses"].append({
            "mcq_id": question['mcq_id'],
            "question": question['question'],
            "chosen": user_option,
            "correct": question['answer'],
            "is_correct": correct,
            "band": band,
            "time_taken": time_taken
        })

        if correct:
            state['performance_log'][skill]["correct_answers"] += 1
            if BAND_ORDER.index(band) < 2:
                state['current_band_per_skill'][skill] = BAND_ORDER[BAND_ORDER.index(band) + 1]
            feedback = random.choice(CORRECT_FEEDBACK)
        else:
            state['performance_log'][skill]["incorrect_answers"] += 1
            if BAND_ORDER.index(band) > 0:
                state['current_band_per_skill'][skill] = BAND_ORDER[BAND_ORDER.index(band) - 1]
            feedback = random.choice(INCORRECT_FEEDBACK).format(answer=question['answer'])

        return jsonify({'feedback': feedback}), 200
    except Exception as e:
        logger.error(f"Error in submit_answer for attempt_id={attempt_id}: {str(e)}")
        return jsonify({'error': f'Internal server error: {str(e)}'}), 500

@assessment_api_bp.route('/end/<int:attempt_id>', methods=['POST'])
def end_assessment(attempt_id):
    try:
        if attempt_id not in assessment_states:
            logger.error(f"Assessment session not found for attempt_id={attempt_id}")
            return jsonify({'error': 'Assessment session not found'}), 404

        state = assessment_states[attempt_id]

        for skill in state['performance_log']:
            state['performance_log'][skill]["final_band"] = state['current_band_per_skill'][skill]
            correct = state['performance_log'][skill]["correct_answers"]
            total = state['performance_log'][skill]["questions_attempted"]
            state['performance_log'][skill]["accuracy_percent"] = round((correct / total) * 100, 2) if total > 0 else 0.0

        attempt = AssessmentAttempt.query.get(attempt_id)
        attempt.performance_log = state['performance_log']
        attempt.end_time = datetime.utcnow()
        attempt.status = 'completed'
        db.session.commit()

        del assessment_states[attempt_id]

        return jsonify({
            'message': 'Assessment completed',
            'candidate_report': state['performance_log']
        }), 200
    except Exception as e:
        logger.error(f"Error in end_assessment for attempt_id={attempt_id}: {str(e)}")
        return jsonify({'error': f'Internal server error: {str(e)}'}), 500

@assessment_api_bp.route('/candidate/assessments/<int:candidate_id>', methods=['GET'])
def get_candidate_assessments(candidate_id):
    try:
        attempted = db.session.query(
            AssessmentAttempt.attempt_id,
            AssessmentAttempt.job_id,
            AssessmentAttempt.attempt_date,
            AssessmentAttempt.status,
            JobDescription.job_title,
            JobDescription.company
        ).join(
            JobDescription, AssessmentAttempt.job_id == JobDescription.job_id
        ).filter(
            AssessmentAttempt.candidate_id == candidate_id,
            AssessmentAttempt.status == 'completed'
        ).all()
        
        attempted_assessments = [
            {
                'attempt_id': attempt.attempt_id,
                'job_id': attempt.job_id,
                'job_title': attempt.job_title,
                'company': attempt.company,
                'attempt_date': attempt.attempt_date.isoformat(),
                'status': attempt.status.capitalize()
            } for attempt in attempted
        ]
        
        return jsonify({
            'attempted': attempted_assessments
        }), 200
    except Exception as e:
        logger.error(f"Error in get_candidate_assessments for candidate_id={candidate_id}: {str(e)}")
        return jsonify({'error': f'Internal server error: {str(e)}'}), 500
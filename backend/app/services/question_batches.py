import os
import json
import re
import threading
import functools
import time
from flask import current_app
import google.generativeai as genai
from google.api_core.exceptions import TooManyRequests
from app import db
from app.models.skill import Skill
from app.models.mcq import MCQ

# Cross-platform timeout implementation
class TimeoutError(Exception):
    pass

def timeout_with_context(seconds):
    def decorator(func):
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            app = current_app._get_current_object()
            result = [None]
            exception = [None]
            
            def target():
                with app.app_context():
                    try:
                        result[0] = func(*args, **kwargs)
                    except Exception as e:
                        exception[0] = e
            
            thread = threading.Thread(target=target)
            thread.daemon = True
            thread.start()
            thread.join(seconds)
            
            if thread.is_alive():
                raise TimeoutError(f'Function call timed out after {seconds} seconds')
            
            if exception[0]:
                raise exception[0]
            
            return result[0]
        return wrapper
    return decorator

# Configure Gemini AI API
api_key = os.getenv("GOOGLE_API_KEY")
if not api_key:
    raise ValueError("GOOGLE_API_KEY environment variable not set")
genai.configure(api_key=api_key)
generation_config = {
    "temperature": 0.2,
    "max_output_tokens": 2048
}
model_gemini = genai.GenerativeModel(
    model_name="gemini-1.5-flash", generation_config=generation_config
)

def divide_experience_range(jd_range):
    start, end = map(float, jd_range.split("-"))
    interval = (end - start) / 3
    return {
        "good": (start, start + interval),
        "better": (start + interval, start + 2 * interval),
        "perfect": (start + 2 * interval, end)
    }

def expand_skills_with_gemini(skill):
    prompt = f"List 5 key subtopics under {skill} that are relevant for a technical interview. Only list the subskills."
    max_retries = 3
    for attempt in range(max_retries):
        try:
            chat_session = model_gemini.start_chat(history=[{"role": "user", "parts": [prompt]}])
            response = chat_session.send_message(prompt)
            if response and isinstance(response.text, str):
                subtopics = [line.strip("- ").strip() for line in response.text.split("\n") if line.strip()][:5]
                return subtopics
        except TooManyRequests:
            if attempt < max_retries - 1:
                wait_time = 2 ** attempt * 10
                print(f"⛔️ Gemini quota exceeded while expanding skill: {skill}. Retrying in {wait_time} seconds...")
                time.sleep(wait_time)
            else:
                print(f"⛔️ Gemini quota exceeded after {max_retries} retries for skill: {skill}")
                return []
    return []

def generate_questions_prompt(skill, subskills, difficulty_band, job_description="", previous_questions=None):
    difficulty_descriptor = {
        "good": "easy and theory-based, suitable for beginners. Can include data structures and algorithms questions.",
        "better": "moderate difficulty, mixing theory and practical concepts, can be DSA-based or practical.",
        "perfect": "challenging, practical, and suitable for advanced learners, mostly code snippet-based to test practical skills."
    }[difficulty_band]
    description_context = f"The job description is: {job_description}" if job_description else "There is no specific job description provided."
    
    avoid_section = ""
    if previous_questions:
        avoid_section = "Avoid generating questions similar in content or concept to the following previously generated questions:\n"
        for i, q in enumerate(previous_questions[:5], 1):
            avoid_section += f"Previous Question {i}:\n{q['question']}\n"
            avoid_section += "\n".join(f"({chr(65+i)}) {opt}" for i, opt in enumerate(q['options']))
            avoid_section += f"\nCorrect Answer: ({q['correct_answer']})\n\n"
    
    prompt = f"""
    {description_context}
    Generate exactly 20 unique and diverse multiple-choice questions (MCQs) on the skill '{skill}' and its subskills: {", ".join(subskills)}.
    The questions should be {difficulty_descriptor}. Include 5-7 code snippet questions where applicable, and the rest should be theory-based to ensure variety.
    Guidelines:
    1. Each question must be unique in wording and concept, with no repetition or paraphrasing across the 20 questions.
    2. Cover a broad range of topics from the subskills provided to ensure diversity.
    3. Avoid similar ideas, synonyms, or rephrased questions within the batch.
    {avoid_section}
    4. Each MCQ must have exactly four options labeled (A), (B), (C), (D).
    5. The correct answer must be one of (A), (B), (C), (D) and formatted as: "Correct Answer: (B)"
    6. Format each question with the question text on one line (code snippets should use spaces instead of newlines), followed by options and correct answer on separate lines.
    7. Example format:
    "What is an AMI in AWS? (A) Virtual machine image (B) Storage volume (C) Network interface (D) Security group Correct Answer: (A)"
    "What will this code print? driver.findElement(By.xpath(\"//input[@type='submit']\")).click(); (A) Submits a form (B) Clicks a button (C) Enters text (D) Clears a field Correct Answer: (B)"
    8. Return ONLY the formatted MCQs as a newline-separated string, with each question separated by a blank line, e.g.:
    "Question 1... (A) Option A (B) Option B (C) Option C (D) Option D Correct Answer: (B)\n\nQuestion 2... (A) Option A..."
    """
    return prompt.strip()

def generate_single_question_prompt(skill, subskills, difficulty_band, job_description="", previous_questions=None):
    difficulty_descriptor = {
        "good": "easy and theory-based, suitable for beginners. Can include data structures and algorithms questions.",
        "better": "moderate difficulty, mixing theory and practical concepts, can be DSA-based or practical.",
        "perfect": "challenging, practical, and suitable for advanced learners, mostly code snippet-based to test practical skills."
    }[difficulty_band]
    description_context = f"The job description is: {job_description}" if job_description else "There is no specific job description provided."
    
    avoid_section = ""
    if previous_questions:
        avoid_section = "Avoid generating questions similar in content or concept to the following previously asked questions:\n"
        for i, q in enumerate(previous_questions[:5], 1):
            avoid_section += f"Previous Question {i}:\n{q['question']}\n"
            avoid_section += "\n".join(f"({chr(65+i)}) {opt}" for i, opt in enumerate(q['options']))
            avoid_section += f"\nCorrect Answer: ({q['correct_answer']})\n\n"
    
    prompt = f"""
    {description_context}
    Generate a single unique multiple-choice question (MCQ) on the skill '{skill}' and its subskills: {", ".join(subskills)}.
    The question should be {difficulty_descriptor}. Include a code snippet if applicable.
    Guidelines:
    1. The question must be unique and concise, distinct from any previous questions.
    2. Cover a topic from the skill or subskills provided.
    3. The MCQ must have exactly four options labeled (A), (B), (C), (D).
    4. The correct answer must be one of (A), (B), (C), (D) and formatted as: "Correct Answer: (B)"
    {avoid_section}
    5. Format the question with the question text on one line (code snippets should use spaces instead of newlines), followed by options and correct answer on separate lines.
    6. Example format:
    "What will this code print? driver.findElement(By.xpath(\"//input[@type='submit']\")).click(); (A) Submits a form (B) Clicks a button (C) Enters text (D) Clears a field Correct Answer: (B)"
    Return ONLY the formatted MCQ as a string. No extra text, no code block markers.
    """
    return prompt.strip()

def clean_entry(entry):
    """Clean a text entry by replacing newlines with spaces and removing extra whitespace."""
    entry = entry.strip().replace('\n', ' ').replace('\\n', ' ')
    entry = re.sub(r'([a-z])\1+', r'\1', entry)
    return ' '.join(entry.split())

def parse_question_block(block):
    """Parse a single question block into a structured format, handling single-line or multi-line input."""
    # Normalize input: replace multiple spaces with single space, handle newlines
    block = re.sub(r'\s+', ' ', block.strip())
    
    # Try splitting by newlines first (multi-line format)
    lines = [line.strip() for line in block.split("\n") if line.strip()]
    if len(lines) >= 5:
        option_start = next((i for i, line in enumerate(lines) if re.match(r'^\(A\)\s*', line)), len(lines))
        if option_start < len(lines) and option_start > 0:
            question = clean_entry(' '.join(lines[:option_start]))
            option_lines = lines[option_start:option_start+4]
            if len(option_lines) == 4:
                options = [clean_entry(re.sub(r'^\([A-D]\)\s*', '', opt).strip()) for opt in option_lines]
                correct_line = lines[option_start+4] if option_start+4 < len(lines) else ""
                match = re.search(r'Correct Answer:\s*\(([A-D])\)\s*$', correct_line)
                if match and match.group(1) in ['A', 'B', 'C', 'D']:
                    return {
                        "question": question,
                        "option_a": options[0],
                        "option_b": options[1],
                        "option_c": options[2],
                        "option_d": options[3],
                        "correct_answer": match.group(1),
                        "options": options
                    }
    
    # Fallback: handle single-line format (e.g., logs show question + options + answer in one line)
    # Example: "What is an AMI in AWS? (A) Virtual machine image (B) Storage volume (C) Network interface (D) Security group Correct Answer: (A)"
    match = re.match(r'^(.*?)\s*\(A\)\s*(.*?)\s*\(B\)\s*(.*?)\s*\(C\)\s*(.*?)\s*\(D\)\s*(.*?)\s*Correct Answer:\s*\(([A-D])\)\s*$', block)
    if match:
        question = clean_entry(match.group(1))
        options = [clean_entry(match.group(i)) for i in range(2, 6)]
        correct_answer = match.group(6)
        if correct_answer in ['A', 'B', 'C', 'D']:
            return {
                "question": question,
                "option_a": options[0],
                "option_b": options[1],
                "option_c": options[2],
                "option_d": options[3],
                "correct_answer": correct_answer,
                "options": options
            }
    
    print(f"Invalid question format: {block}")
    return None

def parse_response(raw_text):
    """Parse the raw response from Gemini into a list of questions."""
    # Log raw response for debugging
    print(f"📜 Raw Gemini response: {raw_text[:500]}... (truncated)")
    
    # Clean response: remove code block markers, normalize newlines
    raw_text = raw_text.strip()
    raw_text = re.sub(r'^```(json|python)?\s*\n', '', raw_text, flags=re.MULTILINE)
    raw_text = re.sub(r'\n```$', '', raw_text, flags=re.MULTILINE)
    raw_text = re.sub(r'\n\s*\n+', '\n\n', raw_text)  # Normalize multiple newlines to double newline
    raw_text = raw_text.strip()
    
    # Try JSON parsing first
    if raw_text.startswith("[") and raw_text.endswith("]"):
        try:
            questions = json.loads(raw_text)
            return [q for q in questions if q]
        except json.JSONDecodeError:
            print(f"⚠️ Failed to parse JSON response: {raw_text[:100]}...")
    
    # Split by double newlines for question blocks
    questions = []
    current_question = []
    for line in raw_text.split("\n"):
        line = line.strip()
        if not line:
            if current_question:
                questions.append("\n".join(current_question))
                current_question = []
            continue
        current_question.append(line)
        if re.match(r'Correct Answer:\s*\([A-D]\)\s*$', line):
            questions.append("\n".join(current_question))
            current_question = []
    
    if current_question:
        questions.append("\n".join(current_question))
    
    # Fallback: if splitting fails, try treating as single-line questions
    if not questions or all(len(q.split("\n")) == 1 for q in questions):
        questions = []
        for line in raw_text.split("\n\n"):
            line = line.strip()
            if line:
                questions.append(line)
    
    return [q for q in questions if q]

@timeout_with_context(5)
def generate_single_question_with_timeout(skill_name, difficulty_band, job_id, job_description="", used_questions=None):
    """Generate a single question with timeout."""
    skill = Skill.query.filter_by(name=skill_name).first()
    if not skill:
        print(f"⚠️ Skill {skill_name} not found in database.")
        return None
    
    skill_id = skill.skill_id
    subskills = expand_skills_with_gemini(skill_name)
    
    previous_questions = [
        q for q in (used_questions or [])
        if q.get('skill') == skill_name and q.get('difficulty_band') == difficulty_band
    ]
    
    max_retries = 3
    for attempt in range(max_retries):
        try:
            prompt = generate_single_question_prompt(skill_name, subskills, difficulty_band, job_description, previous_questions)
            chat = model_gemini.start_chat(history=[{"role": "user", "parts": [prompt]}])
            response = chat.send_message(prompt)
            
            if response and isinstance(response.text, str):
                questions = parse_response(response.text)
                if not questions:
                    print(f"⚠️ No valid question generated for {skill_name} ({difficulty_band})")
                    continue
                
                parsed = parse_question_block(questions[0])
                if not parsed:
                    print(f"⚠️ Invalid question format for {skill_name} ({difficulty_band}): {questions[0]}")
                    continue
                
                mcq = MCQ(
                    job_id=job_id,
                    skill_id=skill_id,
                    question=parsed["question"],
                    option_a=parsed["option_a"],
                    option_b=parsed["option_b"],
                    option_c=parsed["option_c"],
                    option_d=parsed["option_d"],
                    correct_answer=parsed["correct_answer"],
                    difficulty_band=difficulty_band
                )
                db.session.add(mcq)
                db.session.commit()
                
                print(f"✅ Saved real-time question for {skill_name} ({difficulty_band}) to MCQ table")
                return {
                    "mcq_id": mcq.mcq_id,
                    "question": parsed["question"],
                    "option_a": parsed["option_a"],
                    "option_b": parsed["option_b"],
                    "option_c": parsed["option_c"],
                    "option_d": parsed["option_d"],
                    "correct_answer": parsed["correct_answer"],
                    "skill": skill_name,
                    "difficulty_band": difficulty_band,
                    "options": parsed["options"]
                }
        except TooManyRequests:
            if attempt < max_retries - 1:
                wait_time = 2 ** attempt * 10
                print(f"⛔️ Gemini quota exceeded for {skill_name} ({difficulty_band}). Retrying in {wait_time} seconds...")
                time.sleep(wait_time)
            else:
                print(f"⛔️ Gemini quota exceeded after {max_retries} retries for {skill_name} ({difficulty_band}).")
                return None
    return None

def get_prestored_question(skill_name, difficulty_band, job_id, used_questions=None):
    """Retrieve a pre-stored question."""
    try:
        skill = Skill.query.filter_by(name=skill_name).first()
        if not skill:
            print(f"⚠️ Skill {skill_name} not found in database.")
            return None
        
        used_mcq_ids = [q['mcq_id'] for q in (used_questions or []) if 'mcq_id' in q]
        query = MCQ.query.filter_by(
            job_id=job_id,
            skill_id=skill.skill_id,
            difficulty_band=difficulty_band
        ).filter(~MCQ.mcq_id.in_(used_mcq_ids))
        
        available_mcqs = query.all()
        if not available_mcqs:
            print(f"⚠️ No unused pre-stored questions found for {skill_name} ({difficulty_band})")
            return None
        
        mcq = available_mcqs[0]  # Select first available question
        print(f"📦 Using pre-stored question for {skill_name} ({difficulty_band}) - ID: {mcq.mcq_id}")
        return {
            "mcq_id": mcq.mcq_id,
            "question": mcq.question,
            "option_a": mcq.option_a,
            "option_b": mcq.option_b,
            "option_c": mcq.option_c,
            "option_d": mcq.option_d,
            "correct_answer": mcq.correct_answer,
            "skill": skill_name,
            "difficulty_band": difficulty_band,
            "options": [mcq.option_a, mcq.option_b, mcq.option_c, mcq.option_d]
        }
    except Exception as e:
        print(f"⚠️ Error fetching pre-stored question: {e}")
        return None

def generate_single_question(skill_name, difficulty_band, job_id, job_description="", used_questions=None):
    """Main function that tries real-time generation with fallback to pre-stored questions."""
    if used_questions is None:
        used_questions = []
    
    max_attempts = 3
    for attempt in range(max_attempts):
        try:
            result = generate_single_question_with_timeout(skill_name, difficulty_band, job_id, job_description, used_questions)
            if result:
                return result
        except TimeoutError:
            print(f"⏰ Real-time generation timed out for {skill_name} ({difficulty_band}). Falling back to pre-stored questions.")
            break
        except TooManyRequests:
            print(f"⛔️ Gemini quota exceeded after retries for {skill_name} ({difficulty_band}). Falling back to pre-stored questions.")
            break
        except Exception as e:
            print(f"⚠️ Error in real-time generation for {skill_name} ({difficulty_band}): {e}")
            print("🔄 Falling back to pre-stored questions.")
            break
    
    return get_prestored_question(skill_name, difficulty_band, job_id, used_questions)

def prepare_question_batches(skills_with_priorities, jd_experience_range, job_id, job_description=""):
    """Generate and store 20 unique questions per skill per difficulty band."""
    band_ranges = divide_experience_range(jd_experience_range)
    question_bank = {"good": {}, "better": {}, "perfect": {}}
    total_questions_saved = 0
    
    for skill_data in skills_with_priorities:
        skill_name = skill_data["name"]
        print(f"\n📌 Processing Skill: {skill_name} (Priority: {skill_data['priority']})")
        skill = Skill.query.filter_by(name=skill_name).first()
        if not skill:
            print(f"⚠️ Skill {skill_name} not found in database. Skipping...")
            continue
        skill_id = skill.skill_id
        subskills = expand_skills_with_gemini(skill_name)
        
        for band in ["good", "better", "perfect"]:
            key = f"{skill_name}"
            if key not in question_bank[band]:
                question_bank[band][key] = []
            
            saved_questions = []
            attempts = 0
            max_attempts = 5
            while len(saved_questions) < 20 and attempts < max_attempts:
                try:
                    prompt = generate_questions_prompt(skill_name, subskills, band, job_description, saved_questions)
                    chat = model_gemini.start_chat(history=[{"role": "user", "parts": [prompt]}])
                    response = chat.send_message(prompt)
                    
                    if response and isinstance(response.text, str):
                        questions = parse_response(response.text)
                        print(f"✅ [{band.upper()}] {skill_name}: {len(questions)} questions generated")
                        
                        for q in questions[:20 - len(saved_questions)]:  # Limit to remaining needed questions
                            parsed = parse_question_block(q)
                            if not parsed:
                                print(f"⚠️ Invalid question format for {skill_name} in {band} band: {q}")
                                continue
                            
                            try:
                                mcq = MCQ(
                                    job_id=job_id,
                                    skill_id=skill_id,
                                    question=parsed["question"],
                                    option_a=parsed["option_a"],
                                    option_b=parsed["option_b"],
                                    option_c=parsed["option_c"],
                                    option_d=parsed["option_d"],
                                    correct_answer=parsed["correct_answer"],
                                    difficulty_band=band
                                )
                                db.session.add(mcq)
                                db.session.flush()
                                saved_questions.append({
                                    "mcq_id": mcq.mcq_id,
                                    "question": parsed["question"],
                                    "options": parsed["options"],
                                    "correct_answer": parsed["correct_answer"],
                                    "skill": skill_name,
                                    "difficulty_band": band
                                })
                                total_questions_saved += 1
                                print(f"Added MCQ: {parsed['question']} (Band: {band}, Correct Answer: {parsed['correct_answer']})")
                            except Exception as e:
                                print(f"⚠️ Error adding MCQ to session for {skill_name} in {band} band: {e}")
                                print(f"MCQ data: {parsed}")
                
                except TooManyRequests:
                    print(f"⛔️ Gemini quota exceeded for {skill_name} ({band}). Retrying in 10 seconds...")
                    time.sleep(10)
                except Exception as e:
                    print(f"⚠️ Error generating batch for {skill_name} in {band} band: {e}")
                
                attempts += 1
                time.sleep(1.5)
            
            if len(saved_questions) < 20:
                print(f"⚠️ Only {len(saved_questions)} unique questions generated for {skill_name} ({band}) after {max_attempts} attempts")
            
            question_bank[band][key] = saved_questions
    
    try:
        db.session.commit()
        print(f"✅ {total_questions_saved} questions saved to the database.")
    except Exception as e:
        db.session.rollback()
        print(f"⚠️ Error saving questions to database: {e}")
    
    print("\n✅ Question generation completed!")
    return question_bank
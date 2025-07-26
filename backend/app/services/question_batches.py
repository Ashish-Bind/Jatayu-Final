import os
import json
import re
import threading
import functools
import hashlib
import time
from flask import current_app
import importlib
import google.generativeai as genai
from google.api_core.exceptions import TooManyRequests
from app import db
from app.models.skill import Skill
from app.models.mcq import MCQ
from nltk.tokenize import word_tokenize
from nltk.corpus import stopwords
import string

# Jaccard similarity function for question uniqueness
stop_words = set(stopwords.words('english'))
def jaccard_similarity(text1, text2):
    tokens1 = {w.lower() for w in word_tokenize(text1) if w.lower() not in stop_words and w not in string.punctuation}
    tokens2 = {w.lower() for w in word_tokenize(text2) if w.lower() not in stop_words and w not in string.punctuation}
    intersection = len(tokens1 & tokens2)
    union = len(tokens1 | tokens2)
    return intersection / union if union > 0 else 0

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
        "good": "easy and theory-based, suitable for beginners. Can be data structures and algorithms based question",
        "better": "moderate difficulty, mixing theory and practical concepts can be dsa based or practical based question",
        "perfect": "challenging, practical, and suitable for advanced learners, should mostly be a code snippet to test practical skills"
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
    Generate 20 unique and diverse multiple-choice questions (MCQs) on the skill '{skill}' and its subskills: {", ".join(subskills)}.
    The questions should be {difficulty_descriptor}. Include 5-7 code snippet questions where applicable, and the rest should be theory-based to ensure variety.
    Guidelines:
    1. Each question must be unique in wording and concept.
    2. Cover a broad range of topics from the subskills provided.
    3. Do NOT repeat similar ideas or phrasing.
    {avoid_section}
    4. Each MCQ must have exactly four options labeled (A), (B), (C), (D).
    5. The correct answer must be one of (A), (B), (C), (D) and formatted as: "Correct Answer: (B)"
    6. Format each question with the question text on one line (code snippets should use spaces instead of newlines), followed by options and correct answer on separate lines.
    7. Example format:
    "What will this code print? driver.findElement(By.xpath(\"//input[@type='submit']\")).click();\n(A) Submits a form\n(B) Clicks a button\n(C) Enters text\n(D) Clears a field\nCorrect Answer: (B)"
    8. Return the questions as a newline-separated string, with each question separated by a blank line, e.g.:
    "Question 1...\n(A) Option A\n(B) Option B\n(C) Option C\n(D) Option D\nCorrect Answer: (B)\n\nQuestion 2...\n(A) Option A\n..."
    Return ONLY the formatted MCQs. No extra text, no code block markers, no JSON arrays.
    """
    return prompt.strip()

def generate_single_question_prompt(skill, subskills, difficulty_band, job_description="", previous_questions=None):
    difficulty_descriptor = {
        "good": "easy and theory-based, suitable for beginners. Can be data structures and algorithms based question",
        "better": "moderate difficulty, mixing theory and practical concepts can be dsa based or practical based question",
        "perfect": "challenging, practical, and suitable for advanced learners, should mostly be a code snippet to test practical skills"
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
    Generate a single multiple-choice question (MCQ) on the skill '{skill}' and its subskills: {", ".join(subskills)}.
    The question should be {difficulty_descriptor}. Include a code snippet if applicable.
    Guidelines:
    1. The question must be unique and concise.
    2. Cover a topic from the skill or subskills provided.
    3. The MCQ must have exactly four options labeled (A), (B), (C), (D).
    4. The correct answer must be one of (A), (B), (C), (D) and formatted as: "Correct Answer: (B)"
    {avoid_section}
    5. Format the question with the question text on one line (code snippets should use spaces instead of newlines), followed by options and correct answer on separate lines.
    6. Example format:
    "What will this code print? driver.findElement(By.xpath(\"//input[@type='submit']\")).click();\n(A) Submits a form\n(B) Clicks a button\n(C) Enters text\n(D) Clears a field\nCorrect Answer: (B)"
    Return ONLY the formatted MCQ as a string. No extra text, no code block markers.
    """
    return prompt.strip()

def clean_entry(entry):
    """Clean a text entry by replacing newlines with spaces and removing extra whitespace."""
    entry = entry.strip().replace('\n', ' ').replace('\\n', ' ')
    # Remove common typos (e.g., double letters)
    entry = re.sub(r'([a-z])\1+', r'\1', entry)
    return ' '.join(entry.split())

def parse_question_block(block):
    """Parse a single question block into a structured format."""
    # Split by newlines, preserving structure
    lines = [line.strip() for line in block.strip().split("\n") if line.strip()]
    if len(lines) < 5:
        print(f"Invalid question format (too few lines, got {len(lines)}): {block}")
        return None
    
    # Find the start of options
    option_start = next((i for i, line in enumerate(lines) if re.match(r'^\(A\)\s*', line)), len(lines))
    if option_start == len(lines):
        print(f"Invalid question format (no options found): {block}")
        return None
    
    # Combine all lines before options into the question
    question = clean_entry(' '.join(lines[:option_start]))
    
    # Extract options
    option_lines = lines[option_start:option_start+4]
    if len(option_lines) != 4:
        print(f"Invalid question format (wrong number of options, got {len(option_lines)}): {block}")
        return None
    
    options = [clean_entry(re.sub(r'^\([A-D]\)\s*', '', opt).strip()) for opt in option_lines]
    
    # Extract correct answer
    correct_line = lines[option_start+4] if option_start+4 < len(lines) else ""
    match = re.search(r'Correct Answer:\s*\(([A-D])\)\s*$', correct_line)
    if not match:
        print(f"Invalid correct answer format in line: '{correct_line}'")
        return None
    
    correct_answer = match.group(1)
    if correct_answer not in ['A', 'B', 'C', 'D']:
        print(f"Invalid correct_answer value: '{correct_answer}'")
        return None
    
    return {
        "question": question,
        "option_a": options[0],
        "option_b": options[1],
        "option_c": options[2],
        "option_d": options[3],
        "correct_answer": correct_answer,
        "options": options
    }

def parse_response(raw_text):
    """Parse the raw response from Gemini into a list of questions."""
    raw_text = raw_text.strip()
    raw_text = re.sub(r'^```(json|python)?\s*\n', '', raw_text, flags=re.MULTILINE)
    raw_text = re.sub(r'\n```$', '', raw_text, flags=re.MULTILINE)
    raw_text = raw_text.strip()
    
    # Handle JSON array format
    if raw_text.startswith("[") and raw_text.endswith("]"):
        try:
            questions = json.loads(raw_text)
            return [q for q in questions if q]
        except json.JSONDecodeError:
            print(f"⚠️ Failed to parse JSON response: {raw_text[:100]}...")
    
    # Handle newline-separated questions
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
                
                question_content = f"{parsed['question']} {' '.join(parsed['options'])}"
                is_unique = True
                for q in previous_questions:
                    if 'question' in q and 'options' in q:
                        prev_content = f"{q['question']} {' '.join(q['options'])}"
                        similarity = jaccard_similarity(question_content, prev_content)
                        if similarity > 0.5:  # Adjusted threshold for Jaccard
                            print(f"⚠️ Generated question too similar to previous (Jaccard: {similarity:.2f}). Retrying...")
                            is_unique = False
                            break
                if not is_unique:
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
    """Retrieve a pre-stored question, ensuring it’s not too similar to used questions."""
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
        
        used_contents = [(q['mcq_id'], f"{q['question']} {' '.join(q['options'])}") for q in (used_questions or []) if 'question' in q and 'options' in q]
        
        for mcq in available_mcqs:
            content = f"{mcq.question} {mcq.option_a} {mcq.option_b} {mcq.option_c} {mcq.option_d}"
            is_unique = True
            for used_id, used_content in used_contents:
                similarity = jaccard_similarity(content, used_content)
                if similarity > 0.5:  # Adjusted threshold for Jaccard
                    print(f"⚠️ Pre-stored question ID {mcq.mcq_id} too similar to used question ID {used_id} (Jaccard: {similarity:.2f})")
                    is_unique = False
                    break
            if is_unique:
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
        
        print(f"⚠️ No unique pre-stored questions found for {skill_name} ({difficulty_band}) after similarity check")
        return None
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
                question_content = f"{result['question']} {' '.join(result['options'])}"
                is_unique = True
                for q in used_questions:
                    if 'question' in q and 'options' in q:
                        prev_content = f"{q['question']} {' '.join(q['options'])}"
                        similarity = jaccard_similarity(question_content, prev_content)
                        if similarity > 0.5:  # Adjusted threshold for Jaccard
                            print(f"⚠️ Generated question too similar to previous (Jaccard: {similarity:.2f}). Retrying...")
                            is_unique = False
                            break
                if is_unique:
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
            question_contents = []  # Store (mcq_id, content) tuples
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
                        
                        for q in questions:
                            if len(saved_questions) >= 20:
                                break
                            
                            parsed = parse_question_block(q)
                            if not parsed:
                                print(f"⚠️ Invalid question format for {skill_name} in {band} band: {q}")
                                continue
                            
                            question_content = f"{parsed['question']} {' '.join(parsed['options'])}"
                            is_unique = True
                            for _, prev_content in question_contents:
                                similarity = jaccard_similarity(question_content, prev_content)
                                if similarity > 0.5:  # Adjusted threshold for Jaccard
                                    print(f"⚠️ Generated question too similar to previous (Jaccard: {similarity:.2f}). Skipping...")
                                    is_unique = False
                                    break
                            
                            if is_unique:
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
                                    question_contents.append((mcq.mcq_id, question_content))
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
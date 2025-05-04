import wikipediaapi
import numpy as np
import time
import os
import re
from sentence_transformers import SentenceTransformer
import google.generativeai as genai
from google.api_core.exceptions import TooManyRequests
from app import db
from app.models.skill import Skill
from app.models.mcq import MCQ

def prepare_question_batches(skills_with_priorities, jd_experience_range, job_id):
    # Configure Gemini AI API
    api_key = os.getenv("GOOGLE_API_KEY")
    if not api_key:
        raise ValueError("GEMINI_API_KEY environment variable not set")
    genai.configure(api_key=api_key)

    generation_config = {
        "temperature": 0.2,
        "max_output_tokens": 2048
    }

    model_gemini = genai.GenerativeModel(
        model_name="gemini-2.0-flash", generation_config=generation_config
    )

    embedding_model = SentenceTransformer("all-MiniLM-L6-v2")

    wiki = wikipediaapi.Wikipedia(
        user_agent="MandviAIQuiz/1.0 (contact: mandvishukla20@gmail.com)", language='en'
    )

    # Utility Functions
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
        try:
            chat_session = model_gemini.start_chat(history=[{"role": "user", "parts": [prompt]}])
            response = chat_session.send_message(prompt)
        except TooManyRequests:
            print(f"⛔️ Gemini quota exceeded while expanding skill: {skill}")
            return []

        if response and isinstance(response.text, str):
            subtopics = [line.strip("- ").strip() for line in response.text.split("\n") if line.strip()][:5]
            return subtopics
        return []

    def fetch_wikipedia_content(topic):
        page = wiki.page(topic)
        return page.summary if page.exists() else None

    def generate_questions_prompt(skill, subskills, difficulty_band):
        difficulty_descriptor = {
            "good": "easy and theory-based, suitable for beginners",
            "better": "moderate difficulty, mixing theory and practical concepts",
            "perfect": "challenging, practical, and suitable for advanced learners"
        }[difficulty_band]

        prompt = f"""
    Generate 20 unique and diverse multiple-choice questions (MCQs) on the skill '{skill}' and its subskills: {", ".join(subskills)}.
    The questions should be {difficulty_descriptor}.
    Guidelines:
    1. Each question must be different in wording and concept.
    2. Cover a broad range of topics from the subskills provided.
    3. Do NOT repeat similar ideas or phrasing.
    4. Each MCQ must have exactly four options labeled (A), (B), (C), (D).
    5. Include the correct answer at the end in the format: "Correct Answer: (B)"
    6. Format each question exactly like this:
    "Question text\n\n(A) Option A\n(B) Option B\n(C) Option C\n(D) Option D\n\nCorrect Answer: (B)"
    7. Return the questions as a list of strings, separated by commas, enclosed in square brackets, e.g., ["question1...", "question2..."].

    Return ONLY the list of 20 formatted MCQs. No extra text, no explanations, no code block markers (like ```json or ```python).
    """
        return prompt.strip()

    def parse_question(question_text):
        # Split the question text into lines
        lines = [line.strip() for line in question_text.strip().split("\n") if line.strip()]
        if len(lines) != 6:  # Expect exactly 6 lines (question, 4 options, correct answer)
            print(f"Invalid question format (wrong number of lines, got {len(lines)}): {question_text}")
            return None

        question = lines[0]
        # Extract options (remove "(A) ", "(B) ", etc.)
        option_a = re.sub(r'^\(A\)\s*', '', lines[1])
        option_b = re.sub(r'^\(B\)\s*', '', lines[2])
        option_c = re.sub(r'^\(C\)\s*', '', lines[3])
        option_d = re.sub(r'^\(D\)\s*', '', lines[4])
        # Extract correct answer (e.g., "Correct Answer: (B)" -> "B")
        correct_answer_line = lines[5]
        match = re.match(r'Correct Answer:\s*\(([A-D])\)\s*$', correct_answer_line)
        if not match:
            print(f"Invalid correct answer format in line: '{correct_answer_line}'")
            return None
        correct_answer = match.group(1)

        return {
            "question": question,
            "option_a": option_a,
            "option_b": option_b,
            "option_c": option_c,
            "option_d": option_d,
            "correct_answer": correct_answer
        }

    def parse_response(raw_text):
        # Remove code block markers if present (e.g., ```json ... ``` or ```python ... ```)
        raw_text = raw_text.strip()
        raw_text = re.sub(r'^```(json|python)\s*\n', '', raw_text, flags=re.MULTILINE)
        raw_text = re.sub(r'\n```$', '', raw_text, flags=re.MULTILINE)
        raw_text = raw_text.strip()

        # Check if the response is a list
        if not (raw_text.startswith("[") and raw_text.endswith("]")):
            print(f"⚠️ Response is not a list after cleaning: {raw_text}")
            return []

        content = raw_text[1:-1].strip()
        if not content:
            return []

        # Manually parse the list by tracking quoted strings and commas
        questions = []
        current_question = []
        inside_quote = False
        current_line = ""

        for char in content:
            if char == '"':
                inside_quote = not inside_quote
                current_line += char
            elif char == ',' and not inside_quote:
                # End of a question string
                if current_line:
                    current_question.append(current_line.strip('"'))
                    question_text = "\n".join(current_question)
                    questions.append(question_text)
                    current_question = []
                    current_line = ""
            else:
                current_line += char
                if char == "\n":
                    current_question.append(current_line.strip())
                    current_line = ""

        # Handle the last question
        if current_line:
            current_question.append(current_line.strip('"'))
            question_text = "\n".join(current_question)
            questions.append(question_text)

        return questions

    # Initialize
    band_ranges = divide_experience_range(jd_experience_range)
    knowledge_base = {}
    question_bank = {"good": {}, "better": {}, "perfect": {}}
    total_questions_saved = 0

    for skill_data in skills_with_priorities:
        skill_name = skill_data["name"]
        print(f"\n📌 Processing Skill: {skill_name} (Priority: {skill_data['priority']})")

        # Get skill_id from the database
        skill = Skill.query.filter_by(name=skill_name).first()
        if not skill:
            print(f"⚠️ Skill {skill_name} not found in database. Skipping...")
            continue
        skill_id = skill.skill_id

        subskills = expand_skills_with_gemini(skill_name)
        all_topics = [skill_name] + subskills

        # Fetch and store Wikipedia summaries
        for topic in all_topics:
            if topic not in knowledge_base:
                content = fetch_wikipedia_content(topic)
                if content:
                    embedding = embedding_model.encode(content)
                    knowledge_base[topic] = {
                        "content": content,
                        "embedding": np.array(embedding)
                    }

        # Generate MCQ batches per band
        for band in ["good", "better", "perfect"]:
            key = f"{skill_name}"
            if key not in question_bank[band]:
                question_bank[band][key] = []

            prompt = generate_questions_prompt(skill_name, subskills, band)
            try:
                chat = model_gemini.start_chat(history=[{"role": "user", "parts": [prompt]}])
                response = chat.send_message(prompt)
                if response and isinstance(response.text, str):
                    raw_text = response.text.strip()
                    questions = parse_response(raw_text)

                    print(f"✅ [{band.upper()}] {skill_name}: {len(questions)} questions generated")

                    # Parse and store questions in the database
                    for q in questions:
                        parsed = parse_question(q)
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
                            total_questions_saved += 1
                            print(f"Added MCQ: {parsed['question']} (Band: {band}, Correct Answer: {parsed['correct_answer']})")
                        except Exception as e:
                            print(f"⚠️ Error adding MCQ to session for {skill_name} in {band} band: {e}")
                            print(f"MCQ data: {parsed}")
            except TooManyRequests:
                print("⛔️ Gemini quota exceeded. Retrying in 10 seconds...")
                time.sleep(10)
            except Exception as e:
                print(f"⚠️ Error generating batch for {skill_name} in {band} band: {e}")
            time.sleep(1.5)

    # Commit all questions to the database
    try:
        db.session.commit()
        print(f"✅ {total_questions_saved} questions saved to the database.")
    except Exception as e:
        db.session.rollback()
        print(f"⚠️ Error saving questions to database: {e}")

    print("\n✅ Question generation completed!")
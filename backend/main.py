from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from schemas import SubmitRequest
from pdf_service import extract_text
from ai_service import generate_questions, evaluate_explanations
import session as store

load_dotenv()

app = FastAPI(title="DocAI")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

VALID_DIFFICULTIES = {"Easy", "Medium", "Hard"}
VALID_COUNTS = {5, 10, 15, 20}
MAX_FILE_BYTES = 20 * 1024 * 1024  # 20 MB


@app.get("/")
def root():
    return {"status": "DocAI backend running"}


@app.post("/api/quiz/start")
async def start_quiz(
    file: UploadFile = File(...),
    difficulty: str = Form(...),
    question_count: int = Form(...),
):
    if file.content_type != "application/pdf":
        raise HTTPException(400, "Only PDF files are accepted.")
    if difficulty not in VALID_DIFFICULTIES:
        raise HTTPException(400, "Invalid difficulty level.")
    if question_count not in VALID_COUNTS:
        raise HTTPException(400, "Invalid question count.")

    contents = await file.read()
    if len(contents) > MAX_FILE_BYTES:
        raise HTTPException(400, "File exceeds 20 MB limit.")

    try:
        text = extract_text(contents)
    except ValueError as e:
        raise HTTPException(400, str(e))

    try:
        questions = generate_questions(text, difficulty, question_count)
    except Exception as e:
        raise HTTPException(500, f"Question generation failed: {str(e)}")

    # Store with correct answers on server only
    sid = store.create({"questions": questions, "difficulty": difficulty})

    # Send options to frontend — WITHOUT correct_answer
    safe_questions = [
        {
            "id": q["id"],
            "text": q["text"],
            "options": q["options"],
            "topic": q.get("topic"),
        }
        for q in questions
    ]

    return {
        "session_id": sid,
        "questions": safe_questions,
        "difficulty": difficulty,
        "total_questions": len(safe_questions),
    }


@app.post("/api/quiz/submit")
async def submit_quiz(body: SubmitRequest):
    session = store.get(body.session_id)
    if not session:
        raise HTTPException(404, "Quiz session not found or expired.")

    questions = session["questions"]
    difficulty = session["difficulty"]
    answer_map = {a.question_id: a for a in body.answers}

    # --- AI Explanation Evaluation ---
    try:
        eval_results = evaluate_explanations(questions, body.answers, difficulty)
    except Exception as e:
        raise HTTPException(500, f"Explanation evaluation failed: {str(e)}")

    eval_map = {e["id"]: e for e in eval_results}

    # --- Scoring ---
    obtained_marks = 0
    correct_mcq_count = 0
    incorrect_mcq_count = 0
    results = []

    for q in questions:
        ans = answer_map.get(q["id"])
        selected = ans.selected_option if ans else ""
        explanation = ans.explanation if ans else ""
        correct = q["correct_answer"]
        is_correct = selected == correct

        eval_info = eval_map.get(q["id"], {"relevance_score": 0, "feedback": ""})
        relevance_score = eval_info["relevance_score"]
        feedback = eval_info["feedback"]

        # Critical rule: mark=1 ONLY IF correct option AND relevance > 55
        mark = 1 if (is_correct and relevance_score > 55) else 0
        obtained_marks += mark

        explanation_pass = relevance_score > 55

        if is_correct:
            correct_mcq_count += 1
        else:
            incorrect_mcq_count += 1

        results.append({
            "id": q["id"],
            "question": q["text"],
            "options": q["options"],
            "selected_option": selected,
            "correct_answer": correct,
            "is_correct": is_correct,
            "explanation": explanation,
            "relevance_score": relevance_score,
            "explanation_pass": explanation_pass,
            "ai_feedback": feedback,
            "mark": mark,
            "topic": q.get("topic"),
        })

    total = len(questions)
    percentage = round((obtained_marks / total) * 100) if total else 0
    overall_pass = percentage > 55

    store.delete(body.session_id)

    return {
        "difficulty": difficulty,
        "total_questions": total,
        "obtained_marks": obtained_marks,
        "correct_mcq": correct_mcq_count,
        "incorrect_mcq": incorrect_mcq_count,
        "percentage": percentage,
        "overall_pass": overall_pass,
        "results": results,
    }

import os
import json
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
_model = genai.GenerativeModel("gemini-3.8-flash")

_DIFFICULTY_GUIDE = {
    "Easy": "basic recall, definitions, and direct facts from the document",
    "Medium": "conceptual understanding, explanations, and topic relationships",
    "Hard": "critical thinking, in-depth analysis, and application of document concepts",
}

_EXPLANATION_EXPECTATIONS = {
    "Easy": "basic factual understanding and correct identification of concepts",
    "Medium": "conceptual understanding, logical reasoning, and connections between related concepts",
    "Hard": "critical thinking, deeper analysis, application of concepts, and logical justification",
}


def _parse_json(text: str) -> dict:
    text = text.strip()
    if text.startswith("```"):
        text = text.split("```")[1]
        if text.startswith("json"):
            text = text[4:]
    return json.loads(text.strip())


def generate_questions(text: str, difficulty: str, count: int) -> list[dict]:
    content = text[:50_000]

    prompt = f"""Generate exactly {count} MCQs from the document below. Difficulty: {difficulty} ({_DIFFICULTY_GUIDE[difficulty]}).

Return ONLY this JSON, nothing else:
{{"questions":[{{"id":1,"text":"question","options":{{"A":"opt","B":"opt","C":"opt","D":"opt"}},"correct_answer":"A","topic":"topic or null"}}]}}

Rules: use only document content, no duplicates, one correct answer (A/B/C/D).

Document:
{content}"""

    response = _model.generate_content(
        prompt,
        generation_config={"temperature": 0.3, "max_output_tokens": 4096},
    )
    data = _parse_json(response.text)
    questions = data["questions"][:count]

    for q in questions:
        if q.get("correct_answer") not in ("A", "B", "C", "D"):
            raise ValueError("AI returned an invalid question format.")

    return questions


def evaluate_explanations(
    questions: list[dict],
    answers: list,  # list of AnswerItem
    difficulty: str,
) -> list[dict]:
    """
    Evaluate all user explanations in a single Gemini call.
    Returns list of {id, relevance_score (0-100), feedback}.
    """
    # Build a compact evaluation payload for the prompt
    eval_items = []
    answer_map = {a.question_id: a for a in answers}

    for q in questions:
        ans = answer_map.get(q["id"])
        if not ans:
            continue
        correct = q["correct_answer"]
        eval_items.append({
            "id": q["id"],
            "question": q["text"],
            "options": q["options"],
            "correct_answer": correct,
            "selected_option": ans.selected_option,
            "user_explanation": ans.explanation,
        })

    if not eval_items:
        return []

    items_json = json.dumps(eval_items, ensure_ascii=False)
    expectation = _EXPLANATION_EXPECTATIONS.get(difficulty, _EXPLANATION_EXPECTATIONS["Medium"])

    prompt = f"""You are an expert evaluator assessing student explanations for MCQ answers.

Difficulty level: {difficulty}
Expectation at this level: {expectation}

For each item below, evaluate the user's explanation based on:
1. Relevance to the question
2. Conceptual understanding demonstrated
3. Logical reasoning quality
4. Accuracy according to the question context
5. Whether it genuinely justifies the selected option
6. Meeting the difficulty-level expectation above

IMPORTANT: Do NOT award high scores merely for keyword matching. Evaluate actual understanding.

Items to evaluate:
{items_json}

Return ONLY this JSON array, nothing else:
[{{"id": 1, "relevance_score": 75, "feedback": "Brief constructive feedback (1-2 sentences)"}}]

Rules:
- relevance_score: integer 0-100
- feedback: 1-2 sentences explaining what was good and what was missing
- Evaluate the explanation's quality independent of whether the selected option is correct
- Be consistent and fair across all items"""

    response = _model.generate_content(
        prompt,
        generation_config={"temperature": 0.2, "max_output_tokens": 2048},
    )

    raw = response.text.strip()
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    results = json.loads(raw.strip())

    # Validate and clamp scores
    validated = []
    for item in results:
        score = int(item.get("relevance_score", 0))
        score = max(0, min(100, score))
        validated.append({
            "id": item["id"],
            "relevance_score": score,
            "feedback": str(item.get("feedback", "")).strip(),
        })

    return validated

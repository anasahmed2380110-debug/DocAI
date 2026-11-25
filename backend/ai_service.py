
import os
import json
import urllib.request
import urllib.error
from dotenv import load_dotenv

load_dotenv()

# Local Ollama configuration
OLLAMA_URL = os.getenv(
    "OLLAMA_URL",
    "http://localhost:11434/api/generate"
)
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "qwen2.5:3b")

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


def _parse_json(raw_text: str):
    """Parse JSON even if the model adds markdown fences."""
    raw_text = raw_text.strip()

    if raw_text.startswith("```"):
        raw_text = raw_text.split("```", 1)[1]
        if raw_text.rstrip().endswith("```"):
            raw_text = raw_text.rsplit("```", 1)[0]

        raw_text = raw_text.strip()

        if raw_text.lower().startswith("json"):
            raw_text = raw_text[4:].strip()

    try:
        return json.loads(raw_text)
    except json.JSONDecodeError:
        # Try extracting the first JSON object or array.
        decoder = json.JSONDecoder()

        for index, char in enumerate(raw_text):
            if char in ("{", "["):
                try:
                    result, _ = decoder.raw_decode(raw_text[index:])
                    return result
                except json.JSONDecodeError:
                    continue

        raise ValueError("Qwen returned invalid JSON.")


def _call_ollama(prompt: str, max_tokens: int = 4096):
    """Send a prompt to the locally running Ollama model."""

    payload = {
        "model": OLLAMA_MODEL,
        "prompt": prompt,
        "stream": False,
        "format": "json",
        "keep_alive": "10m",
        "options": {
            "temperature": 0.2,
            "num_predict": max_tokens,
            "num_ctx": 4096
        }
    }

    request = urllib.request.Request(
        OLLAMA_URL,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST"
    )

    try:
        with urllib.request.urlopen(request, timeout=600) as response:
            result = json.loads(response.read().decode("utf-8"))

        if "response" not in result:
            raise ValueError("Ollama returned an unexpected response.")

        return result["response"]

    except urllib.error.URLError as error:
        raise RuntimeError(
            "Cannot connect to Ollama. Make sure Ollama is running."
        ) from error

    except TimeoutError as error:
        raise RuntimeError(
            "Qwen response timed out. Try fewer questions or a smaller PDF."
        ) from error


def generate_questions(text: str, difficulty: str, count: int) -> list[dict]:
    """Generate MCQs from uploaded PDF content using local Qwen."""

    if difficulty not in _DIFFICULTY_GUIDE:
        raise ValueError("Invalid difficulty level.")

    if not text or not text.strip():
        raise ValueError("The uploaded PDF contains no readable text.")

    if count < 1 or count > 20:
        raise ValueError("Question count must be between 1 and 20.")

    # Limit input to avoid excessive context usage on low-memory systems.
    content = text[:6000]

    prompt = f"""You are an expert educational question generator.

Generate EXACTLY {count} multiple-choice questions using ONLY the supplied document.

Difficulty: {difficulty}
Difficulty requirements: {_DIFFICULTY_GUIDE[difficulty]}

Requirements:
1. Every question must be based on the document.
2. Generate exactly four options: A, B, C, D.
3. Only one option must be correct.
4. correct_answer must contain only A, B, C, or D.
5. Avoid duplicate questions.
6. Make distractors plausible.
7. Hard questions must test reasoning and application, not just difficult wording.
8. Do not invent facts outside the document.
9. Assign a meaningful topic to every question.

Return a JSON object in exactly this structure:

{{
  "questions": [
    {{
      "id": 1,
      "text": "Question text",
      "options": {{
        "A": "Option A",
        "B": "Option B",
        "C": "Option C",
        "D": "Option D"
      }},
      "correct_answer": "A",
      "topic": "Topic name"
    }}
  ]
}}

DOCUMENT:
{content}
"""

    raw_response = _call_ollama(prompt, max_tokens=2048)
    data = _parse_json(raw_response)

    if not isinstance(data, dict) or not isinstance(data.get("questions"), list):
        raise ValueError("Qwen returned an invalid questions structure.")

    questions = data["questions"]

    if len(questions) != count:
        raise ValueError(
            f"Qwen generated {len(questions)} questions instead of {count}. "
            "Please try again."
        )

    validated_questions = []

    for index, q in enumerate(questions, start=1):

        if not isinstance(q, dict):
            raise ValueError("Invalid question format returned by Qwen.")

        options = q.get("options")

        if not isinstance(options, dict):
            raise ValueError(f"Question {index} has invalid options.")

        if set(options.keys()) != {"A", "B", "C", "D"}:
            raise ValueError(f"Question {index} must have four options.")

        if not all(
            isinstance(options[key], str) and options[key].strip()
            for key in ("A", "B", "C", "D")
        ):
            raise ValueError(f"Question {index} has an empty option.")

        if q.get("correct_answer") not in ("A", "B", "C", "D"):
            raise ValueError(f"Question {index} has an invalid correct answer.")

        if not isinstance(q.get("text"), str) or not q["text"].strip():
            raise ValueError(f"Question {index} has invalid question text.")

        validated_questions.append({
            "id": index,
            "text": q["text"].strip(),
            "options": options,
            "correct_answer": q["correct_answer"],
            "topic": q.get("topic")
        })

    return validated_questions


def evaluate_explanations(
    questions: list[dict],
    answers: list,
    difficulty: str,
) -> list[dict]:
    """
    Evaluate student explanations using one local Qwen call.

    Returns:
    [
        {
            "id": 1,
            "relevance_score": 75,
            "feedback": "Explanation feedback"
        }
    ]
    """

    if difficulty not in _EXPLANATION_EXPECTATIONS:
        difficulty = "Medium"

    eval_items = []
    answer_map = {a.question_id: a for a in answers}

    for q in questions:
        ans = answer_map.get(q["id"])

        if not ans:
            continue

        eval_items.append({
            "id": q["id"],
            "question": q["text"],
            "options": q["options"],
            "correct_answer": q["correct_answer"],
            "selected_option": ans.selected_option,
            "user_explanation": ans.explanation
        })

    if not eval_items:
        return []

    items_json = json.dumps(eval_items, ensure_ascii=False)

    expectation = _EXPLANATION_EXPECTATIONS[difficulty]

    prompt = f"""You are a strict but fair educational explanation evaluator.

Difficulty: {difficulty}
Expected understanding: {expectation}

Evaluate each student's explanation independently.

Evaluation criteria:
1. Relevance to the question.
2. Conceptual understanding.
3. Logical reasoning.
4. Factual accuracy.
5. Whether the explanation genuinely justifies the selected option.
6. Whether it meets the selected difficulty level.

IMPORTANT:
- Do not award high scores for keyword matching alone.
- Evaluate actual conceptual understanding.
- An explanation can be good even if the selected option is incorrect.
- An explanation can be poor even if the selected option is correct.
- Do not confuse the selected option with the explanation quality.
- Give scores consistently and fairly.
- Empty or irrelevant explanations must receive very low scores.

Student answers:
{items_json}

Return ONLY a JSON array in this structure:

[
  {{
    "id": 1,
    "relevance_score": 75,
    "feedback": "Brief constructive feedback explaining strengths and weaknesses."
  }}
]

Rules:
- Return one result for EVERY supplied question ID.
- relevance_score must be an integer from 0 to 100.
- Feedback must be 1-2 concise sentences.
"""

    raw_response = _call_ollama(prompt, max_tokens=2048)
    results = _parse_json(raw_response)

    if not isinstance(results, list):
        raise ValueError("Qwen returned an invalid evaluation format.")

    validated = []
    expected_ids = {item["id"] for item in eval_items}
    returned_ids = set()

    for item in results:

        if not isinstance(item, dict) or "id" not in item:
            continue

        question_id = item["id"]

        if question_id not in expected_ids or question_id in returned_ids:
            continue

        try:
            score = int(item.get("relevance_score", 0))
        except (ValueError, TypeError):
            score = 0

        score = max(0, min(100, score))

        validated.append({
            "id": question_id,
            "relevance_score": score,
            "feedback": str(item.get("feedback", "")).strip()
        })

        returned_ids.add(question_id)

    if returned_ids != expected_ids:
        raise ValueError(
            "Qwen did not evaluate every explanation. Please try again."
        )

    return validated

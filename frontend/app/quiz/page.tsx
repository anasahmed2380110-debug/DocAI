'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface Question {
  id: number;
  text: string;
  options: { A: string; B: string; C: string; D: string };
  topic: string | null;
}

interface QuizData {
  session_id: string;
  questions: Question[];
  difficulty: string;
  total_questions: number;
}

interface AnswerEntry {
  selected_option: string;
  explanation: string;
}

const OPTION_KEYS = ['A', 'B', 'C', 'D'] as const;
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

export default function QuizPage() {
  const router = useRouter();

  const [quizData, setQuizData] = useState<QuizData | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, AnswerEntry>>({});
  const [submitted, setSubmitted] = useState<Record<number, boolean>>({});
  const [selected, setSelected] = useState<string | null>(null);
  const [explanation, setExplanation] = useState('');
  const [isFinishing, setIsFinishing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const raw = sessionStorage.getItem('quiz_data');
    if (!raw) { router.replace('/'); return; }
    setQuizData(JSON.parse(raw));
  }, [router]);

  if (!quizData) return null;

  const { session_id, questions, difficulty, total_questions } = quizData;
  const question = questions[currentIndex];
  const isAnswered = !!submitted[question.id];
  const isLast = currentIndex === total_questions - 1;
  const progress = ((currentIndex + (isAnswered ? 1 : 0)) / total_questions) * 100;
  const canSubmit = !!selected && explanation.trim().length > 0;

  const handleSelect = (key: string) => {
    if (!isAnswered) setSelected(key);
  };

  const handleSubmitAnswer = () => {
    if (!selected || !explanation.trim()) return;
    setAnswers((prev) => ({
      ...prev,
      [question.id]: { selected_option: selected, explanation: explanation.trim() },
    }));
    setSubmitted((prev) => ({ ...prev, [question.id]: true }));
  };

  const handleNext = () => {
    setSelected(null);
    setExplanation('');
    setCurrentIndex((i) => i + 1);
  };

  const handleFinish = async () => {
    setIsFinishing(true);
    setError(null);

    const allAnswers = Object.entries(answers).map(([qid, entry]) => ({
      question_id: Number(qid),
      selected_option: entry.selected_option,
      explanation: entry.explanation,
    }));

    try {
      const res = await fetch(`${API_URL}/api/quiz/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id, answers: allAnswers }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Submission failed. Please try again.');
      }

      const result = await res.json();
      sessionStorage.setItem('result_data', JSON.stringify(result));
      sessionStorage.removeItem('quiz_data');
      router.push('/results');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Submission failed. Please try again.');
      setIsFinishing(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col p-6 relative overflow-hidden">
      <div className="absolute -top-24 -left-24 w-96 h-96 bg-blue-200/40 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-slate-300/40 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <header className="flex items-start justify-between mb-6 z-10">
        <h1 className="text-2xl font-semibold text-slate-600">DocAI</h1>
        <div className="text-right">
          <p className="text-slate-600 text-sm font-medium">
            Question {currentIndex + 1} of {total_questions}
          </p>
          <p className="text-slate-400 text-xs mt-0.5">Difficulty: {difficulty}</p>
        </div>
      </header>

      {/* Card */}
      <main className="bg-white rounded-2xl shadow-sm w-full max-w-2xl mx-auto p-8 z-10 flex-1 flex flex-col">

        {isFinishing ? (
          <div className="flex flex-col items-center justify-center flex-1 gap-5">
            <div className="w-10 h-10 border-4 border-slate-200 border-t-slate-400 rounded-full animate-spin" />
            <p className="text-slate-500 text-sm font-medium">Evaluating your answers with AI...</p>
            <p className="text-slate-400 text-xs">This may take a few seconds</p>
          </div>
        ) : (
          <>
            {/* Progress bar */}
            <div className="w-full h-1.5 bg-slate-100 rounded-full mb-6">
              <div
                className="h-1.5 bg-slate-400 rounded-full transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>

            {/* Question */}
            <p className="text-slate-700 text-base font-medium leading-relaxed mb-5">
              {question.text}
            </p>

            {/* MCQ Options */}
            <div className="flex flex-col gap-3">
              {OPTION_KEYS.map((key) => {
                const chosenAnswer = answers[question.id]?.selected_option;
                const isSelected = isAnswered ? chosenAnswer === key : selected === key;

                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => handleSelect(key)}
                    disabled={isAnswered}
                    className={`w-full text-left px-4 py-3 rounded-xl border text-sm transition-colors flex items-center gap-3 ${
                      isAnswered
                        ? isSelected
                          ? 'bg-slate-400 border-slate-400 text-white cursor-default'
                          : 'bg-slate-50 border-slate-100 text-slate-300 cursor-default'
                        : isSelected
                        ? 'bg-slate-400 border-slate-400 text-white'
                        : 'bg-slate-50 border-slate-100 text-slate-600 hover:border-slate-300 hover:bg-white'
                    }`}
                  >
                    <span className={`shrink-0 w-6 h-6 rounded-full border flex items-center justify-center text-xs font-semibold ${
                      isSelected
                        ? 'border-white text-white'
                        : 'border-slate-300 text-slate-400'
                    }`}>
                      {key}
                    </span>
                    {question.options[key]}
                  </button>
                );
              })}
            </div>

            {/* Explanation Textarea */}
            <div className="mt-5">
              <label className="block text-xs font-medium text-slate-500 mb-1.5">
                Explain why you selected this option
                <span className="text-red-400 ml-1">*</span>
              </label>
              {isAnswered ? (
                <div className="w-full px-3 py-2.5 rounded-xl border border-slate-100 bg-slate-50 text-sm text-slate-400 min-h-[80px]">
                  {answers[question.id]?.explanation}
                </div>
              ) : (
                <textarea
                  value={explanation}
                  onChange={(e) => setExplanation(e.target.value)}
                  placeholder="Write your reasoning here... (required)"
                  rows={3}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-700 placeholder:text-slate-300 focus:outline-none focus:border-slate-400 focus:bg-white resize-none transition-colors"
                />
              )}
              {!isAnswered && (
                <p className="text-xs text-slate-400 mt-1">
                  Your explanation will be evaluated by AI for understanding quality.
                </p>
              )}
            </div>

            {error && <p className="text-red-400 text-xs mt-3">{error}</p>}

            {/* Buttons */}
            <div className="flex gap-3 mt-5">
              {!isAnswered && (
                <>
                  <button
                    type="button"
                    onClick={handleSubmitAnswer}
                    disabled={!canSubmit}
                    className="flex-1 py-3 bg-slate-400 hover:bg-slate-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl font-medium transition-colors"
                  >
                    Submit Answer
                  </button>
                  <button
                    type="button"
                    disabled
                    className="flex-1 py-3 bg-white border border-slate-200 text-slate-300 rounded-xl font-medium cursor-not-allowed"
                  >
                    Next
                  </button>
                </>
              )}

              {isAnswered && !isLast && (
                <button
                  type="button"
                  onClick={handleNext}
                  className="flex-1 py-3 bg-white border border-slate-200 hover:border-slate-300 text-slate-500 rounded-xl font-medium transition-colors"
                >
                  Next
                </button>
              )}

              {isAnswered && isLast && (
                <button
                  type="button"
                  onClick={handleFinish}
                  className="flex-1 py-3 bg-slate-400 hover:bg-slate-500 text-white rounded-xl font-medium transition-colors"
                >
                  Finish Quiz
                </button>
              )}
            </div>
          </>
        )}
      </main>

      <footer className="mt-6 text-slate-400 text-sm text-center z-10">
        Select an option and explain your reasoning to submit
      </footer>
    </div>
  );
}

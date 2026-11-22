'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface QuestionResult {
  id: number;
  question: string;
  options: { A: string; B: string; C: string; D: string };
  selected_option: string;
  correct_answer: string;
  is_correct: boolean;
  topic: string | null;
}

interface ResultData {
  difficulty: string;
  total_questions: number;
  correct: number;
  incorrect: number;
  percentage: number;
  results: QuestionResult[];
}

function getPreparationLabel(pct: number): { label: string; color: string } {
  if (pct >= 80) return { label: 'Excellent Preparation', color: 'text-emerald-500' };
  if (pct >= 60) return { label: 'Good Preparation', color: 'text-blue-500' };
  if (pct >= 40) return { label: 'Needs Improvement', color: 'text-amber-500' };
  return { label: 'More Practice Required', color: 'text-red-400' };
}

export default function ResultsPage() {
  const router = useRouter();
  const [data, setData] = useState<ResultData | null>(null);

  useEffect(() => {
    const raw = sessionStorage.getItem('result_data');
    if (!raw) { router.replace('/'); return; }
    setData(JSON.parse(raw));
  }, [router]);

  if (!data) return null;

  const { difficulty, total_questions, correct, incorrect, percentage, results } = data;
  const { label, color } = getPreparationLabel(percentage);

  return (
    <div className="min-h-screen bg-slate-100 p-6 relative overflow-hidden">
      <div className="absolute -top-24 -left-24 w-96 h-96 bg-blue-200/40 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-slate-300/40 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-2xl mx-auto z-10 relative">

        {/* Header */}
        <header className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-semibold text-slate-600">DocAI</h1>
          <span className="text-xs text-slate-400 border border-slate-200 rounded-lg px-3 py-1">
            {difficulty}
          </span>
        </header>

        {/* Score Card */}
        <div className="bg-white rounded-2xl shadow-sm p-8 mb-4">
          <p className="text-slate-400 text-sm mb-1">Your Score</p>
          <div className="flex items-end gap-3 mb-2">
            <span className="text-5xl font-bold text-slate-600">{percentage}%</span>
          </div>
          <p className={`text-sm font-semibold ${color}`}>{label}</p>

          {/* Progress bar */}
          <div className="w-full h-2 bg-slate-100 rounded-full mt-4">
            <div
              className="h-2 bg-slate-400 rounded-full transition-all duration-700"
              style={{ width: `${percentage}%` }}
            />
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-4 mt-6 text-center">
            <div className="bg-slate-50 rounded-xl p-3">
              <p className="text-2xl font-bold text-slate-600">{total_questions}</p>
              <p className="text-xs text-slate-400 mt-0.5">Total</p>
            </div>
            <div className="bg-emerald-50 rounded-xl p-3">
              <p className="text-2xl font-bold text-emerald-500">{correct}</p>
              <p className="text-xs text-slate-400 mt-0.5">Correct</p>
            </div>
            <div className="bg-red-50 rounded-xl p-3">
              <p className="text-2xl font-bold text-red-400">{incorrect}</p>
              <p className="text-xs text-slate-400 mt-0.5">Incorrect</p>
            </div>
          </div>
        </div>

        {/* Per-question breakdown */}
        <div className="bg-white rounded-2xl shadow-sm p-6 mb-4">
          <p className="text-slate-600 text-sm font-semibold mb-4">Question Review</p>
          <div className="flex flex-col gap-4">
            {results.map((r, i) => (
              <div key={r.id} className="border border-slate-100 rounded-xl p-4">
                <div className="flex items-start gap-2 mb-3">
                  <span className={`mt-0.5 shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
                    r.is_correct ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-400'
                  }`}>
                    {r.is_correct ? '✓' : '✗'}
                  </span>
                  <p className="text-slate-700 text-sm font-medium leading-snug">
                    {i + 1}. {r.question}
                  </p>
                </div>

                <div className="flex flex-col gap-1.5 pl-7">
                  {(['A', 'B', 'C', 'D'] as const).map((key) => {
                    const isCorrect = key === r.correct_answer;
                    const isSelected = key === r.selected_option;
                    const isWrongSelection = isSelected && !isCorrect;

                    return (
                      <div
                        key={key}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs ${
                          isCorrect
                            ? 'bg-emerald-50 text-emerald-700 font-medium'
                            : isWrongSelection
                            ? 'bg-red-50 text-red-500'
                            : 'text-slate-400'
                        }`}
                      >
                        <span className={`shrink-0 w-5 h-5 rounded-full border flex items-center justify-center font-semibold text-xs ${
                          isCorrect
                            ? 'border-emerald-400 text-emerald-600'
                            : isWrongSelection
                            ? 'border-red-300 text-red-400'
                            : 'border-slate-200 text-slate-300'
                        }`}>
                          {key}
                        </span>
                        {r.options[key]}
                        {isCorrect && (
                          <span className="ml-auto text-emerald-500 text-xs">✓ Correct</span>
                        )}
                        {isWrongSelection && (
                          <span className="ml-auto text-red-400 text-xs">Your answer</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Retake button */}
        <button
          type="button"
          onClick={() => {
            sessionStorage.removeItem('result_data');
            router.push('/');
          }}
          className="w-full py-3 bg-slate-400 hover:bg-slate-500 text-white rounded-xl font-medium transition-colors"
        >
          Take Another Quiz
        </button>
      </div>
    </div>
  );
}

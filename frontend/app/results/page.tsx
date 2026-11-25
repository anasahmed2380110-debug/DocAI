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
  explanation: string;
  relevance_score: number;
  explanation_pass: boolean;
  ai_feedback: string;
  mark: number;
  topic: string | null;
}

interface ResultData {
  difficulty: string;
  total_questions: number;
  obtained_marks: number;
  correct_mcq: number;
  incorrect_mcq: number;
  percentage: number;
  overall_pass: boolean;
  results: QuestionResult[];
}

function ScoreBadge({ score }: { score: number }) {
  const color =
    score > 80 ? 'bg-emerald-100 text-emerald-600' :
    score > 55 ? 'bg-blue-100 text-blue-600' :
    'bg-red-100 text-red-400';
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${color}`}>
      {score}%
    </span>
  );
}

function OutcomeTag({ r }: { r: QuestionResult }) {
  if (r.is_correct && r.explanation_pass) {
    return <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">✓ Correct + Strong Explanation — 1 mark</span>;
  }
  if (r.is_correct && !r.explanation_pass) {
    return <span className="text-xs font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">Correct option, weak explanation — 0 marks</span>;
  }
  if (!r.is_correct && r.explanation_pass) {
    return <span className="text-xs font-semibold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full">Wrong option, good explanation — 0 marks</span>;
  }
  return <span className="text-xs font-semibold text-red-500 bg-red-50 px-2 py-0.5 rounded-full">Wrong option + weak explanation — 0 marks</span>;
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

  const {
    difficulty, total_questions, obtained_marks,
    correct_mcq, incorrect_mcq, percentage, overall_pass, results,
  } = data;

  return (
    <div className="min-h-screen bg-slate-100 p-6 relative overflow-hidden">
      <div className="absolute -top-24 -left-24 w-96 h-96 bg-blue-200/40 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-slate-300/40 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-2xl mx-auto z-10 relative">

        {/* Header */}
        <header className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-semibold text-slate-600">DocAI</h1>
          <span className="text-xs text-slate-400 border border-slate-200 rounded-lg px-3 py-1">{difficulty}</span>
        </header>

        {/* Score Card */}
        <div className="bg-white rounded-2xl shadow-sm p-8 mb-4">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-slate-400 text-sm mb-1">Final Score</p>
              <div className="flex items-end gap-3">
                <span className="text-5xl font-bold text-slate-600">{percentage}%</span>
                <span className="text-slate-400 text-sm mb-1.5">{obtained_marks}/{total_questions} marks</span>
              </div>
            </div>
            <div className={`px-4 py-2 rounded-xl text-sm font-bold ${
              overall_pass
                ? 'bg-emerald-100 text-emerald-600'
                : 'bg-red-100 text-red-500'
            }`}>
              {overall_pass ? 'PASS' : 'FAIL'}
            </div>
          </div>

          <p className="text-xs text-slate-400 mb-4">
            To pass: correct option <span className="font-medium">AND</span> explanation relevance &gt; 55% required for each mark.
          </p>

          {/* Progress bar */}
          <div className="w-full h-2 bg-slate-100 rounded-full">
            <div
              className={`h-2 rounded-full transition-all duration-700 ${overall_pass ? 'bg-emerald-400' : 'bg-red-400'}`}
              style={{ width: `${percentage}%` }}
            />
          </div>

          {/* Stats */}
          <div className="grid grid-cols-4 gap-3 mt-6 text-center">
            <div className="bg-slate-50 rounded-xl p-3">
              <p className="text-2xl font-bold text-slate-600">{total_questions}</p>
              <p className="text-xs text-slate-400 mt-0.5">Total</p>
            </div>
            <div className="bg-emerald-50 rounded-xl p-3">
              <p className="text-2xl font-bold text-emerald-500">{correct_mcq}</p>
              <p className="text-xs text-slate-400 mt-0.5">MCQ Correct</p>
            </div>
            <div className="bg-red-50 rounded-xl p-3">
              <p className="text-2xl font-bold text-red-400">{incorrect_mcq}</p>
              <p className="text-xs text-slate-400 mt-0.5">MCQ Wrong</p>
            </div>
            <div className={`rounded-xl p-3 ${overall_pass ? 'bg-emerald-50' : 'bg-red-50'}`}>
              <p className={`text-2xl font-bold ${overall_pass ? 'text-emerald-500' : 'text-red-400'}`}>{obtained_marks}</p>
              <p className="text-xs text-slate-400 mt-0.5">Marks</p>
            </div>
          </div>
        </div>

        {/* Per-question breakdown */}
        <div className="bg-white rounded-2xl shadow-sm p-6 mb-4">
          <p className="text-slate-600 text-sm font-semibold mb-4">Question Review</p>
          <div className="flex flex-col gap-5">
            {results.map((r, i) => (
              <div key={r.id} className="border border-slate-100 rounded-xl p-4">

                {/* Question header */}
                <div className="flex items-start gap-2 mb-3">
                  <span className={`mt-0.5 shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
                    r.mark === 1 ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-400'
                  }`}>
                    {r.mark === 1 ? '✓' : '✗'}
                  </span>
                  <p className="text-slate-700 text-sm font-medium leading-snug">
                    {i + 1}. {r.question}
                  </p>
                </div>

                {/* Options */}
                <div className="flex flex-col gap-1.5 pl-7 mb-3">
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
                        {isCorrect && <span className="ml-auto text-emerald-500 text-xs">✓ Correct</span>}
                        {isWrongSelection && <span className="ml-auto text-red-400 text-xs">Your answer</span>}
                      </div>
                    );
                  })}
                </div>

                {/* Outcome tag */}
                <div className="pl-7 mb-3">
                  <OutcomeTag r={r} />
                </div>

                {/* Explanation section */}
                <div className="pl-7 space-y-2">
                  <div className="bg-slate-50 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs font-medium text-slate-500">Your Explanation</p>
                      <ScoreBadge score={r.relevance_score} />
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">{r.explanation}</p>
                  </div>

                  <div className={`rounded-lg p-3 ${r.explanation_pass ? 'bg-blue-50' : 'bg-amber-50'}`}>
                    <p className={`text-xs font-medium mb-1 ${r.explanation_pass ? 'text-blue-600' : 'text-amber-600'}`}>
                      AI Feedback
                    </p>
                    <p className={`text-xs leading-relaxed ${r.explanation_pass ? 'text-blue-700' : 'text-amber-700'}`}>
                      {r.ai_feedback}
                    </p>
                  </div>
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

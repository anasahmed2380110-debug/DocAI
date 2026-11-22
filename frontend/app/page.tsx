'use client';

import { useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';

type Difficulty = 'Easy' | 'Medium' | 'Hard';
type QuestionCount = 5 | 10 | 15 | 20;

const DIFFICULTIES: Difficulty[] = ['Easy', 'Medium', 'Hard'];
const QUESTION_COUNTS: QuestionCount[] = [5, 10, 15, 20];
const MAX_FILE_SIZE_MB = 20;

// These match the actual backend stages in order
const PROCESSING_STEPS = [
  'Uploading PDF...',
  'Extracting document text...',
  'Analyzing content...',
  'Generating questions...',
  'Preparing your quiz...',
];

export default function HomePage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [difficulty, setDifficulty] = useState<Difficulty>('Easy');
  const [questionCount, setQuestionCount] = useState<QuestionCount>(5);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState('');

  const validateAndSetFile = (f: File) => {
    if (f.type !== 'application/pdf') {
      setError('Only PDF files are accepted.');
      return;
    }
    if (f.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      setError(`File size must be under ${MAX_FILE_SIZE_MB} MB.`);
      return;
    }
    setError(null);
    setFile(f);
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) validateAndSetFile(f);
  }, []);

  const removeFile = (e: React.MouseEvent) => {
    e.stopPropagation();
    setFile(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleStartQuiz = async () => {
    if (!file) {
      setError('Please upload a PDF file first.');
      return;
    }

    setIsProcessing(true);
    setError(null);
    setProcessingStep(PROCESSING_STEPS[0]);

    // Progress through steps while backend processes
    const timers = [
      setTimeout(() => setProcessingStep(PROCESSING_STEPS[1]), 1200),
      setTimeout(() => setProcessingStep(PROCESSING_STEPS[2]), 3000),
      setTimeout(() => setProcessingStep(PROCESSING_STEPS[3]), 5500),
    ];

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('difficulty', difficulty);
      formData.append('question_count', questionCount.toString());

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

const res = await fetch(
  `${API_URL}/api/quiz/start`,
        { method: 'POST', body: formData }
      );

      timers.forEach(clearTimeout);

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Something went wrong. Please try again.');
      }

      const data = await res.json();
      setProcessingStep(PROCESSING_STEPS[4]);

      // Store quiz data for Page 2
      sessionStorage.setItem('quiz_data', JSON.stringify(data));

      // Brief pause so user sees the final step
      await new Promise((r) => setTimeout(r, 600));
      router.push('/quiz');
    } catch (err: unknown) {
      timers.forEach(clearTimeout);
      setError(
        err instanceof Error ? err.message : 'Failed to start quiz. Please try again.'
      );
      setIsProcessing(false);
      setProcessingStep('');
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Background blobs */}
      <div className="absolute -top-24 -left-24 w-96 h-96 bg-blue-200/40 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-slate-300/40 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <header className="mb-8 text-center z-10">
        <h1 className="text-4xl font-semibold text-slate-600">DocAI</h1>
        <p className="text-slate-400 mt-1 text-sm">Upload PDF - Take Quiz - Check Preparation</p>
      </header>

      {/* Card */}
      <main className="bg-white rounded-2xl shadow-sm w-full max-w-xl p-8 z-10">

        {isProcessing ? (
          /* Processing State — shown instead of the form */
          <div className="flex flex-col items-center justify-center py-16 gap-5">
            <div className="w-10 h-10 border-4 border-slate-200 border-t-slate-400 rounded-full animate-spin" />
            <p className="text-slate-500 text-sm font-medium">{processingStep}</p>
          </div>
        ) : (
          <>
            {/* Drop Zone */}
            <div
              onDrop={onDrop}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-12 flex flex-col items-center cursor-pointer transition-colors select-none ${
                isDragging
                  ? 'border-slate-400 bg-slate-50'
                  : 'border-slate-200 bg-white hover:bg-slate-50'
              }`}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="48"
                height="48"
                fill="none"
                viewBox="0 0 24 24"
                stroke="#94a3b8"
                strokeWidth="1.5"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 16v-8m0 0-3 3m3-3 3 3M6.75 19.5a4.5 4.5 0 0 1-1.44-8.765 6 6 0 0 1 11.38 0A4.5 4.5 0 0 1 17.25 19.5H6.75z"
                />
              </svg>
              <p className="text-slate-500 mt-3 text-sm font-medium">Drag & Drop your PDF here</p>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) validateAndSetFile(f); }}
              />
            </div>

            {/* Browse + Filename */}
            <div className="flex items-center gap-3 mt-4 min-w-0">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="shrink-0 px-4 py-1.5 bg-slate-400 hover:bg-slate-500 text-white text-sm rounded-lg transition-colors"
              >
                Browse Files
              </button>

              {file ? (
                <>
                  <div className="flex items-center gap-1.5 text-sm text-slate-500 min-w-0">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="15"
                      height="15"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      className="shrink-0"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9z"
                      />
                    </svg>
                    <span className="truncate">{file.name}</span>
                  </div>
                  <button
                    type="button"
                    onClick={removeFile}
                    className="ml-auto shrink-0 text-slate-300 hover:text-slate-500 transition-colors text-xs"
                    aria-label="Remove file"
                  >
                    ✕
                  </button>
                </>
              ) : (
                <span className="text-sm text-slate-300">No file selected</span>
              )}
            </div>

            {/* Error */}
            {error && <p className="text-red-400 text-xs mt-2">{error}</p>}

            {/* Difficulty */}
            <div className="mt-6">
              <p className="text-slate-600 text-sm font-medium mb-2">Difficulty</p>
              <div className="flex gap-2">
                {DIFFICULTIES.map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDifficulty(d)}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                      difficulty === d
                        ? 'bg-slate-400 text-white border-slate-400'
                        : 'bg-white text-slate-400 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>

            {/* Question Quantity */}
            <div className="mt-5">
              <p className="text-slate-600 text-sm font-medium mb-2">Question Quantity</p>
              <div className="flex gap-2">
                {QUESTION_COUNTS.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => setQuestionCount(q)}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                      questionCount === q
                        ? 'bg-slate-400 text-white border-slate-400'
                        : 'bg-white text-slate-400 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>

            {/* Start Quiz */}
            <button
              type="button"
              onClick={handleStartQuiz}
              className="mt-6 w-full py-3 bg-slate-400 hover:bg-slate-500 text-white rounded-xl font-medium transition-colors"
            >
              Start Quiz
            </button>
          </>
        )}
      </main>

      <footer className="mt-6 text-slate-400 text-sm z-10">No login needed</footer>
    </div>
  );
}

import React, { useState } from 'react';
import {
  HelpCircle,
  Sparkles,
  CheckCircle2,
  XCircle,
  ArrowRight,
  RotateCcw,
  Award,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { useApp } from '../../context/AppContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { QuizQuestion } from '../../types';
import { validateAndNormalizeQuestion, gradeQuizAnswer } from '../../utils/quizGrading';
import { NavigationTab } from '../Sidebar';

interface QuizViewProps {
  onNavigate: (tab: NavigationTab) => void;
}

export const QuizView: React.FC<QuizViewProps> = ({ onNavigate }) => {
  const {
    curriculum,
    activeTopic,
    setActiveTopic,
    updateTopicMastery,
    recordMisconception,
    addXP,
  } = useApp();
  const { t } = useLanguage();

  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [questions, setQuestions] = useState<(QuizQuestion & { isValidKey?: boolean })[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOptionId, setSelectedOptionId] = useState<string>('');
  const [selectedAnswer, setSelectedAnswer] = useState<string>('');
  const [shortAnswerText, setShortAnswerText] = useState<string>('');
  const [evaluationResult, setEvaluationResult] = useState<any | null>(null);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [isLoadingQuiz, setIsLoadingQuiz] = useState(false);
  const [submissions, setSubmissions] = useState<
    Record<string, { studentAnswer: string; selectedOptionId?: string; isCorrect: boolean }>
  >({});
  const [isFinished, setIsFinished] = useState(false);

  // Derived score calculated strictly from validated answer keys once per question
  const score = Object.values(submissions).filter((s) => s.isCorrect).length;

  // Clear in-progress quiz questions when the curriculum or active topic changes to avoid stale questions
  React.useEffect(() => {
    setQuestions([]);
    setCurrentIndex(0);
    setSelectedOptionId('');
    setSelectedAnswer('');
    setShortAnswerText('');
    setEvaluationResult(null);
    setSubmissions({});
    setIsFinished(false);
  }, [curriculum.id, activeTopic?.id]);

  const allTopics = curriculum.units.flatMap((u) => u.topics);
  const currentQ = questions[currentIndex];

  const handleStartQuiz = async () => {
    setIsLoadingQuiz(true);
    setSubmissions({});
    setCurrentIndex(0);
    setIsFinished(false);
    setEvaluationResult(null);
    setSelectedOptionId('');
    setSelectedAnswer('');
    setShortAnswerText('');

    const targetTopic = activeTopic || allTopics[0];
    const parentUnit = curriculum.units.find((u) =>
      u.topics.some((t) => t.id === targetTopic?.id)
    );

    try {
      const res = await fetch('/api/assessment/generate-quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: curriculum.subject,
          unitTitle: parentUnit?.title || '',
          topicTitle: targetTopic?.title || curriculum.subject,
          subtopics: targetTopic?.subtopics || [],
          studyNotes: targetTopic?.studyNotes || '',
          difficulty,
          count: 5,
        }),
      });

      const data = await res.json();
      if (data.questions && data.questions.length > 0) {
        const validated = data.questions.map((q: any, idx: number) =>
          validateAndNormalizeQuestion(q, idx)
        );
        setQuestions(validated);
      }
    } catch (err) {
      console.error('Quiz creation failed:', err);
    } finally {
      setIsLoadingQuiz(false);
    }
  };

  const handleSubmitAnswer = async () => {
    if (!currentQ || isEvaluating) return;

    // Prevent duplicate submission from scoring again
    if (submissions[currentQ.id]) return;

    const answerGiven = currentQ.type === 'short_answer' ? shortAnswerText.trim() : selectedAnswer.trim();
    if (!answerGiven) return;

    // 1. Evaluate deterministically against the validated answer key
    const localGrading = gradeQuizAnswer(
      currentQ,
      answerGiven,
      currentQ.type === 'short_answer' ? undefined : selectedOptionId
    );

    setIsEvaluating(true);
    try {
      const res = await fetch('/api/assessment/evaluate-answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionPrompt: currentQ.prompt,
          studentAnswer: answerGiven,
          correctAnswer: currentQ.correctAnswer,
          correctOptionId: currentQ.correctOptionId,
          selectedOptionId: currentQ.type === 'mcq' || currentQ.type === 'boolean' ? selectedOptionId : undefined,
          options: currentQ.options,
          optionItems: currentQ.optionItems,
          explanation: currentQ.explanation,
          commonMisconception: currentQ.commonMisconception,
          counterExample: currentQ.counterExample,
          remediationTip: currentQ.remediationTip,
          topicTitle: activeTopic?.title || 'Active Concept',
          subject: curriculum.subject,
          questionType: currentQ.type,
        }),
      });

      const data = await res.json();

      // For objective questions, score is strictly derived from validated answer key localGrading
      // For short_answer questions with valid key, accept semantic AI verdict if available
      const isCorrect =
        currentQ.type === 'short_answer'
          ? (localGrading.isCorrect || (data.isCorrect && currentQ.isValidKey !== false))
          : localGrading.isCorrect;

      const evalData = {
        ...data,
        isCorrect,
        correctAnswer: currentQ.correctAnswer || data.correctAnswer,
        diagnosis: isCorrect
          ? `Correct! ${currentQ.explanation || data.diagnosis || ''}`
          : (data.diagnosis || localGrading.diagnosis),
        errorType: isCorrect ? 'none' : (data.errorType || localGrading.errorType),
      };

      setEvaluationResult(evalData);

      // Record submission once - prevents duplicate submissions from altering score
      setSubmissions((prev) => ({
        ...prev,
        [currentQ.id]: {
          studentAnswer: answerGiven,
          selectedOptionId: currentQ.type === 'short_answer' ? undefined : selectedOptionId,
          isCorrect,
        },
      }));

      if (isCorrect) {
        addXP(25, 'Correct quiz answer');
      } else {
        // Log misconception if classified as conceptual error or knowledge gap
        if (evalData.errorType === 'deep_misconception' || evalData.errorType === 'knowledge_gap') {
          const parentUnit = curriculum.units.find((u) =>
            u.topics.some((t) => t.id === activeTopic?.id)
          );
          recordMisconception({
            topicId: activeTopic?.id || 't1',
            topicTitle: activeTopic?.title || 'Core Topic',
            unitTitle: parentUnit?.title || 'Active Unit',
            questionPrompt: currentQ.prompt,
            studentAnswer: answerGiven,
            correctAnswer: currentQ.correctAnswer,
            errorType: evalData.errorType,
            diagnosis: evalData.diagnosis,
            counterExample: evalData.counterExample || 'A common misconception in this domain.',
            remediationTip: evalData.remediationTip || 'Review the core mechanism.',
            isResolved: false,
            followUpDiagnostic: evalData.followUpDiagnostic,
          });
        }
      }
    } catch (err) {
      console.error('Answer evaluation failed:', err);
      // Resilient fallback evaluation strictly from validated answer key
      const evalData = {
        isCorrect: localGrading.isCorrect,
        errorType: localGrading.errorType,
        diagnosis: localGrading.diagnosis,
        correctAnswer: currentQ.correctAnswer,
        remediationTip: currentQ.explanation,
      };
      setEvaluationResult(evalData);

      setSubmissions((prev) => ({
        ...prev,
        [currentQ.id]: {
          studentAnswer: answerGiven,
          selectedOptionId: currentQ.type === 'short_answer' ? undefined : selectedOptionId,
          isCorrect: localGrading.isCorrect,
        },
      }));

      if (localGrading.isCorrect) {
        addXP(25, 'Correct quiz answer');
      }
    } finally {
      setIsEvaluating(false);
    }
  };

  const handleNextQuestion = () => {
    // If the current question was never submitted, record it as unanswered (scored as 0)
    const currentSubmissions = { ...submissions };
    if (!currentSubmissions[currentQ.id]) {
      currentSubmissions[currentQ.id] = {
        studentAnswer: '',
        isCorrect: false,
      };
      setSubmissions(currentSubmissions);
    }

    setEvaluationResult(null);
    setSelectedOptionId('');
    setSelectedAnswer('');
    setShortAnswerText('');

    if (currentIndex + 1 < questions.length) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      setIsFinished(true);
      // Final score calculated strictly from all submissions
      const finalScore = Object.values(currentSubmissions).filter((s) => s.isCorrect).length;
      const finalPercentage = Math.round((finalScore / Math.max(1, questions.length)) * 100);
      if (activeTopic) {
        const parentUnit = curriculum.units.find((u) =>
          u.topics.some((t) => t.id === activeTopic.id)
        );
        if (parentUnit) {
          const newState = finalPercentage >= 80 ? 'understood' : finalPercentage >= 50 ? 'partial' : 'unfamiliar';
          updateTopicMastery(parentUnit.id, activeTopic.id, newState, finalPercentage);
        }
      }

      if (finalPercentage >= 80) {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
        });
        addXP(100, 'Quiz Mastery Achieved (>80%)');
      }
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-violet-700 tracking-wide uppercase">
            <HelpCircle className="w-4 h-4 text-violet-600" />
            <span>{t('quiz_title')}</span>
          </div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight mt-1">
            {t('quiz_title')}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {t('quiz_subtitle')}
          </p>
        </div>

        {/* Difficulty Selector */}
        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg shrink-0">
          {(['easy', 'medium', 'hard'] as const).map((d) => (
            <button
              key={d}
              onClick={() => setDifficulty(d)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors capitalize ${
                difficulty === d
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {d}
            </button>
          ))}
        </div>
      </div>

      {/* Target Topic Anchoring */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <span className="px-2.5 py-0.5 rounded bg-violet-100 text-violet-800 font-semibold text-[11px] uppercase tracking-wide">
            {curriculum.subject}
          </span>
          <span className="font-semibold text-slate-700 ml-1">{t('quiz_select_topic')}</span>
          <select
            value={activeTopic?.id || ''}
            onChange={(e) => {
              const selected = allTopics.find((t) => t.id === e.target.value);
              if (selected) setActiveTopic(selected);
            }}
            className="bg-white border border-slate-200 text-slate-900 font-medium rounded-lg px-2.5 py-1 focus:outline-none focus:ring-1 focus:ring-violet-500"
          >
            {allTopics.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title} ({t.masteryState})
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={handleStartQuiz}
          disabled={isLoadingQuiz}
          className="px-3.5 py-1.5 text-xs font-semibold text-white bg-violet-600 hover:bg-violet-700 disabled:bg-violet-400 rounded-lg shadow-xs flex items-center gap-1.5 transition-colors self-start sm:self-auto"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>{isLoadingQuiz ? t('generating') : t('quiz_generate_btn')}</span>
        </button>
      </div>

      {questions.length === 0 ? (
        /* Empty State */
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center shadow-xs space-y-4">
          <div className="w-12 h-12 rounded-full bg-violet-50 border border-violet-100 flex items-center justify-center mx-auto text-violet-600">
            <HelpCircle className="w-6 h-6" />
          </div>
          <div className="space-y-1 max-w-md mx-auto">
            <h2 className="text-base font-bold text-slate-900">
              {activeTopic?.title || curriculum.subject}
            </h2>
            <p className="text-xs text-slate-500">
              {t('quiz_subtitle')}
            </p>
          </div>
          <button
            onClick={handleStartQuiz}
            disabled={isLoadingQuiz}
            className="px-5 py-2.5 text-xs font-semibold text-white bg-violet-600 hover:bg-violet-700 rounded-xl shadow-xs transition-colors"
          >
            {t('quiz_generate_btn')}
          </button>
        </div>
      ) : isFinished ? (
        /* Results Screen */
        <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center shadow-xs space-y-6 max-w-xl mx-auto">
          <div className="w-16 h-16 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center mx-auto text-emerald-600">
            <Award className="w-8 h-8" />
          </div>
          <div className="space-y-1">
            <h2 className="text-xl font-bold text-slate-900">{t('quiz_completed_title')}</h2>
            <p className="text-xs text-slate-500">
              {t('quiz_score')}: <span className="font-bold text-slate-900">{score}</span> /{' '}
              <span className="font-bold text-slate-900">{questions.length}</span> (
              <span className="font-mono tabular-nums font-bold">
                {Math.round((score / Math.max(1, questions.length)) * 100)}%
              </span>
              )
            </p>
          </div>

          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 text-left space-y-1.5">
            <div>• Topic mastery score updated for {activeTopic?.title || curriculum.subject}.</div>
            <div>• Conceptual slips transferred to Misconception Clinic for targeted practice.</div>
          </div>

          <div className="flex items-center justify-center gap-3">
            <button
              onClick={handleStartQuiz}
              className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{t('quiz_retry')}</span>
            </button>
            <button
              onClick={() => onNavigate('clinic')}
              className="px-4 py-2 text-xs font-semibold text-violet-700 bg-violet-50 hover:bg-violet-100 rounded-lg transition-colors flex items-center gap-1.5"
            >
              <span>{t('nav_clinic')}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      ) : (
        /* Active Question Display */
        <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-xs space-y-6">
          {/* Question Meta Header */}
          <div className="flex items-center justify-between text-xs text-slate-500 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <span className="font-bold text-violet-700 uppercase font-mono">
                {t('quiz_question_num')} {currentIndex + 1} / {questions.length}
              </span>
              <span aria-hidden="true">·</span>
              <span className="capitalize">{currentQ.type.replace('_', ' ')}</span>
            </div>

            <div className="font-mono text-slate-600">
              {t('quiz_score')}: <span className="font-bold text-slate-900">{score}</span>
            </div>
          </div>

          {/* Prompt */}
          <div className="space-y-2">
            {currentQ.isValidKey === false && (
              <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-center gap-2 font-medium">
                <span>⚠️ Note: This question has an unverified answer key and will not award points.</span>
              </div>
            )}
            <div className="text-base sm:text-lg font-semibold text-slate-900 leading-relaxed">
              {currentQ.prompt}
            </div>
          </div>

          {/* Answer Inputs */}
          {currentQ.type === 'mcq' || currentQ.type === 'boolean' ? (
            <div className="space-y-2.5">
              {(currentQ.optionItems && currentQ.optionItems.length > 0
                ? currentQ.optionItems
                : (currentQ.options || ['True', 'False']).map((opt, oIdx) => ({
                    id: ['A', 'B', 'C', 'D'][oIdx] || `opt_${oIdx}`,
                    text: opt,
                  }))
              ).map((optItem, oIdx) => {
                const isSelected = selectedOptionId === optItem.id || selectedAnswer === optItem.text;
                const letterBadge =
                  currentQ.type === 'boolean'
                    ? null
                    : optItem.id && optItem.id.length === 1
                    ? optItem.id.toUpperCase()
                    : String.fromCharCode(65 + oIdx);

                return (
                  <button
                    key={optItem.id || oIdx}
                    onClick={() => {
                      if (!evaluationResult && !submissions[currentQ.id]) {
                        setSelectedOptionId(optItem.id);
                        setSelectedAnswer(optItem.text);
                      }
                    }}
                    disabled={!!evaluationResult || !!submissions[currentQ.id]}
                    className={`w-full text-left p-4 rounded-xl border text-xs sm:text-sm font-medium transition-colors flex items-start gap-3 ${
                      isSelected
                        ? 'border-violet-600 bg-violet-50 text-violet-900 shadow-xs ring-1 ring-violet-500'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-800'
                    }`}
                  >
                    {letterBadge && (
                      <span
                        className={`w-6 h-6 rounded-md flex items-center justify-center font-bold text-xs shrink-0 ${
                          isSelected ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {letterBadge}
                      </span>
                    )}
                    <span className="flex-1 pt-0.5">{optItem.text}</span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="space-y-2">
              <textarea
                value={shortAnswerText}
                onChange={(e) => setShortAnswerText(e.target.value)}
                disabled={!!evaluationResult || !!submissions[currentQ.id]}
                placeholder="Type your explanation here..."
                className="w-full p-4 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none min-h-[100px]"
              />
            </div>
          )}

          {/* Evaluation Feedback Panel */}
          {evaluationResult && (
            <div
              className={`p-4 rounded-xl border space-y-2.5 ${
                evaluationResult.isCorrect
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
                  : 'bg-amber-50 border-amber-200 text-amber-950'
              }`}
            >
              <div className="flex items-center gap-2 font-bold text-xs sm:text-sm">
                {evaluationResult.isCorrect ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>{t('quiz_correct')}</span>
                  </>
                ) : (
                  <>
                    <XCircle className="w-4 h-4 text-amber-700" />
                    <span>
                      {t('quiz_incorrect')}{' '}
                      {evaluationResult.errorType && evaluationResult.errorType !== 'none'
                        ? `(${evaluationResult.errorType.replace('_', ' ')})`
                        : ''}
                    </span>
                  </>
                )}
              </div>

              {!evaluationResult.isCorrect && (
                <div className="text-xs bg-white/90 p-2.5 rounded-lg border border-amber-200 text-amber-950 font-medium">
                  <span className="font-semibold text-amber-900">Correct Answer:</span>{' '}
                  {currentQ.correctAnswer || evaluationResult.correctAnswer}
                </div>
              )}

              <p className="text-xs leading-relaxed text-slate-700">
                {evaluationResult.diagnosis}
              </p>

              {evaluationResult.counterExample && (
                <div className="p-2.5 bg-white/70 border border-amber-200/60 rounded-lg text-xs text-amber-900">
                  <span className="font-semibold">Counter-Example:</span> {evaluationResult.counterExample}
                </div>
              )}

              {evaluationResult.remediationTip && (
                <div className="text-[11px] text-slate-600">
                  <span className="font-semibold">{t('quiz_explanation')}:</span> {evaluationResult.remediationTip}
                </div>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-100">
            <span className="text-xs text-slate-400">
              {evaluationResult || !!submissions[currentQ.id] ? t('quiz_next_question') : t('submit')}
            </span>

            {evaluationResult || !!submissions[currentQ.id] ? (
              <button
                onClick={handleNextQuestion}
                className="px-5 py-2.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-xl shadow-xs flex items-center gap-2 transition-colors"
              >
                <span>{currentIndex + 1 < questions.length ? t('quiz_next_question') : t('quiz_completed_title')}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                onClick={handleSubmitAnswer}
                disabled={isEvaluating || (!selectedAnswer && !shortAnswerText.trim())}
                className="px-5 py-2.5 text-xs font-semibold text-white bg-violet-600 hover:bg-violet-700 disabled:bg-violet-300 rounded-xl shadow-xs transition-colors"
              >
                {isEvaluating ? t('loading') : t('quiz_submit_answer')}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

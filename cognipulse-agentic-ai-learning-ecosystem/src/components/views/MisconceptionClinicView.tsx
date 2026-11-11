import React, { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Sparkles,
  ShieldCheck,
  Brain,
  Trash2,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { useApp } from '../../context/AppContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { MisconceptionRecord } from '../../types';
import { NavigationTab } from '../Sidebar';

interface MisconceptionClinicViewProps {
  onNavigate: (tab: NavigationTab) => void;
}

export const MisconceptionClinicView: React.FC<MisconceptionClinicViewProps> = ({ onNavigate }) => {
  const { misconceptions, resolveMisconception, deleteMisconception, addXP } = useApp();
  const { t } = useLanguage();

  const [activeFilter, setActiveFilter] = useState<'all' | 'unresolved' | 'resolved'>('unresolved');
  const [selectedDiagnosticAnswer, setSelectedDiagnosticAnswer] = useState<Record<string, string>>({});
  const [diagnosticFeedback, setDiagnosticFeedback] = useState<Record<string, { isCorrect: boolean; message: string }>>({});

  const filtered = misconceptions.filter((m) => {
    if (activeFilter === 'unresolved') return !m.isResolved;
    if (activeFilter === 'resolved') return m.isResolved;
    return true;
  });

  const handleTestDiagnostic = (record: MisconceptionRecord) => {
    const chosen = selectedDiagnosticAnswer[record.id];
    if (!chosen || !record.followUpDiagnostic) return;

    const isMatch = chosen.trim().toLowerCase() === record.followUpDiagnostic.correctOption.trim().toLowerCase();

    if (isMatch) {
      setDiagnosticFeedback((prev) => ({
        ...prev,
        [record.id]: {
          isCorrect: true,
          message: 'Correct! You successfully broke the misconception and verified the true principle.',
        },
      }));
      resolveMisconception(record.id);
      addXP(50, 'Misconception resolved');
      confetti({
        particleCount: 70,
        spread: 60,
        origin: { y: 0.7 },
      });
    } else {
      setDiagnosticFeedback((prev) => ({
        ...prev,
        [record.id]: {
          isCorrect: false,
          message: `Not quite. Remember: ${record.followUpDiagnostic?.explanation || 'Review the core concept'}`,
        },
      }));
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header Card */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-amber-700 tracking-wide uppercase">
            <Brain className="w-4 h-4 text-amber-600" />
            <span>{t('clinic_title')}</span>
          </div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight mt-1">
            {t('clinic_title')}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5 max-w-2xl">
            {t('clinic_subtitle')}
          </p>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg shrink-0">
          <button
            onClick={() => setActiveFilter('unresolved')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              activeFilter === 'unresolved'
                ? 'bg-white text-slate-900 shadow-xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {t('clinic_active_count')} ({misconceptions.filter((m) => !m.isResolved).length})
          </button>
          <button
            onClick={() => setActiveFilter('resolved')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              activeFilter === 'resolved'
                ? 'bg-white text-slate-900 shadow-xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {t('clinic_resolved_count')} ({misconceptions.filter((m) => m.isResolved).length})
          </button>
          <button
            onClick={() => setActiveFilter('all')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              activeFilter === 'all'
                ? 'bg-white text-slate-900 shadow-xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {t('all')} ({misconceptions.length})
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center shadow-xs space-y-3">
          <div className="w-12 h-12 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center mx-auto text-emerald-600">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h2 className="text-base font-bold text-slate-900">
            {t('clinic_empty_title')}
          </h2>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            {t('clinic_empty_desc')}
          </p>
          <button
            onClick={() => onNavigate('quiz')}
            className="px-4 py-2 text-xs font-semibold text-white bg-violet-600 hover:bg-violet-700 rounded-lg transition-colors"
          >
            {t('clinic_take_quiz_btn')}
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {filtered.map((record) => {
            const feedback = diagnosticFeedback[record.id];
            const currentSelected = selectedDiagnosticAnswer[record.id];

            return (
              <div
                key={record.id}
                className={`bg-white border rounded-2xl p-6 shadow-xs transition-shadow space-y-5 ${
                  record.isResolved ? 'border-emerald-200' : 'border-amber-200/90'
                }`}
              >
                {/* Record Top Bar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded font-mono ${
                        record.errorType === 'deep_misconception'
                          ? 'bg-rose-100 text-rose-800'
                          : record.errorType === 'knowledge_gap'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}
                    >
                      {record.errorType.replace('_', ' ')}
                    </span>
                    <span className="text-xs font-semibold text-slate-900">{record.topicTitle}</span>
                    <span className="text-slate-300">·</span>
                    <span className="text-xs text-slate-500">{record.unitTitle}</span>
                  </div>

                  <div className="flex items-center gap-3">
                    {record.isResolved ? (
                      <span className="flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>{t('clinic_resolved_badge')}</span>
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-xs font-semibold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-full">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span>{t('action')} Required</span>
                      </span>
                    )}

                    <button
                      onClick={() => deleteMisconception(record.id)}
                      className="text-slate-400 hover:text-rose-600 transition-colors p-1"
                      title={t('delete')}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Problem & Divergent Reasoning */}
                <div className="space-y-3">
                  <div className="text-xs sm:text-sm font-semibold text-slate-900">
                    Question: "{record.questionPrompt}"
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    <div className="p-3 bg-rose-50/60 border border-rose-100 rounded-xl space-y-1">
                      <div className="font-semibold text-rose-900">Student Answer:</div>
                      <p className="text-slate-700">{record.studentAnswer}</p>
                    </div>

                    <div className="p-3 bg-emerald-50/60 border border-emerald-100 rounded-xl space-y-1">
                      <div className="font-semibold text-emerald-900">Correct Understanding:</div>
                      <p className="text-slate-700">{record.correctAnswer}</p>
                    </div>
                  </div>
                </div>

                {/* Cognitive Diagnosis & Memorable Counter-Example */}
                <div className="space-y-3 bg-slate-50 border border-slate-200/80 rounded-xl p-4 text-xs">
                  <div>
                    <span className="font-bold text-slate-900">{t('quiz_diagnosis')}: </span>
                    <span className="text-slate-700">{record.diagnosis}</span>
                  </div>

                  {record.counterExample && (
                    <div className="p-3 bg-white border border-amber-200 rounded-lg text-amber-950 font-medium">
                      <span className="font-bold">{t('clinic_counter_example')}: </span>
                      {record.counterExample}
                    </div>
                  )}

                  {record.remediationTip && (
                    <div className="text-[11px] text-slate-500">
                      <span className="font-semibold text-slate-700">{t('clinic_remediation_tip')}: </span>
                      {record.remediationTip}
                    </div>
                  )}
                </div>

                {/* Interactive Diagnostic Verification Challenge */}
                {record.followUpDiagnostic && !record.isResolved && (
                  <div className="border border-violet-200 bg-violet-50/40 rounded-xl p-4 space-y-3 text-xs">
                    <div className="flex items-center gap-1.5 font-bold text-violet-900 text-xs sm:text-sm">
                      <Sparkles className="w-4 h-4 text-violet-600" />
                      <span>{t('clinic_verification_challenge')}</span>
                    </div>

                    <p className="font-medium text-slate-800">
                      {record.followUpDiagnostic.question}
                    </p>

                    <div className="space-y-2">
                      {record.followUpDiagnostic.options.map((opt, oIdx) => (
                        <button
                          key={oIdx}
                          onClick={() =>
                            setSelectedDiagnosticAnswer((prev) => ({
                              ...prev,
                              [record.id]: opt,
                            }))
                          }
                          className={`w-full text-left p-2.5 rounded-lg border transition-colors ${
                            currentSelected === opt
                              ? 'bg-violet-600 text-white font-semibold border-violet-600'
                              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>

                    {feedback && (
                      <div
                        className={`p-3 rounded-lg border text-xs font-medium ${
                          feedback.isCorrect
                            ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                            : 'bg-rose-100 text-rose-900 border-rose-300'
                        }`}
                      >
                        {feedback.message}
                      </div>
                    )}

                    <div className="flex justify-end pt-1">
                      <button
                        onClick={() => handleTestDiagnostic(record)}
                        disabled={!currentSelected}
                        className="px-4 py-2 text-xs font-semibold text-white bg-violet-700 hover:bg-violet-800 disabled:bg-violet-300 rounded-lg transition-colors"
                      >
                        {t('clinic_mark_resolved')}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

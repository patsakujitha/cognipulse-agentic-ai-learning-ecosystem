import React, { useState } from 'react';
import {
  LifeBuoy,
  Calendar,
  Clock,
  Sparkles,
  CheckCircle2,
  ShieldAlert,
  Sliders,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { RescuePlan } from '../../types';
import { NavigationTab } from '../Sidebar';

interface ExamRescueViewProps {
  onNavigate: (tab: NavigationTab) => void;
}

export const ExamRescueView: React.FC<ExamRescueViewProps> = ({ onNavigate }) => {
  const {
    profile,
    updateProfile,
    curriculum,
    rescuePlan,
    setRescuePlan,
    addXP,
  } = useApp();
  const { t } = useLanguage();

  const [examDate, setExamDate] = useState(profile.examTargetDate);
  const [dailyHours, setDailyHours] = useState(profile.dailyStudyCapacityHours);
  const [isGenerating, setIsGenerating] = useState(false);

  const daysUntilExam = Math.max(
    1,
    Math.ceil((new Date(examDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  );

  const totalRunwayHours = daysUntilExam * dailyHours;

  const allTopics = curriculum.units.flatMap((u) => u.topics);
  const weakCount = allTopics.filter((t) => t.masteryState !== 'understood').length;
  const estimatedHoursNeeded = Math.round(weakCount * 1.5 + 4);
  const isOverloaded = totalRunwayHours < estimatedHoursNeeded;

  const handleGenerateRescuePlan = async () => {
    setIsGenerating(true);
    updateProfile({
      examTargetDate: examDate,
      dailyStudyCapacityHours: dailyHours,
    });

    try {
      const res = await fetch('/api/rescue/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          examDate,
          dailyHours,
          subjects: curriculum.subject,
          topics: allTopics.map((t) => ({
            id: t.id,
            title: t.title,
            status: t.masteryState,
            difficulty: t.difficulty,
            estimatedMins: t.estimatedMins,
          })),
          units: curriculum.units.map((u) => ({
            id: u.id,
            title: u.title,
            weight: u.weight,
            topics: u.topics.map((t) => ({
              id: t.id,
              title: t.title,
              status: t.masteryState,
            })),
          })),
        }),
      });

      const data = await res.json();
      const plan: RescuePlan = {
        daysUntilExam,
        totalAvailableHours: totalRunwayHours,
        estimatedNeededHours: estimatedHoursNeeded,
        isOverload: isOverloaded,
        strategyTitle: data.strategyTitle || (isOverloaded ? 'Aggressive High-Yield Triage' : 'Balanced Full-Mastery Plan'),
        strategicVerdict:
          data.strategicVerdict ||
          (isOverloaded
            ? 'Capacity Warning: Attempting all remaining topics will lead to shallow cramming. Triage focus strictly on high-weight units.'
            : 'You have a healthy runway to systematically master remaining concepts without burnout.'),
        triageRecommendations: data.triageRecommendations || [
          'Dedicate 70% of available study blocks to high-yield topics',
          'Run daily verification challenges in the Misconception Clinic',
          'Complete active recall spaced repetition cards',
        ],
        dailyMilestones: data.dailyMilestones || [],
        generatedAt: new Date().toISOString(),
      };
      setRescuePlan(plan);
      addXP(50, 'Generated Exam Rescue Plan');
    } catch (err) {
      console.error('Failed to generate rescue plan:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header Banner */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-rose-700 tracking-wide uppercase">
            <LifeBuoy className="w-4 h-4 text-rose-600" />
            <span>{t('rescue_title')}</span>
          </div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight mt-1">
            {t('rescue_title')}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5 max-w-2xl">
            {t('rescue_subtitle')}
          </p>
        </div>
      </div>

      {/* Runway Calibration Panel */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-6">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
          <Sliders className="w-4 h-4 text-violet-600" />
          <h2 className="text-sm font-bold text-slate-900">{t('rescue_calc_title')}</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Exam Date Picker */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-500" />
              <span>{t('rescue_exam_date')}</span>
            </label>
            <input
              type="date"
              value={examDate}
              onChange={(e) => setExamDate(e.target.value)}
              className="w-full p-2.5 text-xs sm:text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500 font-mono"
            />
            <div className="text-[11px] text-slate-500">
              Runway: <span className="font-bold text-slate-800 font-mono">{daysUntilExam} {t('daysLeft')}</span>
            </div>
          </div>

          {/* Daily Study Capacity Slider */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-slate-500" />
                <span>{t('rescue_daily_hours')}</span>
              </label>
              <span className="text-xs font-bold font-mono text-violet-700">
                {dailyHours} h / day
              </span>
            </div>
            <input
              type="range"
              min="1"
              max="8"
              step="0.5"
              value={dailyHours}
              onChange={(e) => setDailyHours(parseFloat(e.target.value))}
              className="w-full accent-violet-600 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-400 font-mono">
              <span>1h (Light)</span>
              <span>4h (Balanced)</span>
              <span>8h (Intensive)</span>
            </div>
          </div>
        </div>

        {/* Capacity Reality Check Strip */}
        <div
          className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
            isOverloaded
              ? 'bg-rose-50 border-rose-200 text-rose-950'
              : 'bg-emerald-50 border-emerald-200 text-emerald-950'
          }`}
        >
          <div className="space-y-1">
            <div className="flex items-center gap-2 font-bold text-xs sm:text-sm">
              {isOverloaded ? (
                <>
                  <ShieldAlert className="w-4 h-4 text-rose-600" />
                  <span>{t('rescue_status_overload')} ({Math.round(totalRunwayHours)}h available vs ~{estimatedHoursNeeded}h needed)</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>{t('rescue_status_balanced')} ({Math.round(totalRunwayHours)}h available vs ~{estimatedHoursNeeded}h needed)</span>
                </>
              )}
            </div>
            <p className="text-xs text-slate-600">
              {isOverloaded
                ? 'Your available hours are insufficient to cover all remaining syllabus topics in depth. Rescue Mode triages high-yield units.'
                : 'Sufficient study runway. Pacing learning sessions to guarantee conceptual consolidation.'}
            </p>
          </div>

          <button
            onClick={handleGenerateRescuePlan}
            disabled={isGenerating}
            className="px-5 py-2.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 rounded-xl shadow-xs transition-colors shrink-0 flex items-center justify-center gap-2"
          >
            {isGenerating ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>{t('rescue_calculating')}</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5" />
                <span>{t('rescue_generate_plan')}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Generated Rescue Plan Presentation */}
      {rescuePlan && (
        <div className="space-y-6">
          {/* Strategy Verdict Card */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-violet-700">
                  Rescue Strategy
                </span>
                <h3 className="text-lg font-bold text-slate-900 mt-0.5">
                  {rescuePlan.strategyTitle}
                </h3>
              </div>
              <span className="text-xs font-mono text-slate-500">
                {rescuePlan.daysUntilExam} Days · {rescuePlan.totalAvailableHours}h Total
              </span>
            </div>

            <p className="text-xs sm:text-sm text-slate-700 leading-relaxed bg-slate-50 border border-slate-200 rounded-xl p-4">
              {rescuePlan.strategicVerdict}
            </p>

            {/* Triage Recommendations */}
            <div className="space-y-2">
              <div className="text-xs font-bold text-slate-900">Priority Directives:</div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                {rescuePlan.triageRecommendations.map((rec, rIdx) => (
                  <div
                    key={rIdx}
                    className="p-3 bg-violet-50/50 border border-violet-100 rounded-xl text-xs text-slate-800 flex items-start gap-2"
                  >
                    <span className="font-bold text-violet-700 font-mono">{rIdx + 1}.</span>
                    <span>{rec}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Daily Rescue Milestones */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">{t('rescue_daily_milestones')}</h3>
            </div>

            <div className="divide-y divide-slate-100">
              {rescuePlan.dailyMilestones.map((milestone) => (
                <div
                  key={milestone.day}
                  className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-900 font-mono">
                        {milestone.dateLabel}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="text-xs font-semibold text-violet-700">
                        {milestone.focus}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase font-mono ${
                          milestone.priority === 'Critical'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {milestone.priority}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600">
                      {milestone.actions.map((act, aIdx) => (
                        <span key={aIdx} className="flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-slate-400" />
                          <span>{act}</span>
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-xs font-mono font-medium text-slate-500">
                      {milestone.targetHours}h Block
                    </span>
                    <button
                      onClick={() => onNavigate('quiz')}
                      className="px-3 py-1.5 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                    >
                      {t('practice')}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

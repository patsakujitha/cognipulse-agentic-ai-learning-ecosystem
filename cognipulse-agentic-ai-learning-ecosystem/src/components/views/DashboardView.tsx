import React from 'react';
import {
  Sparkles,
  BrainCircuit,
  ArrowRight,
  Clock,
  HelpCircle,
  Headphones,
  FolderKanban,
  Target,
  ShieldAlert,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { NavigationTab } from '../Sidebar';

interface DashboardViewProps {
  onNavigate: (tab: NavigationTab) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ onNavigate }) => {
  const {
    profile,
    curriculum,
    examReadinessScore,
    unresolvedMisconceptionsCount,
    weakTopics,
    coordinatorRecommendations,
    activeTopic,
    setActiveTopic,
  } = useApp();
  const { t } = useLanguage();

  const daysToExam = Math.max(
    1,
    Math.ceil((new Date(profile.examTargetDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  );

  const primaryTopicTitle = activeTopic?.title || weakTopics[0]?.topic.title || curriculum.subject;

  return (
    <div className="space-y-5 max-w-7xl mx-auto pb-10">
      {/* Welcome Banner & Central Coordinator Status */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-[11px] font-semibold text-violet-700 tracking-wider uppercase">
              <Sparkles className="w-3.5 h-3.5 text-violet-600" />
              <span>{t('dash_coordinator_active')}</span>
              <span className="text-slate-300">·</span>
              <span className="text-slate-600 normal-case font-medium">{curriculum.subject}</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              {t('dash_welcome')}, {profile.name}
            </h1>
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
              <span>{t('target')}: <strong className="text-slate-800 font-semibold">{profile.targetExam}</strong></span>
              <span aria-hidden="true" className="text-slate-300">·</span>
              <span className="font-mono font-semibold text-slate-800 tabular-nums">{daysToExam} {t('daysLeft')}</span>
              <span aria-hidden="true" className="text-slate-300">·</span>
              <span>{profile.gradeLevel}</span>
            </div>
          </div>

          {/* Exam Readiness Metric Box */}
          <div className="flex items-center gap-4 bg-slate-50 border border-slate-200/80 rounded-xl px-4 py-3 shrink-0">
            <div className="relative w-14 h-14 flex items-center justify-center">
              <svg className="w-14 h-14 transform -rotate-90">
                <circle
                  cx="28"
                  cy="28"
                  r="22"
                  stroke="#e2e8f0"
                  strokeWidth="5"
                  fill="transparent"
                />
                <circle
                  cx="28"
                  cy="28"
                  r="22"
                  stroke={examReadinessScore >= 75 ? '#10b981' : examReadinessScore >= 50 ? '#6366f1' : '#f59e0b'}
                  strokeWidth="5"
                  strokeDasharray="138.23"
                  strokeDashoffset={138.23 - (138.23 * examReadinessScore) / 100}
                  strokeLinecap="round"
                  fill="transparent"
                  className="transition-all duration-700"
                />
              </svg>
              <span className="absolute font-mono font-bold text-sm text-slate-900 tabular-nums">
                {examReadinessScore}%
              </span>
            </div>
            <div>
              <div className="text-[11px] text-slate-500 font-medium">{t('dash_readiness_index')}</div>
              <div className="text-xs font-bold text-slate-900">
                {examReadinessScore >= 80 ? t('dash_pace_mastery') : examReadinessScore >= 55 ? t('dash_pace_track') : t('dash_pace_focus')}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                {unresolvedMisconceptionsCount > 0 ? (
                  <span className="text-amber-700 font-medium">
                    {unresolvedMisconceptionsCount} {t('dash_active_errors')}
                  </span>
                ) : (
                  <span className="text-emerald-700 font-medium">{t('dash_zero_errors')}</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Dashboard Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left 2 Columns */}
        <div className="lg:col-span-2 space-y-5">
          {/* Autonomous Directives */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
            <div className="flex items-center justify-between mb-3.5">
              <div className="flex items-center gap-2">
                <BrainCircuit className="w-4 h-4 text-violet-600" />
                <h2 className="text-sm font-bold text-slate-900">{t('dash_priorities_title')}</h2>
              </div>
              <span className="text-[11px] text-slate-400 font-medium">{t('dash_priorities_subtitle')}</span>
            </div>

            <div className="space-y-2.5">
              {coordinatorRecommendations.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-500 bg-slate-50 rounded-xl">
                  {t('dash_no_priorities')}
                </div>
              ) : (
                coordinatorRecommendations.map((rec) => (
                  <div
                    key={rec.id}
                    className={`p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${
                      rec.priority === 'urgent'
                        ? 'bg-amber-50/60 border-amber-200/80'
                        : 'bg-slate-50/80 border-slate-200'
                    }`}
                  >
                    <div className="space-y-0.5 min-w-0">
                      <div className="flex items-center gap-2">
                        {rec.priority === 'urgent' && (
                          <span className="text-[9px] font-bold uppercase tracking-wider text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded">
                            Priority
                          </span>
                        )}
                        <h3 className="font-semibold text-slate-900 text-xs sm:text-sm truncate">
                          {rec.title}
                        </h3>
                      </div>
                      <p className="text-xs text-slate-600 truncate">{rec.description}</p>
                    </div>

                    <button
                      onClick={() => {
                        if (rec.type === 'clinic') onNavigate('clinic');
                        else if (rec.type === 'quiz') {
                          if (rec.actionPayload?.topic) setActiveTopic(rec.actionPayload.topic);
                          onNavigate('quiz');
                        } else if (rec.type === 'flashcard') onNavigate('studysets');
                        else if (rec.type === 'audio') onNavigate('tutor');
                        else onNavigate('rescue');
                      }}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-white border border-slate-300 text-slate-800 hover:bg-slate-100 hover:text-slate-900 shrink-0 self-start sm:self-center transition-colors"
                    >
                      <span>{t('action')}</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* High-Yield Weak Zones */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
            <div className="flex items-center justify-between mb-3.5">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-rose-600" />
                <h2 className="text-sm font-bold text-slate-900">{t('dash_weak_zones_title')}</h2>
              </div>
              <button
                onClick={() => onNavigate('syllabus')}
                className="text-xs font-semibold text-violet-700 hover:text-violet-800"
              >
                {t('dash_full_syllabus')}
              </button>
            </div>

            <div className="space-y-2.5">
              {weakTopics.slice(0, 4).map(({ unitTitle, topic, weight }) => (
                <div
                  key={topic.id}
                  className="p-3 border border-slate-200 rounded-xl flex items-center justify-between gap-3 hover:bg-slate-50 transition-colors"
                >
                  <div className="space-y-0.5 min-w-0">
                    <div className="flex items-center gap-2 text-[11px] text-slate-500">
                      <span className="truncate">{unitTitle}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-semibold text-amber-700 font-mono">{t('dash_weight')} {weight}/5</span>
                    </div>
                    <div className="font-semibold text-slate-900 text-xs sm:text-sm truncate">
                      {topic.title}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <div className="text-xs font-mono font-bold text-slate-700 tabular-nums">
                        {topic.masteryScore}%
                      </div>
                      <div className="text-[10px] text-slate-400 capitalize">
                        {topic.masteryState}
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setActiveTopic(topic);
                        onNavigate('quiz');
                      }}
                      className="px-2.5 py-1 text-xs font-semibold text-violet-700 bg-violet-50 hover:bg-violet-100 rounded-md transition-colors"
                    >
                      {t('practice')}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-5">
          {/* Today's Adaptive Timetable */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
            <div className="flex items-center justify-between mb-3.5">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-indigo-600" />
                <h2 className="text-sm font-bold text-slate-900">{t('dash_today_schedule')}</h2>
              </div>
              <span className="text-xs font-mono text-slate-500 font-medium">
                {profile.dailyStudyCapacityHours}h {t('dash_capacity')}
              </span>
            </div>

            <div className="space-y-2.5">
              <div className="p-2.5 bg-violet-50/60 border border-violet-100 rounded-xl space-y-0.5">
                <div className="flex items-center justify-between text-xs font-semibold text-violet-900">
                  <span>{t('dash_block_1_title')}</span>
                  <span className="font-mono text-[11px]">45m</span>
                </div>
                <div className="text-xs text-slate-600 truncate">
                  {primaryTopicTitle}
                </div>
              </div>

              <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl space-y-0.5">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-900">
                  <span>{t('dash_block_2_title')}</span>
                  <span className="font-mono text-[11px]">30m</span>
                </div>
                <div className="text-xs text-slate-600 truncate">
                  {t('dash_block_2_desc')}
                </div>
              </div>

              <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl space-y-0.5">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-900">
                  <span>{t('dash_block_3_title')}</span>
                  <span className="font-mono text-[11px]">20m</span>
                </div>
                <div className="text-xs text-slate-600 truncate">
                  {t('dash_block_3_desc')}
                </div>
              </div>
            </div>

            <button
              onClick={() => onNavigate('tutor')}
              className="w-full mt-3.5 py-2 px-3 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs transition-colors flex items-center justify-center gap-1.5"
            >
              <span>{t('dash_start_session')}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Quick Learning Toolkit */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-3">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">{t('dash_learning_tools')}</h3>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => onNavigate('tutor')}
                className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-left hover:bg-violet-50/50 hover:border-violet-200 transition-colors"
              >
                <Headphones className="w-4 h-4 text-violet-600 mb-1" />
                <div className="text-xs font-semibold text-slate-900">{t('dash_tool_tutor')}</div>
                <div className="text-[11px] text-slate-500">{t('dash_tool_tutor_sub')}</div>
              </button>

              <button
                onClick={() => onNavigate('quiz')}
                className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-left hover:bg-violet-50/50 hover:border-violet-200 transition-colors"
              >
                <HelpCircle className="w-4 h-4 text-indigo-600 mb-1" />
                <div className="text-xs font-semibold text-slate-900">{t('dash_tool_quiz')}</div>
                <div className="text-[11px] text-slate-500">{t('dash_tool_quiz_sub')}</div>
              </button>

              <button
                onClick={() => onNavigate('clinic')}
                className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-left hover:bg-amber-50/50 hover:border-amber-200 transition-colors"
              >
                <ShieldAlert className="w-4 h-4 text-amber-600 mb-1" />
                <div className="text-xs font-semibold text-slate-900">{t('dash_tool_clinic')}</div>
                <div className="text-[11px] text-slate-500">{t('dash_tool_clinic_sub')}</div>
              </button>

              <button
                onClick={() => onNavigate('studysets')}
                className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-left hover:bg-violet-50/50 hover:border-violet-200 transition-colors"
              >
                <FolderKanban className="w-4 h-4 text-emerald-600 mb-1" />
                <div className="text-xs font-semibold text-slate-900">{t('dash_tool_studysets')}</div>
                <div className="text-[11px] text-slate-500">{t('dash_tool_studysets_sub')}</div>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

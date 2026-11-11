import React, { useState } from 'react';
import {
  Award,
  User,
  RotateCcw,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { NavigationTab } from '../Sidebar';

interface ProfileViewProps {
  onNavigate: (tab: NavigationTab) => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({ onNavigate }) => {
  const {
    profile,
    updateProfile,
    curriculum,
    setActiveTopic,
    resetAllData,
    startOnboarding,
  } = useApp();
  const { t } = useLanguage();

  const [name, setName] = useState(profile.name);
  const [email, setEmail] = useState(profile.email);
  const [gradeLevel, setGradeLevel] = useState(profile.gradeLevel);
  const [targetExam, setTargetExam] = useState(profile.targetExam);
  const [examDate, setExamDate] = useState(profile.examTargetDate);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfile({
      name,
      email,
      gradeLevel,
      targetExam,
      examTargetDate: examDate,
    });
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const allTopics = curriculum.units.flatMap((u) =>
    u.topics.map((t) => ({ ...t, unitTitle: u.title, unitWeight: u.weight }))
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Top Banner */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-violet-700 tracking-wide uppercase">
            <Award className="w-4 h-4 text-violet-600" />
            <span>{t('profile_title')}</span>
          </div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight mt-1">
            {t('profile_title')}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {t('profile_subtitle')}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={startOnboarding}
            className="px-3.5 py-2 text-xs font-semibold text-violet-700 bg-violet-50 hover:bg-violet-100 border border-violet-200 rounded-lg flex items-center gap-1.5 transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Re-run Setup</span>
          </button>
          <button
            onClick={resetAllData}
            className="px-3.5 py-2 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg flex items-center gap-1.5 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Demo Data</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile Settings Form */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <User className="w-4 h-4 text-violet-600" />
            <h2 className="text-sm font-bold text-slate-900">{t('profile_student_info')}</h2>
          </div>

          <form onSubmit={handleSave} className="space-y-3.5 text-xs">
            <div className="space-y-1">
              <label className="font-semibold text-slate-700">{t('onboarding_name_label')}</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full p-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-violet-500 font-medium"
              />
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-slate-700">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full p-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-violet-500 font-medium"
              />
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-slate-700">{t('profile_class')}</label>
              <select
                value={gradeLevel}
                onChange={(e) => setGradeLevel(e.target.value)}
                className="w-full p-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-violet-500 font-medium"
              >
                <option value="Class 10">Class 10</option>
                <option value="Class 11">Class 11</option>
                <option value="Class 12">Class 12</option>
                <option value="College Freshman">College Freshman</option>
                <option value="College Sophomore">College Sophomore</option>
                <option value="Undergraduate">Undergraduate</option>
                <option value="Graduate / Pre-Med">Graduate / Pre-Med</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-slate-700">{t('profile_exam')}</label>
              <input
                type="text"
                value={targetExam}
                onChange={(e) => setTargetExam(e.target.value)}
                className="w-full p-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-violet-500 font-medium"
              />
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-slate-700">{t('profile_exam_date')}</label>
              <input
                type="date"
                value={examDate}
                onChange={(e) => setExamDate(e.target.value)}
                className="w-full p-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-violet-500 font-medium font-mono"
              />
            </div>

            {savedSuccess && (
              <div className="p-2.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-lg font-semibold">
                {t('success')}
              </div>
            )}

            <button
              type="submit"
              className="w-full py-2.5 px-4 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition-colors"
            >
              {t('save')}
            </button>
          </form>
        </div>

        {/* Learning Telemetry Cards */}
        <div className="lg:col-span-2 space-y-6">
          {/* Stats Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs text-center">
              <div className="text-lg font-bold font-mono text-slate-900 tabular-nums">
                {profile.streakDays}
              </div>
              <div className="text-[11px] text-slate-500">{t('profile_streak')}</div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs text-center">
              <div className="text-lg font-bold font-mono text-slate-900 tabular-nums">
                {profile.totalXP}
              </div>
              <div className="text-[11px] text-slate-500">{t('profile_xp')}</div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs text-center">
              <div className="text-lg font-bold font-mono text-slate-900 tabular-nums">
                {profile.completedQuizzesCount}
              </div>
              <div className="text-[11px] text-slate-500">{t('profile_quizzes_completed')}</div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs text-center">
              <div className="text-lg font-bold font-mono text-slate-900 tabular-nums">
                {profile.resolvedMisconceptionsCount}
              </div>
              <div className="text-[11px] text-slate-500">{t('profile_errors_fixed')}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Comprehensive Mastery Matrix Table */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
        <div>
          <h2 className="text-base font-bold text-slate-900">Topic Mastery Matrix</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time mastery status for {curriculum.subject}.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500 font-semibold bg-slate-50/70">
                <th className="py-2.5 px-3">Topic Title</th>
                <th className="py-2.5 px-3">Unit / Weight</th>
                <th className="py-2.5 px-3">Difficulty</th>
                <th className="py-2.5 px-3">Mastery State</th>
                <th className="py-2.5 px-3 text-right">Score</th>
                <th className="py-2.5 px-3 text-right">Attempts</th>
                <th className="py-2.5 px-3 text-right">{t('action')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {allTopics.map((topic) => (
                <tr key={topic.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3 px-3 font-semibold text-slate-900">{topic.title}</td>
                  <td className="py-3 px-3 text-slate-500">
                    {topic.unitTitle} <span className="font-mono text-slate-400 font-semibold">({topic.unitWeight}/5)</span>
                  </td>
                  <td className="py-3 px-3 capitalize text-slate-600">{topic.difficulty}</td>
                  <td className="py-3 px-3">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold capitalize ${
                        topic.masteryState === 'understood'
                          ? 'bg-emerald-50 text-emerald-800'
                          : topic.masteryState === 'partial'
                          ? 'bg-amber-50 text-amber-800'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {topic.masteryState === 'understood' ? (
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      ) : topic.masteryState === 'partial' ? (
                        <AlertCircle className="w-3 h-3 text-amber-600" />
                      ) : (
                        <HelpCircle className="w-3 h-3 text-slate-400" />
                      )}
                      <span>{topic.masteryState}</span>
                    </span>
                  </td>
                  <td className="py-3 px-3 text-right font-mono font-bold text-slate-800 tabular-nums">
                    {topic.masteryScore}%
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-slate-600 tabular-nums">
                    {topic.quizAttempts}
                  </td>
                  <td className="py-3 px-3 text-right">
                    <button
                      onClick={() => {
                        setActiveTopic(topic);
                        onNavigate('quiz');
                      }}
                      className="text-violet-700 hover:text-violet-900 font-semibold hover:underline"
                    >
                      {t('practice')} →
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

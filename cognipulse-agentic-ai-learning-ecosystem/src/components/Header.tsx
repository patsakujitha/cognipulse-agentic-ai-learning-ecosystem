import React from 'react';
import { Menu, Flame, LifeBuoy } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useLanguage } from '../i18n/LanguageContext';
import { NavigationTab } from './Sidebar';
import { LanguageSelector } from './LanguageSelector';

interface HeaderProps {
  onOpenMobile: () => void;
  currentTab: NavigationTab;
  onSelectTab: (tab: NavigationTab) => void;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenMobile,
  currentTab,
  onSelectTab,
}) => {
  const { profile, curriculum, unresolvedMisconceptionsCount, startOnboarding } = useApp();
  const { t } = useLanguage();

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4 sticky top-0 z-30">
      {/* Zone 1: Brand / Context wordmark */}
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenMobile}
          className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 lg:hidden"
          aria-label="Open mobile menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2">
          <span className="text-base font-bold text-slate-900 tracking-tight whitespace-nowrap">
            CogniPulse
          </span>
          <span className="text-slate-300 hidden sm:inline" aria-hidden="true">/</span>
          <span className="text-xs font-semibold text-violet-800 bg-violet-50 px-2 py-0.5 rounded border border-violet-100 hidden sm:inline truncate max-w-xs md:max-w-md">
            {curriculum.subject}
          </span>
        </div>
      </div>

      {/* Zone 2: Navigation Links */}
      <nav className="hidden xl:flex items-center gap-5 text-xs font-medium text-slate-600">
        <button
          onClick={() => onSelectTab('dashboard')}
          className={`hover:text-slate-900 transition-colors whitespace-nowrap ${
            currentTab === 'dashboard' ? 'text-violet-700 font-semibold' : ''
          }`}
        >
          {t('nav_dashboard')}
        </button>
        <button
          onClick={() => onSelectTab('syllabus')}
          className={`hover:text-slate-900 transition-colors whitespace-nowrap ${
            currentTab === 'syllabus' ? 'text-violet-700 font-semibold' : ''
          }`}
        >
          {t('nav_syllabus')}
        </button>
        <button
          onClick={() => onSelectTab('tutor')}
          className={`hover:text-slate-900 transition-colors whitespace-nowrap ${
            currentTab === 'tutor' ? 'text-violet-700 font-semibold' : ''
          }`}
        >
          {t('nav_tutor')}
        </button>
        <button
          onClick={() => onSelectTab('quiz')}
          className={`hover:text-slate-900 transition-colors whitespace-nowrap ${
            currentTab === 'quiz' ? 'text-violet-700 font-semibold' : ''
          }`}
        >
          {t('nav_quiz')}
        </button>
        <button
          onClick={() => onSelectTab('clinic')}
          className={`hover:text-slate-900 transition-colors whitespace-nowrap flex items-center gap-1.5 ${
            currentTab === 'clinic' ? 'text-violet-700 font-semibold' : ''
          }`}
        >
          <span>{t('nav_clinic')}</span>
          {unresolvedMisconceptionsCount > 0 && (
            <span className="text-[10px] font-bold px-1.5 py-0.2 bg-amber-100 text-amber-800 rounded font-mono">
              {unresolvedMisconceptionsCount}
            </span>
          )}
        </button>
      </nav>

      {/* Zone 3: Language Selector, Quick Stats & Rescue */}
      <div className="flex items-center gap-2.5 shrink-0">
        <LanguageSelector />

        <button
          onClick={startOnboarding}
          className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200"
          title="Switch student profile or re-assess syllabus"
        >
          <span className="font-semibold text-slate-900">{profile.name}</span>
          <span className="text-[11px] text-slate-500">· {profile.gradeLevel}</span>
        </button>

        <div className="hidden sm:flex items-center gap-2 text-xs text-slate-600 bg-slate-50 border border-slate-200 px-2.5 py-1.5 rounded-lg">
          <Flame className="w-3.5 h-3.5 text-amber-500" />
          <span className="font-semibold text-slate-800 font-mono tabular-nums">{profile.streakDays}d</span>
          <span className="text-slate-300">·</span>
          <span className="font-semibold text-slate-800 font-mono tabular-nums">{profile.totalXP} XP</span>
        </div>

        <button
          onClick={() => onSelectTab('rescue')}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-violet-600 hover:bg-violet-700 active:bg-violet-800 rounded-lg shadow-2xs transition-colors whitespace-nowrap shrink-0"
        >
          <LifeBuoy className="w-3.5 h-3.5" />
          <span>{t('nav_rescue')}</span>
        </button>
      </div>
    </header>
  );
};

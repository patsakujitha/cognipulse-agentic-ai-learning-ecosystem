import React from 'react';
import {
  Sparkles,
  BookOpen,
  FolderKanban,
  MessageSquareText,
  HelpCircle,
  AlertTriangle,
  Flame,
  Award,
  ChevronRight,
  Headphones,
  LifeBuoy,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useLanguage } from '../i18n/LanguageContext';

export type NavigationTab =
  | 'dashboard'
  | 'syllabus'
  | 'studysets'
  | 'tutor'
  | 'quiz'
  | 'clinic'
  | 'rescue'
  | 'profile';

interface SidebarProps {
  currentTab: NavigationTab;
  onSelectTab: (tab: NavigationTab) => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  mobileOpen,
  onCloseMobile,
}) => {
  const { curriculum, profile, unresolvedMisconceptionsCount, examReadinessScore } = useApp();
  const { t } = useLanguage();

  const navItems: { id: NavigationTab; labelKey: string; icon: React.FC<{ className?: string }>; badgeCount?: number }[] = [
    { id: 'dashboard', labelKey: 'nav_dashboard', icon: Sparkles },
    { id: 'syllabus', labelKey: 'nav_syllabus', icon: BookOpen },
    { id: 'studysets', labelKey: 'nav_studysets', icon: FolderKanban },
    { id: 'tutor', labelKey: 'nav_tutor', icon: Headphones },
    { id: 'quiz', labelKey: 'nav_quiz', icon: HelpCircle },
    {
      id: 'clinic',
      labelKey: 'nav_clinic',
      icon: AlertTriangle,
      badgeCount: unresolvedMisconceptionsCount,
    },
    { id: 'rescue', labelKey: 'nav_rescue', icon: LifeBuoy },
    { id: 'profile', labelKey: 'nav_profile', icon: Award },
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-slate-900/40 z-40 lg:hidden backdrop-blur-xs"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-64 bg-white border-r border-slate-200 flex flex-col transition-transform duration-200 ease-in-out lg:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Lockup */}
        <div className="h-16 px-6 flex items-center justify-between border-b border-slate-200 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-violet-600 to-indigo-600 flex items-center justify-center text-white font-bold text-base shadow-sm">
              C
            </div>
            <div>
              <span className="font-bold text-slate-900 tracking-tight text-base block leading-none">
                CogniPulse
              </span>
              <span className="text-[11px] text-slate-400 font-medium tracking-tight block mt-0.5">
                Autonomous Learning
              </span>
            </div>
          </div>
        </div>

        {/* Current Active Course Card */}
        <div className="p-4 mx-3 my-3 bg-slate-50 border border-slate-200 rounded-xl">
          <div className="text-[11px] text-slate-500 font-medium uppercase tracking-wider">
            {t('activeStudySet')}
          </div>
          <div className="font-semibold text-slate-900 text-sm truncate mt-0.5">
            {curriculum.subject}
          </div>
          <div className="flex items-center justify-between mt-2.5 text-xs text-slate-600">
            <span>{t('examReadiness')}</span>
            <span className="font-semibold text-slate-900 font-mono tabular-nums">
              {examReadinessScore}%
            </span>
          </div>
          {/* Progress bar */}
          <div className="w-full h-1.5 bg-slate-200 rounded-full mt-1.5 overflow-hidden">
            <div
              className="h-full bg-indigo-600 rounded-full transition-all duration-500"
              style={{ width: `${examReadinessScore}%` }}
            />
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 px-3 space-y-1 overflow-y-auto py-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  onSelectTab(item.id);
                  onCloseMobile();
                }}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors text-left ${
                  isActive
                    ? 'bg-violet-50 text-violet-900 font-semibold'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <div className="flex items-center gap-3 truncate">
                  <Icon
                    className={`w-4 h-4 shrink-0 ${
                      isActive ? 'text-violet-700' : 'text-slate-400'
                    }`}
                  />
                  <span className="truncate">{t(item.labelKey)}</span>
                </div>
                {item.badgeCount && item.badgeCount > 0 ? (
                  <span className="text-[11px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded font-mono">
                    {item.badgeCount}
                  </span>
                ) : isActive ? (
                  <ChevronRight className="w-3.5 h-3.5 text-violet-600 shrink-0" />
                ) : null}
              </button>
            );
          })}
        </nav>

        {/* Footer Metrics */}
        <div className="p-4 border-t border-slate-200 shrink-0 space-y-2 text-xs text-slate-600">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-slate-700">
              <Flame className="w-4 h-4 text-amber-500" />
              <span>{profile.streakDays} {t('streak')}</span>
            </span>
            <span className="font-semibold text-slate-900 font-mono tabular-nums">
              {profile.totalXP} XP
            </span>
          </div>
        </div>
      </aside>
    </>
  );
};

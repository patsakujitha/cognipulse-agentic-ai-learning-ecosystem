/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Sidebar, NavigationTab } from './components/Sidebar';
import { Header } from './components/Header';
import { DashboardView } from './components/views/DashboardView';
import { SyllabusView } from './components/views/SyllabusView';
import { StudySetsView } from './components/views/StudySetsView';
import { TutorAndAudioView } from './components/views/TutorAndAudioView';
import { QuizView } from './components/views/QuizView';
import { MisconceptionClinicView } from './components/views/MisconceptionClinicView';
import { ExamRescueView } from './components/views/ExamRescueView';
import { ProfileView } from './components/views/ProfileView';
import { OnboardingFlow } from './components/onboarding/OnboardingFlow';
import { X, CheckCircle, Info } from 'lucide-react';

const AppContent: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<NavigationTab>('dashboard');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const { notification, clearNotification, onboardingCompleted, setOnboardingCompleted } = useApp();

  if (!onboardingCompleted) {
    return <OnboardingFlow onComplete={() => setOnboardingCompleted(true)} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col antialiased">
      {/* Toast Notification Container */}
      {notification && (
        <div className="fixed bottom-5 right-5 z-50 max-w-sm bg-slate-900 text-white text-xs px-4 py-3 rounded-xl shadow-lg border border-slate-800 flex items-center justify-between gap-3 animate-fade-in">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-violet-400 shrink-0" />
            <span className="font-medium">{notification}</span>
          </div>
          <button
            onClick={clearNotification}
            className="text-slate-400 hover:text-white p-0.5"
            aria-label="Dismiss notification"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Persistent Responsive Sidebar */}
      <Sidebar
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        mobileOpen={mobileSidebarOpen}
        onCloseMobile={() => setMobileSidebarOpen(false)}
      />

      {/* Main Workspace Frame */}
      <div className="lg:pl-64 flex flex-col flex-1 min-w-0">
        <Header
          currentTab={currentTab}
          onSelectTab={setCurrentTab}
          onOpenMobile={() => setMobileSidebarOpen(true)}
        />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
          {currentTab === 'dashboard' && <DashboardView onNavigate={setCurrentTab} />}
          {currentTab === 'syllabus' && <SyllabusView onNavigate={setCurrentTab} />}
          {currentTab === 'studysets' && <StudySetsView onNavigate={setCurrentTab} />}
          {currentTab === 'tutor' && <TutorAndAudioView onNavigate={setCurrentTab} />}
          {currentTab === 'quiz' && <QuizView onNavigate={setCurrentTab} />}
          {currentTab === 'clinic' && <MisconceptionClinicView onNavigate={setCurrentTab} />}
          {currentTab === 'rescue' && <ExamRescueView onNavigate={setCurrentTab} />}
          {currentTab === 'profile' && <ProfileView onNavigate={setCurrentTab} />}
        </main>
      </div>
    </div>
  );
};

import { LanguageProvider } from './i18n/LanguageContext';

export default function App() {
  return (
    <LanguageProvider>
      <AppProvider>
        <AppContent />
      </AppProvider>
    </LanguageProvider>
  );
}

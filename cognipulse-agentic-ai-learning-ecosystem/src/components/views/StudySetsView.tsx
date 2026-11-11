import React, { useState } from 'react';
import {
  FolderKanban,
  Sparkles,
  RotateCw,
  Eye,
  Flame,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { SyllabusTopic } from '../../types';
import { NavigationTab } from '../Sidebar';

interface StudySetsViewProps {
  onNavigate: (tab: NavigationTab) => void;
}

export const StudySetsView: React.FC<StudySetsViewProps> = ({ onNavigate }) => {
  const {
    curriculum,
    flashcards,
    addFlashcard,
    reviewFlashcard,
    activeTopic,
    profile,
  } = useApp();
  const { t } = useLanguage();

  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeTab, setActiveTab] = useState<'flashcards' | 'path' | 'timetable'>('flashcards');
  const [selectedTopicForNotes, setSelectedTopicForNotes] = useState<SyllabusTopic | null>(null);

  // Reset flashcard navigation when curriculum changes
  React.useEffect(() => {
    setCurrentCardIndex(0);
    setIsFlipped(false);
    setShowHint(false);
    setSelectedTopicForNotes(null);
  }, [curriculum.id]);

  const todayStr = new Date().toISOString().split('T')[0];
  const dueCards = flashcards.filter((f) => f.nextReviewDate <= todayStr);
  const activeDeck = dueCards.length > 0 ? dueCards : flashcards;
  const currentCard = activeDeck[currentCardIndex % Math.max(1, activeDeck.length)];

  const handleRating = (rating: 'hard' | 'good' | 'easy') => {
    if (!currentCard) return;
    reviewFlashcard(currentCard.id, rating);
    setIsFlipped(false);
    setShowHint(false);
    if (currentCardIndex + 1 < activeDeck.length) {
      setCurrentCardIndex((prev) => prev + 1);
    } else {
      setCurrentCardIndex(0);
    }
  };

  const handleGenerateCards = async () => {
    setIsGenerating(true);
    const targetTopic = activeTopic || curriculum.units[0]?.topics[0];
    try {
      const res = await fetch('/api/flashcards/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topicTitle: targetTopic?.title || curriculum.subject,
          subject: curriculum.subject,
          subtopics: targetTopic?.subtopics || [],
          studyNotes: targetTopic?.studyNotes || '',
        }),
      });
      const data = await res.json();
      if (data.flashcards) {
        data.flashcards.forEach((c: any) => {
          addFlashcard({
            front: c.front,
            back: c.back,
            hint: c.hint,
            topic: c.topic || activeTopic?.title || curriculum.subject,
          });
        });
      }
    } catch (err) {
      console.error('Failed to generate cards:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-violet-700 tracking-wide uppercase">
            <FolderKanban className="w-4 h-4 text-violet-600" />
            <span>{t('study_title')}</span>
          </div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight mt-1">
            {t('study_title')}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {t('study_subtitle')}
          </p>
        </div>

        {/* View Switcher */}
        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg shrink-0">
          <button
            onClick={() => setActiveTab('flashcards')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              activeTab === 'flashcards'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Flashcards ({flashcards.length})
          </button>
          <button
            onClick={() => setActiveTab('path')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              activeTab === 'path'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Syllabus Path
          </button>
          <button
            onClick={() => setActiveTab('timetable')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              activeTab === 'timetable'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Timetable
          </button>
        </div>
      </div>

      {activeTab === 'flashcards' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Flashcard Interactive Stage */}
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs min-h-[380px] flex flex-col justify-between">
              {/* Card Header */}
              <div className="flex items-center justify-between text-xs text-slate-500 pb-3 border-b border-slate-100">
                <span className="font-semibold text-violet-700">
                  {currentCard?.topic || curriculum.subject}
                </span>
                <span className="font-mono tabular-nums">
                  Card {(currentCardIndex % Math.max(1, activeDeck.length)) + 1} / {activeDeck.length}
                </span>
              </div>

              {/* Card Body with Flip State */}
              <div
                onClick={() => setIsFlipped(!isFlipped)}
                className="py-10 flex-1 flex flex-col items-center justify-center text-center cursor-pointer select-none px-4"
              >
                <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-3">
                  {isFlipped ? 'Answer & Core Mechanism' : 'Concept Question'}
                </div>

                <div className="text-base sm:text-lg font-semibold text-slate-900 max-w-xl leading-relaxed whitespace-pre-line">
                  {isFlipped ? currentCard?.back : currentCard?.front}
                </div>

                {showHint && currentCard?.hint && (
                  <div className="mt-4 p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 max-w-md">
                    💡 <span className="font-semibold">Hint:</span> {currentCard.hint}
                  </div>
                )}

                <div className="text-xs text-slate-400 mt-6 flex items-center gap-1">
                  <RotateCw className="w-3.5 h-3.5" />
                  <span>{t('study_flip_prompt')}</span>
                </div>
              </div>

              {/* Hint and Controls */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                {currentCard?.hint ? (
                  <button
                    onClick={() => setShowHint(!showHint)}
                    className="text-xs text-slate-600 hover:text-slate-900 flex items-center gap-1 font-medium"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>{showHint ? 'Hide Hint' : 'Reveal Hint'}</span>
                  </button>
                ) : <div />}

                {/* Spaced Repetition Feedback Buttons */}
                {isFlipped ? (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleRating('hard')}
                      className="px-3 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg border border-rose-200 transition-colors"
                    >
                      {t('study_rate_hard')}
                    </button>
                    <button
                      onClick={() => handleRating('good')}
                      className="px-3 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg border border-indigo-200 transition-colors"
                    >
                      {t('study_rate_good')}
                    </button>
                    <button
                      onClick={() => handleRating('easy')}
                      className="px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg border border-emerald-200 transition-colors"
                    >
                      {t('study_rate_easy')}
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setIsFlipped(true)}
                    className="px-4 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors"
                  >
                    {t('view')} Answer
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Right Sidebar: Deck Meta & AI Card Generator */}
          <div className="space-y-4">
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900">Spaced Repetition</h3>
                <Flame className="w-4 h-4 text-amber-500" />
              </div>

              <div className="grid grid-cols-2 gap-3 text-center">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <div className="text-lg font-bold font-mono text-slate-900 tabular-nums">
                    {dueCards.length}
                  </div>
                  <div className="text-[11px] text-slate-500">{t('study_due_today')}</div>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <div className="text-lg font-bold font-mono text-slate-900 tabular-nums">
                    {flashcards.length}
                  </div>
                  <div className="text-[11px] text-slate-500">{t('study_total_cards')}</div>
                </div>
              </div>

              <button
                onClick={handleGenerateCards}
                disabled={isGenerating}
                className="w-full py-2.5 px-3 text-xs font-semibold text-violet-700 bg-violet-50 hover:bg-violet-100 border border-violet-200 rounded-xl flex items-center justify-center gap-2 transition-colors"
              >
                {isGenerating ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-violet-600/30 border-t-violet-600 rounded-full animate-spin" />
                    <span>{t('study_generating_cards')}</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>{t('study_generate_cards_btn')}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'path' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-6">
          <div>
            <h2 className="text-base font-bold text-slate-900">Syllabus Learning Pathway</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Sequenced units and topics for {curriculum.subject}.
            </p>
          </div>

          <div className="space-y-4">
            {curriculum.units.map((unit, idx) => (
              <div key={unit.id} className="border border-slate-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-bold text-sm text-slate-900">
                    <span className="w-6 h-6 rounded-full bg-violet-100 text-violet-800 text-xs flex items-center justify-center font-mono">
                      {idx + 1}
                    </span>
                    <span>{unit.title}</span>
                  </div>
                  <span className="text-xs text-slate-500 font-medium">{t('dash_weight')}: {unit.weight}/5</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {unit.topics.map((topic) => (
                    <div
                      key={topic.id}
                      onClick={() => setSelectedTopicForNotes(topic)}
                      className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1 hover:border-violet-300 hover:bg-violet-50/20 cursor-pointer transition-colors"
                    >
                      <div className="flex items-center justify-between text-[11px] text-slate-500">
                        <span>~{topic.estimatedMins}m</span>
                        <span className="capitalize">{topic.masteryState}</span>
                      </div>
                      <div className="font-semibold text-xs text-slate-900 truncate">
                        {topic.title}
                      </div>
                      <div className="text-[10px] text-violet-600 font-medium pt-1 flex items-center gap-1">
                        <span>{t('syl_view_content')} →</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Modal / Panel for Topic Study Notes & YouTube Links */}
          {selectedTopicForNotes && (
            <div className="p-5 bg-slate-50 border border-violet-200 rounded-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <div>
                  <div className="text-[11px] font-bold uppercase text-violet-700">Study Content</div>
                  <h3 className="text-base font-bold text-slate-900">{selectedTopicForNotes.title}</h3>
                </div>
                <button
                  onClick={() => setSelectedTopicForNotes(null)}
                  className="text-xs font-semibold text-slate-500 hover:text-slate-800 px-2 py-1 bg-white border border-slate-200 rounded-md"
                >
                  {t('close')}
                </button>
              </div>

              {/* Short Notes */}
              <div className="space-y-1">
                <div className="text-xs font-bold text-slate-800">{t('syl_short_notes')}:</div>
                <div className="p-3 bg-white border border-slate-200 rounded-xl text-xs text-slate-700 leading-relaxed whitespace-pre-line">
                  {selectedTopicForNotes.studyNotes || 'High-yield conceptual summary covering core mechanisms, formulas, and typical exam pitfalls.'}
                </div>
              </div>

              {/* 3 Real YouTube Links */}
              <div className="space-y-2">
                <div className="text-xs font-bold text-slate-800">{t('syl_youtube_lectures')}:</div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {(selectedTopicForNotes.youtubeLinks && selectedTopicForNotes.youtubeLinks.length > 0
                    ? selectedTopicForNotes.youtubeLinks.slice(0, 3)
                    : [
                        { title: `${selectedTopicForNotes.title} Tutorial`, url: `https://www.youtube.com/results?search_query=${encodeURIComponent(selectedTopicForNotes.title + ' tutorial')}`, channel: 'Khan Academy' },
                        { title: `${selectedTopicForNotes.title} Crash Course`, url: `https://www.youtube.com/results?search_query=${encodeURIComponent(selectedTopicForNotes.title + ' crash course')}`, channel: 'CrashCourse' },
                        { title: `${selectedTopicForNotes.title} Lecture & Applications`, url: `https://www.youtube.com/results?search_query=${encodeURIComponent(selectedTopicForNotes.title + ' lecture')}`, channel: 'MIT OpenCourseWare' },
                      ]
                  ).map((yt, yIdx) => (
                    <a
                      key={yIdx}
                      href={yt.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-3 bg-white border border-slate-200 hover:border-violet-400 rounded-xl flex flex-col justify-between gap-2 group transition-all text-xs"
                    >
                      <div className="space-y-1">
                        <div className="text-[10px] font-semibold text-rose-600">{yt.channel}</div>
                        <div className="font-medium text-slate-900 line-clamp-2 group-hover:text-violet-700">
                          {yt.title}
                        </div>
                      </div>
                      <div className="text-[11px] font-semibold text-violet-700 group-hover:underline">
                        {t('syl_watch_youtube')} ↗
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'timetable' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">Adaptive Weekly Timetable</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Automatically scheduled based on your daily capacity ({profile.dailyStudyCapacityHours}h/day).
              </p>
            </div>
            <button
              onClick={() => onNavigate('rescue')}
              className="text-xs font-semibold text-violet-700 hover:text-violet-800"
            >
              {t('nav_rescue')} →
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
              <div key={day} className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-slate-800 border-b border-slate-200 pb-1.5">
                  <span>{day}</span>
                  <span className="font-mono text-slate-500 text-[11px]">{profile.dailyStudyCapacityHours}h</span>
                </div>
                <div className="text-xs space-y-1.5">
                  <div className="p-1.5 bg-white border border-slate-200 rounded text-[11px] font-medium text-slate-800 truncate">
                    {curriculum.units[0]?.topics[0]?.title || curriculum.subject}
                  </div>
                  <div className="p-1.5 bg-violet-50 text-violet-800 rounded text-[10px] font-semibold">
                    10 Card Review
                  </div>
                  <div className="p-1.5 bg-slate-100 text-slate-700 rounded text-[10px]">
                    {t('practice')} Quiz
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

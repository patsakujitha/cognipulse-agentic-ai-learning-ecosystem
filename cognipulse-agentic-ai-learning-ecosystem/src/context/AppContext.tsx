import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import {
  StudentProfile,
  SyllabusCurriculum,
  SyllabusTopic,
  MisconceptionRecord,
  Flashcard,
  RescuePlan,
  CoordinatorRecommendation,
  MasteryState,
} from '../types';
import {
  INITIAL_PROFILE,
  INITIAL_CURRICULUM,
  INITIAL_MISCONCEPTIONS,
  INITIAL_FLASHCARDS,
} from '../data/defaultData';

interface AppContextType {
  profile: StudentProfile;
  curriculum: SyllabusCurriculum;
  misconceptions: MisconceptionRecord[];
  flashcards: Flashcard[];
  rescuePlan: RescuePlan | null;
  activeTopic: SyllabusTopic | null;
  
  // Coordinator computed states
  examReadinessScore: number;
  unresolvedMisconceptionsCount: number;
  weakTopics: { unitTitle: string; topic: SyllabusTopic; weight: number }[];
  coordinatorRecommendations: CoordinatorRecommendation[];

  // Actions
  updateProfile: (updates: Partial<StudentProfile>) => void;
  updateTopicMastery: (unitId: string, topicId: string, newState: MasteryState, score?: number) => void;
  recordMisconception: (record: Omit<MisconceptionRecord, 'id' | 'recordedAt'>) => void;
  resolveMisconception: (id: string) => void;
  deleteMisconception: (id: string) => void;
  setActiveTopic: (topic: SyllabusTopic | null) => void;
  updateCurriculum: (curriculum: SyllabusCurriculum) => void;
  replaceCurriculum: (curriculum: SyllabusCurriculum) => void;
  addFlashcard: (card: Omit<Flashcard, 'id' | 'reviewsCount' | 'intervalDays' | 'easeFactor' | 'nextReviewDate'>) => void;
  reviewFlashcard: (id: string, rating: 'hard' | 'good' | 'easy') => void;
  setRescuePlan: (plan: RescuePlan | null) => void;
  addXP: (amount: number, reason?: string) => void;
  resetAllData: () => void;
  loadCurriculumTemplate: (key: 'biology' | 'cs') => Promise<void>;
  onboardingCompleted: boolean;
  setOnboardingCompleted: (completed: boolean) => void;
  startOnboarding: () => void;
  notification: string | null;
  clearNotification: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Persistence in localStorage
  const [profile, setProfile] = useState<StudentProfile>(() => {
    try {
      const saved = localStorage.getItem('cognipulse_profile');
      return saved ? JSON.parse(saved) : INITIAL_PROFILE;
    } catch {
      return INITIAL_PROFILE;
    }
  });

  const [curriculum, setCurriculum] = useState<SyllabusCurriculum>(() => {
    try {
      const saved = localStorage.getItem('cognipulse_curriculum');
      return saved ? JSON.parse(saved) : INITIAL_CURRICULUM;
    } catch {
      return INITIAL_CURRICULUM;
    }
  });

  const [misconceptions, setMisconceptions] = useState<MisconceptionRecord[]>(() => {
    try {
      const saved = localStorage.getItem('cognipulse_misconceptions');
      return saved ? JSON.parse(saved) : INITIAL_MISCONCEPTIONS;
    } catch {
      return INITIAL_MISCONCEPTIONS;
    }
  });

  const [flashcards, setFlashcards] = useState<Flashcard[]>(() => {
    try {
      const saved = localStorage.getItem('cognipulse_flashcards');
      return saved ? JSON.parse(saved) : INITIAL_FLASHCARDS;
    } catch {
      return INITIAL_FLASHCARDS;
    }
  });

  const [rescuePlan, setRescuePlanState] = useState<RescuePlan | null>(() => {
    try {
      const saved = localStorage.getItem('cognipulse_rescue_plan');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [activeTopic, setActiveTopic] = useState<SyllabusTopic | null>(() => {
    return curriculum.units[0]?.topics[0] || null;
  });

  const [onboardingCompleted, setOnboardingCompletedState] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('cognipulse_onboarding_completed');
      return saved !== null ? JSON.parse(saved) : false;
    } catch {
      return false;
    }
  });

  const setOnboardingCompleted = (completed: boolean) => {
    setOnboardingCompletedState(completed);
    localStorage.setItem('cognipulse_onboarding_completed', JSON.stringify(completed));
  };

  const startOnboarding = () => {
    setOnboardingCompletedState(false);
    localStorage.setItem('cognipulse_onboarding_completed', JSON.stringify(false));
  };

  const [notification, setNotification] = useState<string | null>(null);

  const clearNotification = () => setNotification(null);

  // Sync to localStorage
  useEffect(() => {
    localStorage.setItem('cognipulse_profile', JSON.stringify(profile));
  }, [profile]);

  useEffect(() => {
    localStorage.setItem('cognipulse_curriculum', JSON.stringify(curriculum));
  }, [curriculum]);

  useEffect(() => {
    localStorage.setItem('cognipulse_misconceptions', JSON.stringify(misconceptions));
  }, [misconceptions]);

  useEffect(() => {
    localStorage.setItem('cognipulse_flashcards', JSON.stringify(flashcards));
  }, [flashcards]);

  useEffect(() => {
    if (rescuePlan) {
      localStorage.setItem('cognipulse_rescue_plan', JSON.stringify(rescuePlan));
    } else {
      localStorage.removeItem('cognipulse_rescue_plan');
    }
  }, [rescuePlan]);

  // Central AI Coordinator Telemetry & Calculations
  const { examReadinessScore, weakTopics, unresolvedMisconceptionsCount, coordinatorRecommendations } = useMemo(() => {
    let totalWeightedScore = 0;
    let totalWeight = 0;
    const weakList: { unitTitle: string; topic: SyllabusTopic; weight: number }[] = [];

    curriculum.units.forEach((unit) => {
      const unitWeight = unit.weight || 3;
      unit.topics.forEach((topic) => {
        const effectiveScore =
          topic.masteryState === 'understood'
            ? Math.max(80, topic.masteryScore || 85)
            : topic.masteryState === 'partial'
            ? Math.max(45, topic.masteryScore || 50)
            : Math.min(30, topic.masteryScore || 20);

        totalWeightedScore += effectiveScore * unitWeight;
        totalWeight += unitWeight;

        if (topic.masteryState !== 'understood' || effectiveScore < 70) {
          weakList.push({ unitTitle: unit.title, topic, weight: unitWeight });
        }
      });
    });

    const baselineReadiness = totalWeight > 0 ? Math.round(totalWeightedScore / totalWeight) : 50;

    // Deduct penalty for active, unresolved misconceptions
    const activeMiscCount = misconceptions.filter((m) => !m.isResolved).length;
    const misconceptionPenalty = activeMiscCount * 4;

    const finalReadiness = Math.max(12, Math.min(98, baselineReadiness - misconceptionPenalty));

    // Formulate Autonomous AI Recommendations
    const recs: CoordinatorRecommendation[] = [];

    // Priority 1: Unresolved misconceptions
    const urgentMisc = misconceptions.find((m) => !m.isResolved);
    if (urgentMisc) {
      recs.push({
        id: 'rec_misc',
        type: 'clinic',
        title: `Misconception Trap Detected: ${urgentMisc.topicTitle}`,
        description: `Flawed mental model in ${urgentMisc.unitTitle}. Take the counter-example verification challenge.`,
        priority: 'urgent',
        actionPayload: { misconceptionId: urgentMisc.id },
      });
    }

    // Priority 2: Highest weight weak topic
    const highWeightWeak = weakList.sort((a, b) => b.weight - a.weight)[0];
    if (highWeightWeak) {
      recs.push({
        id: 'rec_weak_topic',
        type: 'quiz',
        title: `High-Yield Weak Zone: ${highWeightWeak.topic.title}`,
        description: `Carries Weight ${highWeightWeak.weight}/5 in exam scoring. Run an adaptive diagnostic check.`,
        priority: 'urgent',
        actionPayload: { topic: highWeightWeak.topic },
      });
    }

    // Priority 3: Flashcards due today
    const todayStr = new Date().toISOString().split('T')[0];
    const dueFlashcards = flashcards.filter((f) => f.nextReviewDate <= todayStr);
    if (dueFlashcards.length > 0) {
      recs.push({
        id: 'rec_flashcard',
        type: 'flashcard',
        title: `${dueFlashcards.length} Spaced Repetition Cards Due Today`,
        description: 'Solidify neural memory consolidation before the forgetting curve takes effect.',
        priority: 'recommended',
      });
    }

    // Priority 4: Audio podcast summary for current topic
    if (activeTopic) {
      recs.push({
        id: 'rec_audio',
        type: 'audio',
        title: `Listen: High-Yield Audio Blitz on ${activeTopic.title}`,
        description: 'Stream 90-second voice breakdown with real-world analogies and exam traps.',
        priority: 'optional',
      });
    }

    return {
      examReadinessScore: finalReadiness,
      weakTopics: weakList,
      unresolvedMisconceptionsCount: activeMiscCount,
      coordinatorRecommendations: recs,
    };
  }, [curriculum, misconceptions, flashcards, activeTopic]);

  // Ensure activeTopic is ALWAYS in sync with the current curriculum and never stale
  useEffect(() => {
    const allTopics = curriculum.units.flatMap((u) => u.topics);
    if (allTopics.length > 0) {
      const match = allTopics.find((t) => t.id === activeTopic?.id);
      if (!match) {
        setActiveTopic(allTopics[0]);
      }
    } else {
      setActiveTopic(null);
    }
  }, [curriculum]);

  const updateProfile = (updates: Partial<StudentProfile>) => {
    setProfile((prev) => ({ ...prev, ...updates }));
  };

  const addXP = (amount: number, reason?: string) => {
    setProfile((prev) => ({
      ...prev,
      totalXP: prev.totalXP + amount,
    }));
    if (reason) {
      setNotification(`+${amount} XP: ${reason}`);
      setTimeout(() => setNotification(null), 4000);
    }
  };

  const updateTopicMastery = (unitId: string, topicId: string, newState: MasteryState, score?: number) => {
    setCurriculum((prev) => {
      // Find actual unit if unitId is omitted or mismatched
      const matchedUnit = prev.units.find((u) => u.id === unitId || u.topics.some((t) => t.id === topicId));
      const targetUnitId = matchedUnit ? matchedUnit.id : unitId;

      const updatedUnits = prev.units.map((unit) => {
        if (unit.id !== targetUnitId) return unit;
        return {
          ...unit,
          topics: unit.topics.map((t) => {
            if (t.id !== topicId) return t;
            const newScore =
              score !== undefined
                ? score
                : newState === 'understood'
                ? 90
                : newState === 'partial'
                ? 60
                : 25;
            return {
              ...t,
              masteryState: newState,
              masteryScore: newScore,
              lastReviewed: new Date().toISOString(),
              quizAttempts: (t.quizAttempts || 0) + 1,
            };
          }),
        };
      });
      return { ...prev, units: updatedUnits, updatedAt: new Date().toISOString() };
    });

    addXP(25, `Mastery status updated to ${newState}`);
  };

  const recordMisconception = (record: Omit<MisconceptionRecord, 'id' | 'recordedAt'>) => {
    const newRecord: MisconceptionRecord = {
      ...record,
      id: `misc_${Date.now()}`,
      recordedAt: new Date().toISOString(),
    };
    setMisconceptions((prev) => [newRecord, ...prev]);
    setNotification('⚠️ Cognitive Misconception detected and logged in Clinic');
    setTimeout(() => setNotification(null), 4500);
  };

  const resolveMisconception = (id: string) => {
    setMisconceptions((prev) =>
      prev.map((m) => (m.id === id ? { ...m, isResolved: true } : m))
    );
    setProfile((prev) => ({
      ...prev,
      resolvedMisconceptionsCount: prev.resolvedMisconceptionsCount + 1,
    }));
    addXP(100, 'Resolved Cognitive Misconception! Conceptual clarity restored.');
  };

  const deleteMisconception = (id: string) => {
    setMisconceptions((prev) => prev.filter((m) => m.id !== id));
  };

  const replaceCurriculum = (newCurriculum: SyllabusCurriculum) => {
    // 1. Sanitize units and reset topic mastery states for new curriculum
    const cleanedUnits = (newCurriculum.units || []).map((u, uIdx) => ({
      ...u,
      id: u.id || `u_${uIdx + 1}`,
      title: u.title || `Unit ${uIdx + 1}`,
      weight: Math.min(5, Math.max(1, Number(u.weight) || 3)),
      topics: (u.topics || []).map((t, tIdx) => ({
        ...t,
        id: t.id || `t_${uIdx + 1}_${tIdx + 1}`,
        masteryState: (t.masteryState || 'unfamiliar') as MasteryState,
        masteryScore: t.masteryScore ?? 0,
        quizAttempts: 0,
        lastReviewed: undefined,
      })),
    }));

    const sanitizedCurriculum: SyllabusCurriculum = {
      ...newCurriculum,
      id: `curr_${Date.now()}`,
      units: cleanedUnits,
      updatedAt: new Date().toISOString(),
    };

    // 2. Set new curriculum and target first topic
    setCurriculum(sanitizedCurriculum);
    const firstTopic = sanitizedCurriculum.units[0]?.topics[0] || null;
    setActiveTopic(firstTopic);

    // 3. Clear old misconceptions completely
    setMisconceptions([]);

    // 4. Clear old rescue plan
    setRescuePlanState(null);

    // 5. Generate fresh initial flashcards for the new curriculum topics
    const freshCards: Flashcard[] = [];
    sanitizedCurriculum.units.forEach((unit) => {
      unit.topics.forEach((topic) => {
        freshCards.push({
          id: `fc_${Date.now()}_${topic.id}`,
          front: `What is the core principle of ${topic.title}?`,
          back: topic.studyNotes ? topic.studyNotes.split('\n')[0].replace(/^[•\-\*]\s*/, '') : `Governing rules and mechanism of ${topic.title}`,
          hint: topic.subtopics?.[0] || 'Foundational mechanism',
          topic: topic.title,
          reviewsCount: 0,
          intervalDays: 1,
          easeFactor: 2.5,
          nextReviewDate: new Date().toISOString().split('T')[0],
        });
      });
    });
    setFlashcards(freshCards);

    // 6. Reset completed quiz and misconception counts while preserving student profile details
    setProfile((prev) => ({
      ...prev,
      completedQuizzesCount: 0,
      resolvedMisconceptionsCount: 0,
    }));

    // 7. Write cleanly to localStorage
    try {
      localStorage.setItem('cognipulse_curriculum', JSON.stringify(sanitizedCurriculum));
      localStorage.setItem('cognipulse_misconceptions', JSON.stringify([]));
      localStorage.setItem('cognipulse_flashcards', JSON.stringify(freshCards));
      localStorage.removeItem('cognipulse_rescue_plan');
    } catch {
      // ignore
    }

    setNotification('New syllabus activated. All previous learning data and topics have been replaced.');
    setTimeout(() => setNotification(null), 3500);
  };

  const updateCurriculum = (newCurriculum: SyllabusCurriculum) => {
    replaceCurriculum(newCurriculum);
  };

  const addFlashcard = (cardData: Omit<Flashcard, 'id' | 'reviewsCount' | 'intervalDays' | 'easeFactor' | 'nextReviewDate'>) => {
    const newCard: Flashcard = {
      ...cardData,
      id: `fc_${Date.now()}`,
      reviewsCount: 0,
      intervalDays: 1,
      easeFactor: 2.5,
      nextReviewDate: new Date().toISOString().split('T')[0],
    };
    setFlashcards((prev) => [newCard, ...prev]);
    addXP(15, 'Created new active-recall card');
  };

  const reviewFlashcard = (id: string, rating: 'hard' | 'good' | 'easy') => {
    setFlashcards((prev) =>
      prev.map((card) => {
        if (card.id !== id) return card;
        let newInterval = 1;
        let newEase = card.easeFactor;

        if (rating === 'hard') {
          newInterval = 1;
          newEase = Math.max(1.3, card.easeFactor - 0.2);
        } else if (rating === 'good') {
          newInterval = Math.max(2, Math.round(card.intervalDays * card.easeFactor));
        } else if (rating === 'easy') {
          newInterval = Math.max(4, Math.round(card.intervalDays * card.easeFactor * 1.3));
          newEase += 0.15;
        }

        const nextDate = new Date();
        nextDate.setDate(nextDate.getDate() + newInterval);

        return {
          ...card,
          intervalDays: newInterval,
          easeFactor: newEase,
          reviewsCount: card.reviewsCount + 1,
          nextReviewDate: nextDate.toISOString().split('T')[0],
          lastRating: rating,
        };
      })
    );
    addXP(10, 'Reviewed flashcard');
  };

  const setRescuePlan = (plan: RescuePlan | null) => {
    setRescuePlanState(plan);
  };

  const resetAllData = () => {
    localStorage.clear();
    setProfile(INITIAL_PROFILE);
    setCurriculum(INITIAL_CURRICULUM);
    setMisconceptions(INITIAL_MISCONCEPTIONS);
    setFlashcards(INITIAL_FLASHCARDS);
    setRescuePlanState(null);
    setActiveTopic(INITIAL_CURRICULUM.units[0]?.topics[0] || null);
    setNotification('Demo state reset to verified defaults');
    setTimeout(() => setNotification(null), 3000);
  };

  const loadCurriculumTemplate = async (key: 'biology' | 'cs') => {
    try {
      const res = await fetch('/api/syllabus/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sampleId: key }),
      });
      const data = await res.json();
      if (data.curriculum) {
        const formatted: SyllabusCurriculum = {
          id: `curr_${key}_${Date.now()}`,
          subject: data.curriculum.subject,
          description: data.curriculum.description,
          totalEstimatedHours: data.curriculum.totalEstimatedHours,
          updatedAt: new Date().toISOString(),
          units: data.curriculum.units.map((u: any) => ({
            ...u,
            topics: u.topics.map((t: any) => ({
              ...t,
              masteryState: 'unknown' as MasteryState,
              masteryScore: 0,
              quizAttempts: 0,
            })),
          })),
        };
        updateCurriculum(formatted);
      }
    } catch (err) {
      console.error('Failed to load curriculum template:', err);
    }
  };

  return (
    <AppContext.Provider
      value={{
        profile,
        curriculum,
        misconceptions,
        flashcards,
        rescuePlan,
        activeTopic,
        examReadinessScore,
        unresolvedMisconceptionsCount,
        weakTopics,
        coordinatorRecommendations,
        updateProfile,
        updateTopicMastery,
        recordMisconception,
        resolveMisconception,
        deleteMisconception,
        setActiveTopic,
        updateCurriculum,
        replaceCurriculum,
        addFlashcard,
        reviewFlashcard,
        setRescuePlan,
        addXP,
        resetAllData,
        loadCurriculumTemplate,
        onboardingCompleted,
        setOnboardingCompleted,
        startOnboarding,
        notification,
        clearNotification,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};

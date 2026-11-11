export type MasteryState = 'unfamiliar' | 'unknown' | 'partial' | 'understood';

export type ErrorType = 'careless_mistake' | 'knowledge_gap' | 'deep_misconception';

export interface TopicYouTubeLink {
  title: string;
  url: string;
  channel: string;
  duration?: string;
}

export interface StudentProfile {
  id: string;
  name: string;
  email: string;
  gradeLevel: string; // e.g. Class 10, Class 11, Class 12, College Sophomore
  targetExam: string;
  examTargetDate: string;
  dailyStudyCapacityHours: number;
  streakDays: number;
  totalXP: number;
  completedQuizzesCount: number;
  resolvedMisconceptionsCount: number;
  createdAt: string;
}

export interface Subtopic {
  id: string;
  title: string;
}

export interface SyllabusTopic {
  id: string;
  title: string;
  subtopics: string[];
  difficulty: 'easy' | 'medium' | 'hard';
  estimatedMins: number;
  masteryState: MasteryState;
  masteryScore: number; // 0 - 100
  lastReviewed?: string;
  quizAttempts: number;
  notes?: string;
  studyNotes?: string; // Short notes about the topic
  youtubeLinks?: TopicYouTubeLink[]; // 3 real YouTube tutorial links
}

export interface SyllabusUnit {
  id: string;
  title: string;
  weight: number; // 1 - 5 (Exam significance)
  topics: SyllabusTopic[];
}

export interface SyllabusCurriculum {
  id: string;
  subject: string;
  description: string;
  totalEstimatedHours: number;
  units: SyllabusUnit[];
  updatedAt: string;
}

export interface MisconceptionRecord {
  id: string;
  topicId: string;
  topicTitle: string;
  unitTitle: string;
  questionPrompt: string;
  studentAnswer: string;
  correctAnswer: string;
  errorType: ErrorType;
  diagnosis: string;
  counterExample: string;
  remediationTip: string;
  isResolved: boolean;
  followUpDiagnostic?: {
    question: string;
    options: string[];
    correctOption: string;
    explanation: string;
  };
  recordedAt: string;
}

export interface QuizOption {
  id: string; // "A" | "B" | "C" | "D" | "true" | "false"
  text: string;
}

export interface QuizQuestion {
  id: string;
  type: 'mcq' | 'boolean' | 'short_answer';
  prompt: string;
  options?: string[]; // e.g. ["A) ...", "B) ..."]
  optionItems?: QuizOption[];
  correctOptionId?: string; // "A" | "B" | "C" | "D" | "true" | "false"
  correctAnswer: string;
  explanation: string;
  commonMisconception?: string;
  counterExample?: string;
  remediationTip?: string;
  bloomTaxonomy?: string;
}

export interface Flashcard {
  id: string;
  front: string;
  back: string;
  hint?: string;
  topic: string;
  intervalDays: number;
  easeFactor: number;
  reviewsCount: number;
  nextReviewDate: string;
  lastRating?: 'hard' | 'good' | 'easy';
}

export interface RescueTask {
  id?: string;
  timeSlot: string; // e.g. "09:00 - 10:15"
  durationMins: number; // e.g. 75
  topic: string; // strictly an actual syllabus topic
  task: string; // actionable, non-repetitive task description
}

export interface RescueMilestone {
  day: number;
  dateLabel: string;
  targetHours: number;
  focus: string;
  priority: 'Critical' | 'High' | 'Moderate';
  tasks?: RescueTask[]; // Detailed timetable tasks with time slot, duration, topic
  actions: string[];
  isCompleted?: boolean;
}

export interface RescuePlan {
  daysUntilExam: number;
  totalAvailableHours: number;
  estimatedNeededHours: number;
  isOverload: boolean;
  overloadRatio?: string;
  strategyTitle: string;
  strategicVerdict: string;
  triageRecommendations: string[];
  dailyMilestones: RescueMilestone[];
  generatedAt: string;
}

export interface CoordinatorRecommendation {
  id: string;
  type: 'quiz' | 'clinic' | 'rescue' | 'audio' | 'flashcard';
  title: string;
  description: string;
  priority: 'urgent' | 'recommended' | 'optional';
  actionPayload?: any;
}

export type SupportedLanguage = 'en' | 'hi' | 'te' | 'ta' | 'kn' | 'mr';


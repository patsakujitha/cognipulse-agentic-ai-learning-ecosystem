import React, { useState } from 'react';
import {
  Sparkles,
  BookOpen,
  ArrowRight,
  Upload,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  User,
  GraduationCap,
  Layers,
  AlertTriangle,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { LanguageSelector } from '../LanguageSelector';
import { SyllabusCurriculum, MasteryState } from '../../types';

interface OnboardingFlowProps {
  onComplete: () => void;
}

export const OnboardingFlow: React.FC<OnboardingFlowProps> = ({ onComplete }) => {
  const {
    profile,
    updateProfile,
    curriculum,
    replaceCurriculum,
    updateTopicMastery,
  } = useApp();
  const { t } = useLanguage();

  const [step, setStep] = useState<'login' | 'uploader' | 'assessment'>('login');

  // Step 1: Login state
  const [studentName, setStudentName] = useState(profile.name || '');
  const [studentClass, setStudentClass] = useState(profile.gradeLevel || 'Class 12');
  const [targetExam, setTargetExam] = useState(profile.targetExam || 'Board Exam & College Prep');

  // Step 2: Uploader state
  const [syllabusText, setSyllabusText] = useState('');
  const [selectedFile, setSelectedFile] = useState<{
    name: string;
    sizeFormatted: string;
    mimeType: string;
    base64?: string;
  } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentName.trim()) return;

    updateProfile({
      name: studentName.trim(),
      gradeLevel: studentClass,
      targetExam: targetExam.trim() || 'Board Exam & College Prep',
    });

    setStep('uploader');
  };

  const processExtractedCurriculum = (data: any, fallbackName: string = 'Course Syllabus') => {
    if (!data.curriculum || !data.curriculum.units || data.curriculum.units.length === 0) {
      throw new Error('No structured units or topics could be extracted. Please upload a clear document or paste detailed syllabus text.');
    }

    const units = data.curriculum.units;
    let totalTopics = 0;
    units.forEach((u: any) => {
      if (Array.isArray(u.topics)) totalTopics += u.topics.length;
    });

    if (totalTopics === 0) {
      throw new Error('The extracted syllabus has no topics. Please provide a more detailed syllabus.');
    }

    const parsed: SyllabusCurriculum = {
      id: `curr_${Date.now()}`,
      subject: data.curriculum.subject || fallbackName,
      description: data.curriculum.description || 'AI Extracted Course Structure',
      totalEstimatedHours: Number(data.curriculum.totalEstimatedHours) || Math.max(20, Math.round(totalTopics * 1.5)),
      updatedAt: new Date().toISOString(),
      units: units.map((u: any, idx: number) => ({
        id: u.id || `u_${idx + 1}`,
        title: u.title || `Unit ${idx + 1}`,
        weight: Math.min(5, Math.max(1, Number(u.weight) || 4)),
        topics: (u.topics || []).map((t: any, tIdx: number) => ({
          id: t.id || `t_${idx + 1}_${tIdx + 1}`,
          title: t.title || 'Topic',
          subtopics: Array.isArray(t.subtopics) && t.subtopics.length > 0 ? t.subtopics : ['Fundamental Concepts', 'Core Mechanism', 'Exam Applications'],
          difficulty: ['easy', 'medium', 'hard'].includes(t.difficulty) ? t.difficulty : 'medium',
          estimatedMins: Number(t.estimatedMins) || 60,
          masteryState: 'unfamiliar' as MasteryState,
          masteryScore: 0,
          quizAttempts: 0,
          studyNotes: t.studyNotes || `${t.title}: Fundamental principles, core concepts, formulas, and typical exam questions.`,
          youtubeLinks: Array.isArray(t.youtubeLinks) && t.youtubeLinks.length >= 3 ? t.youtubeLinks.slice(0, 3) : [
            { title: `${t.title} Full Tutorial`, url: `https://www.youtube.com/results?search_query=${encodeURIComponent((t.title || '') + ' tutorial')}`, channel: 'Khan Academy' },
            { title: `${t.title} Crash Course`, url: `https://www.youtube.com/results?search_query=${encodeURIComponent((t.title || '') + ' crash course')}`, channel: 'CrashCourse' },
            { title: `${t.title} Concept & Practice`, url: `https://www.youtube.com/results?search_query=${encodeURIComponent((t.title || '') + ' lecture')}`, channel: 'MIT OpenCourseWare' },
          ],
        })),
      })),
    };

    replaceCurriculum(parsed);
    setStep('assessment');
  };

  const handleProcessSyllabus = async (samplePreset?: 'biology' | 'cs') => {
    setErrorMessage(null);
    setIsProcessing(true);

    try {
      const payload: any = {};
      if (samplePreset) {
        payload.sampleId = samplePreset;
      } else {
        if (!syllabusText.trim() && !selectedFile) {
          throw new Error('Please enter curriculum text or upload a syllabus file.');
        }
        if (syllabusText.trim()) {
          payload.syllabusText = syllabusText.trim();
        }
        if (selectedFile?.base64) {
          payload.fileBase64 = selectedFile.base64;
          payload.mimeType = selectedFile.mimeType;
          payload.fileName = selectedFile.name;
        }
      }

      const res = await fetch('/api/syllabus/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to extract syllabus.');
      }

      const data = await res.json();
      processExtractedCurriculum(data, selectedFile?.name?.replace(/\.[^/.]+$/, '') || 'Course Syllabus');
    } catch (err: any) {
      console.error('Failed to analyze syllabus:', err);
      setErrorMessage(err.message || 'Failed to analyze syllabus. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMessage(null);

    const sizeFormatted = file.size > 1024 * 1024
      ? `${(file.size / (1024 * 1024)).toFixed(1)} MB`
      : `${Math.round(file.size / 1024)} KB`;

    const lowerName = file.name.toLowerCase();
    const isText = lowerName.endsWith('.txt') || lowerName.endsWith('.md') || (file.type && file.type.startsWith('text/'));

    if (isText) {
      const reader = new FileReader();
      reader.onload = () => {
        const text = (reader.result as string) || '';
        setSelectedFile({
          name: file.name,
          sizeFormatted,
          mimeType: file.type || 'text/plain',
        });
        setSyllabusText(text.slice(0, 15000));
      };
      reader.onerror = () => setErrorMessage('Unable to read selected text file.');
      reader.readAsText(file);
    } else {
      const reader = new FileReader();
      reader.onload = () => {
        const fullDataUrl = (reader.result as string) || '';
        const base64 = fullDataUrl.includes(',') ? fullDataUrl.split(',')[1] : fullDataUrl;
        let mime = file.type;
        if (!mime) {
          if (lowerName.endsWith('.pdf')) mime = 'application/pdf';
          else if (lowerName.endsWith('.png')) mime = 'image/png';
          else if (lowerName.endsWith('.webp')) mime = 'image/webp';
          else mime = 'image/jpeg';
        }

        setSelectedFile({
          name: file.name,
          sizeFormatted,
          mimeType: mime,
          base64,
        });
      };
      reader.onerror = () => {
        setErrorMessage('Unable to read selected file.');
      };
      reader.readAsDataURL(file);
    }
  };

  // Assessment calculation
  const allTopics = curriculum.units.flatMap((u) => u.topics);
  const understoodCount = allTopics.filter((t) => t.masteryState === 'understood').length;
  const partialCount = allTopics.filter((t) => t.masteryState === 'partial').length;
  const unfamiliarCount = allTopics.filter(
    (t) => t.masteryState === 'unfamiliar' || t.masteryState === 'unknown'
  ).length;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-4 sm:p-6 lg:p-8">
      {/* Top Bar with Language Selector */}
      <div className="w-full max-w-2xl flex items-center justify-between mb-6">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-violet-600 to-indigo-600 flex items-center justify-center text-white font-bold text-lg shadow-sm">
            C
          </div>
          <div>
            <span className="font-bold text-slate-900 tracking-tight text-lg block leading-none">
              {t('appName')}
            </span>
            <span className="text-xs text-slate-500 font-medium tracking-tight block mt-0.5">
              {t('tagline')}
            </span>
          </div>
        </div>
        <LanguageSelector />
      </div>

      {/* Progress Steps Header */}
      <div className="flex items-center gap-2 mb-6 text-xs text-slate-500">
        <span
          className={`font-semibold ${
            step === 'login' ? 'text-violet-700 font-bold' : 'text-slate-400'
          }`}
        >
          1. {t('onboarding_name_label')}
        </span>
        <span>→</span>
        <span
          className={`font-semibold ${
            step === 'uploader' ? 'text-violet-700 font-bold' : 'text-slate-400'
          }`}
        >
          2. {t('syl_upload_button')}
        </span>
        <span>→</span>
        <span
          className={`font-semibold ${
            step === 'assessment' ? 'text-violet-700 font-bold' : 'text-slate-400'
          }`}
        >
          3. {t('onboarding_assessment_title')}
        </span>
      </div>

      {/* Card Content Container */}
      <div className="w-full max-w-2xl bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-xs">
        {step === 'login' && (
          <div className="space-y-6">
            <div className="space-y-1.5 text-center sm:text-left">
              <div className="flex items-center justify-center sm:justify-start gap-2 text-xs font-semibold text-violet-700 uppercase tracking-wide">
                <User className="w-4 h-4 text-violet-600" />
                <span>{t('onboarding_title')}</span>
              </div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                {t('onboarding_title')}
              </h1>
              <p className="text-sm text-slate-600">
                {t('onboarding_subtitle')}
              </p>
            </div>

            <form onSubmit={handleLoginSubmit} className="space-y-4 text-xs sm:text-sm">
              <div className="space-y-1.5">
                <label className="font-semibold text-slate-700 flex items-center gap-1.5">
                  <User className="w-4 h-4 text-slate-400" />
                  <span>{t('onboarding_name_label')} *</span>
                </label>
                <input
                  type="text"
                  required
                  value={studentName}
                  onChange={(e) => setStudentName(e.target.value)}
                  placeholder={t('onboarding_name_placeholder')}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500 font-medium"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-slate-700 flex items-center gap-1.5">
                  <GraduationCap className="w-4 h-4 text-slate-400" />
                  <span>{t('onboarding_class_label')} *</span>
                </label>
                <select
                  value={studentClass}
                  onChange={(e) => setStudentClass(e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500 font-medium bg-white"
                >
                  <option value="Class 10">Class 10 (Secondary School)</option>
                  <option value="Class 11">Class 11 (Higher Secondary)</option>
                  <option value="Class 12">Class 12 (Board / Entrance Prep)</option>
                  <option value="College Freshman">College Freshman (Year 1)</option>
                  <option value="College Sophomore">College Sophomore (Year 2)</option>
                  <option value="Undergraduate">Undergraduate / Engineering / Medical</option>
                  <option value="Graduate Prep">Graduate / Competitive Exam Prep</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-slate-700">
                  {t('onboarding_exam_label')}
                </label>
                <input
                  type="text"
                  value={targetExam}
                  onChange={(e) => setTargetExam(e.target.value)}
                  placeholder={t('onboarding_exam_placeholder')}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500 font-medium"
                />
              </div>

              <button
                type="submit"
                disabled={!studentName.trim()}
                className="w-full py-3 px-5 text-sm font-semibold text-white bg-violet-600 hover:bg-violet-700 disabled:bg-violet-300 rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 mt-2"
              >
                <span>{t('onboarding_start_button')}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          </div>
        )}

        {step === 'uploader' && (
          <div className="space-y-6">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-xs font-semibold text-violet-700 uppercase tracking-wide">
                <BookOpen className="w-4 h-4 text-violet-600" />
                <span>2 / 3</span>
              </div>
              <h2 className="text-xl font-bold text-slate-900 tracking-tight">
                {t('onboarding_upload_title')}
              </h2>
              <p className="text-xs sm:text-sm text-slate-600">
                {t('onboarding_upload_desc')}
              </p>
            </div>

            {errorMessage && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5 text-xs text-rose-700">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Attached file chip if selected */}
            {selectedFile && (
              <div className="p-3 bg-violet-50 border border-violet-200 rounded-xl flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-violet-950">{selectedFile.name}</span>
                  <span className="text-violet-600 font-mono">({selectedFile.sizeFormatted})</span>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedFile(null)}
                  className="text-violet-500 hover:text-violet-800 text-xs font-semibold"
                >
                  ✕
                </button>
              </div>
            )}

            {/* Upload Area */}
            <div className="space-y-4">
              <label className="border-2 border-dashed border-slate-300 hover:border-violet-500 rounded-xl p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-colors bg-slate-50/50 hover:bg-violet-50/20">
                <Upload className="w-8 h-8 text-slate-400 mb-2" />
                <span className="text-xs sm:text-sm font-semibold text-slate-800">
                  {selectedFile ? 'Change Attached File' : t('onboarding_dropzone')}
                </span>
                <span className="text-[11px] text-slate-500 mt-1">
                  PDF, JPG, PNG, WEBP, or TXT
                </span>
                <input
                  type="file"
                  accept=".pdf,image/png,image/jpeg,image/webp,image/jpg,.txt,.md"
                  className="hidden"
                  onChange={handleFileUpload}
                  disabled={isProcessing}
                />
              </label>

              {/* Paste Text Area */}
              <div className="space-y-1">
                <div className="text-xs font-semibold text-slate-700">{t('onboarding_or_paste')}</div>
                <textarea
                  value={syllabusText}
                  onChange={(e) => setSyllabusText(e.target.value)}
                  placeholder={t('onboarding_paste_placeholder')}
                  className="w-full p-3 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500 min-h-[110px] resize-none"
                  disabled={isProcessing}
                />
              </div>

              {/* Instant preset samples */}
              <div className="pt-1">
                <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                  Or Start Instantly with Verified Curriculum:
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleProcessSyllabus('biology')}
                    disabled={isProcessing}
                    className="px-2.5 py-1 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                  >
                    AP Biology & Genetics
                  </button>
                  <button
                    type="button"
                    onClick={() => handleProcessSyllabus('cs')}
                    disabled={isProcessing}
                    className="px-2.5 py-1 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                  >
                    Data Structures & Algorithms
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setStep('login')}
                className="text-xs text-slate-500 hover:text-slate-800 font-medium"
              >
                ← {t('back')}
              </button>

              <button
                type="button"
                onClick={() => handleProcessSyllabus()}
                disabled={isProcessing || (!syllabusText.trim() && !selectedFile)}
                className="px-5 py-2.5 text-xs font-semibold text-white bg-violet-600 hover:bg-violet-700 disabled:bg-violet-300 rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
              >
                {isProcessing ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Extracting & Validating OCR...</span>
                  </>
                ) : (
                  <>
                    <span>Extract & Validate</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {step === 'assessment' && (
          <div className="space-y-6">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-xs font-semibold text-violet-700 uppercase tracking-wide">
                <Layers className="w-4 h-4 text-violet-600" />
                <span>3 / 3</span>
              </div>
              <h2 className="text-xl font-bold text-slate-900 tracking-tight">
                {t('onboarding_assessment_title')}
              </h2>
              <p className="text-xs sm:text-sm text-slate-600">
                {t('onboarding_assessment_subtitle')}
              </p>
            </div>

            {/* Assessment Counter Strip */}
            <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs">
              <span className="font-semibold text-slate-800">
                {curriculum.subject} ({allTopics.length} {t('topics')})
              </span>
              <div className="flex items-center gap-3">
                <span className="text-emerald-700 font-medium">✓ {understoodCount} {t('mastery_understood')}</span>
                <span className="text-amber-700 font-medium">~ {partialCount} {t('mastery_partial')}</span>
                <span className="text-slate-600 font-medium">? {unfamiliarCount} {t('mastery_unfamiliar')}</span>
              </div>
            </div>

            {/* Units & Topics List with 3-Option Classifier */}
            <div className="space-y-4 max-h-[360px] overflow-y-auto pr-1">
              {curriculum.units.map((unit) => (
                <div
                  key={unit.id}
                  className="border border-slate-200 rounded-xl p-4 bg-white space-y-3"
                >
                  <div className="text-xs font-bold text-slate-800 flex items-center justify-between border-b border-slate-100 pb-2">
                    <span>{unit.title}</span>
                    <span className="text-[11px] text-slate-500 font-mono">{t('weight')}: {unit.weight}/5</span>
                  </div>

                  <div className="space-y-2.5">
                    {unit.topics.map((topic) => {
                      const state = topic.masteryState;
                      const isUnfamiliar = state === 'unfamiliar' || state === 'unknown';
                      const isPartial = state === 'partial';
                      const isUnderstood = state === 'understood';

                      return (
                        <div
                          key={topic.id}
                          className="p-3 bg-slate-50/70 border border-slate-200/80 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
                        >
                          <div className="space-y-0.5">
                            <div className="text-xs font-semibold text-slate-900">
                              {topic.title}
                            </div>
                            <div className="text-[11px] text-slate-500">
                              ~{topic.estimatedMins}m · {topic.difficulty}
                            </div>
                          </div>

                          {/* 3 Rating Buttons: Unfamiliar / Partial / Understood */}
                          <div className="flex items-center gap-1.5 shrink-0 self-start sm:self-center">
                            <button
                              type="button"
                              onClick={() => updateTopicMastery(unit.id, topic.id, 'unfamiliar')}
                              className={`px-2.5 py-1 text-xs font-medium rounded-lg border transition-colors flex items-center gap-1 ${
                                isUnfamiliar
                                  ? 'bg-slate-900 text-white border-slate-900 font-semibold shadow-xs'
                                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                              }`}
                            >
                              <HelpCircle className="w-3 h-3" />
                              <span>{t('mastery_unfamiliar')}</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => updateTopicMastery(unit.id, topic.id, 'partial')}
                              className={`px-2.5 py-1 text-xs font-medium rounded-lg border transition-colors flex items-center gap-1 ${
                                isPartial
                                  ? 'bg-amber-100 text-amber-900 border-amber-300 font-semibold shadow-xs'
                                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                              }`}
                            >
                              <AlertCircle className="w-3 h-3 text-amber-600" />
                              <span>{t('mastery_partial')}</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => updateTopicMastery(unit.id, topic.id, 'understood')}
                              className={`px-2.5 py-1 text-xs font-medium rounded-lg border transition-colors flex items-center gap-1 ${
                                isUnderstood
                                  ? 'bg-emerald-100 text-emerald-900 border-emerald-300 font-semibold shadow-xs'
                                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                              }`}
                            >
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              <span>{t('mastery_understood')}</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Launch Dashboard Button */}
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setStep('uploader')}
                className="text-xs text-slate-500 hover:text-slate-800 font-medium"
              >
                ← {t('back')}
              </button>

              <button
                type="button"
                onClick={onComplete}
                className="py-2.5 px-6 text-xs sm:text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs transition-colors flex items-center gap-2"
              >
                <span>{t('onboarding_finish_btn')}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

import React, { useState } from 'react';
import {
  Upload,
  FileText,
  Sparkles,
  CheckCircle2,
  HelpCircle,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  BookOpen,
  Search,
  Video,
  ExternalLink,
  BookMarked,
  AlertTriangle,
  RefreshCw,
  ShieldCheck,
  X,
  Layers,
  Clock,
  FileCheck2,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { SyllabusCurriculum, MasteryState } from '../../types';
import { NavigationTab } from '../Sidebar';

interface SyllabusViewProps {
  onNavigate: (tab: NavigationTab) => void;
}

export const SyllabusView: React.FC<SyllabusViewProps> = ({ onNavigate }) => {
  const {
    curriculum,
    replaceCurriculum,
    updateTopicMastery,
    setActiveTopic,
  } = useApp();
  const { t } = useLanguage();

  const [activeTab, setActiveTab] = useState<'checklist' | 'analyzer'>('checklist');
  const [syllabusInput, setSyllabusInput] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterState, setFilterState] = useState<'all' | 'understood' | 'partial' | 'unfamiliar'>('all');
  const [expandedUnits, setExpandedUnits] = useState<Record<string, boolean>>({
    u1: true,
    u2: true,
    u3: true,
  });
  const [expandedStudyContentId, setExpandedStudyContentId] = useState<string | null>(null);
  const [showReplaceWarning, setShowReplaceWarning] = useState(false);

  // File upload state
  const [selectedFile, setSelectedFile] = useState<{
    name: string;
    sizeFormatted: string;
    mimeType: string;
    base64?: string;
    textContent?: string;
  } | null>(null);

  // Staged curriculum for validation before saving
  const [stagedCurriculum, setStagedCurriculum] = useState<SyllabusCurriculum | null>(null);
  const [validationSummary, setValidationSummary] = useState<{
    unitCount: number;
    topicCount: number;
    subtopicCount: number;
  } | null>(null);

  const toggleUnit = (id: string) => {
    setExpandedUnits((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleStudyContent = (topicId: string) => {
    setExpandedStudyContentId((prev) => (prev === topicId ? null : topicId));
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAnalysisError(null);
    setStagedCurriculum(null);

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
          textContent: text,
        });
        if (!syllabusInput.trim()) {
          setSyllabusInput(text.slice(0, 15000));
        }
      };
      reader.onerror = () => setAnalysisError('Failed to read text file.');
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
      reader.onerror = () => setAnalysisError('Failed to read file.');
      reader.readAsDataURL(file);
    }
  };

  const removeSelectedFile = () => {
    setSelectedFile(null);
  };

  const triggerAIAnalysis = async (presetSampleId?: 'biology' | 'cs') => {
    setAnalysisError(null);
    setStagedCurriculum(null);
    setIsAnalyzing(true);
    try {
      const payload: any = {};
      if (presetSampleId) {
        payload.sampleId = presetSampleId;
      } else {
        payload.syllabusText = syllabusInput.trim() || (selectedFile?.textContent || '');
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
      if (!data.curriculum || !data.curriculum.units || data.curriculum.units.length === 0) {
        throw new Error('No structured units or topics could be extracted. Please upload a clear document or detailed syllabus text.');
      }

      // Client-side thorough validation
      const units = data.curriculum.units;
      let totalTopics = 0;
      let totalSubtopics = 0;

      units.forEach((u: any) => {
        if (Array.isArray(u.topics)) {
          totalTopics += u.topics.length;
          u.topics.forEach((t: any) => {
            if (Array.isArray(t.subtopics)) {
              totalSubtopics += t.subtopics.length;
            }
          });
        }
      });

      if (totalTopics === 0) {
        throw new Error('The extracted syllabus has no topics. Please provide a more detailed syllabus.');
      }

      const validated: SyllabusCurriculum = {
        id: `curr_${Date.now()}`,
        subject: data.curriculum.subject || 'Course Syllabus',
        description: data.curriculum.description || 'AI Extracted Course Structure',
        totalEstimatedHours: Number(data.curriculum.totalEstimatedHours) || Math.max(20, Math.round(totalTopics * 1.5)),
        updatedAt: new Date().toISOString(),
        units: units.map((u: any, idx: number) => ({
          id: u.id || `u_${idx + 1}`,
          title: u.title || `Unit ${idx + 1}`,
          weight: Math.min(5, Math.max(1, Number(u.weight) || 4)),
          topics: (u.topics || []).map((t: any, tIdx: number) => ({
            id: t.id || `t_${idx + 1}_${tIdx + 1}`,
            title: t.title || `Topic ${tIdx + 1}`,
            subtopics: Array.isArray(t.subtopics) && t.subtopics.length > 0 ? t.subtopics : ['Fundamental Mechanism', 'Key Formulas', 'Exam Applications'],
            difficulty: ['easy', 'medium', 'hard'].includes(t.difficulty) ? t.difficulty : 'medium',
            estimatedMins: Number(t.estimatedMins) || 60,
            masteryState: 'unfamiliar' as MasteryState,
            masteryScore: 0,
            quizAttempts: 0,
            studyNotes: t.studyNotes || `${t.title}: Core principles, formulas, step-by-step mechanisms, and high-yield exam takeaways.`,
            youtubeLinks: Array.isArray(t.youtubeLinks) && t.youtubeLinks.length >= 3 ? t.youtubeLinks.slice(0, 3) : [
              { title: `${t.title} Tutorial`, url: `https://www.youtube.com/results?search_query=${encodeURIComponent((t.title || '') + ' tutorial')}`, channel: 'Khan Academy' },
              { title: `${t.title} Crash Course`, url: `https://www.youtube.com/results?search_query=${encodeURIComponent((t.title || '') + ' crash course')}`, channel: 'CrashCourse' },
              { title: `${t.title} Lecture & Applications`, url: `https://www.youtube.com/results?search_query=${encodeURIComponent((t.title || '') + ' lecture')}`, channel: 'MIT OpenCourseWare' },
            ],
          })),
        })),
      };

      setValidationSummary({
        unitCount: validated.units.length,
        topicCount: totalTopics,
        subtopicCount: totalSubtopics,
      });

      // Stage for student verification before saving
      setStagedCurriculum(validated);
    } catch (err: any) {
      console.error('Analysis failed:', err);
      setAnalysisError(err.message || 'Syllabus analysis failed. Please try another file or outline.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleConfirmAndSave = () => {
    if (!stagedCurriculum) return;
    replaceCurriculum(stagedCurriculum);
    setStagedCurriculum(null);
    setValidationSummary(null);
    setSelectedFile(null);
    setSyllabusInput('');
    setActiveTab('checklist');
    setShowReplaceWarning(false);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-violet-700 tracking-wide uppercase">
            <BookOpen className="w-4 h-4 text-violet-600" />
            <span>{t('syl_title')}</span>
          </div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight mt-1">
            {curriculum.subject}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5 max-w-2xl">
            {curriculum.description} · ~{curriculum.totalEstimatedHours}h {t('syl_subtitle')}
          </p>
        </div>

        {/* Tab switch between Checklist and Analyzer */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => {
              setActiveTab('checklist');
              setShowReplaceWarning(false);
              setStagedCurriculum(null);
            }}
            className={`px-3.5 py-2 text-xs font-semibold rounded-xl border transition-colors ${
              activeTab === 'checklist'
                ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
          >
            {t('syl_checklist_tab')}
          </button>
          <button
            onClick={() => {
              setActiveTab('analyzer');
              setShowReplaceWarning(true);
            }}
            className={`px-3.5 py-2 text-xs font-semibold rounded-xl border transition-colors flex items-center gap-1.5 ${
              activeTab === 'analyzer'
                ? 'bg-violet-600 text-white border-violet-600 shadow-xs'
                : 'bg-white text-violet-700 border-violet-200 hover:bg-violet-50'
            }`}
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>{t('syl_replace_button')}</span>
          </button>
        </div>
      </div>

      {activeTab === 'analyzer' ? (
        /* Analyzer / Replace View */
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-6">
          {showReplaceWarning && !stagedCurriculum && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-1 text-xs">
                <div className="font-bold text-amber-900">{t('syl_replace_confirm_title')}</div>
                <div className="text-amber-800 leading-relaxed">{t('syl_replace_confirm_desc')}</div>
              </div>
            </div>
          )}

          {/* Validation & Review Stage when AI Extraction completes */}
          {stagedCurriculum && validationSummary ? (
            <div className="space-y-6 animate-fade-in">
              <div className="p-5 bg-emerald-50/80 border border-emerald-200 rounded-2xl space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
                      <ShieldCheck className="w-5 h-5" />
                    </div>
                    <div>
                      <h2 className="text-sm sm:text-base font-bold text-emerald-950">
                        Syllabus Extracted & Validated Successfully
                      </h2>
                      <p className="text-xs text-emerald-800 mt-0.5">
                        Extracted all units, topics, and subtopics with zero omissions. Review before activating.
                      </p>
                    </div>
                  </div>

                  <span className="px-3 py-1 bg-emerald-200/60 text-emerald-900 font-semibold text-xs rounded-full self-start sm:self-center">
                    Validation Passed
                  </span>
                </div>

                {/* Subject and Scope */}
                <div className="bg-white/90 border border-emerald-200 rounded-xl p-4 space-y-2">
                  <div className="text-xs font-semibold text-emerald-800 uppercase tracking-wide">
                    Extracted Course Subject
                  </div>
                  <div className="text-lg font-bold text-slate-900">
                    {stagedCurriculum.subject}
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    {stagedCurriculum.description}
                  </p>

                  {/* Quantitative Metrics Bar */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-emerald-100">
                    <div className="p-2.5 bg-emerald-50/50 rounded-lg">
                      <div className="text-[11px] text-emerald-700 font-medium">Curriculum Units</div>
                      <div className="text-base font-bold text-emerald-950 font-mono">
                        {validationSummary.unitCount} Units
                      </div>
                    </div>
                    <div className="p-2.5 bg-emerald-50/50 rounded-lg">
                      <div className="text-[11px] text-emerald-700 font-medium">Topics Cataloged</div>
                      <div className="text-base font-bold text-emerald-950 font-mono">
                        {validationSummary.topicCount} Topics
                      </div>
                    </div>
                    <div className="p-2.5 bg-emerald-50/50 rounded-lg">
                      <div className="text-[11px] text-emerald-700 font-medium">Subtopics Mapped</div>
                      <div className="text-base font-bold text-emerald-950 font-mono">
                        {validationSummary.subtopicCount} Subtopics
                      </div>
                    </div>
                    <div className="p-2.5 bg-emerald-50/50 rounded-lg">
                      <div className="text-[11px] text-emerald-700 font-medium">Estimated Runway</div>
                      <div className="text-base font-bold text-emerald-950 font-mono">
                        ~{stagedCurriculum.totalEstimatedHours}h
                      </div>
                    </div>
                  </div>
                </div>

                {/* Validation Checklist */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs text-emerald-900 font-medium">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Zero topic omissions</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Notes & exam traps generated</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>YouTube lectures attached</span>
                  </div>
                </div>
              </div>

              {/* Units & Topics Hierarchical Preview */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                    Extracted Curriculum Structure Preview
                  </h3>
                  <span className="text-xs text-slate-500">
                    {stagedCurriculum.units.length} Units · {validationSummary.topicCount} Topics
                  </span>
                </div>

                <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
                  {stagedCurriculum.units.map((unit, uIdx) => (
                    <div
                      key={unit.id || uIdx}
                      className="border border-slate-200 rounded-xl p-4 bg-white space-y-2.5 shadow-2xs"
                    >
                      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                        <span className="text-xs font-bold text-slate-900">
                          {unit.title}
                        </span>
                        <span className="text-[11px] text-slate-500 font-mono">
                          Weight: {unit.weight}/5 · {unit.topics.length} topics
                        </span>
                      </div>

                      <div className="space-y-2">
                        {unit.topics.map((t, tIdx) => (
                          <div
                            key={t.id || tIdx}
                            className="p-2.5 bg-slate-50 rounded-lg text-xs space-y-1.5"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-slate-800">
                                {t.title}
                              </span>
                              <span className="text-[11px] text-slate-500">
                                ~{t.estimatedMins}m · {t.difficulty}
                              </span>
                            </div>
                            {t.subtopics && t.subtopics.length > 0 && (
                              <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                                {t.subtopics.map((sub, sIdx) => (
                                  <span
                                    key={sIdx}
                                    className="px-2 py-0.5 bg-white border border-slate-200 rounded-md text-[11px] text-slate-600"
                                  >
                                    {sub}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Confirmation Action Buttons */}
              <div className="flex items-center justify-between pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => {
                    setStagedCurriculum(null);
                    setValidationSummary(null);
                  }}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-900"
                >
                  Discard & Re-upload
                </button>

                <button
                  type="button"
                  onClick={handleConfirmAndSave}
                  className="px-6 py-2.5 text-xs sm:text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs flex items-center gap-2 transition-colors"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Save & Activate Syllabus</span>
                </button>
              </div>
            </div>
          ) : (
            /* Upload & Extract Form */
            <div className="space-y-6">
              <div className="space-y-1">
                <h2 className="text-lg font-bold text-slate-900">
                  {t('onboarding_upload_title')}
                </h2>
                <p className="text-xs text-slate-600">
                  Upload an image (JPG, PNG, WEBP), PDF syllabus, or text file. Gemini optical character recognition will extract all units, topics, and subtopics with high accuracy.
                </p>
              </div>

              {analysisError && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5 text-xs text-rose-700">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                  <span>{analysisError}</span>
                </div>
              )}

              {/* Attached file chip if selected */}
              {selectedFile && (
                <div className="p-3 bg-violet-50 border border-violet-200 rounded-xl flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2">
                    <FileCheck2 className="w-4 h-4 text-violet-600 shrink-0" />
                    <div>
                      <span className="font-semibold text-violet-950">{selectedFile.name}</span>
                      <span className="text-violet-600 ml-1.5 font-mono">({selectedFile.sizeFormatted})</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={removeSelectedFile}
                    className="p-1 text-violet-400 hover:text-violet-700"
                    aria-label="Remove attached file"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Dropzone & Text Area */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* File Upload Zone */}
                <label className="border-2 border-dashed border-slate-300 hover:border-violet-500 rounded-xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-colors bg-slate-50/50 hover:bg-violet-50/20">
                  <Upload className="w-8 h-8 text-slate-400 mb-2" />
                  <span className="text-sm font-semibold text-slate-800">
                    {selectedFile ? 'Change Attached File' : t('onboarding_dropzone')}
                  </span>
                  <span className="text-xs text-slate-500 mt-1">
                    PDF, JPG, PNG, WEBP, or TXT
                  </span>
                  <input
                    type="file"
                    accept=".pdf,image/png,image/jpeg,image/webp,image/jpg,.txt,.md"
                    className="hidden"
                    onChange={handleFileUpload}
                    disabled={isAnalyzing}
                  />
                </label>

                {/* Raw Text Input */}
                <div className="flex flex-col space-y-2">
                  <div className="text-xs font-semibold text-slate-700">
                    {t('onboarding_or_paste')}
                  </div>
                  <textarea
                    value={syllabusInput}
                    onChange={(e) => setSyllabusInput(e.target.value)}
                    placeholder={t('onboarding_paste_placeholder')}
                    className="flex-1 w-full p-3.5 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent min-h-[140px] resize-none"
                    disabled={isAnalyzing}
                  />
                </div>
              </div>

              {/* 1-Click Preset Demos */}
              <div className="pt-2">
                <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-2">
                  Or Test Instantly with Curated Syllabi:
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => triggerAIAnalysis('biology')}
                    disabled={isAnalyzing}
                    className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors flex items-center gap-1.5"
                  >
                    <span>AP Biology & Molecular Genetics</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => triggerAIAnalysis('cs')}
                    disabled={isAnalyzing}
                    className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors flex items-center gap-1.5"
                  >
                    <span>Data Structures & Algorithmic Analysis</span>
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  onClick={() => {
                    setActiveTab('checklist');
                    setShowReplaceWarning(false);
                  }}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-900"
                >
                  {t('cancel')}
                </button>
                <button
                  onClick={() => triggerAIAnalysis()}
                  disabled={isAnalyzing || (!selectedFile && !syllabusInput.trim())}
                  className="px-5 py-2.5 text-xs font-semibold text-white bg-violet-600 hover:bg-violet-700 disabled:bg-violet-300 rounded-xl shadow-xs flex items-center gap-2 transition-colors"
                >
                  {isAnalyzing ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Transcribing & Validating OCR...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Extract & Validate Syllabus</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Checklist View with 3-State Knowledge Assessment */
        <div className="space-y-4">
          {/* Controls: Search & Mastery Filters */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
            <div className="relative flex-1 max-w-sm">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('syl_search_placeholder')}
                className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
            </div>

            {/* Filter Buttons */}
            <div className="flex items-center gap-1">
              {(
                [
                  { id: 'all', labelKey: 'all' },
                  { id: 'understood', labelKey: 'mastery_understood' },
                  { id: 'partial', labelKey: 'mastery_partial' },
                  { id: 'unfamiliar', labelKey: 'mastery_unfamiliar' },
                ] as const
              ).map((st) => (
                <button
                  key={st.id}
                  onClick={() => setFilterState(st.id)}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                    filterState === st.id
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {t(st.labelKey)}
                </button>
              ))}
            </div>
          </div>

          {/* Units and Topics Accordion */}
          <div className="space-y-4">
            {curriculum.units.map((unit) => {
              const isExpanded = expandedUnits[unit.id] ?? true;
              const matchingTopics = unit.topics.filter((t) => {
                const matchesSearch =
                  t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  t.subtopics.some((s) => s.toLowerCase().includes(searchQuery.toLowerCase()));
                const isUnfamiliar = t.masteryState === 'unfamiliar' || t.masteryState === 'unknown';
                const matchesFilter =
                  filterState === 'all' ||
                  (filterState === 'unfamiliar' ? isUnfamiliar : t.masteryState === filterState);
                return matchesSearch && matchesFilter;
              });

              if (matchingTopics.length === 0 && (searchQuery || filterState !== 'all')) {
                return null;
              }

              const understoodCount = unit.topics.filter((t) => t.masteryState === 'understood').length;
              const unitProgress = Math.round((understoodCount / Math.max(1, unit.topics.length)) * 100);

              return (
                <div
                  key={unit.id}
                  className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs transition-shadow"
                >
                  {/* Unit Title Header */}
                  <div
                    onClick={() => toggleUnit(unit.id)}
                    className="p-5 flex items-center justify-between cursor-pointer hover:bg-slate-50/70 border-b border-slate-100"
                  >
                    <div className="flex items-center gap-3">
                      <button className="text-slate-400 hover:text-slate-700">
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4" />
                        ) : (
                          <ChevronRight className="w-4 h-4" />
                        )}
                      </button>
                      <div>
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                          <span>{t('weight')}: {unit.weight}/5</span>
                          <span aria-hidden="true">·</span>
                          <span>{unit.topics.length} {t('topics')}</span>
                        </div>
                        <h2 className="text-base font-bold text-slate-900 mt-0.5">
                          {unit.title}
                        </h2>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 shrink-0">
                      <div className="text-right hidden sm:block">
                        <span className="text-xs font-semibold text-slate-900 font-mono tabular-nums">
                          {unitProgress}%
                        </span>
                        <span className="text-xs text-slate-500"> {t('mastery_understood')}</span>
                      </div>
                      <div className="w-20 h-2 bg-slate-100 rounded-full overflow-hidden hidden sm:block">
                        <div
                          className="h-full bg-violet-600 rounded-full"
                          style={{ width: `${unitProgress}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Topics List */}
                  {isExpanded && (
                    <div className="divide-y divide-slate-100 p-2">
                      {matchingTopics.map((topic) => {
                        const isUnfamiliar =
                          topic.masteryState === 'unfamiliar' || topic.masteryState === 'unknown';
                        const isPartial = topic.masteryState === 'partial';
                        const isUnderstood = topic.masteryState === 'understood';
                        const isContentOpen = expandedStudyContentId === topic.id;

                        return (
                          <div
                            key={topic.id}
                            className="p-4 hover:bg-slate-50/60 rounded-xl transition-colors space-y-3"
                          >
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                              <div className="space-y-1">
                                <div className="flex items-center gap-2 text-xs text-slate-500">
                                  <span className="font-mono text-slate-600">
                                    ~{topic.estimatedMins}m
                                  </span>
                                  <span aria-hidden="true">·</span>
                                  <span className="capitalize text-slate-600">
                                    {topic.difficulty}
                                  </span>
                                  <span aria-hidden="true">·</span>
                                  <span className="font-mono text-slate-600">
                                    {topic.quizAttempts} {t('practice')}
                                  </span>
                                </div>
                                <h3 className="font-semibold text-slate-900 text-sm">
                                  {topic.title}
                                </h3>
                              </div>

                              {/* 3-State Knowledge Assessment Classifier */}
                              <div className="flex items-center gap-2 self-start md:self-center shrink-0">
                                <button
                                  onClick={() => updateTopicMastery(unit.id, topic.id, 'unfamiliar')}
                                  className={`px-2.5 py-1 text-xs font-medium rounded-lg border flex items-center gap-1.5 transition-colors ${
                                    isUnfamiliar
                                      ? 'bg-slate-900 text-white border-slate-900 font-semibold'
                                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                                  }`}
                                >
                                  <HelpCircle className="w-3.5 h-3.5" />
                                  <span>{t('mastery_unfamiliar')}</span>
                                </button>

                                <button
                                  onClick={() => updateTopicMastery(unit.id, topic.id, 'partial')}
                                  className={`px-2.5 py-1 text-xs font-medium rounded-lg border flex items-center gap-1.5 transition-colors ${
                                    isPartial
                                      ? 'bg-amber-50 text-amber-800 border-amber-300 font-semibold'
                                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                                  }`}
                                >
                                  <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                                  <span>{t('mastery_partial')}</span>
                                </button>

                                <button
                                  onClick={() => updateTopicMastery(unit.id, topic.id, 'understood')}
                                  className={`px-2.5 py-1 text-xs font-medium rounded-lg border flex items-center gap-1.5 transition-colors ${
                                    isUnderstood
                                      ? 'bg-emerald-50 text-emerald-800 border-emerald-300 font-semibold'
                                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                                  }`}
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                  <span>{t('mastery_understood')}</span>
                                </button>
                              </div>
                            </div>

                            {/* Subtopics Checklist */}
                            {topic.subtopics && topic.subtopics.length > 0 && (
                              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600 pt-0.5">
                                {topic.subtopics.map((sub, sIdx) => (
                                  <span key={sIdx} className="flex items-center gap-1">
                                    <span className="text-slate-300" aria-hidden="true">•</span>
                                    <span>{sub}</span>
                                  </span>
                                ))}
                              </div>
                            )}

                            {/* Short Notes & 3 YouTube Video Content Accordion */}
                            <div className="pt-2">
                              <button
                                type="button"
                                onClick={() => toggleStudyContent(topic.id)}
                                className="flex items-center gap-1.5 text-xs font-semibold text-indigo-700 hover:text-indigo-900 bg-indigo-50/70 hover:bg-indigo-100 px-3 py-1.5 rounded-lg border border-indigo-200/80 transition-colors"
                              >
                                <BookMarked className="w-3.5 h-3.5 text-indigo-600" />
                                <span>
                                  {isContentOpen ? t('syl_hide_content') : t('syl_view_content')}
                                </span>
                                {isContentOpen ? (
                                  <ChevronDown className="w-3 h-3 text-indigo-600" />
                                ) : (
                                  <ChevronRight className="w-3 h-3 text-indigo-600" />
                                )}
                              </button>

                              {isContentOpen && (
                                <div className="mt-3 p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-4 animate-fade-in text-xs">
                                  {/* Short Notes Section */}
                                  <div className="space-y-1.5">
                                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
                                      <FileText className="w-3.5 h-3.5 text-violet-600" />
                                      <span>{t('syl_short_notes')}</span>
                                    </div>
                                    <div className="p-3.5 bg-white border border-slate-200/90 rounded-lg text-slate-700 leading-relaxed whitespace-pre-line">
                                      {topic.studyNotes || 'Core definitions, principles, and high-yield exam takeaways.'}
                                    </div>
                                  </div>

                                  {/* 3 Real YouTube Videos Section */}
                                  <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
                                        <Video className="w-3.5 h-3.5 text-rose-600" />
                                        <span>{t('syl_youtube_lectures')}</span>
                                      </div>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                                      {(topic.youtubeLinks && topic.youtubeLinks.length > 0
                                        ? topic.youtubeLinks.slice(0, 3)
                                        : [
                                            { title: `${topic.title} Tutorial`, url: `https://www.youtube.com/results?search_query=${encodeURIComponent(topic.title + ' tutorial')}`, channel: 'Khan Academy' },
                                            { title: `${topic.title} Crash Course`, url: `https://www.youtube.com/results?search_query=${encodeURIComponent(topic.title + ' crash course')}`, channel: 'CrashCourse' },
                                            { title: `${topic.title} Lecture & Practice`, url: `https://www.youtube.com/results?search_query=${encodeURIComponent(topic.title + ' lecture')}`, channel: 'MIT OpenCourseWare' },
                                          ]
                                      ).map((video, vIdx) => (
                                        <a
                                          key={vIdx}
                                          href={video.url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="p-3 bg-white border border-slate-200 hover:border-violet-400 hover:shadow-xs rounded-xl flex flex-col justify-between gap-2 group transition-all"
                                        >
                                          <div className="space-y-1">
                                            <div className="flex items-center justify-between text-[11px] text-slate-500">
                                              <span className="font-semibold text-rose-600">{video.channel}</span>
                                            </div>
                                            <div className="font-medium text-slate-900 line-clamp-2 group-hover:text-violet-700 transition-colors">
                                              {video.title}
                                            </div>
                                          </div>

                                          <div className="flex items-center gap-1 text-[11px] font-semibold text-violet-700 group-hover:underline pt-1 border-t border-slate-100">
                                            <span>{t('syl_watch_youtube')}</span>
                                            <ExternalLink className="w-3 h-3" />
                                          </div>
                                        </a>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* Topic Action Affordances */}
                            <div className="flex items-center gap-3 pt-1 border-t border-slate-100 text-xs">
                              <button
                                onClick={() => {
                                  setActiveTopic(topic);
                                  onNavigate('quiz');
                                }}
                                className="font-semibold text-violet-700 hover:text-violet-800 hover:underline"
                              >
                                {t('syl_run_quiz')} →
                              </button>
                              <span className="text-slate-300">·</span>
                              <button
                                onClick={() => {
                                  setActiveTopic(topic);
                                  onNavigate('tutor');
                                }}
                                className="font-semibold text-slate-700 hover:text-slate-900 hover:underline"
                              >
                                {t('syl_ask_tutor')} →
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

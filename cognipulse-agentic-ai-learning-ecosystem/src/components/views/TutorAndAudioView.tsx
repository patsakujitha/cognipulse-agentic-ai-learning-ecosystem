import React, { useState, useEffect, useRef } from 'react';
import {
  Headphones,
  MessageSquare,
  Sparkles,
  Play,
  Pause,
  Square,
  Volume2,
  Send,
  Lightbulb,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { NavigationTab } from '../Sidebar';

interface TutorAndAudioViewProps {
  onNavigate: (tab: NavigationTab) => void;
}

export const TutorAndAudioView: React.FC<TutorAndAudioViewProps> = ({ onNavigate }) => {
  const { curriculum, activeTopic, setActiveTopic, profile } = useApp();
  const { t, language } = useLanguage();

  const [activeTab, setActiveTab] = useState<'tutor' | 'audio'>('tutor');

  // AI Tutor States
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([
    {
      role: 'assistant',
      content: `Hello ${profile.name}! I am your AI Socratic Tutor. We are currently anchored to "${
        activeTopic?.title || curriculum.subject
      }". What question, mechanism, or doubt would you like to explore together?`,
    },
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [tutorMode, setTutorMode] = useState<'socratic' | 'deep_dive' | 'exam_summary'>('socratic');
  const [isSending, setIsSending] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [lastFailedText, setLastFailedText] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Optimization & Concurrency Refs
  const isSendingRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const starterCacheRef = useRef<Map<string, string>>(new Map());
  const audioCacheRef = useRef<Map<string, any>>(new Map());

  // Audio Learning States
  const [audioMode, setAudioMode] = useState<'simplified' | 'exam_oriented'>('simplified');
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speechRate, setSpeechRate] = useState<number>(1.0);
  const [audioData, setAudioData] = useState<{
    title: string;
    durationSeconds: number;
    hook?: string;
    mechanism?: string;
    examGold?: string;
    fullScript: string;
    keyTakeaways?: string[];
  } | null>(null);

  // Re-anchor AI Tutor and Audio Blitz whenever curriculum or active topic changes to prevent stale data
  useEffect(() => {
    const topicName = activeTopic?.title || curriculum.units[0]?.topics[0]?.title || curriculum.subject;
    setMessages([
      {
        role: 'assistant',
        content: `Hello ${profile.name}! I am your AI Socratic Tutor for "${curriculum.subject}". We are currently anchored to "${topicName}". What question, mechanism, or doubt would you like to explore together?`,
      },
    ]);
    setAudioData(null);
    setIsPlaying(false);
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  }, [curriculum.id, activeTopic?.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Clean up speech synthesis when unmounting or switching
  useEffect(() => {
    return () => {
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const handleSendMessage = async (userText?: string) => {
    const textToSend = (userText || inputMessage).trim();
    // Guard against empty input, in-progress submission, or duplicate dispatch
    if (!textToSend || isSendingRef.current || isSending) return;

    setChatError(null);
    setLastFailedText(null);

    // Cache check for instant, zero-token retrieval of reusable discussion starter questions
    if (starterCacheRef.current.has(textToSend)) {
      const cachedReply = starterCacheRef.current.get(textToSend)!;
      setMessages((prev) => [
        ...prev,
        { role: 'user' as const, content: textToSend },
        { role: 'assistant' as const, content: cachedReply },
      ]);
      if (!userText) {
        setInputMessage('');
      }
      return;
    }

    // Set concurrency flags
    isSendingRef.current = true;
    setIsSending(true);

    const newMessages = [...messages, { role: 'user' as const, content: textToSend }];
    setMessages(newMessages);
    if (!userText) {
      setInputMessage('');
    }

    // Set 25-second AbortController timeout to guarantee no indefinite loading
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, 25000);

    // Filter to last 4 non-greeting messages to minimize payload tokens
    const recentHistory = newMessages
      .filter((m) => !m.content.startsWith('Hello ') && m.content.trim().length > 0)
      .slice(-4);

    // Add placeholder assistant message for streaming
    let assistantIndex = -1;
    let accumulatedText = '';

    try {
      setMessages((prev) => {
        assistantIndex = prev.length;
        return [...prev, { role: 'assistant' as const, content: '' }];
      });

      const res = await fetch('/api/tutor/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream, application/json',
        },
        signal: controller.signal,
        body: JSON.stringify({
          messages: recentHistory,
          activeTopic: activeTopic?.title || curriculum.subject,
          subject: curriculum.subject,
          mode: tutorMode,
          language,
          stream: true,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Server responded with ${res.status}`);
      }

      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('text/event-stream') && res.body) {
        const reader = res.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split('\n\n');
          buffer = parts.pop() || '';

          for (const part of parts) {
            const line = part.trim();
            if (!line.startsWith('data:')) continue;
            const dataStr = line.replace(/^data:\s*/, '');
            try {
              const data = JSON.parse(dataStr);
              if (data.error) {
                throw new Error(data.error);
              }
              if (data.text) {
                accumulatedText += data.text;
                const currentText = accumulatedText;
                setMessages((prev) => {
                  const copy = [...prev];
                  const targetIdx = assistantIndex >= 0 && assistantIndex < copy.length ? assistantIndex : copy.length - 1;
                  if (targetIdx >= 0 && copy[targetIdx]?.role === 'assistant') {
                    copy[targetIdx] = { ...copy[targetIdx], content: currentText };
                  }
                  return copy;
                });
              }
            } catch (pErr: any) {
              if (pErr.message && !pErr.message.includes('JSON')) {
                throw pErr;
              }
            }
          }
        }
      } else {
        // Non-streaming fallback
        const data = await res.json();
        accumulatedText = data.reply || 'Let us explore this concept step by step. What initial condition should we examine first?';
        setMessages((prev) => {
          const copy = [...prev];
          const targetIdx = assistantIndex >= 0 && assistantIndex < copy.length ? assistantIndex : copy.length - 1;
          if (targetIdx >= 0 && copy[targetIdx]?.role === 'assistant') {
            copy[targetIdx] = { ...copy[targetIdx], content: accumulatedText };
          }
          return copy;
        });
      }

      // Safe cache: only cache reusable discussion starters or canned prompts
      if (userText && accumulatedText.trim().length > 0) {
        starterCacheRef.current.set(userText, accumulatedText);
      }
    } catch (err: any) {
      console.error('Tutor chat failed:', err);
      const isTimeout = err.name === 'AbortError' || err.message?.includes('aborted');
      const errorMessage = isTimeout
        ? 'AI Tutor request timed out after 25 seconds. Please click Retry below to re-submit.'
        : (err.message || 'Unable to connect to AI Tutor. Please check your network and try again.');

      setChatError(errorMessage);
      setLastFailedText(textToSend);

      // Clean up empty or broken placeholder
      setMessages((prev) => {
        const copy = [...prev];
        const targetIdx = assistantIndex >= 0 && assistantIndex < copy.length ? assistantIndex : copy.length - 1;
        if (targetIdx >= 0 && copy[targetIdx]?.role === 'assistant' && !copy[targetIdx].content) {
          copy[targetIdx] = {
            role: 'assistant',
            content: isTimeout
              ? 'Request timed out waiting for the tutor response. Click Retry above to try again.'
              : 'I had trouble processing that request. Please try clicking Retry.',
          };
        }
        return copy;
      });
    } finally {
      clearTimeout(timeoutId);
      setIsSending(false);
      isSendingRef.current = false;
      abortControllerRef.current = null;
    }
  };

  const handleGenerateAudio = async () => {
    if (isGeneratingAudio) return;

    // Fast cache check for reusable audio script
    const cacheKey = `${activeTopic?.id || curriculum.subject}_${audioMode}_${language}`;
    if (audioCacheRef.current.has(cacheKey)) {
      setAudioData(audioCacheRef.current.get(cacheKey));
      return;
    }

    setIsGeneratingAudio(true);
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
      setIsPlaying(false);
    }

    try {
      const res = await fetch('/api/tutor/audio-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topicTitle: activeTopic?.title || curriculum.subject,
          subject: curriculum.subject,
          mode: audioMode,
          language,
        }),
      });

      const data = await res.json();
      if (data.audioScript) {
        setAudioData(data.audioScript);
        audioCacheRef.current.set(cacheKey, data.audioScript);
      }
    } catch (err) {
      console.error('Audio generation failed:', err);
    } finally {
      setIsGeneratingAudio(false);
    }
  };

  const handleTogglePlay = () => {
    if (!window.speechSynthesis) {
      return;
    }

    if (isPlaying) {
      window.speechSynthesis.pause();
      setIsPlaying(false);
    } else {
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
        setIsPlaying(true);
      } else {
        window.speechSynthesis.cancel();
        const textToSpeak = audioData?.fullScript || `Overview for ${activeTopic?.title || curriculum.subject}`;
        const utterance = new SpeechSynthesisUtterance(textToSpeak);
        utterance.rate = speechRate;
        const langCode =
          language === 'hi' ? 'hi-IN' :
          language === 'ta' ? 'ta-IN' :
          language === 'te' ? 'te-IN' :
          language === 'kn' ? 'kn-IN' :
          language === 'mr' ? 'mr-IN' : 'en-US';
        utterance.lang = langCode;
        utterance.onend = () => setIsPlaying(false);
        utterance.onerror = () => setIsPlaying(false);
        window.speechSynthesis.speak(utterance);
        setIsPlaying(true);
      }
    }
  };

  const handleStopAudio = () => {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setIsPlaying(false);
  };

  const allTopics = curriculum.units.flatMap((u) => u.topics);
  const currentTopicTitle = activeTopic?.title || curriculum.subject;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Top Header Card */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-violet-700 tracking-wide uppercase">
            <Headphones className="w-4 h-4 text-violet-600" />
            <span>{t('tutor_title')}</span>
          </div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight mt-1">
            {t('tutor_title')}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {t('tutor_subtitle')}
          </p>
        </div>

        {/* View Switcher Tabs */}
        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg shrink-0">
          <button
            onClick={() => setActiveTab('tutor')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 ${
              activeTab === 'tutor'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5 text-violet-600" />
            <span>{t('tutor_tab_chat')}</span>
          </button>
          <button
            onClick={() => setActiveTab('audio')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 ${
              activeTab === 'audio'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Volume2 className="w-3.5 h-3.5 text-indigo-600" />
            <span>{t('tutor_tab_audio')}</span>
          </button>
        </div>
      </div>

      {/* Context Anchoring Bar */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-700">{t('tutor_select_topic')}:</span>
          <select
            value={activeTopic?.id || ''}
            onChange={(e) => {
              const selected = allTopics.find((t) => t.id === e.target.value);
              if (selected) setActiveTopic(selected);
            }}
            className="bg-white border border-slate-200 text-slate-900 font-medium rounded-lg px-2.5 py-1 focus:outline-none focus:ring-1 focus:ring-violet-500"
          >
            {allTopics.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title} ({t.masteryState})
              </option>
            ))}
          </select>
        </div>

        <div className="text-slate-500 font-mono">
          Mastery: <span className="font-bold text-slate-800">{activeTopic?.masteryScore || 0}%</span>
        </div>
      </div>

      {activeTab === 'tutor' ? (
        /* AI Tutor Interface */
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Main Chat Stream */}
          <div className="lg:col-span-3 bg-white border border-slate-200 rounded-2xl flex flex-col shadow-xs h-[560px]">
            {/* Mode Controls Bar */}
            <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-slate-500">{t('tutor_mode')}:</span>
              <div className="flex items-center gap-1">
                {(
                  [
                    { id: 'socratic', labelKey: 'tutor_mode_socratic' },
                    { id: 'deep_dive', labelKey: 'tutor_mode_deepdive' },
                    { id: 'exam_summary', labelKey: 'tutor_mode_summary' },
                  ] as const
                ).map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setTutorMode(m.id)}
                    className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                      tutorMode === m.id
                        ? 'bg-violet-100 text-violet-800 font-semibold'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {t(m.labelKey)}
                  </button>
                ))}
              </div>
            </div>

            {chatError && (
              <div className="m-3 p-2.5 bg-rose-50 border border-rose-200 rounded-lg flex items-center justify-between gap-2 text-xs text-rose-700">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{chatError}</span>
                </div>
                {lastFailedText && (
                  <button
                    onClick={() => {
                      setChatError(null);
                      handleSendMessage(lastFailedText);
                    }}
                    disabled={isSending}
                    className="flex items-center gap-1 px-2.5 py-1 bg-rose-100 hover:bg-rose-200 text-rose-800 rounded font-medium transition-colors shrink-0 cursor-pointer disabled:opacity-50"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Retry</span>
                  </button>
                )}
              </div>
            )}

            {/* Messages Scroll Area */}
            <div className="flex-1 p-5 overflow-y-auto space-y-4">
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-3 text-xs sm:text-sm leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-violet-600 text-white rounded-br-xs'
                        : 'bg-slate-50 border border-slate-200/80 text-slate-800 rounded-bl-xs whitespace-pre-wrap'
                    }`}
                  >
                    {msg.content}
                  </div>
                </div>
              ))}

              {isSending && (
                <div className="flex justify-start">
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl rounded-bl-xs px-4 py-3 text-xs text-slate-500 flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-violet-500 animate-pulse" />
                    <span>CogniPulse Tutor is formulating response...</span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Chat Input */}
            <div className="p-3 border-t border-slate-100 bg-white rounded-b-2xl">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendMessage();
                }}
                className="flex items-center gap-2"
              >
                <input
                  type="text"
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  placeholder={`${t('tutor_placeholder')} (${currentTopicTitle})`}
                  className="flex-1 px-4 py-2.5 text-xs sm:text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
                <button
                  type="submit"
                  disabled={!inputMessage.trim() || isSending}
                  className="px-4 py-2.5 bg-violet-600 text-white rounded-xl hover:bg-violet-700 disabled:bg-violet-300 font-semibold text-xs flex items-center gap-1.5 transition-colors shrink-0"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{t('tutor_send')}</span>
                </button>
              </form>
            </div>
          </div>

          {/* Right Column: Discussion Starters */}
          <div className="space-y-4">
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-3">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
                <Lightbulb className="w-4 h-4 text-amber-500" />
                <span>Discussion Starters</span>
              </div>
              <p className="text-[11px] text-slate-500">
                Select a topic prompt to query your AI tutor:
              </p>

              <div className="space-y-2">
                {[
                  `Can you explain the most common exam traps for ${currentTopicTitle}?`,
                  `Give me a step-by-step intuitive breakdown of ${currentTopicTitle}.`,
                  `Ask me a Socratic question to test my understanding of this topic.`,
                  `What are the core formulas and boundary conditions I must remember?`,
                ].map((promptText, pIdx) => (
                  <button
                    key={pIdx}
                    onClick={() => handleSendMessage(promptText)}
                    disabled={isSending}
                    className="w-full text-left p-2.5 bg-slate-50 hover:bg-violet-50 border border-slate-200 hover:border-violet-200 rounded-xl text-xs text-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    "{promptText}"
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Audio Learning Interface */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Audio Player Stage */}
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-6">
              {/* Audio Track Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                <div>
                  <div className="text-[11px] font-semibold text-violet-700 uppercase tracking-wider">
                    {audioMode === 'simplified' ? '🎧 ' + t('tutor_audio_simplified') : '⚡ ' + t('tutor_audio_exam')}
                  </div>
                  <h2 className="text-lg font-bold text-slate-900 mt-0.5">
                    {audioData?.title || `${t('tutor_tab_audio')}: ${currentTopicTitle}`}
                  </h2>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setAudioMode('simplified')}
                    className={`px-2.5 py-1 text-xs font-medium rounded-lg border transition-colors ${
                      audioMode === 'simplified'
                        ? 'bg-violet-50 text-violet-800 border-violet-200 font-semibold'
                        : 'bg-white text-slate-600 border-slate-200'
                    }`}
                  >
                    {t('tutor_audio_simplified')}
                  </button>
                  <button
                    onClick={() => setAudioMode('exam_oriented')}
                    className={`px-2.5 py-1 text-xs font-medium rounded-lg border transition-colors ${
                      audioMode === 'exam_oriented'
                        ? 'bg-violet-50 text-violet-800 border-violet-200 font-semibold'
                        : 'bg-white text-slate-600 border-slate-200'
                    }`}
                  >
                    {t('tutor_audio_exam')}
                  </button>
                </div>
              </div>

              {/* Sound Wave Animation Visualizer */}
              <div className="h-24 bg-slate-900 rounded-xl p-4 flex items-center justify-center gap-1.5 overflow-hidden">
                {Array.from({ length: 32 }).map((_, idx) => (
                  <div
                    key={idx}
                    className={`w-1 rounded-full bg-violet-400 transition-all duration-300 ${
                      isPlaying
                        ? 'bg-gradient-to-t from-violet-400 to-indigo-300'
                        : 'bg-slate-700'
                    }`}
                    style={{
                      height: isPlaying ? `${Math.max(8, (Math.sin(idx * 0.4) + 1.2) * 22)}px` : '6px',
                    }}
                  />
                ))}
              </div>

              {/* Playback Controls */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleTogglePlay}
                    disabled={!audioData}
                    className="w-12 h-12 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:bg-slate-200 text-white flex items-center justify-center shadow-xs transition-colors"
                    aria-label={isPlaying ? 'Pause audio' : 'Play audio'}
                  >
                    {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
                  </button>

                  <button
                    onClick={handleStopAudio}
                    disabled={!isPlaying}
                    className="p-3 text-slate-500 hover:text-slate-800 disabled:text-slate-300 hover:bg-slate-100 rounded-lg transition-colors"
                    aria-label="Stop audio"
                  >
                    <Square className="w-4 h-4" />
                  </button>

                  <div className="text-xs text-slate-500 font-mono">
                    {isPlaying ? 'Playing' : 'Audio Ready'}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500">Speed:</span>
                  {[1.0, 1.25, 1.5].map((speed) => (
                    <button
                      key={speed}
                      onClick={() => setSpeechRate(speed)}
                      className={`px-2 py-1 text-xs font-mono rounded border transition-colors ${
                        speechRate === speed
                          ? 'bg-slate-900 text-white font-bold border-slate-900'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {speed}x
                    </button>
                  ))}
                </div>
              </div>

              {/* Spoken Script Beats */}
              {audioData && (
                <div className="space-y-4 pt-4 border-t border-slate-100 text-xs sm:text-sm text-slate-700 leading-relaxed">
                  {audioData.hook && (
                    <div className="p-3.5 bg-violet-50/50 border border-violet-100 rounded-xl space-y-1">
                      <div className="text-[11px] font-bold uppercase text-violet-800">
                        1. The Hook
                      </div>
                      <p>{audioData.hook}</p>
                    </div>
                  )}

                  {audioData.mechanism && (
                    <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                      <div className="text-[11px] font-bold uppercase text-slate-800">
                        2. The Mechanism
                      </div>
                      <p>{audioData.mechanism}</p>
                    </div>
                  )}

                  {audioData.examGold && (
                    <div className="p-3.5 bg-amber-50/60 border border-amber-200 rounded-xl space-y-1">
                      <div className="text-[11px] font-bold uppercase text-amber-800">
                        3. Exam High-Yield Tip
                      </div>
                      <p>{audioData.examGold}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Audio Actions & Key Takeaways */}
          <div className="space-y-4">
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
              <button
                onClick={handleGenerateAudio}
                disabled={isGeneratingAudio}
                className="w-full py-2.5 px-3 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 rounded-xl flex items-center justify-center gap-2 transition-colors shadow-xs"
              >
                {isGeneratingAudio ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>{t('generating')}</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Generate Audio Script</span>
                  </>
                )}
              </button>

              {audioData?.keyTakeaways && (
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <div className="text-xs font-bold text-slate-900">Key Takeaways:</div>
                  <ul className="space-y-1.5 text-xs text-slate-600">
                    {audioData.keyTakeaways.map((takeaway, tIdx) => (
                      <li key={tIdx} className="flex items-start gap-1.5">
                        <span className="text-violet-600 font-bold">•</span>
                        <span>{takeaway}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

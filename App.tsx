
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  PlusCircle, 
  Download, 
  RefreshCw, 
  BookOpen, 
  FileText,
  File,
  Loader2,
  Trash2,
  Sparkles,
  Zap,
  Undo2,
  Redo2,
  Target,
  Type,
  Key,
  Save,
  Clock,
  CheckCircle,
  Smartphone,
  ChevronUp,
  ChevronDown,
  MessageSquareQuote
} from 'lucide-react';
import { StoryGenre, StoryLength, ChangeLevel, RegenTarget } from './types';
import { generateBengaliStory, regenerateSection } from './services/geminiService';
import { exportToPdf, exportToWord, exportToTxt } from './utils/exportUtils';

const STORAGE_KEY = 'bangla_lekhak_draft';

const QUICK_FEEDBACKS = [
  { label: 'আরও বিস্তারিত', value: 'আরও বিস্তারিত এবং বর্ণনামূলক করো' },
  { label: 'অল্প কথায়', value: 'অল্প কথায় সারসংক্ষেপ করো' },
  { label: 'ভাষা সহজ', value: 'ভাষা আরও সহজ এবং সাবলীল করো' },
  { label: 'নাটকীয়', value: 'আরও নাটকীয়তা এবং উত্তেজনা বাড়াও' },
  { label: 'আবেগপ্রবণ', value: 'আবেগ এবং অনুভূতির ওপর জোর দাও' },
  { label: 'সংলাপ যোগ', value: 'সংলাপ বা কথোপকথন বাড়িয়ে দাও' }
];

const App: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [prompt, setPrompt] = useState('');
  const [genre, setGenre] = useState<StoryGenre>(StoryGenre.ROMANCE);
  const [length, setLength] = useState<StoryLength>(StoryLength.MEDIUM);
  const [tone, setTone] = useState('আবেগপ্রবণ (Emotional)');
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showControls, setShowControls] = useState(false);
  
  // Refinement states
  const [regenInstruction, setRegenInstruction] = useState('');
  const [keywords, setKeywords] = useState('');
  const [changeLevel, setChangeLevel] = useState<ChangeLevel>(ChangeLevel.SLIGHT);
  const [regenTarget, setRegenTarget] = useState<RegenTarget>(RegenTarget.SELECTION);
  const [lastActionWasRegen, setLastActionWasRegen] = useState(false);
  
  // History management
  const historyRef = useRef<string[]>(['']);
  const historyIndexRef = useRef(0);
  const [, forceUpdate] = useState({}); 
  
  const editorRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // PWA Install Prompt handling
  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };

  // Load draft on mount
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const { title: sTitle, content: sContent } = JSON.parse(saved);
        setTitle(sTitle || '');
        setContent(sContent || '');
        if (editorRef.current) editorRef.current.innerText = sContent || '';
        historyRef.current = [sContent || ''];
        historyIndexRef.current = 0;
      } catch (e) {
        console.error("Failed to load draft", e);
      }
    }
  }, []);

  // Auto-save
  useEffect(() => {
    const timer = setTimeout(() => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ title, content }));
    }, 1500);
    return () => clearTimeout(timer);
  }, [title, content]);

  const handleManualSave = useCallback(() => {
    setIsSaving(true);
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ title, content }));
    setTimeout(() => {
      setIsSaving(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    }, 500);
  }, [title, content]);

  const pushToHistory = useCallback((newContent: string) => {
    if (newContent === historyRef.current[historyIndexRef.current]) return;
    const newHistory = historyRef.current.slice(0, historyIndexRef.current + 1);
    newHistory.push(newContent);
    if (newHistory.length > 50) newHistory.shift();
    historyRef.current = newHistory;
    historyIndexRef.current = newHistory.length - 1;
    forceUpdate({});
  }, []);

  const undo = useCallback(() => {
    if (historyIndexRef.current > 0) {
      historyIndexRef.current -= 1;
      const prevContent = historyRef.current[historyIndexRef.current];
      setContent(prevContent);
      if (editorRef.current) editorRef.current.innerText = prevContent;
      forceUpdate({});
    }
  }, []);

  const redo = useCallback(() => {
    if (historyIndexRef.current < historyRef.current.length - 1) {
      historyIndexRef.current += 1;
      const nextContent = historyRef.current[historyIndexRef.current];
      setContent(nextContent);
      if (editorRef.current) editorRef.current.innerText = nextContent;
      forceUpdate({});
    }
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleManualSave();
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo, handleManualSave]);

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    setLastActionWasRegen(false);
    try {
      const result = await generateBengaliStory({ prompt, genre, length, tone });
      const lines = result.split('\n');
      let finalTitle = title;
      let finalContent = result;
      
      const titleMatch = result.match(/^(?:শিরোনাম|Title):\s*(.*)$/m);
      if (titleMatch) {
        finalTitle = titleMatch[1].trim();
        finalContent = result.replace(titleMatch[0], '').trim();
      } else if (lines[0].length < 100 && lines.length > 1) {
        finalTitle = lines[0].trim();
        finalContent = lines.slice(1).join('\n').trim();
      }

      setTitle(finalTitle);
      setContent(finalContent);
      if (editorRef.current) editorRef.current.innerText = finalContent;
      pushToHistory(finalContent);
    } catch (error) {
      alert("দুঃখিত, কোনো সমস্যা হয়েছে। আবার চেষ্টা করুন।");
    } finally {
      setLoading(false);
    }
  };

  const getParagraphAtCursor = () => {
    const selection = window.getSelection();
    if (!selection || !editorRef.current || selection.rangeCount === 0) return null;
    
    const range = selection.getRangeAt(0);
    const fullText = editorRef.current.innerText;
    
    let preSelectionRange = range.cloneRange();
    preSelectionRange.selectNodeContents(editorRef.current);
    preSelectionRange.setEnd(range.startContainer, range.startOffset);
    const startOffset = preSelectionRange.toString().length;

    const paragraphs = fullText.split(/\n\s*\n/);
    let currentLen = 0;
    for (let i = 0; i < paragraphs.length; i++) {
      const p = paragraphs[i];
      const pEnd = currentLen + p.length;
      if (startOffset >= currentLen && startOffset <= pEnd + 2) {
        return { text: p, index: i, fullParagraphs: paragraphs };
      }
      currentLen = pEnd + 2; 
    }
    return null;
  };

  const handleRegenerate = async (overrideInstruction?: string) => {
    const instructionToUse = overrideInstruction || regenInstruction;
    if (!instructionToUse.trim() || !content) return;
    
    setIsRegenerating(true);
    
    try {
      const selection = window.getSelection();
      let targetText = "";
      let mode: 'selection' | 'paragraph' | 'all' = 'selection';

      if (regenTarget === RegenTarget.ALL) {
        targetText = content;
        mode = 'all';
      } else if (regenTarget === RegenTarget.PARAGRAPH) {
        const pData = getParagraphAtCursor();
        if (!pData) {
          alert("প্যারাগ্রাফ নির্বাচন করতে ব্যর্থ।");
          setIsRegenerating(false);
          return;
        }
        targetText = pData.text;
        mode = 'paragraph';
      } else {
        targetText = selection?.toString() || "";
        if (!targetText) {
          alert("অনুগ্রহ করে কিছু টেক্সট সিলেক্ট করুন।");
          setIsRegenerating(false);
          return;
        }
        mode = 'selection';
      }
      
      const newText = await regenerateSection(targetText, instructionToUse, changeLevel, keywords, lastActionWasRegen);
      
      let updatedFullContent = "";
      if (mode === 'selection' && selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        range.deleteContents();
        const span = document.createElement('span');
        span.className = 'bg-indigo-100 transition-all duration-1000 p-0.5 rounded';
        span.textContent = newText;
        range.insertNode(span);
        if (editorRef.current) updatedFullContent = editorRef.current.innerText;
        setTimeout(() => { span.className = 'bg-transparent'; }, 3000);
      } else if (mode === 'paragraph') {
        const pData = getParagraphAtCursor();
        if (pData) {
          pData.fullParagraphs[pData.index] = newText;
          updatedFullContent = pData.fullParagraphs.join('\n\n');
          if (editorRef.current) {
            editorRef.current.innerText = updatedFullContent;
            editorRef.current.classList.add('bg-indigo-50/50');
            setTimeout(() => editorRef.current?.classList.remove('bg-indigo-50/50'), 1500);
          }
        }
      } else {
        updatedFullContent = newText;
        if (editorRef.current) {
          editorRef.current.innerText = newText;
          editorRef.current.classList.add('bg-indigo-50/50');
          setTimeout(() => editorRef.current?.classList.remove('bg-indigo-50/50'), 1500);
        }
      }

      setContent(updatedFullContent);
      pushToHistory(updatedFullContent);
      setRegenInstruction('');
      setLastActionWasRegen(true); // Enable "Refinement Mode" for next call
    } catch (error) {
      alert("পরিবর্তন করতে ব্যর্থ হয়েছে।");
    } finally {
      setIsRegenerating(false);
    }
  };

  const clearEditor = () => {
    if (confirm("আপনি কি লেখাগুলো মুছে ফেলতে চান? এটি পুনরায় ফিরে পাওয়া সম্ভব নয়।")) {
      setTitle('');
      setContent('');
      if (editorRef.current) editorRef.current.innerText = '';
      setPrompt('');
      setLastActionWasRegen(false);
      pushToHistory('');
      localStorage.removeItem(STORAGE_KEY);
    }
  };

  const handleContentChange = (e: React.FormEvent<HTMLDivElement>) => {
    setContent(e.currentTarget.innerText);
    setLastActionWasRegen(false);
  };

  // Focus tracking to show/hide sticky controls
  const handleEditorFocus = () => setShowControls(true);
  const handleEditorBlur = (e: React.FocusEvent) => {
    if (panelRef.current && panelRef.current.contains(e.relatedTarget as Node)) {
      return;
    }
    setShowControls(false);
  };

  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;
  const readingTime = Math.ceil(wordCount / 180);

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-[#fdfbf7] text-gray-800 antialiased mobile-safe-area">
      {/* Sidebar */}
      <aside className="w-full md:w-80 bg-white border-r border-gray-200 p-6 flex-shrink-0 shadow-sm overflow-y-auto h-auto md:h-screen md:sticky md:top-0 z-20">
        <div className="flex items-center justify-between mb-8 select-none">
          <div className="flex items-center gap-2">
            <BookOpen className="text-indigo-600 w-8 h-8" />
            <h1 className="text-2xl font-bold text-gray-900 bn-font tracking-tight">বাংলা লেখক AI</h1>
          </div>
          {deferredPrompt && (
            <button 
              onClick={handleInstallClick}
              className="md:hidden p-2 bg-indigo-600 text-white rounded-full animate-bounce shadow-lg"
              title="Install App"
            >
              <Smartphone className="w-5 h-5" />
            </button>
          )}
        </div>

        <div className="space-y-6">
          {deferredPrompt && (
            <button 
              onClick={handleInstallClick}
              className="hidden md:flex w-full items-center justify-center gap-2 py-3 px-4 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-xl font-bold hover:bg-indigo-100 transition-all mb-4"
            >
              <Smartphone className="w-5 h-5" />
              অ্যাপ ইনস্টল করুন
            </button>
          )}

          <section>
            <label className="block text-xs font-bold mb-2 text-gray-400 uppercase tracking-widest bn-font">গল্পের ধরণ (Genre)</label>
            <select 
              value={genre}
              onChange={(e) => setGenre(e.target.value as StoryGenre)}
              className={`w-full p-3 border rounded-xl focus:ring-2 focus:ring-indigo-500 transition-all outline-none text-sm font-medium ${genre === StoryGenre.ADULT ? 'bg-red-50 border-red-200 text-red-700' : 'bg-gray-50 border-gray-200 text-gray-800'}`}
            >
              {Object.values(StoryGenre).map(g => (
                <option key={g} value={g} className={g === StoryGenre.ADULT ? 'text-red-600 font-bold' : ''}>
                  {g} {g === StoryGenre.ADULT ? '🔥' : ''}
                </option>
              ))}
            </select>
            {genre === StoryGenre.ADULT && (
              <p className="mt-2 text-[10px] text-red-500 bn-font font-bold flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> এটি প্রাপ্তবয়স্কদের জন্য হাই-কোয়ালিটি কনটেন্ট তৈরি করবে।
              </p>
            )}
          </section>

          <section>
            <label className="block text-xs font-bold mb-2 text-gray-400 uppercase tracking-widest bn-font">দৈর্ঘ্য (Length)</label>
            <select 
              value={length}
              onChange={(e) => setLength(e.target.value as StoryLength)}
              className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 transition-all outline-none text-sm font-medium"
            >
              {Object.values(StoryLength).map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          </section>

          <section>
            <label className="block text-xs font-bold mb-2 text-gray-400 uppercase tracking-widest bn-font">মেজাজ ও টোন (Tone)</label>
            <input 
              type="text"
              value={tone}
              onChange={(e) => setTone(e.target.value)}
              className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 transition-all outline-none text-sm bn-font"
            />
          </section>

          <section className="pt-4 border-t border-gray-100">
            <label className="block text-xs font-bold mb-2 text-gray-400 uppercase tracking-widest bn-font">গল্পের কাহিনী (Plot/Prompt)</label>
            <textarea 
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="আপনার গল্পের মূল ভাবনা এখানে লিখুন..."
              rows={5}
              className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 transition-all outline-none resize-none text-sm bn-font"
            />
            <button 
              onClick={handleGenerate}
              disabled={loading || !prompt.trim()}
              className="w-full mt-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 px-4 rounded-2xl flex items-center justify-center gap-3 transition-all disabled:opacity-50 shadow-xl shadow-indigo-100 active:scale-95 border-b-4 border-indigo-800"
            >
              {loading ? <Loader2 className="animate-spin w-5 h-5" /> : <PlusCircle className="w-5 h-5" />}
              <span className="bn-font text-lg">গল্প তৈরি করুন</span>
            </button>
          </section>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col p-2 md:p-8 overflow-x-hidden">
        <div className="max-w-4xl mx-auto w-full flex flex-col flex-1 bg-white md:rounded-3xl shadow-2xl border border-gray-100 overflow-hidden relative">
          
          {/* Header Bar */}
          <header className="px-4 md:px-6 py-4 border-b border-gray-100 flex flex-wrap items-center justify-between gap-4 bg-white/80 backdrop-blur-md sticky top-0 z-20">
            <input 
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="গল্পের নাম..."
              className="flex-1 text-xl md:text-2xl font-black bg-transparent outline-none bn-font text-gray-800 placeholder-gray-200"
            />
            <div className="flex items-center gap-1.5 overflow-x-auto">
              <button 
                onClick={handleManualSave}
                disabled={isSaving}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl border transition-all ${
                  saveSuccess 
                    ? 'bg-green-50 text-green-600 border-green-200' 
                    : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                }`}
                title="Save Draft (Ctrl+S)"
              >
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : saveSuccess ? <CheckCircle className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                <span className="text-xs font-bold hidden sm:block">{saveSuccess ? 'সংরক্ষিত' : 'সেভ'}</span>
              </button>

              <div className="flex bg-gray-50 p-1 rounded-xl">
                <button onClick={undo} disabled={historyIndexRef.current === 0} className="p-2 hover:bg-white hover:shadow-sm rounded-lg text-gray-500 disabled:opacity-20 transition-all" title="Undo"><Undo2 className="w-4 h-4" /></button>
                <button onClick={redo} disabled={historyIndexRef.current >= historyRef.current.length - 1} className="p-2 hover:bg-white hover:shadow-sm rounded-lg text-gray-500 disabled:opacity-20 transition-all" title="Redo"><Redo2 className="w-4 h-4" /></button>
              </div>
              
              <div className="flex items-center gap-1.5">
                <button onClick={() => exportToPdf(title, content)} className="p-2.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-xl transition-all border border-indigo-100" title="PDF Export">
                  <Download className="w-4 h-4" />
                </button>
                <button onClick={() => exportToWord(title, content)} className="p-2.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-xl transition-all border border-blue-100" title="Word Export">
                  <FileText className="w-4 h-4" />
                </button>
                <button onClick={() => exportToTxt(title, content)} className="p-2.5 bg-gray-50 text-gray-700 hover:bg-gray-100 rounded-xl transition-all border border-gray-200" title="TXT Export">
                  <File className="w-4 h-4" />
                </button>
                <button onClick={clearEditor} className="p-2.5 bg-red-50 text-red-500 hover:bg-red-100 rounded-xl transition-all border border-red-100" title="Clear Canvas">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </header>

          {/* Editor Body Wrapper */}
          <div className="flex-1 flex flex-col relative overflow-hidden bg-white">
            <div 
              className="flex-1 p-4 md:p-12 overflow-y-auto scroll-smooth"
              style={{ paddingBottom: showControls ? '380px' : '80px' }}
            >
              <div 
                ref={editorRef}
                contentEditable
                onInput={handleContentChange}
                onFocus={handleEditorFocus}
                onBlur={handleEditorBlur}
                spellCheck={false}
                suppressContentEditableWarning={true}
                className="w-full text-lg md:text-xl leading-[2] outline-none bn-font whitespace-pre-wrap min-h-full text-gray-700 selection:bg-indigo-100"
              >
                {content}
              </div>

              {/* Stats Footer - only shown if no controls */}
              {!showControls && (
                <div className="mt-8 pt-6 border-t border-gray-50 flex flex-wrap items-center gap-4 md:gap-6 text-[10px] text-gray-400 font-bold uppercase tracking-widest select-none">
                  <span className="flex items-center gap-1.5"><Clock className="w-3 h-3" /> {readingTime} মিনিট পড়া</span>
                  <span>{wordCount} শব্দ</span>
                  <span className="flex items-center gap-1.5 ml-auto opacity-60"><Save className="w-3 h-3" /> স্বয়ংক্রিয় সেভ হচ্ছে</span>
                </div>
              )}
            </div>

            {/* AI Refinement Panel - STICKY / FIXED */}
            {content && (
              <div 
                ref={panelRef}
                className={`absolute bottom-0 left-0 right-0 z-30 transition-all duration-500 ease-in-out transform ${
                  showControls ? 'translate-y-0 opacity-100 pointer-events-auto' : 'translate-y-full opacity-0 pointer-events-none'
                }`}
              >
                <div className="m-4 md:m-6 p-4 md:p-6 bg-white/95 backdrop-blur-xl border border-indigo-100 rounded-3xl shadow-[0_-20px_50px_-20px_rgba(79,70,229,0.3)]">
                  <div className="flex flex-col gap-4">
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                         <div className={`w-2 h-2 rounded-full ${lastActionWasRegen ? 'bg-orange-500' : 'bg-indigo-500'} animate-pulse`}></div>
                         <span className="text-[11px] font-black text-indigo-600 uppercase tracking-tighter bn-font">
                            {lastActionWasRegen ? 'পুনরায় পরিমার্জন (Iterative Refinement)' : 'এআই পরিমার্জন প্যানেল'}
                         </span>
                      </div>
                      <button onClick={() => setShowControls(false)} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 transition-colors">
                        <ChevronDown className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Quick Feedbacks */}
                    <div className="flex flex-col gap-2">
                       <span className="text-[9px] text-gray-400 font-bold uppercase bn-font flex items-center gap-1">
                         <MessageSquareQuote className="w-3 h-3" /> দ্রুত ফিডব্যাক
                       </span>
                       <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                         {QUICK_FEEDBACKS.map(fb => (
                           <button 
                             key={fb.label}
                             onClick={() => {
                               setRegenInstruction(fb.value);
                               handleRegenerate(fb.value);
                             }}
                             className="whitespace-nowrap px-3 py-1.5 bg-indigo-50/50 hover:bg-indigo-100 text-indigo-600 text-[10px] font-bold rounded-lg border border-indigo-100 transition-all active:scale-95"
                           >
                             {fb.label}
                           </button>
                         ))}
                       </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div className="flex flex-col gap-1.5">
                         <span className="text-[9px] text-gray-400 font-bold uppercase bn-font">টার্গেট এলাকা</span>
                         <div className="flex bg-gray-100/50 p-1 rounded-xl">
                           <button onClick={() => setRegenTarget(RegenTarget.SELECTION)} className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all flex items-center gap-2 ${regenTarget === RegenTarget.SELECTION ? 'bg-white text-indigo-600 shadow-sm border border-indigo-50' : 'text-gray-500 hover:text-gray-700'}`}>সিলেকশন</button>
                           <button onClick={() => setRegenTarget(RegenTarget.PARAGRAPH)} className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all flex items-center gap-2 ${regenTarget === RegenTarget.PARAGRAPH ? 'bg-white text-indigo-600 shadow-sm border border-indigo-50' : 'text-gray-500 hover:text-gray-700'}`}>প্যারাগ্রাফ</button>
                           <button onClick={() => setRegenTarget(RegenTarget.ALL)} className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all flex items-center gap-2 ${regenTarget === RegenTarget.ALL ? 'bg-white text-indigo-600 shadow-sm border border-indigo-50' : 'text-gray-500 hover:text-gray-700'}`}>সম্পূর্ণ</button>
                         </div>
                      </div>

                      <div className="flex flex-col gap-1.5">
                         <span className="text-[9px] text-gray-400 font-bold uppercase bn-font">পরিবর্তনের তীব্রতা</span>
                         <div className="flex bg-gray-100/50 p-1 rounded-xl">
                           <button onClick={() => setChangeLevel(ChangeLevel.SLIGHT)} className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all flex items-center gap-2 ${changeLevel === ChangeLevel.SLIGHT ? 'bg-white text-indigo-600 shadow-sm border border-indigo-50' : 'text-gray-500 hover:text-gray-700'}`}>সামান্য</button>
                           <button onClick={() => setChangeLevel(ChangeLevel.MAJOR)} className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all flex items-center gap-2 ${changeLevel === ChangeLevel.MAJOR ? 'bg-white text-indigo-600 shadow-sm border border-indigo-50' : 'text-gray-500 hover:text-gray-700'}`}>আমূল</button>
                         </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="md:col-span-2">
                        <input 
                          type="text"
                          value={regenInstruction}
                          onChange={(e) => setRegenInstruction(e.target.value)}
                          placeholder={lastActionWasRegen ? "এই রেজাল্ট সম্পর্কে আপনার ফিডব্যাক লিখুন..." : "নির্দেশনা লিখুন... (উদা: আরও আবেগপ্রবণ করো)"}
                          className="w-full px-4 py-3 bg-gray-50/50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-indigo-500 transition-all outline-none text-xs bn-font placeholder:text-gray-300"
                          onKeyDown={(e) => e.key === 'Enter' && handleRegenerate()}
                        />
                      </div>
                      <div>
                        <input 
                          type="text"
                          value={keywords}
                          onChange={(e) => setKeywords(e.target.value)}
                          placeholder="কীওয়ার্ড (অপশনাল)"
                          className="w-full px-4 py-3 bg-gray-50/50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-indigo-500 transition-all outline-none text-xs bn-font placeholder:text-gray-300"
                        />
                      </div>
                    </div>

                    <button 
                      onClick={() => handleRegenerate()}
                      disabled={isRegenerating || !regenInstruction.trim()}
                      className={`w-full ${lastActionWasRegen ? 'bg-orange-600 hover:bg-orange-700' : 'bg-indigo-600 hover:bg-indigo-700'} text-white font-black py-4 rounded-2xl transition-all disabled:opacity-50 flex items-center justify-center gap-3 shadow-lg active:scale-[0.98]`}
                    >
                      {isRegenerating ? <Loader2 className="w-5 h-5 animate-spin" /> : <RefreshCw className="w-5 h-5" />}
                      <span className="bn-font text-base">
                        {lastActionWasRegen ? 'ফিডব্যাক অনুযায়ী ঠিক করুন' : 'তৈরি করুন'}
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Hint to focus editor if controls hidden but editor has content */}
            {content && !showControls && (
              <button 
                onClick={() => editorRef.current?.focus()}
                className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-white/80 backdrop-blur-md px-4 py-2 rounded-full border border-indigo-100 shadow-lg text-[10px] font-bold text-indigo-600 flex items-center gap-2 hover:bg-white transition-all z-20"
              >
                <Sparkles className="w-3 h-3" /> পরিমার্জন টুলস খুলুন <ChevronUp className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* Global Footer */}
        <footer className="mt-8 text-center text-[10px] text-gray-400 bn-font select-none mb-8">
          বাংলা লেখক AI v3.2 • স্মার্ট ফিডব্যাক ও রিফাইনমেন্ট • {new Date().getFullYear()}
        </footer>
      </main>
      
      <style>{`
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
};

export default App;

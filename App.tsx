
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  PlusCircle, 
  Download, 
  RefreshCw, 
  BookOpen, 
  FileText,
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
  CheckCircle
} from 'lucide-react';
import { StoryGenre, StoryLength, ChangeLevel, RegenTarget } from './types';
import { generateBengaliStory, regenerateSection } from './services/geminiService';
import { exportToPdf, exportToWord } from './utils/exportUtils';

const STORAGE_KEY = 'bangla_lekhak_draft';

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
  
  // Refinement states
  const [regenInstruction, setRegenInstruction] = useState('');
  const [keywords, setKeywords] = useState('');
  const [changeLevel, setChangeLevel] = useState<ChangeLevel>(ChangeLevel.SLIGHT);
  const [regenTarget, setRegenTarget] = useState<RegenTarget>(RegenTarget.SELECTION);
  
  // History management
  const historyRef = useRef<string[]>(['']);
  const historyIndexRef = useRef(0);
  const [, forceUpdate] = useState({}); // To trigger re-render for undo/redo state
  
  const editorRef = useRef<HTMLDivElement>(null);

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
      alert("দুঃখিত, কোনো সমস্যা হয়েছে। আবার চেষ্টা করুন। (Error generating content)");
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

  const handleRegenerate = async () => {
    if (!regenInstruction.trim() || !content) return;
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
          alert("প্যারাগ্রাফ নির্বাচন করতে ব্যর্থ। (Failed to detect paragraph)");
          setIsRegenerating(false);
          return;
        }
        targetText = pData.text;
        mode = 'paragraph';
      } else {
        targetText = selection?.toString() || "";
        if (!targetText) {
          alert("অনুগ্রহ করে কিছু টেক্সট সিলেক্ট করুন। (Please select some text)");
          setIsRegenerating(false);
          return;
        }
        mode = 'selection';
      }
      
      const newText = await regenerateSection(targetText, regenInstruction, changeLevel, keywords);
      
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
    } catch (error) {
      alert("পরিবর্তন করতে ব্যর্থ হয়েছে। (Regeneration failed)");
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
      pushToHistory('');
      localStorage.removeItem(STORAGE_KEY);
    }
  };

  const handleContentChange = (e: React.FormEvent<HTMLDivElement>) => {
    setContent(e.currentTarget.innerText);
  };

  const handleBlur = (e: React.FocusEvent<HTMLDivElement>) => {
    pushToHistory(e.currentTarget.innerText);
  };

  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;
  const readingTime = Math.ceil(wordCount / 180);

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-[#fdfbf7] text-gray-800 antialiased">
      {/* Sidebar */}
      <aside className="w-full md:w-80 bg-white border-r border-gray-200 p-6 flex-shrink-0 shadow-sm overflow-y-auto h-auto md:h-screen md:sticky md:top-0 z-20">
        <div className="flex items-center gap-2 mb-8 select-none">
          <BookOpen className="text-indigo-600 w-8 h-8" />
          <h1 className="text-2xl font-bold text-gray-900 bn-font tracking-tight">বাংলা লেখক AI</h1>
        </div>

        <div className="space-y-6">
          <section>
            <label className="block text-xs font-bold mb-2 text-gray-400 uppercase tracking-widest bn-font">গল্পের ধরণ (Genre)</label>
            <select 
              value={genre}
              onChange={(e) => setGenre(e.target.value as StoryGenre)}
              className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 transition-all outline-none text-sm font-medium"
            >
              {Object.values(StoryGenre).map(g => <option key={g} value={g}>{g}</option>)}
            </select>
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
      <main className="flex-1 flex flex-col p-4 md:p-8 overflow-x-hidden">
        <div className="max-w-4xl mx-auto w-full flex flex-col flex-1 bg-white rounded-3xl shadow-2xl border border-gray-100 overflow-hidden">
          
          {/* Header Bar */}
          <header className="px-6 py-4 border-b border-gray-100 flex flex-wrap items-center justify-between gap-4 bg-white/80 backdrop-blur-md sticky top-0 z-10">
            <input 
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="গল্পের নাম দিন..."
              className="flex-1 text-2xl font-black bg-transparent outline-none bn-font text-gray-800 placeholder-gray-200"
            />
            <div className="flex items-center gap-1.5">
              {/* Manual Save Button */}
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
                <span className="text-xs font-bold hidden sm:block">{saveSuccess ? 'সংরক্ষিত' : 'সেভ করুন'}</span>
              </button>

              <div className="w-px h-6 bg-gray-100 mx-1"></div>

              <div className="flex bg-gray-50 p-1 rounded-xl mr-2">
                <button onClick={undo} disabled={historyIndexRef.current === 0} className="p-2 hover:bg-white hover:shadow-sm rounded-lg text-gray-500 disabled:opacity-20 transition-all" title="Undo"><Undo2 className="w-5 h-5" /></button>
                <button onClick={redo} disabled={historyIndexRef.current >= historyRef.current.length - 1} className="p-2 hover:bg-white hover:shadow-sm rounded-lg text-gray-500 disabled:opacity-20 transition-all" title="Redo"><Redo2 className="w-5 h-5" /></button>
              </div>
              
              <div className="flex items-center gap-2">
                <button onClick={() => exportToPdf(title, content)} className="flex items-center gap-2 px-3 py-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-xl transition-all border border-indigo-100" title="PDF Export">
                  <Download className="w-4 h-4" />
                  <span className="text-xs font-bold hidden sm:block">PDF</span>
                </button>
                <button onClick={() => exportToWord(title, content)} className="flex items-center gap-2 px-3 py-2 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-xl transition-all border border-blue-100" title="Word Export">
                  <FileText className="w-4 h-4" />
                  <span className="text-xs font-bold hidden sm:block">DOC</span>
                </button>
                <button onClick={clearEditor} className="p-2.5 bg-red-50 text-red-500 hover:bg-red-100 rounded-xl transition-all border border-red-100 ml-1" title="Clear Canvas">
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </div>
          </header>

          {/* Editor Body */}
          <div className="flex-1 p-8 md:p-12 flex flex-col relative bg-[#ffffff] overflow-y-auto">
            <div 
              ref={editorRef}
              contentEditable
              onInput={handleContentChange}
              onBlur={handleBlur}
              spellCheck={false}
              suppressContentEditableWarning={true}
              className="flex-1 w-full text-xl leading-[2] outline-none bn-font whitespace-pre-wrap min-h-[500px] text-gray-700 selection:bg-indigo-100"
              style={{ minHeight: 'calc(100vh - 400px)' }}
            >
              {content}
            </div>

            {/* Stats Footer inside Editor */}
            <div className="mt-8 pt-6 border-t border-gray-50 flex items-center gap-6 text-[10px] text-gray-400 font-bold uppercase tracking-widest select-none">
              <span className="flex items-center gap-1.5"><Clock className="w-3 h-3" /> {readingTime} মিনিট পড়া</span>
              <span>{wordCount} শব্দ</span>
              <span className="flex items-center gap-1.5 ml-auto opacity-60"><Save className="w-3 h-3" /> স্বয়ংক্রিয় সংরক্ষিত হচ্ছে</span>
            </div>

            {/* AI Refinement Panel */}
            {content && (
              <div className="mt-8 p-6 bg-white border-2 border-indigo-50 rounded-3xl shadow-2xl">
                <div className="flex flex-col gap-6">
                  
                  <div className="flex flex-wrap items-center justify-between gap-6">
                    <div className="flex flex-col gap-2">
                       <span className="text-[10px] text-indigo-400 font-black uppercase bn-font flex items-center gap-1.5">
                         <Target className="w-3 h-3" /> পরিমার্জনের ক্ষেত্র (Refine Target)
                       </span>
                       <div className="flex bg-gray-100 p-1 rounded-xl">
                         <button onClick={() => setRegenTarget(RegenTarget.SELECTION)} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${regenTarget === RegenTarget.SELECTION ? 'bg-white text-indigo-600 shadow-md' : 'text-gray-500 hover:text-gray-700'}`}><Type className="w-3 h-3" />সিলেকশন</button>
                         <button onClick={() => setRegenTarget(RegenTarget.PARAGRAPH)} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${regenTarget === RegenTarget.PARAGRAPH ? 'bg-white text-indigo-600 shadow-md' : 'text-gray-500 hover:text-gray-700'}`}><Target className="w-3 h-3" />প্যারাগ্রাফ</button>
                         <button onClick={() => setRegenTarget(RegenTarget.ALL)} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${regenTarget === RegenTarget.ALL ? 'bg-white text-indigo-600 shadow-md' : 'text-gray-500 hover:text-gray-700'}`}><Sparkles className="w-3 h-3" />সম্পূর্ণ</button>
                       </div>
                    </div>

                    <div className="flex flex-col gap-2">
                       <span className="text-[10px] text-indigo-400 font-black uppercase bn-font flex items-center gap-1.5">
                         <Zap className="w-3 h-3" /> পরিবর্তনের মাত্রা (Change Level)
                       </span>
                       <div className="flex bg-gray-100 p-1 rounded-xl">
                         <button onClick={() => setChangeLevel(ChangeLevel.SLIGHT)} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${changeLevel === ChangeLevel.SLIGHT ? 'bg-white text-indigo-600 shadow-md' : 'text-gray-500 hover:text-gray-700'}`}><Zap className="w-3 h-3" />সামান্য</button>
                         <button onClick={() => setChangeLevel(ChangeLevel.MAJOR)} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${changeLevel === ChangeLevel.MAJOR ? 'bg-white text-indigo-600 shadow-md' : 'text-gray-500 hover:text-gray-700'}`}><Sparkles className="w-3 h-3" />আমূল</button>
                       </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="md:col-span-2 space-y-2">
                      <label className="text-[10px] text-gray-400 font-bold uppercase bn-font">সংশোধন নির্দেশনা (AI Instruction)</label>
                      <input 
                        type="text"
                        value={regenInstruction}
                        onChange={(e) => setRegenInstruction(e.target.value)}
                        placeholder="কি ধরণের পরিবর্তন চান? যেমন: 'সংলাপগুলো আরও স্মার্ট করো'"
                        className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-indigo-500 transition-all outline-none text-sm bn-font placeholder:text-gray-300"
                        onKeyDown={(e) => e.key === 'Enter' && handleRegenerate()}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] text-gray-400 font-bold uppercase bn-font flex items-center gap-1.5"><Key className="w-3 h-3" /> কীওয়ার্ড (Optional Keywords)</label>
                      <input 
                        type="text"
                        value={keywords}
                        onChange={(e) => setKeywords(e.target.value)}
                        placeholder="উদাহরণ: রোমাঞ্চ, মেঘ"
                        className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-indigo-500 transition-all outline-none text-sm bn-font placeholder:text-gray-300"
                      />
                    </div>
                  </div>

                  <button 
                    onClick={handleRegenerate}
                    disabled={isRegenerating || !regenInstruction.trim()}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black py-5 rounded-2xl transition-all disabled:opacity-50 flex items-center justify-center gap-3 shadow-2xl shadow-indigo-200 border-b-4 border-indigo-900 active:scale-[0.98]"
                  >
                    {isRegenerating ? <Loader2 className="w-6 h-6 animate-spin" /> : <RefreshCw className="w-6 h-6" />}
                    <span className="bn-font text-xl">পরিবর্তন কার্যকর করুন</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Global Footer */}
        <footer className="mt-8 text-center text-[10px] text-gray-400 bn-font select-none">
          বাংলা লেখক AI v2.5 • সব ডিভাইসের জন্য অপ্টিমাইজড • {new Date().getFullYear()}
        </footer>
      </main>
    </div>
  );
};

export default App;

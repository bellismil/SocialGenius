
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Tone, Platform, PostResult, ImageSize, AspectRatio, Language, ScheduledPost, Feedback, ImageData, OnboardingData } from './types';
import { generateSocialText, generateSocialImage } from './services/geminiService';

const PLATFORM_CONFIG: Record<Platform, { ratio: AspectRatio, numericRatio: number }> = {
  LinkedIn: { ratio: '16:9', numericRatio: 16 / 9 },
  Twitter: { ratio: '16:9', numericRatio: 16 / 9 },
  Instagram: { ratio: '1:1', numericRatio: 1 },
  Facebook: { ratio: '16:9', numericRatio: 16 / 9 },
  Email: { ratio: '16:9', numericRatio: 16 / 9 }
};

const FONTS = [
  { name: 'Sans', family: "'Inter', sans-serif" },
  { name: 'Serif', family: "'Playfair Display', serif" },
  { name: 'Mono', family: "'Inter Tight', monospace" },
  { name: 'Display', family: "'Inter', sans-serif", weight: '900' }
];

const COLORS = ['#FFFFFF', '#000000', '#4F46E5', '#EF4444', '#10B981', '#F59E0B'];

const App: React.FC = () => {
  const [view, setView] = useState<'onboarding' | 'generator' | 'calendar'>('onboarding');
  const [onboardingData, setOnboardingData] = useState<OnboardingData | null>(null);
  const [idea, setIdea] = useState('');
  const [visualPrompt, setVisualPrompt] = useState('');
  const [tone, setTone] = useState<Tone>(Tone.PROFESSIONAL);
  const [language, setLanguage] = useState<Language>(Language.ENGLISH);
  const [imageSize, setImageSize] = useState<ImageSize>('1K');
  const [syncImages, setSyncImages] = useState(false);
  const [uploadedImage, setUploadedImage] = useState<ImageData | null>(null);
  const [results, setResults] = useState<Record<string, PostResult | null>>({});
  const [scheduledPosts, setScheduledPosts] = useState<ScheduledPost[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  
  const sidebarFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem('socialgenius_profile');
    if (saved) {
      const parsed = JSON.parse(saved);
      setOnboardingData(parsed);
      setView('generator');
    }
  }, []);

  const handleOnboardingSubmit = (data: OnboardingData) => {
    setOnboardingData(data);
    localStorage.setItem('socialgenius_profile', JSON.stringify(data));
    setView('generator');
  };

  const handleGlobalImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = (reader.result as string).split(',')[1];
        setUploadedImage({
          data: base64String,
          mimeType: file.type
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const activePlatforms = useMemo(() => {
    if (!onboardingData) return [];
    return onboardingData.selectedPlatforms;
  }, [onboardingData]);

  const generateContent = async () => {
    if (!idea.trim() || !onboardingData) return;

    setIsGenerating(true);
    const initialResults: Record<string, PostResult | null> = {};
    activePlatforms.forEach(p => {
      initialResults[p] = {
        id: Math.random().toString(36).substr(2, 9),
        platform: p,
        content: '',
        aspectRatio: PLATFORM_CONFIG[p].ratio,
        loading: true
      };
    });
    setResults(initialResults);

    try {
      const effectiveImagePrompt = visualPrompt.trim() || idea;
      let sharedImagePromise: Promise<string> | null = null;

      if (syncImages) {
        sharedImagePromise = generateSocialImage(effectiveImagePrompt, 'LinkedIn', '16:9', imageSize, language, onboardingData, uploadedImage || undefined);
      }

      await Promise.all(activePlatforms.map(async (p) => {
        try {
          const textPromise = generateSocialText(idea, tone, p, language, onboardingData, uploadedImage || undefined);
          const imagePromise = sharedImagePromise || generateSocialImage(effectiveImagePrompt, p, PLATFORM_CONFIG[p].ratio, imageSize, language, onboardingData, uploadedImage || undefined);

          const [textResult, image] = await Promise.all([textPromise, imagePromise]);

          setResults(prev => ({
            ...prev,
            [p]: {
              ...prev[p]!,
              content: textResult.text,
              suggestedTime: textResult.suggestedTime,
              imageUrl: image,
              loading: false
            }
          }));
        } catch (err: any) {
          console.error(`Error for ${p}:`, err);
          setResults(prev => ({
            ...prev,
            [p]: { ...prev[p]!, loading: false, error: err.message }
          }));
        }
      }));
    } finally {
      setIsGenerating(false);
    }
  };

  const handleFeedback = (platform: Platform, feedback: Feedback) => {
    setResults(prev => ({
      ...prev,
      [platform]: { ...prev[platform]!, feedback }
    }));
  };

  const handleSchedule = (post: PostResult, date: string) => {
    const newScheduled: ScheduledPost = {
      id: Math.random().toString(36).substr(2, 9),
      postId: post.id,
      platform: post.platform,
      content: post.content,
      imageUrl: post.imageUrl,
      scheduledAt: date
    };
    setScheduledPosts(prev => [...prev, newScheduled]);
  };

  const handleSyncThisImage = (imageUrl: string) => {
    setResults(prev => {
      const updated = { ...prev };
      activePlatforms.forEach(p => {
        if (updated[p]) updated[p] = { ...updated[p]!, imageUrl };
      });
      return updated;
    });
  };

  if (view === 'onboarding') {
    return <OnboardingView onSubmit={handleOnboardingSubmit} existingData={onboardingData} onCancel={onboardingData ? () => setView('generator') : undefined} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-20">
      <header className="sticky top-0 z-40 glass-effect border-b border-slate-200 px-6 py-4">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-indigo-200">S</div>
            <h1 className="text-xl font-bold tracking-tight text-slate-800">SocialGenius</h1>
          </div>
          <div className="flex items-center gap-4">
            <nav className="flex bg-slate-100 p-1 rounded-xl">
              <button onClick={() => setView('generator')} className={`px-4 py-2 text-sm font-bold rounded-lg transition-all ${view === 'generator' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}>Generator</button>
              <button onClick={() => setView('calendar')} className={`px-4 py-2 text-sm font-bold rounded-lg transition-all ${view === 'calendar' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}>Calendar ({scheduledPosts.length})</button>
            </nav>
            <button onClick={() => setView('onboarding')} className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-400 hover:text-slate-600"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg></button>
          </div>
        </div>
      </header>

      {view === 'generator' ? (
        <main className="max-w-6xl mx-auto px-6 mt-12 grid grid-cols-1 lg:grid-cols-12 gap-12">
          <aside className="lg:col-span-4 space-y-8">
            <div className="bg-white p-6 rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100">
              <h2 className="text-lg font-bold mb-6 flex items-center gap-2"><span className="w-2 h-6 bg-indigo-500 rounded-full"></span>Campaign Studio</h2>
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-semibold text-slate-600 mb-1">Core Idea</label>
                  <textarea value={idea} onChange={e => setIdea(e.target.value)} placeholder="Describe your message..." className="w-full h-24 p-4 rounded-2xl border border-slate-200 bg-slate-50 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none text-sm text-slate-700 font-medium resize-none" />
                </div>
                
                <div className="bg-slate-50/50 p-4 rounded-2xl border border-slate-100 space-y-4">
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-sm font-semibold text-slate-600">Visual Context</label>
                    <button onClick={() => setSyncImages(!syncImages)} className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase transition-all ${syncImages ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-500'}`}>{syncImages ? 'Auto-Sync ON' : 'Auto-Sync OFF'}</button>
                  </div>
                  <textarea value={visualPrompt} onChange={e => setVisualPrompt(e.target.value)} placeholder="Visual prompt override (optional)..." className="w-full h-16 p-4 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 font-medium" />
                  
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-slate-400">Reference Image (Optional)</label>
                    <div className="flex items-center gap-3">
                      <button onClick={() => sidebarFileInputRef.current?.click()} className="flex-grow py-2 px-4 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors flex items-center gap-2 justify-center">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-5-8l-3-3m0 0l-3 3m3-3v12" /></svg>
                        {uploadedImage ? 'Change Image' : 'Upload Ref'}
                      </button>
                      {uploadedImage && (
                        <button onClick={() => setUploadedImage(null)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg">
                           <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      )}
                      <input ref={sidebarFileInputRef} type="file" accept="image/*" onChange={handleGlobalImageUpload} className="hidden" />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <select value={tone} onChange={e => setTone(e.target.value as Tone)} className="p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-700 font-medium">{Object.values(Tone).map(t => <option key={t} value={t}>{t}</option>)}</select>
                  <select value={language} onChange={e => setLanguage(e.target.value as Language)} className="p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-700 font-medium">{Object.values(Language).map(l => <option key={l} value={l}>{l}</option>)}</select>
                </div>
                
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-sm font-semibold text-slate-600">Generation Quality</label>
                    {(imageSize === '2K' || imageSize === '4K') && (
                      <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noreferrer" className="text-[9px] font-bold text-indigo-500 underline uppercase">Billing Info</a>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {['1K', '2K', '4K'].map((size) => (
                      <button
                        key={size}
                        onClick={() => setImageSize(size as ImageSize)}
                        className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all border ${
                          imageSize === size 
                            ? 'bg-slate-800 text-white border-slate-800' 
                            : 'bg-white text-slate-500 border-slate-200'
                        }`}
                      >
                        {size}
                      </button>
                    ))}
                  </div>
                </div>
                <button disabled={isGenerating || !idea.trim()} onClick={generateContent} className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white rounded-2xl font-bold shadow-xl transition-all flex items-center justify-center gap-2 active:scale-[0.98]">{isGenerating ? 'Synthesizing Assets...' : 'Generate Campaign'}</button>
              </div>
            </div>
          </aside>
          
          <section className="lg:col-span-8 space-y-12">
            {activePlatforms.map(p => (
              <PlatformCard 
                key={p} 
                platform={p} 
                result={results[p] || null} 
                onFeedback={f => handleFeedback(p, f)} 
                onSchedule={d => results[p] && handleSchedule(results[p]!, d)}
                onSyncImage={handleSyncThisImage}
                onContentChange={c => setResults(prev => ({ ...prev, [p]: { ...prev[p]!, content: c } }))}
                onImageUpdated={newUrl => setResults(prev => ({ ...prev, [p]: { ...prev[p]!, imageUrl: newUrl } }))}
              />
            ))}
            {activePlatforms.length === 0 && (
              <div className="text-center p-20 bg-white rounded-3xl border border-dashed border-slate-300">
                <p className="text-slate-400 font-bold">No platforms selected. Head back to your Profile to choose.</p>
              </div>
            )}
          </section>
        </main>
      ) : (
        <CalendarView scheduledPosts={scheduledPosts} onDelete={id => setScheduledPosts(prev => prev.filter(p => p.id !== id))} />
      )}
    </div>
  );
};

const OnboardingView: React.FC<{ onSubmit: (data: OnboardingData) => void, existingData: OnboardingData | null, onCancel?: () => void }> = ({ onSubmit, existingData, onCancel }) => {
  const [form, setForm] = useState<OnboardingData>(existingData || {
    businessName: '',
    natureOfBusiness: '',
    targetDemographic: '',
    keyLocation: '',
    brandValues: '',
    selectedPlatforms: ['LinkedIn', 'Twitter', 'Instagram']
  });

  const togglePlatform = (p: Platform) => {
    setForm(prev => {
      const platforms = prev.selectedPlatforms.includes(p) 
        ? prev.selectedPlatforms.filter(x => x !== p)
        : [...prev.selectedPlatforms, p];
      return { ...prev, selectedPlatforms: platforms };
    });
  };

  return (
    <div className="min-h-screen bg-indigo-600 flex items-center justify-center p-6 sm:p-12">
      <div className="w-full max-w-2xl bg-white rounded-[48px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-500">
        <div className="p-8 sm:p-16">
          <h2 className="text-3xl font-black text-slate-800 mb-2">Brand Profile</h2>
          <p className="text-slate-500 mb-8">Personalize your content ecosystem.</p>
          <form onSubmit={e => { e.preventDefault(); onSubmit(form); }} className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <input required value={form.businessName} onChange={e => setForm({...form, businessName: e.target.value})} className="p-4 bg-slate-50 border border-slate-100 rounded-2xl focus:border-indigo-400 outline-none text-sm text-slate-700 font-medium" placeholder="Business Name" />
              <input required value={form.keyLocation} onChange={e => setForm({...form, keyLocation: e.target.value})} className="p-4 bg-slate-50 border border-slate-100 rounded-2xl focus:border-indigo-400 outline-none text-sm text-slate-700 font-medium" placeholder="Primary Region" />
            </div>
            <textarea required value={form.natureOfBusiness} onChange={e => setForm({...form, natureOfBusiness: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl focus:border-indigo-400 outline-none text-sm text-slate-700 font-medium h-24" placeholder="Nature of business..." />
            <input required value={form.targetDemographic} onChange={e => setForm({...form, targetDemographic: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl focus:border-indigo-400 outline-none text-sm text-slate-700 font-medium" placeholder="Target demographic (e.g. Gen Z Creatives)" />
            <input required value={form.brandValues} onChange={e => setForm({...form, brandValues: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl focus:border-indigo-400 outline-none text-sm text-slate-700 font-medium" placeholder="Brand values (e.g. Bold, minimal, premium)" />
            
            <div className="space-y-3">
              <label className="text-xs font-black uppercase tracking-widest text-slate-400">Target Platforms</label>
              <div className="flex flex-wrap gap-2">
                {(['LinkedIn', 'Twitter', 'Instagram', 'Facebook', 'Email'] as Platform[]).map(p => (
                  <button key={p} type="button" onClick={() => togglePlatform(p)} className={`px-4 py-2 rounded-xl text-xs font-black transition-all border ${form.selectedPlatforms.includes(p) ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-slate-50 text-slate-400 border-slate-100'}`}>{p}</button>
                ))}
              </div>
            </div>

            <div className="flex gap-4 pt-6">
              {onCancel && <button type="button" onClick={onCancel} className="flex-1 py-4 bg-slate-50 text-slate-500 rounded-2xl font-black uppercase text-xs">Cancel</button>}
              <button type="submit" disabled={form.selectedPlatforms.length === 0} className="flex-[2] py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase text-xs shadow-xl disabled:bg-indigo-200">Sync & Initialize</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

interface ImageCropperProps {
  imageUrl: string;
  targetRatio: number;
  onConfirm: (croppedUrl: string) => void;
  onCancel: () => void;
}

const ImageCropper: React.FC<ImageCropperProps> = ({ imageUrl, targetRatio, onConfirm, onCancel }) => {
  const [crop, setCrop] = useState({ x: 10, y: 10, width: 80 }); // in percentages
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  const height = crop.width / targetRatio;
  const clampedHeight = Math.min(height, 100 - crop.y);
  const clampedWidth = clampedHeight * targetRatio;

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    
    setCrop(prev => ({
      ...prev,
      x: Math.max(0, Math.min(x - prev.width / 2, 100 - prev.width)),
      y: Math.max(0, Math.min(y - clampedHeight / 2, 100 - clampedHeight))
    }));
  };

  const applyCrop = () => {
    const img = imageRef.current;
    if (!img) return;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const sourceX = (crop.x / 100) * img.naturalWidth;
    const sourceY = (crop.y / 100) * img.naturalHeight;
    const sourceWidth = (clampedWidth / 100) * img.naturalWidth;
    const sourceHeight = (clampedHeight / 100) * img.naturalHeight;

    canvas.width = sourceWidth;
    canvas.height = sourceHeight;
    ctx.drawImage(img, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, sourceWidth, sourceHeight);
    onConfirm(canvas.toDataURL());
  };

  return (
    <div className="fixed inset-0 z-[120] bg-slate-900/95 backdrop-blur-md flex flex-col items-center justify-center p-6 sm:p-12">
      <div className="w-full max-w-4xl flex flex-col h-full">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-black text-white">Crop for Social</h3>
          <p className="text-xs font-bold text-slate-400">Lock: {targetRatio.toFixed(2)} Ratio</p>
        </div>
        
        <div 
          ref={containerRef}
          className="relative flex-grow bg-black rounded-3xl overflow-hidden cursor-move select-none"
          onMouseDown={() => setIsDragging(true)}
          onMouseUp={() => setIsDragging(false)}
          onMouseLeave={() => setIsDragging(false)}
          onMouseMove={handleMouseMove}
        >
          <img ref={imageRef} src={imageUrl} className="w-full h-full object-contain pointer-events-none" alt="To crop" />
          <div 
            className="absolute border-2 border-indigo-400 shadow-[0_0_0_9999px_rgba(0,0,0,0.6)]"
            style={{
              left: `${crop.x}%`,
              top: `${crop.y}%`,
              width: `${clampedWidth}%`,
              height: `${clampedHeight}%`
            }}
          >
            <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 opacity-30 pointer-events-none">
              <div className="border border-white/20"></div><div className="border border-white/20"></div><div className="border border-white/20"></div>
              <div className="border border-white/20"></div><div className="border border-white/20"></div><div className="border border-white/20"></div>
              <div className="border border-white/20"></div><div className="border border-white/20"></div><div className="border border-white/20"></div>
            </div>
          </div>
        </div>

        <div className="mt-8 flex justify-center gap-4">
          <button onClick={onCancel} className="px-8 py-3 bg-white/10 text-white rounded-xl font-bold hover:bg-white/20 transition-colors">Cancel</button>
          <button onClick={applyCrop} className="px-12 py-3 bg-indigo-600 text-white rounded-xl font-bold shadow-xl hover:bg-indigo-700 transition-colors">Apply Crop</button>
        </div>
      </div>
    </div>
  );
};

interface ImageEditorProps {
  imageUrl: string;
  onSave: (newUrl: string) => void;
  onCancel: () => void;
}

const ImageEditor: React.FC<ImageEditorProps> = ({ imageUrl, onSave, onCancel }) => {
  const [text, setText] = useState('');
  const [font, setFont] = useState(FONTS[0]);
  const [color, setColor] = useState('#FFFFFF');
  const [fontSize, setFontSize] = useState(32);
  const [positionY, setPositionY] = useState(50);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = imageUrl;
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);

      if (text) {
        ctx.fillStyle = color;
        ctx.font = `${font.weight || '700'} ${fontSize * (img.width / 500)}px ${font.family}`;
        ctx.textAlign = 'center';
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.shadowBlur = 10;
        ctx.fillText(text, canvas.width / 2, (canvas.height * positionY) / 100);
      }
    };
  }, [imageUrl, text, font, color, fontSize, positionY]);

  const handleSave = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      onSave(canvas.toDataURL('image/png'));
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/90 backdrop-blur-md flex flex-col md:flex-row p-6 md:p-12 gap-12">
      <div className="flex-grow flex items-center justify-center min-h-0">
        <canvas ref={canvasRef} className="max-w-full max-h-full rounded-2xl shadow-2xl border-4 border-slate-700" />
      </div>
      <div className="w-full md:w-80 bg-white rounded-[32px] p-8 flex flex-col gap-6 shadow-2xl animate-in slide-in-from-right-8 duration-300 overflow-y-auto">
        <h3 className="text-xl font-black text-slate-800">Add Text</h3>
        
        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase text-slate-400">Overlay Text</label>
          <input value={text} onChange={e => setText(e.target.value)} placeholder="Type here..." className="w-full p-4 bg-slate-50 border rounded-xl outline-none focus:border-indigo-500 text-sm text-slate-700 font-medium" />
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase text-slate-400">Typography</label>
          <div className="grid grid-cols-2 gap-2">
            {FONTS.map(f => (
              <button key={f.name} onClick={() => setFont(f)} className={`p-3 rounded-xl border text-xs font-bold transition-all ${font.name === f.name ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg' : 'bg-slate-50 text-slate-500'}`}>{f.name}</button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase text-slate-400">Color Palette</label>
          <div className="flex gap-2">
            {COLORS.map(c => (
              <button key={c} onClick={() => setColor(c)} className={`w-8 h-8 rounded-full border-2 transition-all ${color === c ? 'scale-110 border-indigo-500' : 'border-transparent'}`} style={{ backgroundColor: c }} />
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <label className="text-[10px] font-black uppercase text-slate-400">Scale</label>
            <span className="text-xs font-bold text-slate-700">{fontSize}px</span>
          </div>
          <input type="range" min="10" max="100" value={fontSize} onChange={e => setFontSize(parseInt(e.target.value))} className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-600" />
        </div>

        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <label className="text-[10px] font-black uppercase text-slate-400">Vertical Position</label>
            <span className="text-xs font-bold text-slate-700">{positionY}%</span>
          </div>
          <input type="range" min="0" max="100" value={positionY} onChange={e => setPositionY(parseInt(e.target.value))} className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-600" />
        </div>

        <div className="flex gap-2 mt-auto">
          <button onClick={onCancel} className="flex-1 py-4 bg-slate-50 text-slate-400 rounded-2xl font-black uppercase text-[10px]">Discard</button>
          <button onClick={handleSave} className="flex-[2] py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase text-[10px] shadow-xl">Apply Overlay</button>
        </div>
      </div>
    </div>
  );
};

const PlatformCard: React.FC<{ 
  platform: Platform, 
  result: PostResult | null, 
  onFeedback: (f: Feedback) => void, 
  onSchedule: (d: string) => void, 
  onSyncImage: (url: string) => void, 
  onContentChange: (c: string) => void, 
  onImageUpdated: (url: string) => void 
}> = ({ platform, result, onFeedback, onSchedule, onSyncImage, onContentChange, onImageUpdated }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [isDesigning, setIsDesigning] = useState(false);
  const [isCropping, setIsCropping] = useState(false);
  const [isZoomed, setIsZoomed] = useState(false);
  const [editedContent, setEditedContent] = useState(result?.content || '');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (result) setEditedContent(result.content); }, [result?.content]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        onImageUpdated(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  if (!result) return null;

  return (
    <div className={`bg-white rounded-[40px] overflow-hidden shadow-xl border border-slate-100 ${result.loading ? 'opacity-70 grayscale-[0.3]' : ''}`}>
      <div className="flex items-center justify-between px-8 py-5 border-b border-slate-50 bg-slate-50/20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 flex items-center justify-center bg-white shadow-sm border border-slate-100 rounded-xl font-black text-indigo-600">{platform[0]}</div>
          <div>
            <span className="font-black text-slate-800 tracking-tight">{platform}</span>
            {result.suggestedTime && <div className="text-[10px] font-bold text-indigo-500 uppercase tracking-tighter">Suggests: {result.suggestedTime}</div>}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2">
        <div className="p-8 flex flex-col relative border-r border-slate-50">
          <button onClick={() => { if(isEditing) onContentChange(editedContent); setIsEditing(!isEditing); }} className="absolute top-4 right-4 text-[9px] font-black uppercase tracking-widest text-indigo-600 bg-white border px-3 py-1 rounded-lg shadow-sm hover:bg-slate-50">{isEditing ? 'Save' : 'Edit Text'}</button>
          <div className="flex-grow pt-4">
            {result.error ? <div className="p-4 bg-red-50 text-red-600 rounded-xl text-sm leading-relaxed">{result.error}</div> :
             result.loading ? <div className="space-y-4"><div className="h-4 bg-slate-100 rounded animate-pulse w-3/4"></div><div className="h-4 bg-slate-100 rounded animate-pulse w-full"></div></div> :
             isEditing ? <textarea value={editedContent} onChange={e => setEditedContent(e.target.value)} className="w-full h-48 bg-slate-50 p-4 rounded-xl text-sm text-slate-700 font-medium focus:ring-2 focus:ring-indigo-100 outline-none" /> :
             <div className="text-sm text-slate-600 whitespace-pre-wrap leading-relaxed font-medium">{result.content}</div>
            }
          </div>
          <div className="mt-8 flex gap-2">
            <button onClick={() => { navigator.clipboard.writeText(result.content); alert('Copied!'); }} className="flex-1 py-3 bg-slate-50 rounded-xl text-[10px] font-black uppercase border border-slate-200">Copy</button>
            <button onClick={() => setShowDatePicker(true)} className="flex-1 py-3 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase shadow-lg">Schedule</button>
          </div>
        </div>

        <div className="p-8 bg-slate-50/50 flex flex-col items-center justify-center relative min-h-[400px]">
          <div className="flex justify-between items-center w-full mb-4 absolute top-4 px-8 z-10">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Asset ({result.aspectRatio})</span>
            {result.imageUrl && !result.loading && (
              <div className="flex gap-2">
                <button onClick={() => setIsCropping(true)} className="p-2 bg-white rounded-lg shadow-sm border border-slate-100 text-slate-400 hover:text-indigo-600 transition-colors" title="Crop">
                   <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2zM7 9h10v6H7V9z" /></svg>
                </button>
                <button onClick={() => onSyncImage(result.imageUrl!)} className="text-[9px] font-black uppercase text-indigo-600 bg-white px-2 py-1 rounded shadow-sm border border-indigo-50">Sync All</button>
              </div>
            )}
          </div>
          {result.loading ? <div className="w-full aspect-video bg-white rounded-2xl flex items-center justify-center animate-pulse"><div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div></div> :
           result.imageUrl ? (
             <div className="group relative w-full flex items-center justify-center cursor-default">
               <img src={result.imageUrl} className="w-full max-w-sm rounded-2xl shadow-2xl border-4 border-white transition-all group-hover:brightness-90" alt="Creative" />
               
               {/* New Interactive Hover Overlay */}
               <div className="absolute inset-0 flex items-center justify-center gap-4 opacity-0 group-hover:opacity-100 transition-all pointer-events-none group-hover:pointer-events-auto bg-slate-900/20 rounded-2xl">
                  {/* Zoom Icon Tooltip Group */}
                  <div className="relative group/icon flex flex-col items-center">
                    <button onClick={() => setIsZoomed(true)} className="p-3 bg-white text-indigo-600 rounded-full shadow-xl hover:scale-110 transition-transform active:scale-95">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" /></svg>
                    </button>
                    <span className="absolute -top-10 px-2 py-1 bg-slate-800 text-white text-[9px] font-black uppercase rounded opacity-0 group-hover/icon:opacity-100 transition-opacity whitespace-nowrap shadow-lg">Zoom</span>
                  </div>
                  
                  {/* Add Text Icon Tooltip Group */}
                  <div className="relative group/icon flex flex-col items-center">
                    <button onClick={() => setIsDesigning(true)} className="p-3 bg-white text-indigo-600 rounded-full shadow-xl hover:scale-110 transition-transform active:scale-95">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                    </button>
                    <span className="absolute -top-10 px-2 py-1 bg-slate-800 text-white text-[9px] font-black uppercase rounded opacity-0 group-hover/icon:opacity-100 transition-opacity whitespace-nowrap shadow-lg">Add Text</span>
                  </div>

                  {/* Upload Image Icon Tooltip Group */}
                  <div className="relative group/icon flex flex-col items-center">
                    <button onClick={() => fileInputRef.current?.click()} className="p-3 bg-white text-indigo-600 rounded-full shadow-xl hover:scale-110 transition-transform active:scale-95">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-5-8l-3-3m0 0l-3 3m3-3v12" /></svg>
                    </button>
                    <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
                    <span className="absolute -top-10 px-2 py-1 bg-slate-800 text-white text-[9px] font-black uppercase rounded opacity-0 group-hover/icon:opacity-100 transition-opacity whitespace-nowrap shadow-lg">Upload Image</span>
                  </div>
               </div>
             </div>
           ) :
           <div className="w-full aspect-video bg-slate-200 rounded-2xl flex items-center justify-center text-slate-400 cursor-pointer hover:bg-slate-300 transition-colors" onClick={() => fileInputRef.current?.click()}>
              <div className="text-center">
                <svg className="w-8 h-8 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
                <p className="text-[10px] font-black uppercase">Upload your own</p>
              </div>
           </div>
          }
        </div>
      </div>
      
      {isZoomed && result.imageUrl && (
        <div className="fixed inset-0 z-[100] bg-slate-900/95 backdrop-blur-xl flex items-center justify-center p-4 md:p-12 animate-in fade-in duration-300" onClick={() => setIsZoomed(false)}>
           <div className="relative max-w-full max-h-full">
             <button onClick={() => setIsZoomed(false)} className="absolute -top-12 right-0 text-white hover:text-indigo-400 transition-colors">
               <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
             </button>
             <img src={result.imageUrl} className="max-w-full max-h-[85vh] rounded-3xl shadow-2xl border-8 border-white/10" alt="Zoomed view" onClick={e => e.stopPropagation()} />
             <div className="mt-4 flex justify-center gap-4">
                <button onClick={(e) => { e.stopPropagation(); setIsDesigning(true); setIsZoomed(false); }} className="px-6 py-2 bg-indigo-600 text-white rounded-xl font-bold text-sm shadow-xl">Edit text overlay</button>
                <button onClick={(e) => { e.stopPropagation(); setIsCropping(true); setIsZoomed(false); }} className="px-6 py-2 bg-indigo-600 text-white rounded-xl font-bold text-sm shadow-xl">Crop Image</button>
                <button onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }} className="px-6 py-2 bg-white text-slate-800 rounded-xl font-bold text-sm shadow-xl">Replace image</button>
             </div>
           </div>
        </div>
      )}

      {isCropping && result.imageUrl && (
        <ImageCropper 
          imageUrl={result.imageUrl}
          targetRatio={PLATFORM_CONFIG[platform].numericRatio}
          onConfirm={(croppedUrl) => { onImageUpdated(croppedUrl); setIsCropping(false); }}
          onCancel={() => setIsCropping(false)}
        />
      )}

      {isDesigning && result.imageUrl && (
        <ImageEditor 
          imageUrl={result.imageUrl} 
          onSave={(url) => { onImageUpdated(url); setIsDesigning(false); }}
          onCancel={() => setIsDesigning(false)}
        />
      )}

      {showDatePicker && <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-3xl max-w-xs w-full shadow-2xl animate-in zoom-in-95 duration-200">
          <h3 className="font-black text-slate-800 mb-4">Set Schedule</h3>
          <input type="datetime-local" className="w-full p-4 bg-slate-50 rounded-xl mb-6 outline-none" id={`dt-${result.id}`} />
          <div className="flex gap-2">
            <button onClick={() => setShowDatePicker(false)} className="flex-1 py-3 bg-slate-50 text-slate-400 rounded-xl text-xs font-bold">Cancel</button>
            <button onClick={() => { const val = (document.getElementById(`dt-${result.id}`) as HTMLInputElement).value; if(val) onSchedule(val); setShowDatePicker(false); }} className="flex-1 py-3 bg-indigo-600 text-white rounded-xl text-xs font-bold">Confirm</button>
          </div>
        </div>
      </div>}
    </div>
  );
};

const CalendarView: React.FC<{ scheduledPosts: ScheduledPost[], onDelete: (id: string) => void }> = ({ scheduledPosts, onDelete }) => (
  <main className="max-w-6xl mx-auto px-6 mt-12">
    <h2 className="text-3xl font-black text-slate-800 mb-8">Campaign Master Schedule</h2>
    <div className="grid gap-6">
      {scheduledPosts.length === 0 ? <p className="text-slate-400 font-bold p-12 bg-white rounded-3xl border border-dashed text-center">No posts scheduled yet.</p> :
       scheduledPosts.map(p => (
         <div key={p.id} className="bg-white p-6 rounded-3xl shadow-lg border border-slate-100 flex gap-6 items-center">
           {p.imageUrl && <img src={p.imageUrl} className="w-24 h-24 rounded-2xl object-cover flex-shrink-0" alt="" />}
           <div className="flex-grow">
             <div className="flex justify-between mb-1">
               <span className="text-[10px] font-black uppercase text-indigo-600 tracking-widest">{p.platform}</span>
               <span className="text-xs font-bold text-slate-400">{new Date(p.scheduledAt).toLocaleString()}</span>
             </div>
             <p className="text-sm text-slate-600 line-clamp-2 font-medium">{p.content}</p>
           </div>
           <button onClick={() => onDelete(p.id)} className="p-3 text-red-400 hover:bg-red-50 rounded-2xl transition-colors"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
         </div>
       ))
      }
    </div>
  </main>
);

export default App;

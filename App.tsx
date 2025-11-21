import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Camera, RefreshCw, Share2, Image as ImageIcon, ArrowLeft, RefreshCcw, Check, Tag, Zap, ZapOff, Maximize2, Download } from 'lucide-react';
import { generateCaption, getCaptionForCategory } from './services/geminiService';
import { createPolaroidImage } from './utils/imageUtils';
import { FilterConfig, AppState, CaptionCategory } from './types';

// --- Configuration ---
const FILTERS: FilterConfig[] = [
  { 
    id: 'kodak', 
    name: 'Kodak Gold', 
    cssFilter: 'sepia(0.2) contrast(1.1) saturate(1.2) brightness(1.05)', 
    canvasFilter: 'sepia(20%) contrast(110%) saturate(120%) brightness(105%)',
    vignette: false
  },
  { 
    id: 'fuji', 
    name: 'Fuji Blue', 
    cssFilter: 'contrast(1.05) brightness(1.1) saturate(0.9) hue-rotate(-10deg)', 
    canvasFilter: 'contrast(105%) brightness(110%) saturate(90%) hue-rotate(-10deg)',
    vignette: false
  },
  { 
    id: 'portra', 
    name: 'Portra 400', 
    cssFilter: 'sepia(0.1) saturate(0.9) contrast(0.95) brightness(1.05) hue-rotate(5deg)', 
    canvasFilter: 'sepia(10%) saturate(90%) contrast(95%) brightness(105%) hue-rotate(5deg)',
    vignette: false 
  },
  { 
    id: 'ricoh', 
    name: 'GR2 Mono', 
    cssFilter: 'grayscale(1) contrast(1.3) brightness(0.95) blur(0.5px)', 
    canvasFilter: 'grayscale(100%) contrast(130%) brightness(95%) blur(0.5px)',
    vignette: true 
  },
  { 
    id: 'lomo', 
    name: 'Lomo Red', 
    cssFilter: 'saturate(1.4) contrast(1.2) sepia(0.2)', 
    canvasFilter: 'saturate(140%) contrast(120%) sepia(20%)',
    border: 'red',
    vignette: true
  },
  { 
    id: 'cinema', 
    name: 'Cinema', 
    cssFilter: 'contrast(1.1) saturate(1.1) brightness(0.9) sepia(0.1)', 
    canvasFilter: 'contrast(110%) saturate(110%) brightness(90%) sepia(10%)',
    vignette: true
  },
];

const CATEGORY_NAMES: Record<CaptionCategory, string> = {
  PORTRAIT: '人像',
  SCENERY: '风景',
  FOOD: '美食',
  LIFE: '生活',
  CREATIVE: '创意',
  GENERAL: '通用'
};

const App: React.FC = () => {
  // --- State ---
  const [appState, setAppState] = useState<AppState>(AppState.IDLE);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const [selectedFilter, setSelectedFilter] = useState<FilterConfig>(FILTERS[0]);
  
  // Image Data State
  const [uploadedImageSrc, setUploadedImageSrc] = useState<string | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  
  const [isFlashOn, setIsFlashOn] = useState(false);
  const [flashEnabled, setFlashEnabled] = useState(false);
  
  // AI/Text State
  const [currentCaption, setCurrentCaption] = useState<string>("美好的一天");
  const [currentCategory, setCurrentCategory] = useState<CaptionCategory>('GENERAL');
  
  // Gestures State
  const [textPos, setTextPos] = useState({ x: 0.5, y: 0.85 }); // Percentages
  const [textScale, setTextScale] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  
  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef({ x: 0, y: 0 });

  // --- Initialization ---
  const triggerHaptic = () => {
    if (navigator.vibrate) navigator.vibrate(15);
  };

  // --- Camera Handling ---
  const startCamera = useCallback(async () => {
    if (uploadedImageSrc) {
      URL.revokeObjectURL(uploadedImageSrc);
      setUploadedImageSrc(null);
    }
    setCapturedImage(null);

    try {
      if (stream) stream.getTracks().forEach(t => t.stop());
      
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: facingMode,
          width: { ideal: 1920 }, 
          height: { ideal: 1920 }, 
          aspectRatio: 1,
          frameRate: { ideal: 30 }
        },
        audio: false,
      });
      setStream(newStream);
      setAppState(AppState.CAMERA);
    } catch (err) {
      console.error("Camera Error", err);
      alert("需要相机权限来定格美好～请在设置中开启。");
    }
  }, [facingMode, stream, uploadedImageSrc]);

  useEffect(() => {
    if (appState === AppState.CAMERA && videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream, appState]);

  const toggleCamera = () => {
    triggerHaptic();
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
  };

  // --- Upload Handling ---
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const url = URL.createObjectURL(file);
    setUploadedImageSrc(url);
    setCapturedImage(url); // For uploads, captured is same as uploaded
    
    if (stream) {
        stream.getTracks().forEach(t => t.stop());
        setStream(null);
    }
    setAppState(AppState.CAMERA);
  };

  // --- Photo Taking & Logic ---
  const takePhoto = async () => {
    triggerHaptic();
    
    if (flashEnabled) {
        setIsFlashOn(true);
        setTimeout(() => setIsFlashOn(false), 300);
    }

    // Capture the image immediately!
    let finalImageSrc = "";

    if (uploadedImageSrc) {
      finalImageSrc = uploadedImageSrc;
    } else if (videoRef.current) {
       const canvas = document.createElement('canvas');
       canvas.width = videoRef.current.videoWidth;
       canvas.height = videoRef.current.videoHeight;
       const ctx = canvas.getContext('2d');
       if (ctx) {
          // Mirror if user facing
          if (facingMode === 'user') {
             ctx.translate(canvas.width, 0);
             ctx.scale(-1, 1);
          }
          ctx.drawImage(videoRef.current, 0, 0);
          finalImageSrc = canvas.toDataURL('image/jpeg', 0.9);
       }
    }

    if (!finalImageSrc) return;

    setCapturedImage(finalImageSrc);
    setAppState(AppState.PROCESSING);

    // 1. Generate Caption
    // Default to GENERAL as requested
    setCurrentCategory('GENERAL'); 
    const { text, category } = await generateCaption(finalImageSrc);
    setCurrentCaption(text);
    // If we want to respect the auto-detection but prioritize General, geminiService logic handles it.
    // But we update state here.
    setCurrentCategory(category);
    
    setTextPos({ x: 0.5, y: 0.85 });
    setTextScale(1);

    setTimeout(() => {
        setAppState(AppState.REVIEW);
    }, 1000);
  };

  // --- Review & Export ---
  const saveToAlbum = async () => {
    if (!capturedImage) return;
    
    triggerHaptic();
    
    const now = new Date();
    const dateStr = `${(now.getMonth()+1).toString().padStart(2,'0')}.${now.getDate().toString().padStart(2,'0')}.${now.getFullYear()}`;

    try {
        // Generate High-Res Image
        const dataUrl = await createPolaroidImage(
            capturedImage,
            dateStr,
            selectedFilter,
            { text: currentCaption, xPercent: textPos.x, yPercent: textPos.y, scale: textScale }
        );
        
        // Convert DataURL to Blob
        const res = await fetch(dataUrl);
        const blob = await res.blob();
        const file = new File([blob], `RetroSnap_${Date.now()}.jpg`, { type: 'image/jpeg' });

        // Try Native Sharing (The "Save Image" method on iOS)
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({
                files: [file],
                title: 'RetroSnap',
                text: currentCaption
            });
            // User handles "Save Image" in the sheet
        } else {
            // Fallback for Desktop / Non-supported
            const link = document.createElement('a');
            link.href = dataUrl;
            link.download = `RetroSnap_${Date.now()}.jpg`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            alert("照片已下载～");
        }
    } catch (error) {
        console.error("Save failed", error);
        alert("保存失败，请重试");
    }
  };

  // --- Gestures ---
  const handleTouchStart = (e: React.TouchEvent) => {
    if (appState !== AppState.REVIEW) return;
    const touch = e.touches[0];
    dragStartRef.current = { x: touch.clientX, y: touch.clientY };
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || appState !== AppState.REVIEW || !containerRef.current) return;
    const touch = e.touches[0];
    const rect = containerRef.current.getBoundingClientRect();
    const deltaX = (touch.clientX - dragStartRef.current.x) / rect.width;
    const deltaY = (touch.clientY - dragStartRef.current.y) / rect.height;
    setTextPos(prev => ({
        x: Math.min(0.9, Math.max(0.1, prev.x + deltaX)),
        y: Math.min(0.95, Math.max(0.05, prev.y + deltaY))
    }));
    dragStartRef.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleTouchEnd = () => { setIsDragging(false); };

  const changeCaption = (e: React.MouseEvent | React.TouchEvent) => {
      e.stopPropagation();
      triggerHaptic();
      setCurrentCaption(getCaptionForCategory(currentCategory));
  };

  const toggleCategory = (e: React.MouseEvent | React.TouchEvent) => {
      e.stopPropagation();
      triggerHaptic();
      const categories: CaptionCategory[] = ['GENERAL', 'PORTRAIT', 'SCENERY', 'FOOD', 'LIFE', 'CREATIVE'];
      const nextIndex = (categories.indexOf(currentCategory) + 1) % categories.length;
      const nextCategory = categories[nextIndex];
      setCurrentCategory(nextCategory);
      setCurrentCaption(getCaptionForCategory(nextCategory));
  };

  // --- Render Helpers ---
  const renderFilterWheel = () => (
      <div className="absolute bottom-[-90px] left-0 right-0 h-24 flex items-center gap-4 overflow-x-auto no-scrollbar px-6 pb-2 z-40 pointer-events-auto">
        {FILTERS.map(f => (
            <button 
                key={f.id} 
                onClick={() => { triggerHaptic(); setSelectedFilter(f); }}
                className="flex flex-col items-center gap-1 shrink-0 transition-transform active:scale-95"
            >
                <div className={`w-14 h-14 rounded-full border-[3px] ${selectedFilter.id === f.id ? 'border-[#c93c2e] scale-110' : 'border-gray-400'} bg-gray-800 relative overflow-hidden shadow-lg`}>
                    <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1495125839927-2d279c6432c0?ixlib=rb-4.0.3&auto=format&fit=crop&w=100&q=80')] bg-cover bg-center opacity-80" style={{ filter: f.cssFilter }}></div>
                </div>
                <span className={`text-[10px] font-bold tracking-wider ${selectedFilter.id === f.id ? 'text-[#c93c2e]' : 'text-[#8b4513]'}`}>{f.name}</span>
            </button>
        ))}
      </div>
  );

  // --- IDLE SCREEN ---
  if (appState === AppState.IDLE) {
      return (
        <div className="h-[100dvh] w-full flex flex-col items-center justify-center relative bg-[#f5f1e9] overflow-hidden">
             <div className="absolute inset-0 pointer-events-none scratches opacity-20"></div>
             <div className="z-10 flex flex-col items-center animate-eject">
                 {/* Big Logo Icon */}
                 <div className="w-40 h-40 bg-[#fdfbf7] rounded-[40px] shadow-[0_20px_40px_rgba(0,0,0,0.15),inset_0_-5px_10px_rgba(0,0,0,0.05)] flex items-center justify-center mb-8 border border-[#e6e2da] relative">
                     <div className="w-28 h-28 rounded-full bg-gradient-to-br from-gray-200 to-gray-400 p-1 shadow-inner">
                        <div className="w-full h-full rounded-full bg-[#222] border-[6px] border-[#333] flex items-center justify-center relative">
                             <div className="w-12 h-12 rounded-full bg-[#111] border border-gray-700 relative overflow-hidden">
                                 <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/20 to-transparent"></div>
                             </div>
                        </div>
                     </div>
                     <div className="absolute top-4 right-5 w-3 h-3 bg-red-500 rounded-full shadow-[0_0_8px_rgba(239,68,68,0.6)] animate-pulse"></div>
                 </div>
                 
                 <h1 className="text-6xl font-bold text-[#8b4513] font-['Ma_Shan_Zheng'] mb-2 drop-shadow-sm">RetroSnap</h1>
                 <p className="text-[#8b4513]/60 font-serif italic text-lg mb-12">定格旧时光</p>
                 
                 <div className="flex flex-col gap-5 w-64">
                     <button onClick={startCamera} className="w-full py-4 bg-[#8b4513] text-[#f5f1e9] text-xl font-bold rounded-2xl shadow-[0_8px_20px_rgba(139,69,19,0.3)] active:scale-95 active:shadow-none transition-all flex items-center justify-center gap-3">
                        <Camera size={28} strokeWidth={2.5} />
                        开启相机
                     </button>
                     <button onClick={() => fileInputRef.current?.click()} className="w-full py-4 bg-white border-2 border-[#8b4513]/20 text-[#8b4513] text-xl font-bold rounded-2xl shadow-md active:scale-95 transition-all flex items-center justify-center gap-3">
                        <ImageIcon size={28} />
                        导入照片
                     </button>
                 </div>
             </div>
             <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
        </div>
      );
  }

  // --- CAMERA BODY UI ---
  return (
    <div className="h-[100dvh] w-full relative flex flex-col items-center bg-[#e8e4d9] overflow-hidden select-none">
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
      {isFlashOn && <div className="flash-effect"></div>}

      {/* Top Bar */}
      <div className="w-full h-16 px-6 flex items-center justify-between z-30 pt-safe-top absolute top-0">
         <button onClick={() => setAppState(AppState.IDLE)} className="w-10 h-10 bg-white/80 backdrop-blur rounded-full flex items-center justify-center text-[#8b4513] shadow-sm active:scale-90 transition-all">
            <ArrowLeft size={22} />
         </button>
         <div className="px-4 py-1 bg-black/5 rounded-full">
            <h1 className="text-[#8b4513] font-bold text-sm tracking-[0.2em] font-serif">RETROSNAP</h1>
         </div>
         {appState === AppState.CAMERA && (
             <button onClick={() => setFlashEnabled(!flashEnabled)} className={`w-10 h-10 rounded-full flex items-center justify-center shadow-sm active:scale-90 transition-all ${flashEnabled ? 'bg-yellow-400 text-[#8b4513]' : 'bg-white/80 text-gray-400'}`}>
                {flashEnabled ? <Zap size={20} fill="currentColor"/> : <ZapOff size={20} />}
             </button>
         )}
         {appState === AppState.REVIEW && (
            <button onClick={saveToAlbum} className="w-10 h-10 bg-[#8b4513] rounded-full flex items-center justify-center text-white shadow-sm active:scale-90 transition-all">
                <Download size={20} />
            </button>
         )}
      </div>

      {/* CAMERA MODE UI */}
      {appState !== AppState.REVIEW && (
        <div className="flex-1 w-full flex items-center justify-center relative top-[-20px]">
            {/* THE CAMERA BODY */}
            <div className="relative w-[90vw] max-w-[380px] aspect-[4/5] bg-[#fdfbf7] rounded-[48px] shadow-[0_30px_60px_-12px_rgba(0,0,0,0.25),inset_0_2px_4px_rgba(255,255,255,0.9),inset_0_-4px_10px_rgba(0,0,0,0.05)] p-6 flex flex-col items-center border border-[#e6e2da]">
                
                {/* Grip Texture */}
                <div className="absolute right-0 top-[20%] bottom-[20%] w-6 bg-[#e6e2da] rounded-l-2xl opacity-30 pointer-events-none"></div>

                {/* Upper Components */}
                <div className="w-full flex justify-between items-start px-2 mb-2 relative z-10">
                    <div className="w-20 h-12 bg-[#333] rounded-xl border-[3px] border-[#555] relative overflow-hidden shadow-inner group">
                        <div className="absolute inset-0 bg-[radial-gradient(circle,rgba(255,255,255,0.8)_10%,rgba(255,255,255,0.1)_50%,transparent_70%)] opacity-50"></div>
                        <div className="w-full h-full grid grid-cols-4 gap-0.5 opacity-20">
                             {[...Array(8)].map((_,i)=><div key={i} className="bg-white"></div>)}
                        </div>
                    </div>
                    <div className="w-12 h-12 bg-[#111] rounded-xl border-[3px] border-[#444] relative shadow-inner overflow-hidden flex items-center justify-center">
                        <div className="w-6 h-6 bg-[#000] rounded-md relative overflow-hidden">
                             <div className="absolute w-full h-[120%] bg-gradient-to-b from-purple-900/50 to-blue-900/30"></div>
                             <div className="absolute top-[-2px] left-[-2px] w-4 h-4 bg-white/20 rounded-full blur-sm"></div>
                        </div>
                    </div>
                </div>

                {/* Main Lens */}
                <div className="relative mt-2 w-64 h-64 z-20">
                    <div className="absolute inset-0 rounded-full bg-gradient-to-br from-gray-200 via-white to-gray-300 shadow-[0_10px_25px_rgba(0,0,0,0.2)] flex items-center justify-center">
                        <div className="w-[94%] h-[94%] rounded-full bg-[#222] flex items-center justify-center border border-gray-600 shadow-inner">
                            <div className="w-[88%] h-[88%] rounded-full bg-[#0a0a0a] relative overflow-hidden border-[6px] border-[#1a1a1a] shadow-[inset_0_0_20px_black]">
                                <div className="w-full h-full relative overflow-hidden rounded-full bg-black">
                                    {appState === AppState.PROCESSING ? (
                                        <div className="w-full h-full flex items-center justify-center">
                                            <span className="text-white/50 font-serif text-sm animate-pulse">Developing...</span>
                                        </div>
                                    ) : uploadedImageSrc ? (
                                        <img src={uploadedImageSrc} className="w-full h-full object-cover scale-125" style={{ filter: selectedFilter.cssFilter }} />
                                    ) : (
                                        <video ref={videoRef} autoPlay playsInline muted className={`w-full h-full object-cover scale-125 ${facingMode === 'user' ? '-scale-x-125' : ''}`} style={{ filter: selectedFilter.cssFilter }} />
                                    )}
                                    <div className="absolute inset-0 glass-reflection rounded-full z-30"></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Bottom Controls */}
                <div className="mt-auto w-full flex justify-between items-end px-4 pb-2 relative z-20">
                    <button onClick={() => fileInputRef.current?.click()} className="w-14 h-14 rounded-full bg-[#e8e4d9] border-2 border-[#d6d2c9] shadow-[inset_0_2px_5px_rgba(0,0,0,0.1),0_2px_5px_rgba(0,0,0,0.1)] flex items-center justify-center text-[#8b4513] active:scale-95 transition-transform">
                        <ImageIcon size={24} />
                    </button>
                    
                    {!uploadedImageSrc && (
                        <button onClick={toggleCamera} className="absolute left-1/2 -translate-x-1/2 bottom-4 w-10 h-10 rounded-full bg-[#333] border border-gray-500 flex items-center justify-center text-white shadow-lg active:rotate-180 transition-all duration-500">
                            <RefreshCw size={16} />
                        </button>
                    )}

                    <button onClick={takePhoto} className="relative w-20 h-20 rounded-full bg-[#c93c2e] border-[4px] border-[#fdfbf7] shadow-[0_6px_15px_rgba(0,0,0,0.3),inset_0_-4px_8px_rgba(0,0,0,0.2)] flex items-center justify-center active:scale-95 transition-transform group">
                         <div className="w-16 h-16 rounded-full border-2 border-red-400/30 bg-gradient-to-br from-[#d94c3e] to-[#b02c20]"></div>
                         <div className="absolute top-3 left-4 w-6 h-3 bg-white/20 rounded-full blur-[2px]"></div>
                    </button>
                </div>
                
                <div className="absolute bottom-[105px] text-[10px] font-bold tracking-widest text-[#8b4513]/40 uppercase pointer-events-none">
                    {selectedFilter.name}
                </div>

                {renderFilterWheel()}
            </div>
        </div>
      )}

      {/* PREVIEW / DEVELOPED MODE UI */}
      {appState === AppState.REVIEW && (
          <div className="flex-1 w-full flex flex-col items-center justify-center relative animate-eject p-6">
               {/* The Polaroid Card */}
               <div 
                 ref={containerRef}
                 className="relative w-full max-w-[340px] aspect-[3.5/4.2] bg-[#f8f5ee] shadow-[0_20px_50px_rgba(0,0,0,0.25)] p-4 pb-12 transition-transform duration-300"
                 style={{ transform: 'rotate(-2deg)' }}
               >
                   {/* Paper Texture */}
                   <div className="absolute inset-0 bg-[#f8f5ee] opacity-100 pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/paper-fibers.png')]"></div>

                   {/* Photo Area */}
                   <div className="w-full aspect-square bg-[#ddd] relative overflow-hidden shadow-inner mb-4">
                        {capturedImage && (
                           <img src={capturedImage} className="w-full h-full object-cover" style={{ filter: selectedFilter.cssFilter }} />
                        )}
                        {/* Filter Overlays */}
                        {selectedFilter.vignette && <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle,transparent_40%,rgba(0,0,0,0.4)_100%)]"></div>}
                        {selectedFilter.border && <div className={`absolute inset-0 pointer-events-none border-[12px] border-opacity-30 ${selectedFilter.border.includes('red') ? 'border-red-800' : 'border-black'}`}></div>}
                   </div>

                   {/* Category Badge */}
                   <button onClick={toggleCategory} className="absolute top-6 left-6 z-20 bg-black/40 backdrop-blur px-2 py-1 rounded text-[10px] text-white font-bold flex items-center gap-1 hover:bg-black/60">
                       <Tag size={10} /> {CATEGORY_NAMES[currentCategory]}
                   </button>

                   {/* Date Stamp */}
                   <div className="absolute top-[calc(4px+100%-120px)] right-6 text-[#f5f5f5]/90 font-['Courier_Prime'] font-bold text-lg tracking-widest drop-shadow-md pointer-events-none">
                        {(() => {
                            const now = new Date();
                            return `${(now.getMonth()+1).toString().padStart(2,'0')}.${now.getDate().toString().padStart(2,'0')}.${now.getFullYear()}`;
                        })()}
                   </div>

                   {/* Handwritten Text Area */}
                   <div 
                        className="absolute bottom-4 left-0 w-full flex justify-center cursor-move z-30"
                        onTouchStart={handleTouchStart}
                        onTouchMove={handleTouchMove}
                        onTouchEnd={handleTouchEnd}
                   >
                        <div className="relative px-4 py-2">
                             <p className="font-['Ma_Shan_Zheng'] text-3xl text-[#1a1a1a] text-center whitespace-nowrap">{currentCaption}</p>
                             <button onClick={changeCaption} className="absolute -right-6 top-2 text-[#8b4513]/50 hover:text-[#8b4513] p-2">
                                 <RefreshCcw size={16} />
                             </button>
                        </div>
                   </div>
               </div>
               
               {/* Action Buttons */}
               <div className="mt-12 flex gap-8">
                    <button onClick={() => setAppState(AppState.CAMERA)} className="w-16 h-16 rounded-full border-2 border-[#8b4513]/30 flex items-center justify-center text-[#8b4513] active:scale-95 bg-[#f5f1e9]">
                        <RefreshCw size={24} />
                    </button>
                    
                    {/* Main Save/Share Button */}
                    <button onClick={saveToAlbum} className="w-16 h-16 rounded-full bg-[#8b4513] flex items-center justify-center text-white shadow-xl active:scale-95 flex-col gap-1">
                        <Download size={28} />
                    </button>
               </div>
               <p className="mt-6 text-[#8b4513]/40 text-xs font-serif italic">点击下载保存至相册</p>
          </div>
      )}
    </div>
  );
};

export default App;
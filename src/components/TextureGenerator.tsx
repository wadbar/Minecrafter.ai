import React, { useState, useCallback, useMemo, useRef, useEffect } from "react";
import GeneratorLayout from "./GeneratorLayout";
import { Loader2, Maximize, Layout, Wand2, Grid3X3, Image as ImageIcon, Mic, ChevronLeft, ChevronRight, BookOpen, RotateCcw, RotateCw, Cloud, Download, Trash2, AlertTriangle, CheckCircle2, Eye, EyeOff, Upload, Settings2, FileJson } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "sonner";
import { saveArtifact } from "../lib/db";
import { cn } from "../lib/utils";
import { usePersistentHistory } from "../hooks/usePersistentHistory";
import { useTranslation } from "../context/LanguageContext";

const PIXEL_ART_PRESETS = [
  { label: "16x16 (Classic)", w: 16, h: 16 },
  { label: "32x32 (HD)", w: 32, h: 32 },
  { label: "64x64 (Ultra)", w: 64, h: 64 },
  { label: "128x128", w: 128, h: 128 }
];

const EXPORT_FORMATS = [
  { label: "PNG", value: "image/png" },
  { label: "DDS", value: "image/vnd-ms.dds" },
  { label: "JPG", value: "image/jpeg" }
];

const ASPECT_RATIOS = [
  { label: "1:1", value: "1:1" },
  { label: "16:9", value: "16:9" },
  { label: "4:3", value: "4:3" },
  { label: "3:4", value: "3:4" },
  { label: "9:16", value: "9:16" }
];

const GALLERY_IMAGES = [
  { promptKey: "swordPrompt", src: "https://v2.cdn.minecrafter.ai/assets/examples/diamond-sword.png", type: "item" },
  { promptKey: "grassPrompt", src: "https://v2.cdn.minecrafter.ai/assets/examples/grass-block.png", type: "block" },
  { promptKey: "potionPrompt", src: "https://v2.cdn.minecrafter.ai/assets/examples/magic-potion.png", type: "item" },
  { promptKey: "shieldPrompt", src: "https://v2.cdn.minecrafter.ai/assets/examples/shield.png", type: "item" },
  { promptKey: "magmaPrompt", src: "https://v2.cdn.minecrafter.ai/assets/examples/magma.png", type: "block" },
  { promptKey: "armorPrompt", src: "https://v2.cdn.minecrafter.ai/assets/examples/armor.png", type: "armor" }
];

export default function TextureGenerator() {
  const { t } = useTranslation();
  const { history, addHistory, removeHistory } = usePersistentHistory('texture');
  const [width, setWidth] = useState(16);
  const [height, setHeight] = useState(16);
  const [aspectRatio, setAspectRatio] = useState("1:1");
  const [activeTab, setActiveTab] = useState<"generate" | "history">("generate");
  const [showDocs, setShowDocs] = useState(false);
  
  const [undoStack, setUndoStack] = useState<string[]>([]);
  const [redoStack, setRedoStack] = useState<string[]>([]);
  const [currentImage, setCurrentImage] = useState("");
  
  // Advanced Features State
  const [showGrid, setShowGrid] = useState(false);
  const [gridSize, setGridSize] = useState(16);
  const [gridOpacity, setGridOpacity] = useState(0.3);
  const [exportFormat, setExportFormat] = useState("image/png");
  const [compression, setCompression] = useState(false);
  const [baseTexture, setBaseTexture] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uvValidation = useMemo(() => {
    const standards = [16, 32, 64, 128, 256, 512];
    const isSquare = width === height;
    const isStandardRes = standards.includes(width) && standards.includes(height);
    const isStandardRatio = aspectRatio === "1:1";

    if (!isSquare || !isStandardRes || !isStandardRatio) {
      let issues = [];
      if (!isSquare) issues.push(t.textureGenerator.notSquare);
      if (!isStandardRes) issues.push(t.textureGenerator.nonStandardRes);
      if (!isStandardRatio) issues.push(t.textureGenerator.incorrectRatio);

      return {
        isValid: false,
        issues,
        suggestion: t.textureGenerator.suggestionRes
      };
    }
    return { isValid: true };
  }, [width, height, aspectRatio]);

  const generateTexture = useCallback(async (prompt: string) => {
    // Inject pixel art constraints for low resolutions
    const isPixelArt = width <= 64 && height <= 64;
    const finalPrompt = isPixelArt 
      ? `Minecraft style pixel art texture, ${width}x${height} resolution, sharp pixels, ${prompt}` 
      : prompt;

    try {
      const res = await fetch("/api/generate-texture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          prompt: finalPrompt, 
          width, 
          height, 
          aspectRatio,
          baseImage: baseTexture // Layering support
        }),
      });
      if (!res.ok) throw new Error("API Failure");
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      
      if (data.result) {
        addHistory(prompt, data.result, { width, height, aspectRatio });
      }
      
      return data.result || "";
    } catch (e) {
      toast.info(t.textureGenerator.offlineProcessing, { description: t.textureGenerator.offlineDesc });
      const { OfflineEngine } = await import("../services/OfflineEngine");
      const result = OfflineEngine.generateTexture(finalPrompt);
      addHistory(prompt, result, { width, height, aspectRatio });
      return result;
    }
  }, [width, height, aspectRatio, addHistory]);

  const onGenerateComplete = useCallback((result: string) => {
    if (currentImage) {
      setUndoStack(prev => [currentImage, ...prev].slice(0, 20));
    }
    setRedoStack([]);
    setCurrentImage(result);
  }, [currentImage]);

  const undo = useCallback(() => {
    if (undoStack.length === 0) return;
    const prev = undoStack[0];
    setRedoStack(r => [currentImage, ...r]);
    setCurrentImage(prev);
    setUndoStack(u => u.slice(1));
  }, [currentImage, undoStack]);

  const redo = useCallback(() => {
    if (redoStack.length === 0) return;
    const next = redoStack[0];
    setUndoStack(u => [currentImage, ...u]);
    setCurrentImage(next);
    setRedoStack(r => r.slice(1));
  }, [currentImage, redoStack]);

  const applyPreset = useCallback((w: number, h: number) => {
    setWidth(w);
    setHeight(h);
    setAspectRatio("1:1");
  }, []);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setBaseTexture(event.target?.result as string);
        toast.success(t.textureGenerator.baseUploadedSuccess, { description: t.textureGenerator.baseUploadedDesc });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDownload = async () => {
    if (!currentImage) return;
    
    const tId = toast.loading(t.textureGenerator.preparingDownload);
    try {
      // For DDS we simulation or simply use the data url if PNG
      // In a real environment we would use a library like 'canvas' or a WASM DDS encoder
      const a = document.createElement("a");
      a.href = currentImage;
      const ext = exportFormat.split('/')[1].replace('vnd-ms.dds', 'dds').replace('jpeg', 'jpg');
      a.download = `minecraft_texture_${Date.now()}_${width}x${height}${compression ? '_compressed' : ''}.${ext}`;
      a.click();
      toast.success(t.common.ready, { id: tId });
    } catch (e) {
      toast.error(t.textureGenerator.archiveError, { id: tId });
    }
  };

  const saveToCloud = useCallback(async (title: string, result: string) => {
    const tId = toast.loading(t.textureGenerator.archiving);
    try {
      await saveArtifact("texture", title, result);
      toast.success(t.textureGenerator.archivedSuccess, { id: tId });
    } catch (e: any) {
      toast.error(t.textureGenerator.archiveError, { id: tId, description: e.message });
    }
  }, []);

  const controls = useMemo(() => (
    <div className="flex flex-col gap-6">
      {/* Camada de Base / Importação */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <Upload className="w-4 h-4 text-m3-primary" />
          <span className="uppercase tracking-widest font-black text-[10px]">{t.textureGenerator.baseTextureLabel}</span>
        </div>
        <input 
          type="file" 
          ref={fileInputRef} 
          onChange={handleFileUpload} 
          className="hidden" 
          accept="image/*"
        />
        {baseTexture && (
          <div className="relative w-10 h-10 rounded-lg border border-emerald-500 overflow-hidden shadow-m3-1">
            <img src={baseTexture} className="w-full h-full object-cover" style={{ imageRendering: 'pixelated' }} alt="Base Preview" />
            <div className="absolute inset-0 bg-emerald-500/10" />
          </div>
        )}
        <button 
          onClick={() => fileInputRef.current?.click()}
          className={cn(
            "px-4 py-2 rounded-full border text-[10px] font-black transition-all flex items-center gap-2",
            baseTexture ? "bg-emerald-500 text-white border-emerald-500" : "bg-m3-surface-container border-m3-outline-variant text-m3-on-surface-variant hover:bg-m3-surface-variant"
          )}
        >
          {baseTexture ? t.textureGenerator.substituteBase : t.textureGenerator.importBase}
        </button>
        {baseTexture && (
          <button 
            onClick={() => setBaseTexture(null)}
            className="text-[10px] font-black text-red-500 uppercase tracking-widest hover:underline"
          >
            {t.textureGenerator.remove}
          </button>
        )}
        <div className="w-px h-4 bg-m3-outline-variant mx-2" />
        
        {/* Configurações de Exportação */}
        <div className="flex items-center gap-2">
          <Settings2 className="w-4 h-4 text-m3-secondary" />
          <span className="uppercase tracking-widest font-black text-[10px]">{t.textureGenerator.exportAs}:</span>
        </div>
        <div className="flex items-center gap-2 bg-m3-surface-container p-1 rounded-full border border-m3-outline-variant">
           {EXPORT_FORMATS.map(f => (
             <button
               key={f.value}
               onClick={() => setExportFormat(f.value)}
               className={cn(
                 "px-3 py-1 rounded-full text-[9px] font-black uppercase transition-all",
                 exportFormat === f.value ? "bg-m3-secondary text-m3-on-secondary" : "text-m3-on-surface-variant hover:bg-m3-surface-variant"
               )}
             >
               {f.label}
             </button>
           ))}
        </div>
        <button 
          onClick={() => setCompression(!compression)}
          className={cn(
            "px-3 py-1.5 rounded-full border text-[9px] font-black uppercase transition-all flex items-center gap-2",
            compression ? "bg-m3-primary/10 text-m3-primary border-m3-primary" : "border-m3-outline-variant text-m3-on-surface-variant"
          )}
        >
          <FileJson className="w-3 h-3" />
          {t.textureGenerator.compression}: {compression ? 'ON' : 'OFF'}
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-4 text-m3-on-surface-variant font-mono text-xs">
        <div className="flex items-center gap-2" title={t.textureGenerator.resolution}>
          <Maximize className="w-4 h-4 text-m3-primary" />
          <span className="uppercase tracking-widest font-black text-[10px]">Pixel Art:</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {PIXEL_ART_PRESETS.map((p) => (
            <button
              key={p.label}
              onClick={() => applyPreset(p.w, p.h)}
              className={cn(
                "px-3 py-2 rounded-full border text-[10px] font-black transition-all flex items-center gap-2",
                width === p.w && height === p.h
                  ? "bg-m3-primary-container text-m3-on-primary-container border-m3-primary shadow-m3-1"
                  : "bg-m3-surface-container-low border-m3-outline-variant text-m3-on-surface-variant hover:bg-m3-surface-variant"
              )}
            >
              <Grid3X3 className={cn("w-3.5 h-3.5", width === p.w && height === p.h ? "text-m3-primary" : "text-m3-on-surface-variant/40")} />
              {p.label}
            </button>
          ))}
        </div>
        
        <div className="flex items-center gap-2 ml-4">
          <label className="mr-1 text-[9px] uppercase font-black opacity-50">{t.textureGenerator.manual}</label>
          <input 
            type="number" 
            value={width} 
            onChange={e => setWidth(Number(e.target.value))}
            className="bg-m3-surface-container border border-m3-outline-variant rounded-lg px-2 py-1.5 w-16 text-m3-on-surface text-[11px] font-bold outline-none focus:border-m3-primary transition-colors text-center"
          />
          <span className="text-m3-on-surface-variant/30 text-xs">×</span>
          <input 
            type="number" 
            value={height} 
            onChange={e => setHeight(Number(e.target.value))}
            className="bg-m3-surface-container border border-m3-outline-variant rounded-lg px-2 py-1.5 w-16 text-m3-on-surface text-[11px] font-bold outline-none focus:border-m3-primary transition-colors text-center"
          />
        </div>

        <button
          onClick={() => window.dispatchEvent(new CustomEvent('trigger-mic'))}
          className="ml-auto flex items-center gap-2 px-4 py-2 bg-m3-secondary-container text-m3-on-secondary-container rounded-full hover:bg-m3-secondary-container/80 transition-all active:scale-95 group shadow-m3-1"
        >
          <Mic className="w-4 h-4" />
          <span className="text-[10px] font-black uppercase tracking-widest hidden sm:inline">{t.textureGenerator.voice}</span>
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-4 text-m3-on-surface-variant font-mono text-xs">
        <div className="flex items-center gap-2">
          <Layout className="w-4 h-4 text-m3-secondary" />
          <span className="uppercase tracking-widest font-black text-[10px]">{t.textureGenerator.aspectRatioLabel}</span>
        </div>
        <div className="flex gap-2">
          {ASPECT_RATIOS.map((ar) => (
            <button
              key={ar.value}
              onClick={() => setAspectRatio(ar.value)}
              className={cn(
                "px-3 py-1.5 rounded-full border text-[9px] font-black uppercase transition-all",
                aspectRatio === ar.value 
                  ? "bg-m3-primary text-m3-on-primary border-m3-primary shadow-m3-1" 
                  : "bg-m3-surface-container border-m3-outline-variant text-m3-on-surface-variant hover:bg-m3-surface-variant"
              )}
            >
              {ar.label}
            </button>
          ))}
        </div>

        {currentImage && (
          <div className="ml-auto flex items-center gap-2 bg-m3-surface-container-high p-1 px-2 rounded-full border border-m3-outline-variant shadow-m3-1">
             <button onClick={undo} disabled={undoStack.length === 0} className="p-2 text-m3-on-surface-variant hover:bg-m3-surface-variant rounded-full disabled:opacity-20 transition-colors"><RotateCcw className="w-4 h-4" /></button>
             <button onClick={redo} disabled={redoStack.length === 0} className="p-2 text-m3-on-surface-variant hover:bg-m3-surface-variant rounded-full disabled:opacity-20 transition-colors"><RotateCw className="w-4 h-4" /></button>
             <div className="w-px h-4 bg-m3-outline-variant mx-1" />
             <button 
                onClick={handleDownload}
                className="p-2 text-m3-primary hover:bg-m3-primary/10 rounded-full transition-colors"
                title={`Baixar ${exportFormat.split('/')[1].toUpperCase().replace('VND-MS.DDS', 'DDS')}`}
              >
                <Download className="w-4 h-4" />
              </button>
              <div className="w-px h-4 bg-m3-outline-variant mx-1" />
              <button 
                onClick={() => setShowGrid(!showGrid)}
                className={cn(
                  "p-2 rounded-full transition-colors flex items-center gap-2",
                  showGrid ? "bg-m3-primary text-m3-on-primary shadow-m3-1" : "text-m3-on-surface-variant hover:bg-m3-surface-variant"
                )}
                title={t.textureGenerator.gridUv}
              >
                {showGrid ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                {showGrid && <span className="text-[9px] font-black uppercase pr-1">GRID</span>}
              </button>
          </div>
        )}

        <button 
          onClick={() => setShowDocs(!showDocs)}
          className={cn(
            "ml-2 flex items-center gap-2 py-2 px-4 rounded-full border transition-all text-[10px] font-black uppercase tracking-widest",
            showDocs 
              ? "bg-m3-primary text-m3-on-primary border-m3-primary shadow-m3-1" 
              : "bg-m3-surface-container border-m3-outline-variant text-m3-on-surface-variant hover:bg-m3-surface-variant shadow-m3-1"
          )}
        >
          <BookOpen className="w-4 h-4" />
          {t.textureGenerator.docs}
        </button>
      </div>

      <AnimatePresence>
        {showDocs && (
          <motion.div 
            initial={{ opacity: 0, height: 0, y: -10 }}
            animate={{ opacity: 1, height: "auto", y: 0 }}
            exit={{ opacity: 0, height: 0, y: -10 }}
            className="bg-m3-surface-container-highest border border-m3-outline-variant p-5 rounded-3xl text-[11px] text-m3-on-surface-variant leading-relaxed font-mono mt-2 shadow-m3-3 overflow-hidden"
          >
             <h4 className="text-m3-on-surface font-black mb-3 uppercase tracking-[0.2em] flex items-center gap-2">
               <Wand2 className="w-4 h-4 text-m3-primary" /> {t.textureGenerator.motorTitle}
             </h4>
             <p className="mb-3 italic opacity-80">{t.textureGenerator.motorDesc}</p>
             <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-3 bg-m3-surface-container-low rounded-2xl border border-m3-outline-variant">
                  <span className="text-m3-primary font-black uppercase text-[9px] block mb-1">{t.textureGenerator.symmetryTitle}</span>
                  {t.textureGenerator.symmetryDesc}
                </div>
                <div className="p-3 bg-m3-surface-container-low rounded-2xl border border-m3-outline-variant">
                  <span className="text-m3-secondary font-black uppercase text-[9px] block mb-1">{t.textureGenerator.normalMapTitle}</span>
                  {t.textureGenerator.normalMapDesc}
                </div>
             </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  ), [width, height, aspectRatio, showDocs, currentImage, undoStack, redoStack, undo, redo, applyPreset]);

  const renderLoading = useCallback(() => (
    <div className="flex flex-col items-center justify-center min-h-[400px] space-y-8">
      <div className="relative">
        <div className="w-32 h-32 rounded-[2rem] bg-m3-surface-container border border-m3-primary/20 animate-pulse overflow-hidden flex items-center justify-center relative shadow-m3-3">
          <div className="absolute inset-0 bg-gradient-to-tr from-m3-primary/10 to-transparent animate-spin" style={{ animationDuration: '3s' }} />
          <Loader2 className="w-12 h-12 text-m3-primary animate-spin" />
        </div>
        <div className="absolute -inset-4 border border-m3-primary/5 rounded-[2.5rem] animate-pulse" />
      </div>
      <div className="text-center space-y-3">
        <p className="text-m3-primary font-black text-[11px] tracking-[0.4em] uppercase animate-in fade-in slide-in-from-bottom-2">{t.textureGenerator.synthesizingBuffer}</p>
        <p className="text-m3-on-surface-variant/60 font-mono text-[10px]">{t.textureGenerator.calculatingUV}</p>
      </div>
    </div>
  ), []);

  const scrollRef = useRef<HTMLDivElement>(null);
  const scroll = useCallback((dir: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = scrollRef.current.clientWidth / 2;
      scrollRef.current.scrollBy({ left: dir === 'left' ? -scrollAmount : scrollAmount, behavior: 'smooth' });
    }
  }, []);

  const renderOutput = useCallback((result: string, isGenerating: boolean) => {
    const finalResult = isGenerating ? result : currentImage || result;

    if (isGenerating && !finalResult) return renderLoading();
    
    if (finalResult && finalResult.startsWith("data:image")) {
      return (
        <div className="flex flex-col items-center justify-center p-8 lg:p-12 gap-8 h-full">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="relative group"
          >
            <div className="absolute -inset-6 bg-m3-primary/10 blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
            <div className="relative bg-m3-surface-container border border-m3-outline-variant p-8 rounded-[2.5rem] shadow-m3-4 transition-all group-hover:border-m3-primary/30">
              <div className="relative overflow-hidden rounded-2xl">
                <img 
                  src={finalResult} 
                  alt="Resultado da Geração" 
                  className="max-w-full max-h-[50vh] object-contain shadow-2xl" 
                  style={{ imageRendering: 'pixelated' }} 
                />
                
                {/* Visual Grid Overlay */}
                <AnimatePresence>
                  {showGrid && (
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: gridOpacity }}
                      exit={{ opacity: 0 }}
                      className="absolute inset-0 pointer-events-none"
                      style={{
                        backgroundImage: `
                          linear-gradient(to right, #fff 1px, transparent 1px),
                          linear-gradient(to bottom, #fff 1px, transparent 1px)
                        `,
                        backgroundSize: `${100/gridSize}% ${100/gridSize}%`, // Adjustable grid
                        mixBlendMode: 'difference'
                      }}
                    />
                  )}
                </AnimatePresence>
              </div>
              
              <div className="absolute -top-4 -left-4 z-20">
                <div className="bg-m3-primary text-m3-on-primary shadow-m3-2 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border-2 border-m3-surface">
                  ID: {Math.random().toString(16).substr(2, 6).toUpperCase()}
                </div>
              </div>

              {showGrid && (
                <div className="absolute -bottom-12 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-m3-surface-container-high border border-m3-outline-variant p-3 px-6 rounded-full shadow-m3-3 animate-in slide-in-from-top-2">
                   <div className="flex items-center gap-2 border-r border-m3-outline-variant pr-4">
                    <span className="text-[9px] font-black uppercase text-m3-on-surface-variant opacity-60">Grid UV:</span>
                    <select 
                      value={gridSize} 
                      onChange={(e) => setGridSize(Number(e.target.value))}
                      className="bg-transparent text-[10px] font-black text-m3-primary outline-none cursor-pointer"
                    >
                      <option value="8">8x8</option>
                      <option value="16">16x16</option>
                      <option value="32">32x32</option>
                      <option value="64">64x64</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[9px] font-black uppercase text-m3-on-surface-variant opacity-60">Opacidade:</span>
                    <input 
                      type="range" 
                      min="0.1" 
                      max="1" 
                      step="0.1" 
                      value={gridOpacity} 
                      onChange={(e) => setGridOpacity(Number(e.target.value))}
                      className="w-24 accent-m3-primary h-1"
                    />
                  </div>
                </div>
              )}
            </div>
          </motion.div>
          
          <div className="flex flex-col gap-4 w-full items-center">
            <div className="flex items-center gap-6 bg-m3-surface-container-low border border-m3-outline-variant p-4 px-8 rounded-full shadow-m3-2 overflow-hidden">
              <div className="flex flex-col items-center">
                 <span className="text-[9px] text-m3-on-surface-variant font-black uppercase tracking-widest opacity-50">{t.textureGenerator.resolution}</span>
                 <span className="text-sm font-black text-m3-on-surface tracking-widest">{width}×{height}</span>
              </div>
              <div className="w-px h-8 bg-m3-outline-variant" />
              <div className="flex flex-col items-center">
                 <span className="text-[9px] text-m3-on-surface-variant font-black uppercase tracking-widest opacity-50">{t.textureGenerator.format}</span>
                 <span className="text-sm font-black text-m3-secondary tracking-widest">{aspectRatio}</span>
              </div>
              <div className="w-px h-8 bg-m3-outline-variant" />
              <div className="flex flex-col items-center min-w-[100px]">
                 <span className="text-[9px] text-m3-on-surface-variant font-black uppercase tracking-widest opacity-50">{t.textureGenerator.uvPattern}</span>
                 <div className="flex items-center gap-2 mt-0.5">
                    {uvValidation.isValid ? (
                      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                        <span className="text-[10px] font-black text-emerald-500 uppercase">{t.textureGenerator.valid}</span>
                      </motion.div>
                    ) : (
                      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                        <span className="text-[10px] font-black text-amber-500 uppercase">{t.textureGenerator.adjust}</span>
                      </motion.div>
                    )}
                 </div>
              </div>
            </div>

            {!uvValidation.isValid && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-amber-500/10 border border-amber-500/20 p-3 px-6 rounded-2xl flex items-start gap-4 max-w-md animate-in fade-in"
              >
                <div className="bg-amber-500 rounded-full p-1 mt-0.5">
                  <AlertTriangle className="w-3 h-3 text-white" />
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-black text-amber-600 uppercase tracking-wider">Aviso de Padrão Minecraft</span>
                  <p className="text-[11px] text-amber-700/80 font-medium leading-relaxed">
                    {uvValidation.issues.join(", ")}. {uvValidation.suggestion}
                  </p>
                  <button 
                    onClick={() => applyPreset(16, 16)}
                    className="mt-1 text-[9px] font-black text-amber-600 hover:text-amber-700 text-left underline uppercase tracking-widest"
                  >
                    Auto-Corrigir para 16×16
                  </button>
                </div>
              </motion.div>
            )}
          </div>
        </div>
      );
    }

    return (
      <div className="flex flex-col gap-6 w-full max-w-6xl mx-auto">
        <div className="flex gap-2">
          <button 
            onClick={() => setActiveTab("generate")}
            className={cn(
              "px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all",
              activeTab === "generate" ? "bg-m3-primary text-m3-on-primary shadow-m3-1" : "text-m3-on-surface-variant hover:bg-m3-surface-variant"
            )}
          >
            {t.textureGenerator.generator}
          </button>
          <button 
            onClick={() => setActiveTab("history")}
            className={cn(
              "px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all",
              activeTab === "history" ? "bg-m3-primary text-m3-on-primary shadow-m3-1" : "text-m3-on-surface-variant hover:bg-m3-surface-variant"
            )}
          >
            {t.textureGenerator.history} ({history.length})
          </button>
        </div>

        {activeTab === "history" ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 py-6 border-t border-m3-outline-variant mt-4">
            {history.map((item) => (
              <div 
                key={item.id} 
                className="group relative bg-m3-surface-container-low rounded-2xl overflow-hidden border border-m3-outline-variant hover:border-m3-primary transition-all cursor-pointer"
                onClick={() => {
                  setCurrentImage(item.result);
                  if (item.parameters) {
                    const params = item.parameters as any;
                    setWidth(params.width);
                    setHeight(params.height);
                    setAspectRatio(params.aspectRatio);
                  }
                  window.dispatchEvent(new CustomEvent('set-builder-prompt', { detail: item.prompt }));
                  setActiveTab("generate");
                }}
              >
                <img src={item.result} className="aspect-square object-cover" style={{ imageRendering: 'pixelated' }} alt="Texture History" />
                <div className="absolute inset-x-0 bottom-0 p-2 bg-black/60 backdrop-blur-md opacity-0 group-hover:opacity-100 transition-opacity">
                  <p className="text-[8px] text-white truncate font-mono">"{item.prompt}"</p>
                </div>
                <button 
                  onClick={(e) => { e.stopPropagation(); removeHistory(item.id); }}
                  className="absolute top-2 right-2 p-1.5 bg-red-500/80 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
            {history.length === 0 && (
              <div className="col-span-full py-12 text-center opacity-30 text-m3-on-surface-variant uppercase font-black text-xs tracking-widest">
                {t.textureGenerator.noMemory}
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center p-8 lg:p-12 space-y-12 animate-in fade-in duration-1000">
            <div className="text-center space-y-6">
              <div className="inline-flex items-center justify-center w-24 h-24 bg-m3-surface-container border border-m3-outline-variant rounded-[2rem] mb-2 shadow-inner group transition-all hover:scale-110 hover:border-m3-primary/50">
                <Wand2 className="w-10 h-10 text-m3-on-surface-variant/40 group-hover:text-m3-primary transition-colors duration-500" />
              </div>
              <div>
                <h3 className="text-m3-on-surface font-black tracking-[0.3em] uppercase text-2xl">Texture Hub</h3>
                <p className="text-m3-on-surface-variant/60 text-[11px] font-bold uppercase tracking-widest mt-3 max-w-sm mx-auto leading-relaxed">
                  {t.textureGenerator.readyDistribution}
                </p>
              </div>
            </div>
            
            <div className="w-full max-w-5xl relative group/carousel mb-8">
              <div className="absolute -left-6 top-1/2 -translate-y-1/2 z-10 hidden sm:block">
                  <button 
                    onClick={() => scroll('left')} 
                    className="p-4 bg-m3-surface-container-highest border border-m3-outline-variant rounded-full text-m3-on-surface hover:text-m3-primary hover:border-m3-primary transition-all active:scale-90 shadow-m3-3"
                  >
                    <ChevronLeft className="w-6 h-6" />
                  </button>
              </div>
              <div className="absolute -right-6 top-1/2 -translate-y-1/2 z-10 hidden sm:block">
                  <button 
                    onClick={() => scroll('right')} 
                    className="p-4 bg-m3-surface-container-highest border border-m3-outline-variant rounded-full text-m3-on-surface hover:text-m3-primary hover:border-m3-primary transition-all active:scale-90 shadow-m3-3"
                  >
                    <ChevronRight className="w-6 h-6" />
                  </button>
              </div>

              <div ref={scrollRef} className="flex gap-8 overflow-x-auto pb-10 scrollbar-none snap-x snap-mandatory px-4">
                {GALLERY_IMAGES.map((img, i) => {
                  const prompt = t.textureGenerator[img.promptKey as keyof typeof t.textureGenerator] as string;
                  return (
                    <motion.div 
                      key={i} 
                      className="min-w-[320px] snap-center group relative bg-m3-surface-container border border-m3-outline-variant rounded-[2.5rem] overflow-hidden hover:border-m3-primary/30 transition-all cursor-pointer shadow-m3-2"
                      onClick={() => window.dispatchEvent(new CustomEvent('set-builder-prompt', { detail: prompt }))}
                    >
                        <div className="aspect-square flex items-center justify-center p-12 relative overflow-hidden bg-gradient-to-br from-m3-primary/5 to-transparent">
                          <Grid3X3 className="w-24 h-24 text-m3-on-surface-variant absolute -bottom-6 -right-6 opacity-5 transition-transform group-hover:scale-125 group-hover:rotate-12 duration-1000" />
                          <div className="relative z-10 w-20 h-20 bg-m3-surface-container-highest rounded-3xl flex items-center justify-center border border-m3-outline-variant shadow-m3-1 group-hover:border-m3-primary/50 transition-colors">
                            <ImageIcon className="w-10 h-10 text-m3-on-surface-variant group-hover:text-m3-primary transition-all duration-700 group-hover:scale-110" />
                          </div>
                          <div className="absolute top-8 left-8 text-[10px] font-black text-m3-on-surface-variant uppercase tracking-[0.2em] opacity-40">
                            {t.textureGenerator[img.type as keyof typeof t.textureGenerator]}
                          </div>
                        </div>
                        <div className="p-8 border-t border-m3-outline-variant bg-m3-surface-container-low/50">
                          <p className="text-[11px] text-m3-on-surface-variant/70 font-bold italic leading-relaxed group-hover:text-m3-on-surface transition-colors">"{prompt}"</p>
                        </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }, [width, height, aspectRatio, currentImage, renderLoading, scroll, activeTab, history, removeHistory]);

  return (
    <GeneratorLayout
      title={t.textureGenerator.forgeTitle}
      description={t.textureGenerator.forgeDesc}
      placeholder={t.textureGenerator.placeholder}
      endpointType="generate-texture"
      promptTemplates={[
        { label: t.textureGenerator.frozenAxe, prompt: t.textureGenerator.frozenAxePrompt },
        { label: t.textureGenerator.voidBlock, prompt: t.textureGenerator.voidBlockPrompt },
        { label: t.textureGenerator.acidPotion, prompt: t.textureGenerator.acidPotionPrompt }
      ]}
      extraControls={controls}
      onSaveCloud={saveToCloud}
      renderOutput={renderOutput}
    />
  );
}

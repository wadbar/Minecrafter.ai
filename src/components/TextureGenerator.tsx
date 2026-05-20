import React, { useState, useCallback, useMemo, useRef, useEffect } from "react";
import GeneratorLayout from "./GeneratorLayout";
import { Loader2, Maximize, Layout, Wand2, Grid3X3, Image as ImageIcon, Mic, ChevronLeft, ChevronRight, BookOpen, RotateCcw, RotateCw, Cloud, Download } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "sonner";
import { saveArtifact } from "../lib/db";
import { cn } from "../lib/utils";
import { auth } from "../lib/firebase";

const RESOLUTION_PRESETS = [
  { label: "16x16", w: 16, h: 16 },
  { label: "32x32", w: 32, h: 32 },
  { label: "64x64", w: 64, h: 64 },
  { label: "128x128", w: 128, h: 128 },
  { label: "256x256", w: 256, h: 256 },
  { label: "512x512", w: 512, h: 512 }
];

const ASPECT_RATIOS = [
  { label: "1:1", value: "1:1" },
  { label: "16:9", value: "16:9" },
  { label: "4:3", value: "4:3" },
  { label: "3:4", value: "3:4" },
  { label: "9:16", value: "9:16" }
];

const GALLERY_IMAGES = [
  { prompt: "Una espada de diamante envuelta en llamas azules", src: "https://v2.cdn.minecrafter.ai/assets/examples/diamond-sword.png", type: "Item" },
  { prompt: "Bloque de tierra con césped brillante", src: "https://v2.cdn.minecrafter.ai/assets/examples/grass-block.png", type: "Block" },
  { prompt: "Poción mágica con líquido morado brillando", src: "https://v2.cdn.minecrafter.ai/assets/examples/magic-potion.png", type: "Item" },
  { prompt: "Escudo de madera reforzado con metal oscuro", src: "https://v2.cdn.minecrafter.ai/assets/examples/shield.png", type: "Item" },
  { prompt: "Bloque de magma cristalizado con venas doradas", src: "https://v2.cdn.minecrafter.ai/assets/examples/magma.png", type: "Block" },
  { prompt: "Armadura de amatista mística", src: "https://v2.cdn.minecrafter.ai/assets/examples/armor.png", type: "Armor" }
];

export default function TextureGenerator() {
  const [width, setWidth] = useState(16);
  const [height, setHeight] = useState(16);
  const [aspectRatio, setAspectRatio] = useState("1:1");
  const [showDocs, setShowDocs] = useState(false);
  
  const [undoStack, setUndoStack] = useState<string[]>([]);
  const [redoStack, setRedoStack] = useState<string[]>([]);
  const [currentImage, setCurrentImage] = useState("");

  const generateTexture = useCallback(async (prompt: string) => {
    const res = await fetch("/api/generate-texture", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, width, height, aspectRatio }),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    return data.result || "";
  }, [width, height, aspectRatio]);

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

  const saveToCloud = useCallback(async (title: string, result: string) => {
    if (!auth.currentUser) return toast.error("Login necessário");
    const tId = toast.loading("Arquivando Textura...");
    try {
      await saveArtifact("texture", title, result);
      toast.success("Arquivado com sucesso", { id: tId });
    } catch (e: any) {
      toast.error("Erro ao arquivar", { id: tId, description: e.message });
    }
  }, []);

  const controls = useMemo(() => (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-4 text-neutral-400 font-mono text-xs">
        <div className="flex items-center gap-2 cursor-help" title="Resolução da textura">
          <Maximize className="w-4 h-4 text-emerald-500" />
          <span className="uppercase tracking-widest font-bold border-b border-dashed border-emerald-500/50 pb-0.5">Res:</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {RESOLUTION_PRESETS.map((p) => (
            <button
              key={p.label}
              onClick={() => applyPreset(p.w, p.h)}
              className={cn(
                "px-3 py-1.5 rounded-lg border text-[10px] font-bold transition-all flex items-center gap-2",
                width === p.w && height === p.h
                  ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/50 shadow-[0_0_10px_rgba(16,185,129,0.2)]"
                  : "bg-neutral-900 border-neutral-800 text-neutral-500 hover:border-neutral-600 hover:text-neutral-400"
              )}
            >
              <Grid3X3 className={cn("w-3 h-3", width === p.w && height === p.h ? "text-emerald-500" : "text-neutral-700")} />
              {p.label}
            </button>
          ))}
        </div>
        
        <div className="flex items-center gap-2 ml-4">
          <label className="mr-1 text-[9px] uppercase font-black">Manual:</label>
          <input 
            type="number" 
            value={width} 
            onChange={e => setWidth(Number(e.target.value))}
            className="bg-neutral-900 border border-neutral-700 rounded px-2 py-1 w-14 text-white text-[10px]"
          />
          <span className="text-neutral-700">x</span>
          <input 
            type="number" 
            value={height} 
            onChange={e => setHeight(Number(e.target.value))}
            className="bg-neutral-900 border border-neutral-700 rounded px-2 py-1 w-14 text-white text-[10px]"
          />
        </div>

        <button
          onClick={() => window.dispatchEvent(new CustomEvent('trigger-mic'))}
          className="ml-auto flex items-center gap-2 px-3 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 border border-emerald-500/20 rounded-md transition-all active:scale-95 group"
        >
          <Mic className="w-3.5 h-3.5" />
          <span className="text-[10px] font-black uppercase tracking-widest hidden sm:inline">Voz</span>
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-4 text-neutral-400 font-mono text-xs">
        <div className="flex items-center gap-2">
          <Layout className="w-4 h-4 text-sky-500" />
          <span className="uppercase tracking-widest font-bold">Aspect:</span>
        </div>
        <div className="flex gap-1.5">
          {ASPECT_RATIOS.map((ar) => (
            <button
              key={ar.value}
              onClick={() => setAspectRatio(ar.value)}
              className={cn(
                "px-2.5 py-1 rounded border text-[9px] font-black uppercase transition-all",
                aspectRatio === ar.value ? "bg-sky-500/20 text-sky-400 border-sky-500/50 shadow-[0_0_8px_rgba(14,165,233,0.2)]" : "bg-neutral-900 border-neutral-800 text-neutral-600 hover:text-neutral-400"
              )}
            >
              {ar.label}
            </button>
          ))}
        </div>

        {currentImage && (
          <div className="ml-auto flex items-center gap-2 bg-neutral-900/50 p-1 px-2 rounded-lg border border-neutral-800">
             <button onClick={undo} disabled={undoStack.length === 0} className="p-1 text-neutral-500 hover:text-white disabled:opacity-20"><RotateCcw className="w-3.5 h-3.5" /></button>
             <button onClick={redo} disabled={redoStack.length === 0} className="p-1 text-neutral-500 hover:text-white disabled:opacity-20"><RotateCw className="w-3.5 h-3.5" /></button>
             <div className="w-px h-3 bg-neutral-800 mx-1" />
             <button 
               onClick={() => {
                 const a = document.createElement("a");
                 a.href = currentImage;
                 a.download = `texture_${Date.now()}.png`;
                 a.click();
               }}
               className="p-1 text-sky-400 hover:text-sky-300"
               title="Download PNG"
             >
               <Download className="w-3.5 h-3.5" />
             </button>
          </div>
        )}

        <button 
          onClick={() => setShowDocs(!showDocs)}
          className={cn(
            "ml-2 flex items-center gap-2 p-1.5 px-3 rounded-lg border transition-colors",
            showDocs ? "bg-sky-500/20 border-sky-500/50 text-sky-400" : "bg-neutral-900/50 border-neutral-800 text-neutral-400 hover:bg-neutral-800"
          )}
        >
          <BookOpen className="w-3.5 h-3.5" />
          <span className="uppercase tracking-widest font-black text-[9px]">Docs</span>
        </button>
      </div>

      {showDocs && (
        <div className="bg-neutral-950/80 border border-neutral-800 p-4 rounded-xl text-[11px] text-neutral-500 leading-relaxed font-mono mt-2 shadow-2xl">
           <h4 className="text-white font-black mb-2 uppercase tracking-[0.2em] flex items-center gap-2">
             <Wand2 className="w-3 h-3 text-emerald-500" /> Texture_Engine_V3
           </h4>
           <p className="mb-2 italic">Use "pixel art" para resultados clássicos ou "4k hyper-realistic" para texturas modernas.</p>
           <div className="grid grid-cols-2 gap-4">
              <div><span className="text-emerald-500 font-bold">Seamless:</span> Garante que a textura se repita sem emendas.</div>
              <div><span className="text-sky-500 font-bold">Normal Map:</span> Use para profundidade e relevo.</div>
           </div>
        </div>
      )}
    </div>
  ), [width, height, aspectRatio, showDocs, currentImage, undoStack, redoStack, undo, redo, applyPreset]);

  const renderLoading = useCallback(() => (
    <div className="flex flex-col items-center justify-center min-h-[400px] space-y-6">
      <div className="relative">
        <div className="w-28 h-28 rounded-2xl bg-neutral-900 border-2 border-emerald-500/20 animate-pulse overflow-hidden flex items-center justify-center relative shadow-[0_0_30px_rgba(16,185,129,0.15)]">
          <div className="absolute inset-0 bg-gradient-to-tr from-emerald-500/20 to-transparent animate-spin" style={{ animationDuration: '4s' }} />
          <Loader2 className="w-10 h-10 text-emerald-500 animate-spin" />
        </div>
        <div className="absolute -inset-2 border border-emerald-500/10 rounded-3xl animate-pulse" />
      </div>
      <div className="text-center space-y-2">
        <p className="text-emerald-400 font-mono text-[10px] font-black tracking-[0.3em] uppercase animate-pulse">Synthesizing_Buffer</p>
        <p className="text-neutral-600 font-mono text-[9px]">Calculando UV-Maps & Dithering...</p>
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
        <div className="flex flex-col items-center justify-center p-12 gap-8 h-full bg-neutral-950/20">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="relative group"
          >
            <div className="absolute inset-0 bg-emerald-500/10 blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
            <img 
              src={finalResult} 
              alt="Gen_Output" 
              className="relative z-10 shadow-[0_0_50px_rgba(0,0,0,0.8)] rounded-2xl bg-neutral-900/50 p-6 border border-neutral-800 max-w-full max-h-[55vh] object-contain transition-all group-hover:border-emerald-500/30" 
              style={{ imageRendering: 'pixelated' }} 
            />
            <div className="absolute top-4 left-4 z-20 pointer-events-none">
              <div className="bg-black/60 backdrop-blur-md border border-white/5 px-3 py-1 rounded text-[8px] font-mono text-emerald-500 uppercase tracking-widest font-black">
                Render_ID: {Math.random().toString(16).substr(2, 6).toUpperCase()}
              </div>
            </div>
          </motion.div>
          
          <div className="flex items-center gap-4 bg-neutral-900 border border-neutral-800 p-3 px-6 rounded-2xl shadow-2xl">
            <div className="flex flex-col items-center">
               <span className="text-[8px] text-neutral-600 font-black uppercase tracking-tighter">Resolution</span>
               <span className="text-xs font-mono font-bold text-white tracking-widest">{width}x{height}</span>
            </div>
            <div className="w-px h-6 bg-neutral-800" />
            <div className="flex flex-col items-center">
               <span className="text-[8px] text-neutral-600 font-black uppercase tracking-tighter">Format</span>
               <span className="text-xs font-mono font-bold text-sky-400 tracking-widest">{aspectRatio}</span>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="flex flex-col items-center justify-center p-12 space-y-12 animate-in fade-in duration-700">
        <div className="text-center space-y-4">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-neutral-950 border border-neutral-800 rounded-3xl mb-2 shadow-inner">
            <Wand2 className="w-8 h-8 text-neutral-600 animate-pulse" />
          </div>
          <div>
            <h3 className="text-white font-black tracking-[0.2em] uppercase text-xl">Texture Hub</h3>
            <p className="text-neutral-600 text-[10px] font-mono uppercase tracking-widest mt-2 max-w-xs mx-auto">
              Ready for neural pixel distribution. Select your vector target above.
            </p>
          </div>
        </div>
        
        <div className="w-full max-w-5xl relative group/carousel">
           <div className="absolute -left-4 top-1/2 -translate-y-1/2 z-10">
              <button onClick={() => scroll('left')} className="p-2.5 bg-neutral-900/80 border border-neutral-800 rounded-full text-neutral-400 hover:text-white hover:border-emerald-500/50 shadow-2xl transition-all active:scale-90"><ChevronLeft className="w-5 h-5" /></button>
           </div>
           <div className="absolute -right-4 top-1/2 -translate-y-1/2 z-10">
              <button onClick={() => scroll('right')} className="p-2.5 bg-neutral-900/80 border border-neutral-800 rounded-full text-neutral-400 hover:text-white hover:border-emerald-500/50 shadow-2xl transition-all active:scale-90"><ChevronRight className="w-5 h-5" /></button>
           </div>

           <div ref={scrollRef} className="flex gap-8 overflow-x-auto pb-10 scrollbar-none snap-x snap-mandatory px-4">
            {GALLERY_IMAGES.map((img, i) => (
              <motion.div 
                key={i} 
                className="min-w-[300px] snap-center group relative bg-neutral-950 border border-neutral-900 rounded-3xl overflow-hidden hover:border-emerald-500/30 transition-all cursor-pointer shadow-2xl"
                onClick={() => window.dispatchEvent(new CustomEvent('set-builder-prompt', { detail: img.prompt }))}
              >
                  <div className="aspect-square flex items-center justify-center p-12 relative overflow-hidden bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-emerald-500/5 to-transparent">
                    <Grid3X3 className="w-20 h-20 text-neutral-900 absolute -bottom-4 -right-4 opacity-50" />
                    <ImageIcon className="w-12 h-12 text-neutral-800 group-hover:text-emerald-500 transition-all duration-700 group-hover:scale-125" />
                    <div className="absolute top-6 left-6 text-[9px] font-black text-neutral-700 uppercase tracking-widest">{img.type}_PRESET</div>
                  </div>
                  <div className="p-6 border-t border-neutral-900 bg-black/40">
                    <p className="text-[10px] text-neutral-500 font-mono italic leading-relaxed group-hover:text-emerald-400 transition-colors">"{img.prompt}"</p>
                  </div>
              </motion.div>
            ))}
           </div>
        </div>
      </div>
    );
  }, [width, height, aspectRatio, currentImage, renderLoading, scroll]);

  return (
    <GeneratorLayout
      title="Architecture_Texture_Forge"
      description="Gere texturas experimentais para blocos e itens (Neural Distribution Engine)."
      placeholder="Injete o comando visual (ex: Espada mística de cristal azul)..."
      endpointType="generate-texture"
      promptTemplates={[
        { label: "⚔️ Frozen Axe", prompt: "A frozen battle axe made of pure jagged ice, glowing blue aura, pixel art game asset." },
        { label: "🧱 Void Block", prompt: "A solid block made of starlight and purple void energy, seamless tile, minecraft texture block." },
        { label: "🧪 Acid Potion", prompt: "A glowing green poison potion flask with bubbling acid, skull icon, pixel art item." }
      ]}
      onGenerateComplete={onGenerateComplete}
      extraControls={controls}
      onSaveCloud={saveToCloud}
      renderOutput={renderOutput}
    />
  );
}

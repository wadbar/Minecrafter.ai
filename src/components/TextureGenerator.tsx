import React, { useState, useCallback, useMemo, useRef, useEffect } from "react";
import GeneratorLayout from "./GeneratorLayout";
import { Loader2, Maximize, Layout, Wand2, Grid3X3, Image as ImageIcon, Mic, ChevronLeft, ChevronRight, BookOpen, RotateCcw, RotateCw, Cloud, Download, Trash2 } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "sonner";
import { saveArtifact } from "../lib/db";
import { cn } from "../lib/utils";
import { usePersistentHistory } from "../hooks/usePersistentHistory";

const PIXEL_ART_PRESETS = [
  { label: "16x16 (Classic)", w: 16, h: 16 },
  { label: "32x32 (HD)", w: 32, h: 32 },
  { label: "64x64 (Ultra)", w: 64, h: 64 }
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
  const { history, addHistory, removeHistory } = usePersistentHistory('texture');
  const [width, setWidth] = useState(16);
  const [height, setHeight] = useState(16);
  const [aspectRatio, setAspectRatio] = useState("1:1");
  const [activeTab, setActiveTab] = useState<"generate" | "history">("generate");
  const [showDocs, setShowDocs] = useState(false);
  
  const [undoStack, setUndoStack] = useState<string[]>([]);
  const [redoStack, setRedoStack] = useState<string[]>([]);
  const [currentImage, setCurrentImage] = useState("");

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
        body: JSON.stringify({ prompt: finalPrompt, width, height, aspectRatio }),
      });
      if (!res.ok) throw new Error("API Failure");
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      
      if (data.result) {
        addHistory(prompt, data.result, { width, height, aspectRatio });
      }
      
      return data.result || "";
    } catch (e) {
      toast.info("Processamento Local Ativado", { description: "Gerando textura procedural offline." });
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

  const saveToCloud = useCallback(async (title: string, result: string) => {
    const tId = toast.loading("Arquivando Textura...");
    try {
      await saveArtifact("texture", title, result);
      toast.success("Arquivado com sucesso", { id: tId });
    } catch (e: any) {
      toast.error("Erro ao arquivar", { id: tId, description: e.message });
    }
  }, []);

  const controls = useMemo(() => (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-4 text-m3-on-surface-variant font-mono text-xs">
        <div className="flex items-center gap-2" title="Resolução da textura">
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
          <label className="mr-1 text-[9px] uppercase font-black opacity-50">Manual:</label>
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
          <span className="text-[10px] font-black uppercase tracking-widest hidden sm:inline">Voz</span>
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-4 text-m3-on-surface-variant font-mono text-xs">
        <div className="flex items-center gap-2">
          <Layout className="w-4 h-4 text-m3-secondary" />
          <span className="uppercase tracking-widest font-black text-[10px]">Proporção:</span>
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
               onClick={() => {
                 const a = document.createElement("a");
                 a.href = currentImage;
                 a.download = `textura_${Date.now()}.png`;
                 a.click();
               }}
               className="p-2 text-m3-primary hover:bg-m3-primary/10 rounded-full transition-colors"
               title="Baixar PNG"
             >
               <Download className="w-4 h-4" />
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
          Docum.
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
               <Wand2 className="w-4 h-4 text-m3-primary" /> Motor_Texturas_V3
             </h4>
             <p className="mb-3 italic opacity-80">Use "pixel art" para resultados clássicos ou "4k hyper-realistic" para texturas modernas.</p>
             <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-3 bg-m3-surface-container-low rounded-2xl border border-m3-outline-variant">
                  <span className="text-m3-primary font-black uppercase text-[9px] block mb-1">Simetria (Seamless)</span>
                  Garante que a textura se repita sem emendas visíveis.
                </div>
                <div className="p-3 bg-m3-surface-container-low rounded-2xl border border-m3-outline-variant">
                  <span className="text-m3-secondary font-black uppercase text-[9px] block mb-1">Mapa de Relevo (Normal)</span>
                  Define profundidade e interações de luz realistas.
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
        <p className="text-m3-primary font-black text-[11px] tracking-[0.4em] uppercase animate-in fade-in slide-in-from-bottom-2">Sintetizando_Buffer</p>
        <p className="text-m3-on-surface-variant/60 font-mono text-[10px]">Calculando UV-Maps & Difusão Neural...</p>
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
              <img 
                src={finalResult} 
                alt="Resultado da Geração" 
                className="max-w-full max-h-[50vh] object-contain shadow-2xl rounded-2xl" 
                style={{ imageRendering: 'pixelated' }} 
              />
              
              <div className="absolute -top-4 -left-4 z-20">
                <div className="bg-m3-primary text-m3-on-primary shadow-m3-2 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border-2 border-m3-surface">
                  ID: {Math.random().toString(16).substr(2, 6).toUpperCase()}
                </div>
              </div>
            </div>
          </motion.div>
          
          <div className="flex items-center gap-6 bg-m3-surface-container-low border border-m3-outline-variant p-4 px-8 rounded-full shadow-m3-2">
            <div className="flex flex-col items-center">
               <span className="text-[9px] text-m3-on-surface-variant font-black uppercase tracking-widest opacity-50">Resolução</span>
               <span className="text-sm font-black text-m3-on-surface tracking-widest">{width}×{height}</span>
            </div>
            <div className="w-px h-8 bg-m3-outline-variant" />
            <div className="flex flex-col items-center">
               <span className="text-[9px] text-m3-on-surface-variant font-black uppercase tracking-widest opacity-50">Formato</span>
               <span className="text-sm font-black text-m3-secondary tracking-widest">{aspectRatio}</span>
            </div>
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
            Gerador
          </button>
          <button 
            onClick={() => setActiveTab("history")}
            className={cn(
              "px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all",
              activeTab === "history" ? "bg-m3-primary text-m3-on-primary shadow-m3-1" : "text-m3-on-surface-variant hover:bg-m3-surface-variant"
            )}
          >
            Histórico ({history.length})
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
                Nenhum fragmento de memória detectado.
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
                  Pronto para distribuição neural. Selecione um alvo vetorial ou descreva sua visão.
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
                {GALLERY_IMAGES.map((img, i) => (
                  <motion.div 
                    key={i} 
                    className="min-w-[320px] snap-center group relative bg-m3-surface-container border border-m3-outline-variant rounded-[2.5rem] overflow-hidden hover:border-m3-primary/30 transition-all cursor-pointer shadow-m3-2"
                    onClick={() => window.dispatchEvent(new CustomEvent('set-builder-prompt', { detail: img.prompt }))}
                  >
                      <div className="aspect-square flex items-center justify-center p-12 relative overflow-hidden bg-gradient-to-br from-m3-primary/5 to-transparent">
                        <Grid3X3 className="w-24 h-24 text-m3-on-surface-variant absolute -bottom-6 -right-6 opacity-5 transition-transform group-hover:scale-125 group-hover:rotate-12 duration-1000" />
                        <div className="relative z-10 w-20 h-20 bg-m3-surface-container-highest rounded-3xl flex items-center justify-center border border-m3-outline-variant shadow-m3-1 group-hover:border-m3-primary/50 transition-colors">
                          <ImageIcon className="w-10 h-10 text-m3-on-surface-variant group-hover:text-m3-primary transition-all duration-700 group-hover:scale-110" />
                        </div>
                        <div className="absolute top-8 left-8 text-[10px] font-black text-m3-on-surface-variant uppercase tracking-[0.2em] opacity-40">{img.type}</div>
                      </div>
                      <div className="p-8 border-t border-m3-outline-variant bg-m3-surface-container-low/50">
                        <p className="text-[11px] text-m3-on-surface-variant/70 font-bold italic leading-relaxed group-hover:text-m3-on-surface transition-colors">"{img.prompt}"</p>
                      </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }, [width, height, aspectRatio, currentImage, renderLoading, scroll, activeTab, history, removeHistory]);

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
      extraControls={controls}
      onSaveCloud={saveToCloud}
      renderOutput={renderOutput}
    />
  );
}

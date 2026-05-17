import React, { useState, useCallback, useMemo, useRef } from "react";
import GeneratorLayout from "./GeneratorLayout";
import { Loader2, Maximize, Layout, Wand2, Grid3X3, Image as ImageIcon, Mic, ChevronLeft, ChevronRight, BookOpen } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "sonner";
import { saveArtifact } from "../lib/db";
import { cn } from "../lib/utils";

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

  const applyPreset = useCallback((w: number, h: number) => {
    setWidth(w);
    setHeight(h);
    setAspectRatio("1:1"); // Force 1:1 on explicit presets
  }, []);

  const handleSaveCloud = useCallback(async (title: string, result: string) => {
    await saveArtifact("texture", title, result);
  }, []);

  const controls = useMemo(() => (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-4 text-neutral-400 font-mono text-xs">
        <div className="flex items-center gap-2">
          <Maximize className="w-4 h-4 text-emerald-500" />
          <span className="uppercase tracking-widest font-bold">Res:</span>
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
          <label className="mr-1">W:</label>
          <input 
            type="number" 
            min={1}
            max={2048}
            value={width} 
            onChange={e => setWidth(Math.max(1, Math.min(2048, Number(e.target.value))))}
            className="bg-neutral-900 border border-neutral-700 rounded px-2 py-1 w-16 text-white focus:border-emerald-500 focus:outline-none"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="mr-1">H:</label>
          <input 
            type="number" 
            min={1}
            max={2048}
            value={height} 
            onChange={e => setHeight(Math.max(1, Math.min(2048, Number(e.target.value))))}
            className="bg-neutral-900 border border-neutral-700 rounded px-2 py-1 w-16 text-white focus:border-emerald-500 focus:outline-none"
          />
        </div>

        <button
          onClick={() => window.dispatchEvent(new CustomEvent('trigger-matrix-mic'))}
          className="ml-auto flex items-center gap-2 px-3 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 border border-emerald-500/20 rounded-md transition-all active:scale-95 group"
          title="Dictate prompt via microphone"
        >
          <Mic className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
          <span className="text-[10px] font-black uppercase tracking-widest hidden sm:inline">Dictate_AI</span>
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-4 text-neutral-400 font-mono text-xs mt-1">
        <div className="flex items-center gap-2">
          <Layout className="w-4 h-4 text-sky-500" />
          <span className="uppercase tracking-widest font-bold">Aspect:</span>
        </div>
        <div className="flex gap-2">
          {ASPECT_RATIOS.map((ar) => (
            <button
              key={ar.value}
              onClick={() => setAspectRatio(ar.value)}
              className={cn(
                "px-2 py-1 rounded border text-[10px] font-bold transition-all",
                aspectRatio === ar.value
                  ? "bg-sky-500/20 text-sky-400 border-sky-500/50"
                  : "bg-neutral-900 border-neutral-700 hover:border-neutral-500"
              )}
            >
              {ar.label}
            </button>
          ))}
        </div>

        {/* Documentation Toggle */}
        <button 
          onClick={() => setShowDocs(!showDocs)}
          className={cn(
            "ml-auto flex items-center gap-2 p-1.5 px-3 rounded-lg border transition-colors",
            showDocs 
              ? "bg-sky-500/20 border-sky-500/50 text-sky-400" 
              : "bg-neutral-900/50 border-neutral-800 text-neutral-400 hover:bg-neutral-800"
          )}
        >
          <BookOpen className="w-3.5 h-3.5" />
          <span className="uppercase tracking-widest font-bold text-[10px]">Doc & Rules</span>
        </button>
      </div>

      {showDocs && (
        <div className="bg-neutral-900/50 border border-neutral-800 p-4 rounded-lg text-xs text-neutral-400 leading-relaxed animate-in fade-in slide-in-from-top-2 mt-2">
          <h4 className="text-emerald-400 font-bold mb-3 uppercase tracking-widest flex items-center gap-2">
            <BookOpen className="w-4 h-4" /> 
            Texture Generation & PBR Guidelines
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <div>
                <strong className="text-white block mb-1">Pixel Art vs HD</strong> 
                By default, low resolutions (16x16 or 32x32) will try to render in a distinct pixel art style. HD resolutions will lean towards realistic or stylized hand-painted looks. Include terms like "pixel art, 16bit, sega" or "PBR, photorealistic" in your prompt.
              </div>
              <div>
                <strong className="text-white block mb-1">Seamless Textures</strong> 
                If you are creating Blocks (e.g. grass, dirt, stone), add the keyword <code>"seamless tile"</code> or <code>"repeating pattern"</code> to ensure the edges match when the block is placed repeatedly.
              </div>
            </div>
            <div>
              <strong className="text-white block mb-1">PBR (Physically Based Rendering) Properties:</strong> 
              <ul className="list-none space-y-2 mt-2">
                <li className="flex gap-2"><span className="text-sky-500">Albedo (Color)</span> The base texture without any lighting or shadows baked in. Provide pure colors.</li>
                <li className="flex gap-2"><span className="text-sky-500">Normal Map</span> Specifies the bumpiness. Describe it with keywords like "deep grooves, raised edges, bumpy".</li>
                <li className="flex gap-2"><span className="text-sky-500">Roughness</span> Defines how matte or shiny it is. "Glossy, wet, polished" vs "matte, dusty, dry".</li>
                <li className="flex gap-2"><span className="text-sky-500">Emission</span> Specifies glowing parts. Uses keywords like "glowing core, neon, luminescent".</li>
              </ul>
            </div>
          </div>
          
          {/* Recommended Keywords */}
          <div className="mt-4 pt-4 border-t border-neutral-800">
            <strong className="text-white block mb-2">⚡ Recommended Keywords:</strong>
            <div className="flex flex-wrap gap-2">
              {[
                { term: "seamless tile", type: "block" },
                { term: "repeating pattern", type: "block" },
                { term: "pixel art", type: "style" },
                { term: "hand-painted", type: "style" },
                { term: "PBR", type: "tech" },
                { term: "photorealistic", type: "tech" },
                { term: "isometric", type: "perspective" },
                { term: "top-down", type: "perspective" },
                { term: "rough", type: "material" },
                { term: "glossy", type: "material" },
                { term: "glowing", type: "material" }
              ].map((k, i) => (
                <span 
                  key={i} 
                  className={cn(
                    "px-2 py-1 rounded text-[10px] font-mono",
                    k.type === "block" && "bg-amber-500/20 text-amber-400 border border-amber-500/30",
                    k.type === "style" && "bg-purple-500/20 text-purple-400 border border-purple-500/30",
                    k.type === "tech" && "bg-sky-500/20 text-sky-400 border border-sky-500/30",
                    k.type === "perspective" && "bg-blue-500/20 text-blue-400 border border-blue-500/30",
                    k.type === "material" && "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                  )}
                >
                  {k.term}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  ), [applyPreset, width, height, aspectRatio, showDocs]);

  const renderLoading = useCallback(() => (
    <div className="flex flex-col items-center justify-center min-h-[350px] space-y-6">
      <div className="relative">
        <div className="w-24 h-24 rounded-lg bg-neutral-900 border-2 border-emerald-500/20 animate-pulse overflow-hidden flex items-center justify-center relative shadow-[0_0_15px_rgba(16,185,129,0.2)]">
          <Grid3X3 className="w-8 h-8 text-neutral-800 absolute opacity-50" />
          <div className="absolute inset-0 bg-gradient-to-tr from-emerald-500/10 to-transparent animate-spin" style={{ animationDuration: '3s' }} />
        </div>
        <div className="absolute -inset-1 border border-emerald-500/30 rounded-xl animate-pulse" style={{ animationDelay: '200ms' }} />
      </div>
      <div className="text-center space-y-2">
        <p className="text-emerald-400 font-mono text-xs font-bold tracking-widest uppercase">
          Synthesizing Pixels...
        </p>
        <p className="text-neutral-500 font-mono text-[10px]">
          Applying structural maps & color grading
        </p>
        <div className="w-32 h-1 bg-neutral-900 rounded-full mx-auto overflow-hidden">
          <div className="h-full bg-emerald-500 rounded-full w-1/3 animate-[slide_1.5s_ease-in-out_infinite_alternate]" />
        </div>
      </div>
    </div>
  ), []);

  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = useCallback((direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const { scrollLeft, clientWidth } = scrollRef.current;
      const scrollTo = direction === 'left' ? scrollLeft - clientWidth / 2 : scrollLeft + clientWidth / 2;
      scrollRef.current.scrollTo({ left: scrollTo, behavior: 'smooth' });
    }
  }, []);

  const renderOutput = useCallback((result: string, isGenerating: boolean) => {
    if (isGenerating) return null; // handled by renderLoading
    
    if (result && result.startsWith("data:image")) {
      return (
        <div className="flex flex-col items-center justify-center p-8 gap-6 h-full">
          <img 
            src={result} 
            alt="Gerado pela IA" 
            className="shadow-[0_0_30px_rgba(0,0,0,0.5)] rounded bg-neutral-900/50 p-4 border border-neutral-700 max-w-full max-h-[60vh] object-contain" 
            style={{ imageRendering: 'pixelated' }} 
            onError={(e) => {
              (e.target as HTMLImageElement).src = 'https://placehold.co/512x512/0a0a0a/emerald?text=Erro+de+Renderizacao';
              toast.error("Erro ao carregar imagem", { description: "Verifique a rede ou tente gerar novamente." });
            }}
          />
          <div className="flex items-center gap-3 bg-neutral-950 px-4 py-2 rounded-full border border-neutral-800 text-neutral-400">
            <Wand2 className="w-4 h-4 text-emerald-500" />
            <span className="font-mono text-[10px] uppercase font-bold tracking-widest">
              {width}x{height} // {aspectRatio}
            </span>
          </div>
        </div>
      );
    }

    if (result) {
      return (
        <div className="text-neutral-400 p-4 font-mono whitespace-pre-wrap">
          {result}
        </div>
      );
    }
    
    // Show gallery empty state since result is empty
    return (
      <div className="flex flex-col items-center justify-center p-8 space-y-12 animate-in fade-in duration-1000">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center p-3 bg-neutral-900 rounded-2xl mb-2">
            <ImageIcon className="w-6 h-6 text-neutral-500" />
          </div>
          <h3 className="text-neutral-300 font-bold tracking-tight">Texture Matrix Ready</h3>
          <p className="text-neutral-500 text-xs max-w-sm font-medium">
            Select your resolution and aspect ratio above, or get inspired by the generation examples below.
          </p>
        </div>
        
        <div className="w-full max-w-5xl relative group/carousel">
           <div className="absolute -left-4 top-1/2 -translate-y-1/2 z-10 opacity-0 group-hover/carousel:opacity-100 transition-opacity">
              <button 
                onClick={() => scroll('left')}
                className="p-2 bg-neutral-900 border border-neutral-800 rounded-full text-white hover:bg-neutral-800 hover:border-emerald-500/50 shadow-xl"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
           </div>

           <div className="absolute -right-4 top-1/2 -translate-y-1/2 z-10 opacity-0 group-hover/carousel:opacity-100 transition-opacity">
              <button 
                onClick={() => scroll('right')}
                className="p-2 bg-neutral-900 border border-neutral-800 rounded-full text-white hover:bg-neutral-800 hover:border-emerald-500/50 shadow-xl"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
           </div>

           <div 
             ref={scrollRef}
             className="flex gap-6 overflow-x-auto pb-8 scrollbar-none snap-x snap-mandatory px-4"
           >
            {GALLERY_IMAGES.map((img, i) => (
              <motion.div 
                key={i} 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.1 }}
                onClick={() => {
                   window.dispatchEvent(new CustomEvent('set-matrix-prompt', { detail: img.prompt }));
                   toast.success("Prompt carregado!", { description: "O exemplo foi injetado no campo de comando." });
                }}
                className="min-w-[280px] snap-center group relative bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden hover:border-emerald-500 transition-all cursor-pointer active:scale-95 shadow-xl"
              >
                  <div className="aspect-square bg-neutral-950 flex flex-col items-center justify-center border-b border-neutral-800 p-8 relative overflow-hidden">
                    <div className="absolute inset-0 bg-emerald-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="text-[8px] font-mono font-black text-neutral-800 absolute top-4 left-4 uppercase tracking-[0.2em]">{img.type}_MOD_ARC</div>
                    
                    <div className="relative transform group-hover:scale-110 transition-transform duration-500">
                       <Grid3X3 className="w-16 h-16 text-neutral-800 group-hover:text-emerald-500/20 transition-colors" />
                       <div className="absolute inset-0 flex items-center justify-center">
                          <ImageIcon className="w-6 h-6 text-neutral-900 opacity-0 group-hover:opacity-100 transition-opacity" />
                       </div>
                    </div>
                  </div>
                  <div className="p-5 bg-black/40 backdrop-blur-sm">
                    <p className="text-[11px] text-neutral-400 font-mono line-clamp-2 leading-relaxed italic group-hover:text-neutral-200 transition-colors">
                      "{img.prompt}"
                    </p>
                    <div className="mt-4 h-[2px] w-0 bg-emerald-500 group-hover:w-full transition-all duration-500" />
                  </div>
              </motion.div>
            ))}
           </div>
        </div>
      </div>
    );
  }, [width, height, aspectRatio, scroll]);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <GeneratorLayout
        title="Forja de Texturas & Skins"
        description="Gere texturas experimentais para blocos e itens com alta personalização."
        placeholder="Ex: Uma espada de diamante em chamas..."
        promptTemplates={[
          { label: "⚔️ Espada Congelante", prompt: "A frozen battle axe made of pure jagged ice, glowing blue aura, pixel art game asset." },
          { label: "🧱 Bloco do Void", prompt: "A solid block made of starlight and purple void energy, seamless tile, minecraft texture block." },
          { label: "🧪 Poção de Veneno", prompt: "A glowing green poison potion flask with bubbling acid, skull icon, pixel art item." },
          { label: "🔮 Orbe Corrompido", prompt: "A highly detailed demonic orb with red glowing cracks, pixel art asset." }
        ]}
        endpointType=""
        onGenerate={generateTexture}
        extraControls={controls}
        onSaveCloud={handleSaveCloud}
        renderLoading={renderLoading}
        renderOutput={renderOutput}
      />
    </div>
  );
}

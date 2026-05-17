import React, { useState, useMemo } from "react";
import GeneratorLayout from "./GeneratorLayout";
import { Download as DownloadIcon, Accessibility, Monitor, User, BookOpen } from "lucide-react";
import SkinViewer3D from "./SkinViewer3D";
import { saveAs } from "file-saver";
import { toast } from "sonner";
import { saveArtifact } from "../lib/db";
import { cn } from "../lib/utils";

export default function SkinGenerator() {
  const [modelType, setModelType] = useState<"classic" | "slim">("classic");
  const [autoRotate, setAutoRotate] = useState(true);
  const [showDocs, setShowDocs] = useState(false);

  const generateSkin = async (prompt: string) => {
    const res = await fetch("/api/generate-skin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, modelType }),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    
    return data.result;
  };

  const handleDownload = (imgUrl: string) => {
    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const img = new Image();
    
    img.onload = () => {
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, 0, 0, 64, 64);
      
      canvas.toBlob((blob) => {
        if (blob) {
          saveAs(blob, `skin_${modelType}_matrix.png`);
          toast.success("Skin exportada com sucesso!", { description: `Modelo ${modelType} 64x64 pronto.` });
        }
      });
    };
    img.src = imgUrl;
  };

  const extraControls = useMemo(() => (
    <div className="flex flex-col w-full gap-2 text-neutral-400 font-mono text-[10px]">
      <div className="flex flex-wrap items-center gap-4">
         <div className="flex items-center gap-2 bg-neutral-900 px-3 py-1.5 rounded-lg border border-neutral-800">
           <Accessibility className="w-3.5 h-3.5 text-emerald-500" />
           <span className="font-bold uppercase tracking-widest text-neutral-500">Physique</span>
           <div className="flex gap-1 ml-2">
             <button 
               onClick={() => setModelType("classic")}
               className={cn(
                 "px-2 py-1 rounded transition-all",
                 modelType === "classic" ? "bg-emerald-500/20 text-emerald-500 border border-emerald-500/30" : "hover:text-white"
               )}
             >
               CLASSIC
             </button>
             <button 
               onClick={() => setModelType("slim")}
               className={cn(
                 "px-2 py-1 rounded transition-all",
                 modelType === "slim" ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "hover:text-white"
               )}
             >
               SLIM
             </button>
           </div>
         </div>

         <div className="flex items-center gap-2 bg-neutral-900 px-3 py-1.5 rounded-lg border border-neutral-800">
           <Monitor className="w-3.5 h-3.5 text-sky-500" />
           <span className="font-bold uppercase tracking-widest text-neutral-500">Render</span>
           <button 
              onClick={() => setAutoRotate(!autoRotate)}
              className={cn(
                "px-2 py-1 rounded transition-all ml-2",
                autoRotate ? "bg-sky-500/20 text-sky-400 border border-sky-500/30" : "hover:text-white"
              )}
           >
             AUTO_ROTATE: {autoRotate ? "ON" : "OFF"}
           </button>
         </div>

         {/* Documentation Toggle */}
         <button 
            onClick={() => setShowDocs(!showDocs)}
            className={cn(
              "ml-auto flex items-center gap-2 p-1.5 px-3 rounded-lg border transition-colors",
              showDocs 
                ? "bg-purple-500/20 border-purple-500/50 text-purple-400" 
                : "bg-neutral-900/50 border-neutral-800 text-neutral-400 hover:bg-neutral-800"
            )}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span className="uppercase tracking-widest font-bold text-[10px]">Styles & Keywords</span>
          </button>
      </div>

      {showDocs && (
        <div className="bg-neutral-900/50 border border-neutral-800 p-4 rounded-lg text-xs text-neutral-400 leading-relaxed animate-in fade-in slide-in-from-top-2 mt-2">
          <h4 className="text-purple-400 font-bold mb-3 uppercase tracking-widest flex items-center gap-2">
            <BookOpen className="w-4 h-4" /> 
            Skin Generation Keyword Guide
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <div>
                <strong className="text-white block mb-1">Cyberpunk & Sci-Fi</strong> 
                Use keywords like <code>cybernetic implants</code>, <code>neon green glowing visor</code>, <code>tactical exoskeleton</code>, <code>holographic details</code> to get high-tech looks.
                <div className="mt-2 text-neutral-500 bg-neutral-950/50 p-2 rounded">
                  <span className="text-purple-500/70 font-semibold mb-1 block uppercase text-[9px] tracking-widest">Example Prompt</span>
                  "A futuristic netrunner with a glowing blue visor, chrome robotic arm, and glowing tactical jacket"
                </div>
              </div>
              <div>
                <strong className="text-white block mb-1">Fantasy & Medieval</strong> 
                Try words like <code>corrupted dark knight</code>, <code>elven ranger cloak</code>, <code>gilded golden armor</code>, <code>mystical runes</code>.
                <div className="mt-2 text-neutral-500 bg-neutral-950/50 p-2 rounded">
                  <span className="text-purple-500/70 font-semibold mb-1 block uppercase text-[9px] tracking-widest">Example Prompt</span>
                  "An ancient elven druid wearing green mossy robes, glowing emerald eyes, and antler crown"
                </div>
              </div>
            </div>
            <div>
               <strong className="text-white block mb-1">Other Styles:</strong> 
               <ul className="list-none space-y-3 mt-2">
                  <li className="flex flex-col gap-1">
                    <div className="flex gap-2"><span className="text-purple-500 font-bold">Retro Sci-fi</span> Space suits, bubble helmets, orange stripes, 80s aesthetics.</div>
                    <div className="text-[10px] text-neutral-500 italic">Ex: "1980s astronaut with orange and white spacesuit, gold mirrored visor"</div>
                  </li>
                  <li className="flex flex-col gap-1">
                    <div className="flex gap-2"><span className="text-purple-500 font-bold">Steampunk</span> Brass goggles, leather coats, clockwork limbs, top hats.</div>
                    <div className="text-[10px] text-neutral-500 italic">Ex: "Victorian inventor with brass goggles, leather longcoat, and mechanical arm"</div>
                  </li>
                  <li className="flex flex-col gap-1">
                    <div className="flex gap-2"><span className="text-purple-500 font-bold">Streetwear</span> Oversized hoodies, high-top sneakers, chains, masks.</div>
                    <div className="text-[10px] text-neutral-500 italic">Ex: "Urban skater wearing oversized black hoodie, gold chains, and oni mask"</div>
                  </li>
               </ul>
            </div>
          </div>
          
          <div className="mt-4 pt-4 border-t border-neutral-800">
            <strong className="text-white block mb-2">⚡ Recommended Keywords for Detail:</strong>
            <div className="flex flex-wrap gap-2">
              {[
                "glowing eyes", "hooded", "tattered cape", "metallic plates", 
                "goggles", "masked", "horns", "cyborg", "demon", "angelic", 
                "tactical belt", "puffer jacket", "robotic arm", "undead"
              ].map((k, i) => (
                <span 
                  key={i} 
                  className="px-2 py-1 rounded text-[10px] font-mono bg-purple-500/20 text-purple-400 border border-purple-500/30"
                >
                  {k}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  ), [modelType, autoRotate, showDocs]);

  return (
    <GeneratorLayout
      title="Skin Forge 3D"
      description="Geração instantânea de Skins 64x64 por Inteligência Artificial com preview 3D."
      placeholder="Ex: Um cavaleiro sombrio com armadura de ouro místico e capa rasgada..."
      promptTemplates={[
        { label: "🥷 Ninja Cyberpunk", prompt: "A futuristic cyberpunk ninja with glowing neon green visor, dark tactical suit, metallic armor plates." },
        { label: "🤴 Rei Decaído", prompt: "A corrupted undead king with a broken crown, skeletal face, tattered crimson cape, dark iron armor." },
        { label: "👩‍🚀 Astronauta Retrô", prompt: "A retro sci-fi space explorer, white suit with orange stripes, gold tinted helmet visor." }
      ]}
      endpointType=""
      extraControls={extraControls}
      onGenerate={generateSkin}
      onSaveCloud={async (title, result) => await saveArtifact("skin", title, result)}
      renderOutput={(result, isGenerating) => {
        if (isGenerating || !result) return null;

        if (!result.startsWith("data:image")) {
            return (
                <div className="text-red-400 p-4 border border-red-500/20 bg-red-500/10 rounded-lg">
                    Formato inesperado gerado pela IA. Tente reescrever o prompt. (Erro de pipeline)
                </div>
            );
        }

        return (
          <div className="flex flex-col md:flex-row gap-12 items-center justify-center p-8 w-full h-full max-w-5xl mx-auto animate-in fade-in zoom-in duration-500">
            {/* 3D Interactive Viewer */}
            <div className="flex-1 flex flex-col items-center justify-center gap-6 w-full">
               <div className="flex items-center gap-3 bg-neutral-900/50 px-4 py-2 rounded-full border border-neutral-800 text-emerald-400 font-mono text-[10px] tracking-[0.2em] font-bold uppercase">
                  <User className="w-4 h-4" /> Logic_Model: {modelType}
               </div>
               <div className="relative group">
                 <div className="absolute -inset-4 bg-emerald-500/5 blur-2xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
                 <SkinViewer3D skinUrl={result} />
               </div>
               <button
                 onClick={() => handleDownload(result)}
                 className="flex items-center gap-3 px-8 py-3 bg-emerald-600 hover:bg-emerald-500 active:scale-95 transition-all rounded-xl text-white font-bold text-xs uppercase tracking-widest shadow-[0_0_20px_rgba(16,185,129,0.2)] border border-emerald-400/20"
               >
                 <DownloadIcon className="w-4 h-4" />
                 Download PNG
               </button>
            </div>

            {/* Flat Texture & Exporter */}
            <div className="flex-1 flex flex-col items-center justify-center gap-8 w-full">
              <div className="space-y-2 text-center">
                <h3 className="text-neutral-500 font-mono text-[10px] tracking-widest uppercase font-bold">UV_Map_Matrix</h3>
                <p className="text-[10px] text-neutral-700 font-mono">64x64 PIXEL_OUTPUT</p>
              </div>
              
              <div className="relative p-1 bg-neutral-800 rounded-xl shadow-2xl border border-neutral-700/50">
                <div 
                  className="w-56 h-56 bg-neutral-950 rounded-lg overflow-hidden"
                  style={{
                    backgroundImage: `url("${result}")`,
                    backgroundSize: '100% 100%',
                    backgroundRepeat: 'no-repeat',
                    imageRendering: 'pixelated'
                  }}
                />
                <div className="absolute -top-3 -right-3 w-8 h-8 bg-emerald-500 rounded-full flex items-center justify-center border-4 border-neutral-950 text-white font-bold text-[10px]">
                  OK
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4 w-full max-w-[280px]">
                <div className="p-4 bg-neutral-900/50 border border-neutral-800 rounded-xl text-center">
                  <div className="text-neutral-600 text-[8px] font-bold uppercase mb-1">Depth</div>
                  <div className="text-emerald-500 font-mono text-xs">8-BIT</div>
                </div>
                <div className="p-4 bg-neutral-900/50 border border-neutral-800 rounded-xl text-center">
                  <div className="text-neutral-600 text-[8px] font-bold uppercase mb-1">Color</div>
                  <div className="text-emerald-500 font-mono text-xs">RGBA</div>
                </div>
              </div>
            </div>
          </div>
        );
      }}
    />
  );
}

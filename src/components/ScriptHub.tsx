import React, { useState, useCallback, useRef, useEffect } from "react";
import GeneratorLayout from "./GeneratorLayout";
import { Terminal, Copy, Download, Zap, Play, Trash2, Save, FileCode, Bot, Cpu, Loader2, RotateCcw, RotateCw, Cloud } from "lucide-react";
import { toast } from "sonner";
import { cn } from "../lib/utils";
import { saveArtifact } from "../lib/db";
import { auth } from "../lib/firebase";

interface SavedScript {
  id: string;
  name: string;
  code: string;
  type: string;
  timestamp: number;
}

export default function ScriptHub() {
  const [scriptType, setScriptType] = useState("Mineflayer");
  const [savedScripts, setSavedScripts] = useState<SavedScript[]>([]);
  const [undoStack, setUndoStack] = useState<string[]>([]);
  const [redoStack, setRedoStack] = useState<string[]>([]);
  const [currentCode, setCurrentCode] = useState("");

  useEffect(() => {
    const stored = localStorage.getItem("saved-scripts");
    if (stored) setSavedScripts(JSON.parse(stored));
  }, []);

  const saveScriptLocal = (result: string, prompt: string) => {
    if (!result) return;
    const name = prompt?.slice(0, 20) || "Script_" + Date.now();
    const newScript: SavedScript = {
      id: Math.random().toString(36).substr(2, 9),
      name: name.trim() + (name.length >= 20 ? "..." : ""),
      code: result,
      type: scriptType,
      timestamp: Date.now()
    };
    const updated = [newScript, ...savedScripts].slice(0, 10);
    setSavedScripts(updated);
    localStorage.setItem("saved-scripts", JSON.stringify(updated));
    toast.success("Script Arquivado Localmente");
  };

  const saveToCloud = async (result: string, prompt: string) => {
    if (!result) return toast.error("Sem código para salvar");
    if (!auth.currentUser) return toast.error("Login necessário para Cloud Vault");

    const tId = toast.loading("Arquivando Script na Nuvem...");
    try {
      const name = prompt?.slice(0, 40) || "AutoScript_" + Date.now();
      await saveArtifact("mod", `Script: ${name}`, result);
      toast.success("Arquivado no Cloud Vault", { id: tId });
    } catch (e: any) {
      toast.error("Erro no Cloud Vault", { id: tId, description: e.message });
    }
  };

  const onGenerateComplete = (result: string) => {
    if (currentCode) {
      setUndoStack(prev => [currentCode, ...prev].slice(0, 20));
    }
    setRedoStack([]);
    setCurrentCode(result);
  };

  const undo = () => {
    if (undoStack.length === 0) return;
    const prev = undoStack[0];
    setRedoStack(r => [currentCode, ...r]);
    setCurrentCode(prev);
    setUndoStack(u => u.slice(1));
  };

  const redo = () => {
    if (redoStack.length === 0) return;
    const next = redoStack[0];
    setUndoStack(u => [currentCode, ...u]);
    setCurrentCode(next);
    setRedoStack(r => r.slice(1));
  };

  const sidebar = (
    <div className="flex flex-col gap-6">
      <div className="space-y-4">
        <div>
          <label className="text-[10px] font-black uppercase tracking-widest text-neutral-500 mb-2 block">Motor de Linguagem</label>
          <div className="grid grid-cols-2 gap-2">
            {["Mineflayer", "Skript", "CommandBlock", "JSON_Model"].map((type) => (
              <button
                key={type}
                onClick={() => setScriptType(type)}
                className={cn(
                  "px-3 py-2 rounded-lg border text-[9px] font-bold uppercase transition-all text-center",
                  scriptType === type 
                    ? "bg-emerald-500/10 border-emerald-500/50 text-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.2)]" 
                    : "bg-neutral-900 border-neutral-800 text-neutral-500 hover:border-neutral-700 hover:text-neutral-300"
                )}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        {/* Action Buttons for current code */}
        {currentCode && (
           <div className="grid grid-cols-2 gap-2 mt-4">
              <button 
                onClick={() => saveToCloud(currentCode, "")}
                className="flex items-center justify-center gap-2 px-3 py-2 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-emerald-500 text-[9px] font-black uppercase hover:bg-emerald-500 hover:text-black transition-all"
              >
                <Cloud className="w-3.5 h-3.5" /> Cloud Save
              </button>
              <button 
                onClick={() => {
                  const blob = new Blob([currentCode], { type: "text/plain" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `script_${Date.now()}.txt`;
                  a.click();
                }}
                className="flex items-center justify-center gap-2 px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-300 text-[9px] font-black uppercase hover:bg-neutral-700 transition-all"
              >
                <Download className="w-3.5 h-3.5" /> Download
              </button>
           </div>
        )}
        
        <div>
          <label className="text-[10px] font-black uppercase tracking-widest text-neutral-500 mb-2 block">Parâmetros de Injeção</label>
          <div className="space-y-3 bg-neutral-900/50 p-3 rounded-xl border border-neutral-800/50">
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-bold text-neutral-500 uppercase">Auto-Clean</span>
              <div className="w-8 h-4 bg-emerald-500/20 rounded-full relative p-0.5" title="Habilitado">
                <div className="w-3 h-3 bg-emerald-500 rounded-full shadow-[0_0_5px_rgba(16,185,129,1)] translate-x-4" />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-bold text-neutral-500 uppercase">Verbosity</span>
              <div className="w-8 h-4 bg-neutral-800 rounded-full relative p-0.5" title="Desabilitado" />
            </div>
          </div>
        </div>
      </div>

      <div className="pt-4 border-t border-neutral-800/50">
        <div className="flex items-center gap-2 mb-4">
          <Terminal className="w-4 h-4 text-emerald-500" />
          <span className="text-[10px] font-black uppercase tracking-widest text-neutral-300">Script_Archive_Local</span>
        </div>
        <div className="space-y-2">
          {savedScripts.map((s) => (
            <button
              key={s.id}
              onClick={() => {
                onGenerateComplete(s.code);
                toast.info("Código Restaurado do Cache Local");
              }}
              className="w-full text-left p-3 rounded-xl bg-neutral-900/30 border border-neutral-800/50 hover:bg-neutral-800/40 transition-all group"
            >
              <div className="flex justify-between items-start mb-1">
                <span className="text-[10px] font-bold text-neutral-200 truncate pr-2">{s.name}</span>
                <span className="text-[8px] font-black text-emerald-500/50 uppercase">{s.type}</span>
              </div>
              <div className="text-[8px] text-neutral-600 font-mono">
                {new Date(s.timestamp).toLocaleDateString()}
              </div>
            </button>
          ))}
          {savedScripts.length === 0 && (
            <div className="text-[10px] text-neutral-700 italic text-center py-4">Arquivo de scripts vazio.</div>
          )}
        </div>
      </div>
    </div>
  );

  const renderOutput = useCallback((result: string, isGenerating: boolean) => {
    const finalResult = isGenerating ? result : currentCode || result;

    if (isGenerating && !finalResult) {
      return (
        <div className="h-64 flex flex-col items-center justify-center gap-4">
          <Loader2 className="w-10 h-10 animate-spin text-emerald-500" />
          <span className="text-[10px] font-black uppercase tracking-[0.3em] text-emerald-500 animate-pulse">Streaming_Service_Data</span>
        </div>
      );
    }

    if (!finalResult && !isGenerating) {
      return (
        <div className="h-64 flex flex-col items-center justify-center text-neutral-700 text-center space-y-4">
          <Bot className="w-16 h-16 opacity-10 mb-2" />
          <div>
            <p className="text-xs font-black uppercase tracking-widest mb-1 italic">Subsystem Idle</p>
            <p className="text-[10px] max-w-sm px-10 text-neutral-500">Aguardando injeção de prompt para materializar automações no buffer local.</p>
          </div>
        </div>
      );
    }

    return (
      <div className="h-full flex flex-col gap-4">
        {/* Output Header */}
        <div className="flex items-center justify-between bg-neutral-900/50 px-4 py-2 rounded-xl border border-neutral-800/50">
          <div className="flex items-center gap-3">
             <div className="flex items-center gap-1.5 px-2 py-0.5 bg-emerald-500/10 text-emerald-500 rounded text-[9px] font-bold uppercase border border-emerald-500/20">
               <Cpu className="w-3 h-3" /> System_Core
             </div>
             <span className="text-[10px] font-mono text-neutral-500 tracking-tighter">
               VIRTUAL_BUFFER: {Math.round(finalResult.length / 1024 * 100) / 100} KB
             </span>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={undo}
              disabled={undoStack.length === 0}
              className="p-1.5 text-neutral-400 hover:text-white transition-colors disabled:opacity-20" 
              title="Desfazer"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button 
              onClick={redo}
              disabled={redoStack.length === 0}
              className="p-1.5 text-neutral-400 hover:text-white transition-colors disabled:opacity-20" 
              title="Refazer"
            >
              <RotateCw className="w-4 h-4" />
            </button>
            <div className="w-px h-4 bg-neutral-800 mx-2" />
            <button 
              onClick={() => {
                navigator.clipboard.writeText(finalResult);
                toast.success("Copiado!", { description: "Buffer transferido para a área de transferência." });
              }}
              className="p-1.5 text-neutral-400 hover:text-white transition-colors" 
              title="Copy Code"
            >
              <Copy className="w-4 h-4" />
            </button>
            <button 
              onClick={() => toast.info("Simulação de Execução iniciada...")}
              className="p-1.5 text-emerald-500 hover:text-emerald-400 transition-colors" 
              title="Execute Local"
            >
              <Play className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 flex-1 min-h-0">
          <div className="lg:col-span-2 relative group flex flex-col">
             <div className="absolute inset-0 bg-emerald-500/5 border border-emerald-500/10 rounded-2xl pointer-events-none group-hover:border-emerald-500/20 transition-all" />
             <pre className="flex-1 p-6 overflow-auto custom-scrollbar font-mono text-sm leading-relaxed text-emerald-400 whitespace-pre-wrap">
               {finalResult}
             </pre>
             <div className="absolute bottom-4 left-4 pointer-events-none text-[8px] font-mono text-emerald-500/30 uppercase">
               Terminal_Output_Ready
             </div>
          </div>

          <div className="bg-black/60 border border-neutral-800 rounded-2xl p-4 font-mono text-[10px] flex flex-col gap-2 overflow-hidden shadow-inner">
             <div className="flex items-center gap-2 text-neutral-500 border-b border-neutral-800 pb-2 mb-2">
                <Terminal className="w-3 h-3" />
                <span className="uppercase font-black text-[9px] tracking-widest">Runtime_Logs</span>
             </div>
             <div className="flex-1 overflow-y-auto space-y-1 custom-scrollbar pr-2">
                <div className="text-emerald-500 font-bold uppercase tracking-widest">[SYSTEM] Core Online.</div>
                <div className="text-neutral-500">[INFO] Connection: Stable</div>
                <div className="text-neutral-500">[INFO] Engine: Automation Core v4.37</div>
                <div className="text-sky-500 font-black">[NET] Port 3000 Ingress Verified.</div>
                <div className="h-px bg-neutral-900 my-2" />
                {isGenerating && (
                  <>
                    <div className="text-amber-500 animate-pulse">[WARN] High execution load...</div>
                    <div className="text-neutral-600">[DEBUG] Buffer Alloc: 512KB</div>
                    <div className="text-neutral-600 font-mono text-[8px]">0x{Math.random().toString(16).substr(2, 8).toUpperCase()} - Writing Chunk...</div>
                  </>
                )}
                {finalResult && !isGenerating && (
                  <div className="text-emerald-500 font-black italic shadow-[0_0_10px_rgba(16,185,129,0.3)]">[DEPLOY_READY] Logic materialized.</div>
                )}
                <div className="text-neutral-800 italic animate-pulse">... monitoring active runtime hooks ...</div>
             </div>
          </div>
        </div>
      </div>
    );
  }, [currentCode, undoStack, redoStack]);

  const promptTemplates = [
    { label: "Bot Minerador", prompt: "Crie um bot Mineflayer que minera diamantes automaticamente na camada Y -59, volta para a superfície quando o inventário encher e guarda em um baú.", description: "Automação completa de coleta e armazenamento." },
    { label: "IA Defender Bot", prompt: "Crie um script para um bot que protege a base. Se detectar mobs hostis em um raio de 10 blocos, ele ataca. Se a vida baixar de 5 corações, ele come maçã dourada.", description: "Segurança reativa com Mineflayer-Pathfinder." },
    { label: "Skript Economia", prompt: "Crie um Skript de economia com comandos /buy, /sell e um sistema de mercado dinâmico baseado no stock do servidor.", description: "Lógica de plugins Bukkit/Paper via Skript." },
  ];

  return (
    <GeneratorLayout
      title="Logic Script Factory"
      description="The Core Logic for bot orchestration and Script automation (Industrial Solutions)."
      placeholder="Injete os parâmetros da automação (ex: Bot AI que segue o dono e defende de creepers)..."
      endpointType="generate-mod"
      renderOutput={renderOutput}
      extraControls={sidebar}
      promptTemplates={promptTemplates}
      onGenerateComplete={onGenerateComplete}
      parameters={{ scriptType }}
      onSaveCloud={async (title, res) => {
        saveScriptLocal(res, title);
        await saveToCloud(res, title);
      }}
    />
  );
}

import React from "react";
import Markdown from "react-markdown";
import { Loader2, CloudUpload } from "lucide-react";
import { cn } from "../lib/utils";
import { toast } from "sonner";
import { useAuth } from "../lib/firebase";

interface GeneratorOutputProps {
  isBusy: boolean;
  activeResult: string;
  chatHistory: { role: string, parts: { text: string }[] }[];
  mode: "create" | "edit";
  renderLoading?: () => React.ReactNode;
  renderOutput?: (result: string, isBusy: boolean) => React.ReactNode;
  promptTemplates?: { label: string, prompt: string, description?: string }[];
  setPrompt: (p: string) => void;
  onSaveCloud?: (title: string, result: string) => Promise<void>;
  isSaving: boolean;
  setIsSaving: (val: boolean) => void;
  getCurrentPrompt: () => string;
}

export default function GeneratorOutput({
  isBusy, activeResult, chatHistory, mode, renderLoading, renderOutput,
  promptTemplates, setPrompt, onSaveCloud, isSaving, setIsSaving, getCurrentPrompt
}: GeneratorOutputProps) {
  const { user, signIn } = useAuth();
  const hasContent = activeResult || isBusy || chatHistory.length > 0;

  return (
    <div className="flex-1 bg-neutral-950/80 border border-neutral-800 rounded-2xl overflow-hidden relative shadow-2xl backdrop-blur-md group">
      <div className="absolute inset-0 bg-emerald-500/5 opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl pointer-events-none" />
      
      {/* Output Telemetry Header */}
      <div className="absolute top-0 left-0 right-0 h-10 px-6 border-b border-neutral-900 bg-black/40 flex items-center justify-between z-20">
         <div className="flex items-center gap-4 text-[9px] font-mono text-neutral-600 uppercase tracking-widest">
            <div className="flex items-center gap-1.5">
               <div className={cn("w-1.5 h-1.5 rounded-full", isBusy ? "bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]" : "bg-neutral-800")} />
               Matrix_Stream: {isBusy ? "Active" : "Idle"}
            </div>
            {activeResult && <div className="hidden lg:block italic">Payload_Size: {(new TextEncoder().encode(activeResult).length / 1024).toFixed(1)}KB</div>}
         </div>
         {activeResult && !isBusy && (
           <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(activeResult);
                  toast.success("Payload copiado para a área de transferência!");
                }}
                className="flex items-center gap-2 h-6 px-3 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-md border border-neutral-700 text-[9px] font-mono font-bold uppercase tracking-wider transition-all"
              >
                Copiar
              </button>
              <button
                onClick={() => {
                  const blob = new Blob([activeResult], { type: 'text/plain' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `matrix-artifact-${Date.now()}.txt`;
                  a.click();
                  URL.revokeObjectURL(url);
                  toast.success("Artifact downloaded successfully.");
                }}
                className="flex items-center gap-2 h-6 px-3 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-md border border-neutral-700 text-[9px] font-mono font-bold uppercase tracking-wider transition-all"
              >
                Baixar
              </button>
             {onSaveCloud && (
              <button
                data-matrix-action="save"
                onClick={async () => {
                  if (!user) {
                    toast.info("Security Barrier", { description: "Authenticate via Identity Provider to enable Cloud Vault features." });
                    await signIn();
                    return;
                  }
                  setIsSaving(true);
                  try {
                    await onSaveCloud(getCurrentPrompt().slice(0, 50) || "Geração", activeResult);
                    toast.success("Artifact stored in Matrix Vault.");
                  } catch (err: any) {
                    toast.error("Vault Failure", { description: err.message });
                  } finally {
                    setIsSaving(false);
                  }
                }}
                disabled={isSaving}
                className="flex items-center gap-2 h-6 px-3 bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-500 rounded-md border border-emerald-500/20 text-[9px] font-mono font-bold uppercase tracking-wider transition-all"
              >
                {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <CloudUpload className="w-3 h-3" />}
                {user ? "Store_Vault" : "Auth_Identity"}
              </button>
             )}
           </div>
         )}
      </div>

      <div className="absolute inset-0 pt-10 overflow-auto custom-scrollbar">
        {hasContent ? (
          <div className="p-8 space-y-12">
             {/* Conversation History */}
             {chatHistory.slice(0, -1).map((msg, i) => (
                <div key={i} className={cn("p-6 rounded-2xl border font-mono text-xs", msg.role === "user" ? "bg-neutral-900/30 border-neutral-800 ml-12 text-neutral-400" : "bg-neutral-950 border-neutral-900 mr-12 text-neutral-300")}>
                    <div className="flex items-center gap-2 mb-4 opacity-50">
                       <div className={cn("w-1.5 h-1.5 rounded-full", msg.role === "user" ? "bg-blue-500" : "bg-emerald-500")} />
                       <span className="uppercase tracking-widest font-bold">{msg.role === "user" ? "Input_Archive" : "Matrix_Response"}</span>
                    </div>
                    <div className="prose prose-invert prose-xs max-w-none">
                      <Markdown>{msg.parts[0].text}</Markdown>
                    </div>
                </div>
             ))}

             {/* Current Output */}
             <div className="text-neutral-300 font-mono text-xs leading-relaxed">
               {isBusy && !activeResult ? (
                 renderLoading ? renderLoading() : (
                 <div className="flex flex-col items-center justify-center min-h-[300px] text-neutral-500 space-y-6">
                   <Loader2 className={cn("w-10 h-10 animate-spin", mode === "edit" ? "text-sky-500" : "text-emerald-500")} />
                   <div className="text-center space-y-1">
                     <p className={cn("text-[10px] uppercase font-mono tracking-widest font-bold", mode === "edit" ? "text-sky-400" : "text-emerald-500")}>
                       {mode === "edit" ? "Refactoring_Structural_Matrix" : "Synthesizing_Procedural_Assets"}
                     </p>
                     <p className="text-[9px] text-neutral-600 font-mono italic">Initiating neural collapse chain...</p>
                   </div>
                 </div>
                 )
               ) : renderOutput ? (
                 renderOutput(activeResult, isBusy)
               ) : (
                 <div className="prose prose-invert prose-xs max-w-none prose-pre:bg-black/50 prose-pre:border-neutral-800 prose-code:text-emerald-400">
                    <Markdown>{activeResult}</Markdown>
                 </div>
               )}
             </div>
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-neutral-700 px-8 text-center space-y-8">
            <div className="w-12 h-12 rounded-full border border-neutral-900 flex items-center justify-center">
               <div className="w-2 h-2 rounded-full bg-neutral-900 border border-neutral-800" />
            </div>
            <p className="text-[10px] font-mono uppercase tracking-[0.2em] font-bold opacity-50 underline underline-offset-8 decoration-neutral-800">Ready for Command Ingress</p>
            
            {promptTemplates && promptTemplates.length > 0 && mode === "create" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-3xl w-full mt-8">
                {promptTemplates.map((t, idx) => (
                  <button
                    key={idx}
                    onClick={() => setPrompt(t.prompt)}
                    className="p-4 border border-neutral-800 bg-neutral-900/30 hover:bg-neutral-800/80 hover:border-emerald-500/30 text-neutral-400 hover:text-emerald-400 rounded-xl text-left transition-all flex flex-col gap-2 group/btn"
                  >
                    <span className="text-sm font-bold text-neutral-300 group-hover/btn:text-emerald-400 transition-colors">{t.label}</span>
                    {t.description && <span className="text-xs text-neutral-500 line-clamp-2">{t.description}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

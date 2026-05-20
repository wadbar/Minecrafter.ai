import React, { useState, useEffect, useCallback, useRef } from "react";
import { Send, Mic, Loader2, StopCircle, RefreshCw, FileEdit, Plus, Globe, CloudUpload, Copy } from "lucide-react";
import Markdown from "react-markdown";
import { cn } from "../lib/utils";
import { toast } from "sonner";
import { useAuth } from "../lib/firebase";
import { useAIGenerator } from "../lib/useAIGenerator";
import VoiceCommandOverlay from "./VoiceCommandOverlay";
import GeneratorOutput from "./GeneratorOutput";
import EditorPanel from "./EditorPanel";
import AIGuide from "./AIGuide";

interface GeneratorLayoutProps {
  title: string;
  description: string;
  placeholder: string;
  onGenerate?: (prompt: string, existingData?: string, targetLanguage?: string) => Promise<string>;
  onSaveCloud?: (title: string, result: string) => Promise<void>;
  endpointType?: string;
  renderOutput?: (result: string, isGenerating: boolean) => React.ReactNode;
  renderLoading?: () => React.ReactNode;
  supportsEditing?: boolean;
  extraControls?: React.ReactNode;
  onVoiceCommand?: (transcript: string) => boolean;
  parameters?: any;
}

export default React.memo(function GeneratorLayout({
  title,
  description,
  placeholder,
  onGenerate,
  onSaveCloud,
  endpointType,
  renderOutput,
  renderLoading,
  supportsEditing = false,
  extraControls,
  promptTemplates,
  onVoiceCommand,
  parameters: moduleParams,
}: GeneratorLayoutProps & { promptTemplates?: { label: string, prompt: string, description?: string }[] }) {
  const [prompt, setPrompt] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [chatHistory, setChatHistory] = useState<{ role: "user" | "model", parts: { text: string }[] }[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState("");
  const [mode, setMode] = useState<"create" | "edit">("create");
  const [existingData, setExistingData] = useState("");
  const [targetLanguage, setTargetLanguage] = useState("Português (BR)");
  const [isManualGenerating, setIsManualGenerating] = useState(false);
  const [manualResult, setManualResult] = useState("");
  
  const { user, signIn } = useAuth();
  const lastGeneratedPromptRef = useRef("");

  const type = mode === "edit" && endpointType ? "edit-" + endpointType.split("-")[1] : endpointType || "generate-mod";

  const { isGenerating, streamData: result, error, startGeneration, stopGeneration } = useAIGenerator({
    endpointType: type,
    onComplete: () => {
      // Usar a função no setState para ter o valor garantido mais fresco possível caso result state atrase
      setChatHistory(prev => {
        // Encontraremos o text em `result` mas `result` pode ainda esatr no snapshot anterior, 
        // mas é OK porque result também é setado final, vou capturar de outra forma no onComplete 
        // ou não me preocupar, o user visualiza o history + curr
        return [...prev, { role: "model", parts: [{ text: "Generation Complete" }] }];
      });
      const current = Number(localStorage.getItem("session_gens") || "0");
      localStorage.setItem("session_gens", String(current + 1));
      window.dispatchEvent(new Event("storage"));
      toast.success(mode === "create" ? "Geração concluída!" : "Otimização concluída!");
    },
    onError: (err) => {
      toast.error("Falha na Geração", { description: err.message });
    }
  });

  const isBusy = isGenerating || isManualGenerating;
  const activeResult = result || manualResult;

  // Since we don't have access to the final activeResult directly in onComplete without ref, 
  // let's update chathistory with the final activeResult using an effect that watches `isGenerating` falling perfectly
  // Lifecycle hardening: Synchronize generation result with chat history safely
  useEffect(() => {
    if (!isGenerating && result && result.length > 0 && !error) {
       setChatHistory(prev => {
         // Verificação de duplicidade para evitar race conditions em renders rápidos
         const lastMessage = prev[prev.length - 1];
         if (lastMessage?.role === "model" && lastMessage.parts[0].text === result) {
           return prev;
         }
         // Limpeza de placeholders antes de consolidar o stream final
         const clean = prev.filter(p => p.parts[0].text !== "Generation Complete");
         return [...clean, { role: "model", parts: [{ text: result }] }];
       });

       // Auto-save to Cloud Vault if logged in
       if (user && onSaveCloud) {
         const artifactTitle = `${title} [${mode === "create" ? "GEN" : "OPT"}]: ${lastGeneratedPromptRef.current.slice(0, 25)}...`;
         onSaveCloud(artifactTitle, result).catch(() => {
           console.warn("Auto-save to vault failed.");
         });
       }
    }
  }, [isGenerating, result, error]);

  const handleGenerate = async () => {
    if (!prompt.trim() || isBusy) return;
    if (mode === "edit" && !existingData.trim()) {
      toast.warning("Dados Incompletos", { description: "Por favor, forneça o código ou dado existente para otimizar." });
      return;
    }
    
    setIsManualGenerating(false);
    setManualResult("");
    
    const currentPrompt = prompt;
    lastGeneratedPromptRef.current = currentPrompt;
    setChatHistory(prev => [...prev, { role: "user", parts: [{ text: currentPrompt }] }]);
    setPrompt("");

    if (endpointType) {
      startGeneration({
        prompt: currentPrompt,
        history: chatHistory,
        existingData: mode === "edit" ? existingData : undefined,
        targetLanguage: mode === "edit" ? targetLanguage : undefined
      });
    } else if (onGenerate) {
      setIsManualGenerating(true);
      
      try {
        const generatedResult = await onGenerate(currentPrompt, mode === "edit" ? existingData : undefined, mode === "edit" ? targetLanguage : undefined);
        setManualResult(generatedResult);
        setChatHistory(prev => {
           return [...prev, { role: "model", parts: [{ text: generatedResult }] }];
        });

        // Auto-save for manual generation
        if (user && onSaveCloud) {
          const titleText = `${title} [${mode === "create" ? "GEN" : "OPT"}]: ${currentPrompt.slice(0, 25)}...`;
          onSaveCloud(titleText, generatedResult).catch(() => {
            console.warn("Auto-save to vault failed.");
          });
        }
      } catch (err: any) {
        toast.error("Falha na Geração", { description: err.message });
      } finally {
        setIsManualGenerating(false);
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleGenerate();
    }
  };

  const recognitionRef = React.useRef<any>(null);

  const isListeningRef = React.useRef(isListening);
  useEffect(() => {
    isListeningRef.current = isListening;
  }, [isListening]);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  const toggleMic = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      toast.error("Voz não suportada", { description: "Seu navegador não possui suporte para reconhecimento de voz." });
      return;
    }

    if (isListeningRef.current) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsListening(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognitionRef.current = recognition;
      
      recognition.lang = targetLanguage.includes("Português") ? "pt-BR" : "en-US";
      recognition.continuous = true;
      recognition.interimResults = true;

      recognition.onstart = () => {
        setIsListening(true);
        setInterimTranscript("");
        window.dispatchEvent(new CustomEvent('VOICE_RECOGNITION_READY'));
        toast.info("Escuta Ativa", { description: "Falando no canal de voz..." });
      };

      recognition.onresult = (event: any) => {
        let finalTranscript = "";
        let currentInterim = "";

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            currentInterim += event.results[i][0].transcript;
          }
        }

        if (currentInterim) {
          setInterimTranscript(currentInterim);
        }

        if (finalTranscript) {
          const transcript = finalTranscript.toLowerCase().trim();
          setInterimTranscript("");

          // Command Processing Logic
          if (transcript.includes("ajuda") || transcript.includes("comandos") || transcript.includes("help") || transcript.includes("commands")) {
            toast.info("Comandos de Voz", { 
              description: "Diga: 'Gerar', 'Limpar', 'Salvar', 'Parar', 'Ir para [Setor]', 'Modo Criação/Otimização'",
              duration: 5000 
            });
            recognition.stop();
            return;
          }

          if (transcript === "gerar" || transcript === "executar" || transcript === "generate" || transcript === "execute") {
            handleGenerate();
            toast.success("Comando Executado", { description: "Iniciando geração via comando de voz." });
            recognition.stop();
            return;
          }

          if (transcript === "limpar" || transcript === "resetar" || transcript === "clear" || transcript === "reset") {
            handleClear();
            toast.success("Comando Executado", { description: "Contexto limpo via comando de voz." });
            recognition.stop();
            return;
          }

          if (transcript === "parar" || transcript === "stop" || transcript === "cancelar") {
            stopGeneration();
            toast.info("Geração Interrompida", { description: "Desconectado via comando de voz." });
            recognition.stop();
            return;
          }

          if (transcript === "salvar" || transcript === "save" || transcript === "armazenar") {
            const saveBtn = document.querySelector('[data-action="save"]') as HTMLButtonElement;
            if (saveBtn) {
              saveBtn.click();
            } else {
              toast.warning("Nada para salvar", { description: "Gere um artefato primeiro para habilitar o Cloud Vault." });
            }
            recognition.stop();
            return;
          }

          if (transcript.includes("modo criação") || transcript.includes("creation mode")) {
            setMode("create");
            toast.success("Modo Alterado", { description: "Módulo de criação estabilizado." });
            recognition.stop();
            return;
          }

          if (transcript.includes("modo otimização") || transcript.includes("optimize mode") || transcript.includes("otimizar")) {
            setMode("edit");
            toast.success("Modo Alterado", { description: "Módulo de otimização ativado." });
            recognition.stop();
            return;
          }

          // Navigation Commands
          const navMatch = transcript.match(/(abrir|ir para|open|go to|mudar para|switch to)\s+(mapas|mapa|map|maps|mods|mod|texturas|textura|texture|textures|skins|skin|dashboard|configurações|configuração|settings|setting|storyteller|narrativa|história|integrações|integrations|vault|cofre)/i);
          if (navMatch) {
            const target = navMatch[2].toLowerCase();
            let view = "";
            if (target === "mapas" || target === "mapa" || target === "map" || target === "maps") view = "map";
            if (target === "mods" || target === "mod") view = "mod";
            if (target === "texturas" || target === "textura" || target === "texture" || target === "textures") view = "texture";
            if (target === "skins" || target === "skin") view = "skin";
            if (target === "storyteller" || target === "narrativa" || target === "história") view = "storyteller";
            if (target === "dashboard") view = "dashboard";
            if (target === "integrações" || target === "integrations") view = "integrations";
            if (target === "vault" || target === "cofre") view = "vault";
            if (target === "configurações" || target === "configuração" || target === "settings" || target === "setting") view = "settings";

            if (view) {
              window.dispatchEvent(new CustomEvent('nav-navigate', { detail: view }));
              toast.success("Navegação Iniciada", { description: `Mudando para o setor: ${target}` });
              recognition.stop();
              return;
            }
          }

          // External interceptors (Component specific)
          if (onVoiceCommand && onVoiceCommand(transcript)) {
            recognition.stop();
            return;
          }

          // Default: Append to prompt
          setPrompt((prev) => prev ? `${prev} ${finalTranscript}` : finalTranscript);
          window.dispatchEvent(new CustomEvent("voice-command-received", { detail: transcript }));
          toast.success("Transcrição Completa", { description: "Dictação processada com sucesso." });
        }
      };

      recognition.onerror = (event: any) => {
        setIsListening(false);
        if (event.error === 'not-allowed') {
          toast.error("Acesso Negado", { description: "Permissão de microfone negada pelo sistema." });
        } else {
          toast.error("Erro de Voz", { description: `Falha na captura: ${event.error}` });
        }
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognition.start();
    } catch (err) {
      console.error("Mic error:", err);
      setIsListening(false);
    }
  }, [targetLanguage]); // Agora não depende mais de isListening, pois usamos ref

  const handleClear = () => {
    setPrompt("");
    setChatHistory([]);
    setExistingData("");
    toast.success("Contexto Resetado", { description: "Uma nova sessão limpa foi iniciada." });
  };

  useEffect(() => {
    const handleExternalMic = () => toggleMic();
    const handleSetPrompt = (e: any) => setPrompt(e.detail);
    window.addEventListener('trigger-mic', handleExternalMic);
    window.addEventListener('set-builder-prompt', handleSetPrompt);
    return () => {
      window.removeEventListener('trigger-mic', handleExternalMic);
      window.removeEventListener('set-builder-prompt', handleSetPrompt);
    };
  }, [toggleMic]);

  return (
    <div className="flex flex-col h-[calc(100vh-10rem)] gap-4">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-neutral-900">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
             <div className="relative">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.8)] animate-pulse" />
                <div className="absolute inset-0 w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping opacity-25" />
             </div>
             <div className="flex flex-col">
                <span className="text-[10px] font-mono text-neutral-600 uppercase tracking-[0.4em] font-black leading-none mb-1">Architecture_Connected</span>
                <div className="h-[1px] w-full bg-gradient-to-r from-emerald-500/50 to-transparent" />
             </div>
          </div>
          <div className="space-y-1">
            <h2 className="text-4xl font-black tracking-tighter text-white uppercase italic">{title}</h2>
            <p className="text-xs text-neutral-600 font-mono font-bold uppercase tracking-widest">{description}</p>
          </div>
        </div>
        <div className="flex items-center gap-4 bg-neutral-950 p-2 rounded-[2rem] border border-neutral-900 shadow-2xl">
          <AIGuide context={title} prompt={prompt} parameters={{ mode, targetLanguage, ...moduleParams }} />
          {supportsEditing && (
            <div className="flex bg-neutral-950 border border-neutral-800 rounded-lg p-1 shadow-inner">
              <button
                onClick={() => setMode("create")}
                className={cn("px-4 py-1.5 rounded-md text-[11px] font-bold uppercase tracking-wider transition-all flex items-center gap-2", mode === "create" ? "bg-emerald-500/10 text-emerald-500" : "text-neutral-600 hover:text-neutral-400")}
              >
                <Plus className="w-3.5 h-3.5" /> Creation
              </button>
              <button
                onClick={() => setMode("edit")}
                className={cn("px-4 py-1.5 rounded-md text-[11px] font-bold uppercase tracking-wider transition-all flex items-center gap-2", mode === "edit" ? "bg-sky-500/10 text-sky-500" : "text-neutral-600 hover:text-neutral-400")}
              >
                <FileEdit className="w-3.5 h-3.5" /> Optimize
              </button>
            </div>
          )}
          <button
            onClick={handleClear}
            className="px-4 py-2 text-neutral-600 hover:text-white hover:bg-neutral-900 border border-transparent hover:border-neutral-800 rounded-lg transition-all flex items-center gap-2 text-[11px] uppercase font-bold tracking-wider"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Reset Context
          </button>
        </div>
      </header>

      <div className="flex-1 min-h-0 flex gap-4 relative">
        {/* Voice Portal Overlay */}
        <VoiceCommandOverlay 
           isListening={isListening} 
           interimTranscript={interimTranscript} 
           onCancel={toggleMic} 
        />

        {/* Editor Area (if mode === 'edit') */}
        {supportsEditing && mode === "edit" && (
          <EditorPanel 
            existingData={existingData} 
            setExistingData={setExistingData}
            targetLanguage={targetLanguage}
            setTargetLanguage={setTargetLanguage}
          />
        )}

        {/* Output Area */}
        <GeneratorOutput 
           isBusy={isBusy}
           activeResult={activeResult}
           chatHistory={chatHistory}
           mode={mode}
           renderLoading={renderLoading}
           renderOutput={renderOutput}
           promptTemplates={promptTemplates}
           setPrompt={setPrompt}
           onSaveCloud={onSaveCloud}
           isSaving={isSaving}
           setIsSaving={setIsSaving}
           getCurrentPrompt={() => prompt}
        />
      </div>

      <div className="flex-none flex flex-col gap-2">
        {extraControls && <div className="bg-neutral-950 border border-neutral-800 rounded-2xl p-4 shadow-xl">{extraControls}</div>}
        <div className="relative bg-neutral-950 border border-neutral-800 rounded-2xl p-4 shadow-xl">
           <textarea
            value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={isListening ? "Audio_Receiving..." : (mode === "edit" ? "Describe optimization directives for the source code above..." : placeholder)}
          className={cn("w-full bg-transparent pr-32 text-white placeholder-neutral-700 focus:outline-none transition-all resize-none scrollbar-thin overflow-y-auto text-sm font-medium", isListening && "animate-pulse")}
          rows={3}
        />
        <div className="absolute bottom-4 right-6 flex items-center gap-3">
          <button
            onClick={() => {
              navigator.clipboard.writeText(prompt);
              toast.success("Prompt Copiado", { description: "Conteúdo movido para a área de transferência." });
            }}
            disabled={!prompt.trim()}
            className="p-2.5 rounded-xl transition-all border text-neutral-600 hover:text-neutral-400 border-transparent hover:bg-neutral-900 disabled:opacity-30"
            title="Copy Prompt"
          >
            <Copy className="w-5 h-5" />
          </button>
          <button
            onClick={toggleMic}
            className={cn(
              "p-2.5 rounded-xl transition-all border",
              isListening ? "text-red-500 bg-red-500/10 border-red-500/30" : "text-neutral-600 hover:text-neutral-400 border-transparent hover:bg-neutral-900"
            )}
          >
            {isListening ? <StopCircle className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>
          <button
            onClick={handleGenerate}
            disabled={!prompt.trim() || isBusy}
            data-action="generate-button"
            className={cn("flex items-center gap-2 h-12 px-6 text-white rounded-xl font-bold text-xs uppercase tracking-widest transition-all shadow-lg active:scale-95 group", mode === "edit" ? "bg-sky-600 hover:bg-sky-500 disabled:bg-neutral-900" : "bg-emerald-600 hover:bg-emerald-500 disabled:bg-neutral-900")}
          >
            {isBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : (
              <>
                <span>Execute</span>
                <Send className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
              </>
            )}
          </button>
        </div>
        <div className="absolute top-2 right-6">
          <span className="text-[10px] uppercase font-mono text-neutral-600 font-bold bg-neutral-900 px-2 py-0.5 rounded border border-neutral-800">
            Enter para enviar, Shift+Enter para quebra
          </span>
        </div>
      </div>
      </div>
    </div>
  );
});

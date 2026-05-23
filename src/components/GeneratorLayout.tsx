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
  autoSaveCloud?: boolean;
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
  autoSaveCloud = true,
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
       if (user && onSaveCloud && autoSaveCloud) {
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
        if (user && onSaveCloud && autoSaveCloud) {
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
    <div className="flex flex-col h-[calc(100vh-8rem)] gap-4 transition-colors duration-300">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-m3-outline-variant">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
             <div className="relative">
                <div className="w-2.5 h-2.5 rounded-full bg-m3-primary shadow-m3-1 animate-pulse" />
                <div className="absolute inset-0 w-2.5 h-2.5 rounded-full bg-m3-primary animate-ping opacity-20" />
             </div>
             <div className="flex flex-col">
                <span className="text-[10px] font-bold text-m3-on-surface-variant uppercase tracking-widest leading-none mb-1">Architecture Connected</span>
             </div>
          </div>
          <div className="space-y-1">
            <h2 className="text-3xl font-bold tracking-tight text-m3-on-surface">{title}</h2>
            <p className="text-sm text-m3-on-surface-variant font-medium">{description}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 bg-m3-surface-container-high p-2 rounded-full border border-m3-outline-variant shadow-m3-1 self-start md:self-center">
          <AIGuide context={title} prompt={prompt} parameters={{ mode, targetLanguage, ...moduleParams }} />
          {supportsEditing && (
            <div className="flex bg-m3-surface-container rounded-full p-1 border border-m3-outline-variant">
              <button
                onClick={() => setMode("create")}
                className={cn(
                  "px-4 py-2 rounded-full text-xs font-bold transition-all flex items-center gap-2", 
                  mode === "create" ? "bg-m3-primary text-m3-on-primary" : "text-m3-on-surface-variant hover:bg-m3-surface-variant"
                )}
              >
                <Plus className="w-3.5 h-3.5" /> Criar
              </button>
              <button
                onClick={() => setMode("edit")}
                className={cn(
                  "px-4 py-2 rounded-full text-xs font-bold transition-all flex items-center gap-2", 
                  mode === "edit" ? "bg-m3-primary text-m3-on-primary" : "text-m3-on-surface-variant hover:bg-m3-surface-variant"
                )}
              >
                <FileEdit className="w-3.5 h-3.5" /> Otimizar
              </button>
            </div>
          )}
          <button
            onClick={handleClear}
            className="px-4 py-2 text-m3-on-surface-variant hover:text-m3-on-surface hover:bg-m3-surface-variant rounded-full transition-all flex items-center gap-2 text-xs font-bold"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Limpar
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

      <div className="flex-none flex flex-col gap-3">
        {extraControls && (
          <div className="bg-m3-surface-container border border-m3-outline-variant rounded-3xl p-4 shadow-m3-1 animate-in fade-in zoom-in-95 duration-300">
            {extraControls}
          </div>
        )}
        <div className="relative bg-m3-surface-container-high border border-m3-outline-variant rounded-3xl p-4 shadow-m3-2 group transition-all duration-300 focus-within:border-m3-primary focus-within:shadow-m3-3">
           <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isListening ? "Escutando..." : (mode === "edit" ? "Descreva as diretrizes de otimização..." : placeholder)}
            className={cn(
              "w-full bg-transparent pr-36 text-m3-on-surface placeholder-m3-on-surface-variant/50 focus:outline-none transition-all resize-none min-h-[96px] text-sm font-medium leading-relaxed", 
              isListening && "animate-pulse"
            )}
            rows={3}
          />
          <div className="absolute bottom-4 right-5 flex items-center gap-2">
            <button
              onClick={() => {
                navigator.clipboard.writeText(prompt);
                toast.success("Copiado!");
              }}
              disabled={!prompt.trim()}
              className="p-3 rounded-full transition-all text-m3-on-surface-variant hover:bg-m3-surface-variant disabled:opacity-30"
              title="Copiar Prompt"
            >
              <Copy className="w-5 h-5" />
            </button>
            <button
              onClick={toggleMic}
              className={cn(
                "p-3 rounded-full transition-all border",
                isListening 
                  ? "bg-m3-error-container text-m3-on-error-container border-m3-error" 
                  : "text-m3-on-surface-variant border-transparent hover:bg-m3-surface-variant"
              )}
            >
              {isListening ? <StopCircle className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </button>
            <button
              onClick={handleGenerate}
              disabled={!prompt.trim() || isBusy}
              data-action="generate-button"
              className={cn(
                "flex items-center gap-2 h-12 px-6 rounded-2xl font-bold text-xs uppercase tracking-widest transition-all shadow-m3-2 active:scale-95 group", 
                mode === "edit" 
                  ? "bg-m3-tertiary text-m3-on-tertiary hover:shadow-m3-3 disabled:bg-m3-surface-variant disabled:text-m3-on-surface-variant/30" 
                  : "bg-m3-primary text-m3-on-primary hover:shadow-m3-3 disabled:bg-m3-surface-variant disabled:text-m3-on-surface-variant/30"
              )}
            >
              {isBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                <>
                  <span>Executar</span>
                  <Send className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </div>
          <div className="absolute top-4 right-6 pointer-events-none opacity-0 group-focus-within:opacity-100 transition-opacity">
            <span className="text-[10px] font-bold text-m3-on-surface-variant bg-m3-surface-variant/50 px-2 py-0.5 rounded-full border border-m3-outline-variant">
              Enter ↵ Enviar
            </span>
          </div>
        </div>
      </div>
    </div>
  );
});

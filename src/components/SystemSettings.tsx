import React from "react";
import { Settings, Shield, Zap, Eye, EyeOff, Server, LogOut } from "lucide-react";
import { cn } from "../lib/utils";
import { auth } from "../lib/firebase";
import { toast } from "sonner";

interface SettingItemProps {
  id: string;
  label: string;
  description: string;
  icon: any;
  enabled: boolean;
  onToggle: (id: string) => void;
}

const SettingItem = ({ label, description, icon: Icon, enabled, onToggle, id }: SettingItemProps) => (
  <button 
    onClick={() => onToggle(id)}
    className="flex items-start gap-4 p-6 bg-neutral-900 border border-neutral-800 rounded-2xl hover:border-emerald-500/30 hover:bg-neutral-800/80 transition-all text-left group"
  >
    <div className={cn("p-3 rounded-xl border transition-colors", enabled ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" : "text-neutral-600 bg-neutral-950 border-neutral-900")}>
      <Icon className="w-5 h-5" />
    </div>
    <div className="flex-1">
      <div className="flex items-center justify-between mb-1">
        <h4 className="font-bold text-white text-sm group-hover:text-emerald-400 transition-colors">{label}</h4>
        <div className={cn("w-8 h-4 rounded-full relative transition-colors", enabled ? "bg-emerald-500" : "bg-neutral-800")}>
          <div className={cn("absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all", enabled ? "left-4.5" : "left-0.5")} />
        </div>
      </div>
      <p className="text-xs text-neutral-500 leading-relaxed uppercase tracking-widest font-mono">{description}</p>
    </div>
  </button>
);

export default function SystemSettings() {
  const [settings, setSettings] = React.useState({
    ultra_fast: true,
    stealth_mode: false,
    hardware_accel: true,
    secure_vault: true
  });

  const toggle = (id: string) => {
    setSettings(prev => ({ ...prev, [id as keyof typeof prev]: !prev[id as keyof typeof prev] }));
  };

  const handleReset = async () => {
    try {
      localStorage.clear();
      await auth.signOut();
      toast.success("Sistema Reiniciado", { description: "Sessão encerrada e cache purgado." });
      window.location.reload();
    } catch (e) {
      toast.error("Erro ao Reiniciar");
    }
  };

  return (
    <div className="space-y-10 max-w-4xl mx-auto">
      <header className="space-y-2">
        <div className="flex items-center gap-2 mb-4">
          <Settings className="w-4 h-4 text-neutral-500" />
          <span className="text-[10px] font-mono text-neutral-600 uppercase tracking-[0.2em] font-bold underline underline-offset-4">Configurações Base</span>
        </div>
        <h1 className="text-4xl font-bold tracking-tighter text-white">Preferências do <span className="text-emerald-500 italic">Engenheiro</span></h1>
        <p className="text-neutral-400 font-medium">Ajuste os parâmetros de performance e segurança da interface do Sistema.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <SettingItem 
          id="ultra_fast"
          label="Stream Ultra-Rápido"
          description="Otimiza o buffer de streaming para entrega instantânea."
          icon={Zap}
          enabled={settings.ultra_fast}
          onToggle={toggle}
        />
        <SettingItem 
           id="stealth_mode"
           label="Modo Stealth"
           description="Oculta logs de telemetria e rastros da sessão."
           icon={EyeOff}
           enabled={settings.stealth_mode}
           onToggle={toggle}
        />
        <SettingItem 
           id="hardware_accel"
           label="Aceleração de Malha"
           description="Usa a GPU para renderizar previews 3D pesados."
           icon={Shield}
           enabled={settings.hardware_accel}
           onToggle={toggle}
        />
        <SettingItem 
           id="secure_vault"
           label="Criptografia de Cofre"
           description="AES-256 forçado em todas as persistências."
           icon={Shield}
           enabled={settings.secure_vault}
           onToggle={toggle}
        />
      </div>

      <div className="p-8 rounded-3xl bg-neutral-900/30 border-2 border-neutral-800 space-y-6">
        <div className="flex items-center gap-3 border-b border-neutral-800 pb-4">
           <Server className="w-5 h-5 text-emerald-500" />
           <h3 className="text-xl font-bold text-white uppercase tracking-tighter">Guia de Implantação Solutions Builder</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
           <div className="p-8 rounded-3xl bg-neutral-900/30 border border-neutral-800 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                   <h4 className="text-white font-bold uppercase tracking-widest text-xs">V8_JIT_Otimização</h4>
                   <p className="text-[10px] text-neutral-500 font-mono mt-1">TurboFan & Maglev Pipeline Injection</p>
                </div>
                <div className="w-10 h-5 bg-emerald-500/20 rounded-full p-1 border border-emerald-500/30">
                   <div className="w-3 h-3 bg-emerald-500 rounded-full translate-x-5 shadow-[0_0_8px_rgba(16,185,129,1)]" />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div>
                   <h4 className="text-white font-bold uppercase tracking-widest text-xs">Isolamento_Processo</h4>
                   <p className="text-[10px] text-neutral-500 font-mono mt-1">Chromium-style Sandbox Isolation</p>
                </div>
                <div className="w-10 h-5 bg-emerald-500/20 rounded-full p-1 border border-emerald-500/30">
                   <div className="w-3 h-3 bg-emerald-500 rounded-full translate-x-5 shadow-[0_0_8px_rgba(16,185,129,1)]" />
                </div>
              </div>
              <div className="flex items-center justify-between opacity-50">
                <div>
                   <h4 className="text-white font-bold uppercase tracking-widest text-xs">GPU_Rasterization</h4>
                   <p className="text-[10px] text-neutral-500 font-mono mt-1">Requires Desktop Driver Access</p>
                </div>
                <div className="w-10 h-5 bg-neutral-800 rounded-full p-1 border border-neutral-700">
                   <div className="w-3 h-3 bg-neutral-600 rounded-full" />
                </div>
              </div>
           </div>

           <div className="p-8 rounded-3xl bg-neutral-900/30 border border-neutral-800 space-y-4 flex flex-col justify-center text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                 <Zap className="w-5 h-5 text-sky-500 animate-pulse" />
                 <h4 className="text-white font-black uppercase tracking-[0.2em] text-xs">Chromium_Native_Build</h4>
              </div>
              <p className="text-[10px] text-neutral-500 leading-relaxed max-w-xs mx-auto">
                Sincronizando flags de runtime com a arquitetura do sistema para minimizar o footprint de memória e otimizar loops procedurais.
              </p>
              <button className="mt-4 px-4 py-2 bg-sky-500/10 hover:bg-sky-500/20 text-sky-500 border border-sky-500/20 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">
                Compilar Core Otimizado
              </button>
           </div>
        </div>

        <div className="p-8 rounded-3xl bg-neutral-900/30 border-2 border-neutral-800 space-y-6">
           <div className="space-y-3">
              <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest bg-emerald-500/10 px-2 py-0.5 rounded">RECOMENDADO</span>
              <h4 className="font-bold text-white text-sm">Linux VPS (Ubuntu)</h4>
              <p className="text-[10px] text-neutral-500 font-mono leading-relaxed">
                1. sudo apt update && sudo apt install nodejs npm git<br/>
                2. git clone [PAPERCREEPER_REPO]<br/>
                3. npm install && npm run build<br/>
                4. sudo npm run start
              </p>
           </div>
           <div className="space-y-3 border-x border-neutral-800 px-6">
              <span className="text-[10px] font-black text-sky-500 uppercase tracking-widest bg-sky-500/10 px-2 py-0.5 rounded">DESENVOLVEDOR</span>
              <h4 className="font-bold text-white text-sm">Windows via WSL2</h4>
              <p className="text-[10px] text-neutral-500 font-mono leading-relaxed">
                - Instale o WSL2 via Terminal (wsl --install).<br/>
                - Recomendado usar imagem Debian/Ubuntu.<br/>
                - Use "npm run dev" para interface de depuração.
              </p>
           </div>
           <div className="space-y-3">
              <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest bg-amber-500/10 px-2 py-0.5 rounded">LEGACY</span>
              <h4 className="font-bold text-white text-sm">Windows Native</h4>
              <p className="text-[10px] text-neutral-500 font-mono leading-relaxed">
                - Requer Node.js 18+.<br/>
                - Algumas bibliotecas de IO podem exigir privilégios de Admin.<br/>
                - Use Git Bash para rodar setup.sh.
              </p>
           </div>
        </div>
      </div>

      <div className="p-8 rounded-2xl bg-neutral-900/50 border border-neutral-800 text-center space-y-4">
         <p className="text-[10px] font-mono text-neutral-600 uppercase tracking-widest font-bold">Zera_Sessão_Global</p>
         <button 
           onClick={handleReset}
           className="px-6 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-lg border border-red-500/20 text-xs font-bold transition-all uppercase tracking-widest flex items-center gap-2 mx-auto"
         >
           <LogOut className="w-4 h-4" />
           Limpar Todos os Cache e Sair
         </button>
      </div>
    </div>
  );
}

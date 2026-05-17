import React from "react";
import { Settings, Shield, Zap, Eye, EyeOff } from "lucide-react";
import { cn } from "../lib/utils";

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

export default function MatrixSettings() {
  const [settings, setSettings] = React.useState({
    ultra_fast: true,
    stealth_mode: false,
    hardware_accel: true,
    secure_vault: true
  });

  const toggle = (id: string) => {
    setSettings(prev => ({ ...prev, [id as keyof typeof prev]: !prev[id as keyof typeof prev] }));
  };

  return (
    <div className="space-y-10 max-w-4xl mx-auto">
      <header className="space-y-2">
        <div className="flex items-center gap-2 mb-4">
          <Settings className="w-4 h-4 text-neutral-500" />
          <span className="text-[10px] font-mono text-neutral-600 uppercase tracking-[0.2em] font-bold underline underline-offset-4">Configurações Nucleares</span>
        </div>
        <h1 className="text-4xl font-bold tracking-tighter text-white">Prefereências do <span className="text-emerald-500 italic">Sifão</span></h1>
        <p className="text-neutral-400 font-medium">Ajuste os parâmetros de performance e segurança da interface Matrix.</p>
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

      <div className="p-8 rounded-2xl bg-neutral-900/50 border border-neutral-800 text-center space-y-4">
         <p className="text-[10px] font-mono text-neutral-600 uppercase tracking-widest font-bold">Zera_Sessão_Global</p>
         <button className="px-6 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-lg border border-red-500/20 text-xs font-bold transition-all uppercase tracking-widest">
           Limpar Todos os Cache e Sair
         </button>
      </div>
    </div>
  );
}

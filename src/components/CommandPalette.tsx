import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Search, Command, Globe, Box, Palette, User, 
  BookOpen, Terminal, Grid3X3, Database, 
  Settings, Zap, Shield, Sparkles, Wand2,
  RotateCcw
} from 'lucide-react';
import { cn } from '../lib/utils';
import { ViewState } from '../App';
import { toast } from 'sonner';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (view: ViewState) => void;
}

const COMMANDS: { id: string, label: string, description: string, icon: any, color: string, category: 'navigation' | 'action' }[] = [
  // Navigation
  { id: 'dashboard', label: 'Dashboard', description: 'Visão geral do sistema e estatísticas', icon: Grid3X3, color: 'text-neutral-400', category: 'navigation' },
  { id: 'map', label: 'Terrain Forge', description: 'Arquitetura de mapas e terrenos', icon: Globe, color: 'text-emerald-500', category: 'navigation' },
  { id: 'mod', label: 'Mod Orchestrator', description: 'Geração de mods e plugins Java', icon: Box, color: 'text-sky-500', category: 'navigation' },
  { id: 'texture', label: 'Texture Forge', description: 'Geração de texturas neurais', icon: Palette, color: 'text-purple-500', category: 'navigation' },
  { id: 'skin', label: 'Skin Distribution', description: 'Arquitetura de skins 3D', icon: User, color: 'text-pink-500', category: 'navigation' },
  { id: 'voxellab', label: 'Voxel Lab', description: 'Laboratório de estruturas 3D voxeizadas', icon: Wand2, color: 'text-amber-500', category: 'navigation' },
  { id: 'scripthub', label: 'Script Hub', description: 'Centro de automação e scripts MC', icon: Terminal, color: 'text-emerald-500', category: 'navigation' },
  { id: 'storyteller', label: 'Storyteller', description: 'Diálogos e comportamentos de NPCs', icon: BookOpen, color: 'text-sky-500', category: 'navigation' },
  { id: 'vault', label: 'Cloud Vault', description: 'Arquivo central de artefatos', icon: Database, color: 'text-amber-500', category: 'navigation' },
  { id: 'integrations', label: 'Server Bridge', description: 'Conexão direta com servidores MC', icon: Zap, color: 'text-emerald-500', category: 'navigation' },
  { id: 'settings', label: 'System Config', description: 'Parâmetros globais do sistema', icon: Settings, color: 'text-neutral-500', category: 'navigation' },
  
  // Global Actions
  { id: 'action_clear_cache', label: 'Limpar Cache', description: 'Resetar buffers e memória local do sistema', icon: RotateCcw, color: 'text-red-400', category: 'action' },
  { id: 'action_save_all', label: 'Salvar Tudo', description: 'Sincronizar todos os dados pendentes na nuvem', icon: Database, color: 'text-blue-400', category: 'action' },
  { id: 'action_theme_toggle', label: 'Alternar Tema', description: 'Trocar entre interface clara e escura', icon: Sparkles, color: 'text-amber-400', category: 'action' },
];

export default function CommandPalette({ isOpen, onClose, onNavigate }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  const filteredCommands = useMemo(() => {
    if (!query) return COMMANDS;
    return COMMANDS.filter(cmd => 
      cmd.label.toLowerCase().includes(query.toLowerCase()) || 
      cmd.description.toLowerCase().includes(query.toLowerCase())
    );
  }, [query]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

const handleAction = (id: string) => {
    if (id.startsWith('action_')) {
      switch (id) {
        case 'action_clear_cache':
          localStorage.clear();
          toast.success('Cache Limpo');
          break;
        case 'action_save_all':
          toast.success('Todos os dados sincronizados');
          break;
        case 'action_theme_toggle':
          toast.info('Alternando tema...');
          break;
      }
      onClose();
      return;
    }
    onNavigate(id as ViewState);
    onClose();
  };

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev + 1) % filteredCommands.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev - 1 + filteredCommands.length) % filteredCommands.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredCommands[selectedIndex]) {
        handleAction(filteredCommands[selectedIndex].id);
      }
    } else if (e.key === 'Escape') {
      onClose();
    }
  }, [filteredCommands, selectedIndex, onClose]);

  useEffect(() => {
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  const navigationCommands = filteredCommands.filter(c => c.category === 'navigation');
  const actionCommands = filteredCommands.filter(c => c.category === 'action');

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[10vh] px-4">
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/60 backdrop-blur-md"
        />
        
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: -20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: -20 }}
          className="relative w-full max-w-2xl bg-m3-surface-container-high border border-m3-outline-variant rounded-[2rem] shadow-m3-5 overflow-hidden"
        >
          <div className="flex items-center px-6 py-5 border-b border-m3-outline-variant/30 bg-m3-surface-container-highest/20">
            <Search className="w-5 h-5 text-m3-on-surface-variant mr-4 opacity-50" />
            <input 
              autoFocus
              type="text" 
              placeholder="Pesquisar módulos, ferramentas ou ações rápidas..." 
              value={query}
              onChange={e => setQuery(e.target.value)}
              className="flex-1 bg-transparent border-none outline-none text-m3-on-surface font-mono text-sm placeholder:text-m3-on-surface-variant/40"
            />
            <div className="flex items-center gap-2 ml-4">
               <div className="px-2 py-1 rounded bg-m3-surface-variant/50 border border-m3-outline-variant text-[10px] font-black font-mono text-m3-on-surface-variant opacity-60">ESC</div>
            </div>
          </div>

          <div className="max-h-[60vh] overflow-y-auto scrollbar-none p-4 space-y-6">
            {navigationCommands.length > 0 && (
              <div>
                <div className="px-4 py-2 text-[9px] font-black text-m3-on-surface-variant/50 uppercase tracking-[0.2em]">Navegação Sistêmica</div>
                <div className="space-y-1">
                  {navigationCommands.map((cmd, idx) => {
                    const globalIdx = filteredCommands.indexOf(cmd);
                    return (
                      <button
                        key={cmd.id}
                        onClick={() => handleAction(cmd.id)}
                        onMouseEnter={() => setSelectedIndex(globalIdx)}
                        className={cn(
                          "w-full flex items-center gap-4 px-4 py-3 rounded-2xl transition-all text-left group",
                          selectedIndex === globalIdx ? "bg-m3-primary/10 border border-m3-primary/20" : "border border-transparent hover:bg-m3-surface-variant/50"
                        )}
                      >
                        <div className={cn("p-2.5 rounded-xl transition-colors", selectedIndex === globalIdx ? "bg-m3-primary/20" : "bg-m3-surface-container-lowest")}>
                          <cmd.icon className={cn("w-5 h-5", selectedIndex === globalIdx ? "text-m3-primary" : cmd.color)} />
                        </div>
                        <div className="flex-1">
                          <div className={cn("text-xs font-black transition-colors uppercase tracking-widest", selectedIndex === globalIdx ? "text-m3-on-surface" : "text-m3-on-surface-variant/80")}>
                            {cmd.label}
                          </div>
                          <div className="text-[10px] text-m3-on-surface-variant/50 font-medium">
                            {cmd.description}
                          </div>
                        </div>
                        {selectedIndex === globalIdx && (
                          <div className="px-2 py-1 rounded-full bg-m3-primary/20 text-[8px] font-black text-m3-primary uppercase tracking-[0.2em] animate-pulse">Ir para</div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {actionCommands.length > 0 && (
              <div>
                <div className="px-4 py-2 text-[9px] font-black text-m3-on-surface-variant/50 uppercase tracking-[0.2em]">Ações Globais</div>
                <div className="space-y-1">
                  {actionCommands.map((cmd, idx) => {
                    const globalIdx = filteredCommands.indexOf(cmd);
                    return (
                      <button
                        key={cmd.id}
                        onClick={() => handleAction(cmd.id)}
                        onMouseEnter={() => setSelectedIndex(globalIdx)}
                        className={cn(
                          "w-full flex items-center gap-4 px-4 py-3 rounded-2xl transition-all text-left group",
                          selectedIndex === globalIdx ? "bg-red-500/10 border border-red-500/20" : "border border-transparent hover:bg-m3-surface-variant/50"
                        )}
                      >
                        <div className={cn("p-2.5 rounded-xl transition-colors", selectedIndex === globalIdx ? "bg-red-500/10" : "bg-m3-surface-container-lowest")}>
                          <cmd.icon className={cn("w-5 h-5", selectedIndex === globalIdx ? "text-red-400" : cmd.color)} />
                        </div>
                        <div className="flex-1">
                          <div className={cn("text-xs font-black transition-colors uppercase tracking-widest", selectedIndex === globalIdx ? "text-red-400" : "text-m3-on-surface-variant/80")}>
                            {cmd.label}
                          </div>
                          <div className="text-[10px] text-m3-on-surface-variant/50 font-medium font-mono">
                            {cmd.description}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {filteredCommands.length === 0 && (
              <div className="py-16 text-center flex flex-col items-center justify-center opacity-30">
                 <Shield className="w-12 h-12 text-m3-on-surface-variant mb-4" />
                 <p className="text-[11px] font-mono text-m3-on-surface-variant uppercase tracking-[0.4em] font-black">Gateway_Desconectado</p>
                 <p className="text-[9px] text-m3-on-surface-variant mt-2">Nenhum atalho encontrado para "{query}"</p>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between px-8 py-4 border-t border-m3-outline-variant/30 bg-m3-surface-container-highest/30 text-[9px] font-black text-m3-on-surface-variant/40 uppercase tracking-[0.2em]">
             <div className="flex gap-6">
                <span className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-m3-primary shadow-[0_0_8px_rgba(var(--m3-primary-rgb),0.5)]" /> Bridge_Active</span>
                <span className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-m3-secondary shadow-[0_0_8px_rgba(var(--m3-secondary-rgb),0.5)]" /> Neural_Link_V9</span>
             </div>
             <div className="flex gap-6">
                <div className="flex items-center gap-2 group/key">
                   <div className="px-2 py-0.5 rounded bg-m3-surface-variant/50 border border-m3-outline-variant font-mono">↑↓</div>
                   <span className="group-hover:text-m3-on-surface-variant transition-colors">Navegar</span>
                </div>
                <div className="flex items-center gap-2 group/key">
                   <div className="px-2 py-0.5 rounded bg-m3-surface-variant/50 border border-m3-outline-variant font-mono uppercase tracking-tighter">Enter</div>
                   <span className="group-hover:text-m3-on-surface-variant transition-colors">Executar</span>
                </div>
             </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Search, Command, Globe, Box, Palette, User, 
  BookOpen, Terminal, Grid3X3, Database, 
  Settings, Zap, Shield, Sparkles, Wand2
} from 'lucide-react';
import { cn } from '../lib/utils';
import { ViewState } from '../App';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (view: ViewState) => void;
}

const COMMANDS: { id: ViewState, label: string, description: string, icon: any, color: string }[] = [
  { id: 'dashboard', label: 'Dashboard', description: 'Visão geral do sistema e estatísticas', icon: Grid3X3, color: 'text-neutral-400' },
  { id: 'map', label: 'Terrain Forge', description: 'Arquitetura de mapas e terrenos', icon: Globe, color: 'text-emerald-500' },
  { id: 'mod', label: 'Mod Orchestrator', description: 'Geração de mods e plugins Java', icon: Box, color: 'text-sky-500' },
  { id: 'texture', label: 'Texture Forge', description: 'Geração de texturas neurais', icon: Palette, color: 'text-purple-500' },
  { id: 'skin', label: 'Skin Distribution', description: 'Arquitetura de skins 3D', icon: User, color: 'text-pink-500' },
  { id: 'voxellab', label: 'Voxel Lab', description: 'Laboratório de estruturas 3D voxeizadas', icon: Wand2, color: 'text-amber-500' },
  { id: 'scripthub', label: 'Script Hub', description: 'Centro de automação e scripts MC', icon: Terminal, color: 'text-emerald-500' },
  { id: 'storyteller', label: 'Storyteller', description: 'Diálogos e comportamentos de NPCs', icon: BookOpen, color: 'text-sky-500' },
  { id: 'vault', label: 'Cloud Vault', description: 'Arquivo central de artefatos', icon: Database, color: 'text-amber-500' },
  { id: 'integrations', label: 'Server Bridge', description: 'Conexão direta com servidores MC', icon: Zap, color: 'text-emerald-500' },
  { id: 'settings', label: 'System Config', description: 'Parâmetros globais do sistema', icon: Settings, color: 'text-neutral-500' },
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
        onNavigate(filteredCommands[selectedIndex].id);
        onClose();
      }
    } else if (e.key === 'Escape') {
      onClose();
    }
  }, [filteredCommands, selectedIndex, onNavigate, onClose]);

  useEffect(() => {
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

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
          className="relative w-full max-w-2xl bg-neutral-900 border border-neutral-800 rounded-3xl shadow-2xl overflow-hidden industrial-bg"
        >
          <div className="flex items-center px-6 py-4 border-b border-neutral-800 bg-black/20">
            <Search className="w-5 h-5 text-neutral-500 mr-4" />
            <input 
              autoFocus
              type="text" 
              placeholder="Pesquisar módulos, ferramentas ou configurações..." 
              value={query}
              onChange={e => setQuery(e.target.value)}
              className="flex-1 bg-transparent border-none outline-none text-white font-mono text-sm placeholder:text-neutral-600"
            />
            <div className="flex items-center gap-1.5 ml-4">
               <div className="px-1.5 py-0.5 rounded border border-neutral-800 bg-neutral-950 text-[10px] font-mono text-neutral-500">ESC</div>
            </div>
          </div>

          <div className="max-h-[60vh] overflow-y-auto scrollbar-none p-2">
            <div className="px-4 py-2 text-[9px] font-black text-neutral-600 uppercase tracking-widest border-b border-neutral-800/50 mb-2">Comandos do Sistema</div>
            <div className="space-y-1">
              {filteredCommands.length > 0 ? (
                filteredCommands.map((cmd, idx) => (
                  <button
                    key={cmd.id}
                    onClick={() => {
                      onNavigate(cmd.id);
                      onClose();
                    }}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    className={cn(
                      "w-full flex items-center gap-4 px-4 py-3 rounded-2xl transition-all text-left group",
                      selectedIndex === idx ? "bg-emerald-500/10 border border-emerald-500/20" : "border border-transparent hover:bg-neutral-800/50"
                    )}
                  >
                    <div className={cn("p-2 rounded-xl transition-colors", selectedIndex === idx ? "bg-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.2)]" : "bg-neutral-800")}>
                      <cmd.icon className={cn("w-5 h-5", selectedIndex === idx ? "text-emerald-400" : cmd.color)} />
                    </div>
                    <div className="flex-1">
                      <div className={cn("text-xs font-bold transition-colors", selectedIndex === idx ? "text-white" : "text-neutral-400 font-mono")}>
                        {cmd.label}
                      </div>
                      <div className="text-[10px] text-neutral-600 font-medium">
                        {cmd.description}
                      </div>
                    </div>
                    {selectedIndex === idx && (
                      <div className="flex items-center gap-2">
                        <div className="px-1.5 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/20 text-[8px] font-black text-emerald-500 uppercase tracking-widest">Ativar</div>
                        <Command className="w-3 h-3 text-emerald-500 animate-pulse" />
                      </div>
                    )}
                  </button>
                ))
              ) : (
                <div className="py-12 text-center flex flex-col items-center justify-center opacity-50">
                   <Shield className="w-10 h-10 text-neutral-800 mb-4" />
                   <p className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest">Nenhum gateway detectado para "{query}"</p>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between px-6 py-3 border-t border-neutral-800 bg-black/40 text-[9px] font-bold text-neutral-600 uppercase tracking-widest">
             <div className="flex gap-4">
                <span className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> System_Online</span>
                <span className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-sky-500" /> Link_Stabilized</span>
             </div>
             <div className="flex gap-4">
                <div className="flex items-center gap-2">
                   <div className="px-1.5 py-0.5 rounded border border-neutral-800 bg-neutral-950 font-mono">↑↓</div>
                   <span>Navegar</span>
                </div>
                <div className="flex items-center gap-2">
                   <div className="px-1.5 py-0.5 rounded border border-neutral-800 bg-neutral-950 font-mono">ENTER</div>
                   <span>Executar</span>
                </div>
             </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

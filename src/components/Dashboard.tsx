import React, { memo } from "react";
import { ViewState } from "../App";
import { Brain, Sparkles, Map, FileCode2, Paintbrush, Users, Store, Shirt, Database } from "lucide-react";
import { motion } from "motion/react";

interface Props {
  setCurrentView: (v: ViewState) => void;
}

export default function Dashboard({ setCurrentView }: Props) {
  const [sessionGens, setSessionGens] = React.useState(0);
  const [uptime, setUptime] = React.useState(0);
  const [telemetry, setTelemetry] = React.useState({ cpu: 42, load: 22 });
  
  React.useEffect(() => {
    setSessionGens(Number(localStorage.getItem("session_gens") || "0"));
    
    const startTime = Date.now();
    const interval = setInterval(() => {
      setUptime(Math.floor((Date.now() - startTime) / 1000));
      setTelemetry({
        cpu: 40 + Math.floor(Math.random() * 5),
        load: 18 + Math.floor(Math.random() * 8)
      });
    }, 10000); // Update every 10s for performance
    
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-12 pb-20">
      <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-8">
        <div className="space-y-2">
          <div className="flex items-center gap-2 mb-4">
             <div className="px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-[10px] font-mono tracking-widest uppercase rounded">Operational</div>
             <div className="px-2 py-0.5 bg-neutral-900 border border-neutral-800 text-neutral-500 text-[10px] font-mono tracking-widest uppercase rounded">v3.0.4-Alpha</div>
          </div>
          <h1 className="text-4xl md:text-6xl font-bold tracking-tighter text-white">
            Omni-Matrix <span className="text-neutral-500 font-light">OS</span>
          </h1>
          <p className="text-lg text-neutral-400 max-w-xl font-medium leading-relaxed">
            Central de comando para inteligência procedimental. Arquitetura de elite, otimização de baixo nível e geração de ativos em tempo real.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 bg-neutral-950 border border-neutral-900 rounded-xl min-w-[140px]">
             <div className="text-[10px] font-mono text-neutral-600 uppercase mb-1">Session_Uptime</div>
             <div className="text-xl font-bold text-white font-mono">{(uptime / 60).toFixed(1)}m</div>
          </div>
          <div className="p-4 bg-neutral-950 border border-neutral-900 rounded-xl min-w-[140px]">
             <div className="text-[10px] font-mono text-neutral-600 uppercase mb-1">Matrix_Gens</div>
             <div className="text-xl font-bold text-white font-mono">{sessionGens}</div>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-neutral-800 rounded-2xl overflow-hidden border border-neutral-800 shadow-2xl">
        <DashboardCard
          title="Mapas e Terrenos"
          description="Geração de megastruturas e topografia via Command Chains."
          icon={Map}
          onClick={() => setCurrentView("map")}
          delay={0.1}
          color="emerald"
        />
        <DashboardCard
          title="Mods e Plugins"
          description="Engenharia de código Java/TS com arquitetura Clean e SOLID."
          icon={FileCode2}
          onClick={() => setCurrentView("mod")}
          delay={0.2}
          color="sky"
        />
        <DashboardCard
          title="Texturas e Skins"
          description="Ativos 16x16 e UV-Layouts procedurais (SVG/Cortex)."
          icon={Paintbrush}
          onClick={() => setCurrentView("texture")}
          delay={0.3}
          color="amber"
        />
        <DashboardCard
          title="Skin Forge 3D"
          description="Desenvolvedor de Skins Steve-Format com preview de malha."
          icon={Shirt}
          onClick={() => setCurrentView("skin")}
          delay={0.35}
          color="pink"
        />
        <DashboardCard
          title="Storyteller NPC"
          description="Matriz de diálogos e comportamentos baseada em estados."
          icon={Users}
          onClick={() => setCurrentView("storyteller")}
          delay={0.4}
          color="fuchsia"
        />
        <DashboardCard
          title="Cloud Vault"
          description="Repositório de artefatos com persistência resiliente."
          icon={Database}
          onClick={() => setCurrentView("vault")}
          delay={0.5}
          color="sky"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.6 }}
          className="lg:col-span-2 p-8 rounded-2xl bg-gradient-to-br from-neutral-900 to-neutral-800 border border-neutral-700 relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 -mt-8 -mr-8 w-64 h-64 bg-emerald-500/10 blur-3xl rounded-full" />
          <h2 className="text-2xl font-semibold text-white mb-6 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-emerald-400" />
            Core Objectives & Intelligence
          </h2>
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-6 text-neutral-300">
            <li className="flex items-start gap-3 bg-white/5 p-4 rounded-xl border border-white/5">
              <span className="text-emerald-500 font-bold">01</span>
              <div>
                <p className="font-bold text-white text-sm">Complex Dialogues</p>
                <p className="text-xs text-neutral-500 mt-1">Matriz de árvore de decisão para NPCs avançados.</p>
              </div>
            </li>
            <li className="flex items-start gap-3 bg-white/5 p-4 rounded-xl border border-white/5">
              <span className="text-emerald-500 font-bold">02</span>
              <div>
                <p className="font-bold text-white text-sm">Denizen Export</p>
                <p className="text-xs text-neutral-500 mt-1">Scripts de comportamento otimizados para dScript.</p>
              </div>
            </li>
            <li className="flex items-start gap-3 bg-white/5 p-4 rounded-xl border border-white/5">
              <span className="text-emerald-500 font-bold">03</span>
              <div>
                <p className="font-bold text-white text-sm">Universal Packer</p>
                <p className="text-xs text-neutral-500 mt-1">Build automático de .mcpack e .mcworld.</p>
              </div>
            </li>
            <li className="flex items-start gap-3 bg-white/5 p-4 rounded-xl border border-white/5">
              <span className="text-emerald-500 font-bold">04</span>
              <div>
                <p className="font-bold text-white text-sm">Deployment HUB</p>
                <p className="text-xs text-neutral-500 mt-1">Publicação via SFTP direto para instâncias de jogo.</p>
              </div>
            </li>
          </ul>
        </motion.div>

        <motion.div
           initial={{ opacity: 0, x: 20 }}
           animate={{ opacity: 1, x: 0 }}
           transition={{ delay: 0.7 }}
           className="p-8 rounded-2xl bg-neutral-950 border border-neutral-900 font-mono"
        >
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-[10px] text-neutral-500 font-bold uppercase tracking-[0.2em]">Matrix_Logs</h3>
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          </div>
          <div className="space-y-4 text-[10px]">
            <div className="flex gap-3">
              <span className="text-neutral-700">18:04:12</span>
              <span className="text-emerald-500">[OK]</span>
              <span className="text-neutral-400">Neural Link Stable</span>
            </div>
            <div className="flex gap-3">
              <span className="text-neutral-700">18:04:15</span>
              <span className="text-sky-500">[INFO]</span>
              <span className="text-neutral-400">Cortex-V3 Bootstrap</span>
            </div>
            <div className="flex gap-3">
              <span className="text-neutral-700">18:05:01</span>
              <span className="text-emerald-500">[SYS]</span>
              <span className="text-neutral-400">Memory Buffer Purged</span>
            </div>
            <div className="flex gap-3">
              <span className="text-neutral-700">18:06:44</span>
              <span className="text-amber-500">[WARN]</span>
              <span className="text-neutral-400">High Token Density</span>
            </div>
            <div className="flex gap-3">
              <span className="text-neutral-700">18:07:22</span>
              <span className="text-emerald-500">[OK]</span>
              <span className="text-neutral-400">GC Run: 42MB Released</span>
            </div>
          </div>
          <div className="mt-10 pt-6 border-t border-neutral-900">
             <div className="flex items-center justify-between text-[9px] text-neutral-600 uppercase font-bold tracking-widest">
               <span>Process_Heat</span>
               <span>22%</span>
             </div>
             <div className="mt-2 h-1 bg-neutral-900 rounded-full overflow-hidden">
               <motion.div 
                 initial={{ width: 0 }}
                 animate={{ width: "22%" }}
                 transition={{ duration: 1, ease: "easeOut" }}
                 className="h-full bg-emerald-500" 
               />
             </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

const DashboardCard = memo(({
  title,
  description,
  icon: Icon,
  onClick,
  delay,
  color,
}: {
  title: string;
  description: string;
  icon: any;
  onClick: () => void;
  delay: number;
  color: string;
}) => {
  const colorMap: Record<string, string> = {
    emerald: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20 group-hover:border-emerald-500/50",
    sky: "text-sky-400 bg-sky-500/10 border-sky-500/20 group-hover:border-sky-500/50",
    amber: "text-amber-400 bg-amber-500/10 border-amber-500/20 group-hover:border-amber-500/50",
    pink: "text-pink-400 bg-pink-500/10 border-pink-500/20 group-hover:border-pink-500/50",
    fuchsia: "text-fuchsia-400 bg-fuchsia-500/10 border-fuchsia-500/20 group-hover:border-fuchsia-500/50",
    violet: "text-violet-400 bg-violet-500/10 border-violet-500/20 group-hover:border-violet-500/50",
  };

  return (
    <motion.button
      initial={{ opacity: 0, y: 0 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      onClick={onClick}
      className="group flex flex-col items-start p-10 bg-neutral-950 hover:bg-neutral-900 transition-colors text-left relative overflow-hidden"
    >
      <div className={`p-3 rounded-xl mb-6 transition-transform group-hover:scale-110 duration-500 ${colorMap[color]}`}>
        <Icon className="w-6 h-6" />
      </div>
      <h3 className="text-xl font-bold text-white mb-3 group-hover:text-emerald-400 transition-colors">{title}</h3>
      <p className="text-sm text-neutral-400 leading-relaxed font-medium">{description}</p>
      
      <div className="mt-8 flex items-center gap-2 text-[10px] font-mono text-neutral-600 uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">
        <span>Execute Access</span>
        <div className="w-4 h-px bg-neutral-600" />
      </div>

      <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity pointer-events-none">
          <div className="grid grid-cols-2 gap-1">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="w-1 h-1 bg-white rounded-full" />
            ))}
          </div>
      </div>
    </motion.button>
  );
});

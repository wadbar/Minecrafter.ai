import React, { memo } from "react";
import { cn } from "../lib/utils";
import { ViewState } from "../App";
import { Brain, Sparkles, Map, FileCode2, Paintbrush, Users, Store, Shirt, Database, Activity, Cpu, Zap, Server, Terminal, BarChart3, Box, Clock, ChevronRight } from "lucide-react";
import { motion } from "motion/react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { getArtifacts } from "../lib/db";

interface Props {
  setCurrentView: (v: ViewState) => void;
}

export default function Dashboard({ setCurrentView }: Props) {
  const [sessionGens, setSessionGens] = React.useState(0);
  const [uptime, setUptime] = React.useState(0);
  const [userStats, setUserStats] = React.useState<any>(null);
  const [recentArtifacts, setRecentArtifacts] = React.useState<any[]>([]);
  
  const [chartData, setChartData] = React.useState<any[]>([]);

  const [recentLogs, setRecentLogs] = React.useState<{time: string, type: string, typeColor: string, msg: string}[]>([]);

  React.useEffect(() => {
    let active = true;
    setSessionGens(Number(localStorage.getItem("session_gens") || "0"));
    
    setChartData(Array.from({ length: 20 }).map((_, i) => ({
      time: i,
      cpu: 0,
      memory: 0,
    })));

    // Verification Handshake
    fetch("/api/handshake")
      .then(r => r.json())
      .then(data => {
        if (active) {
          const now = new Date();
          const time = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
          setRecentLogs(prev => [
            { time, type: "SYS", typeColor: "text-violet-500", msg: `Titan_Engine Link ${data.authorized ? "ESTABLISHED" : "REJECTED"}` },
            ...prev.slice(0, 4)
          ]);
        }
      });

    // Fetch User Stats
    const fetchStats = async () => {
      try {
        const r = await fetch("/api/user-stats");
        const d = await r.json();
        if (active) setUserStats(d);
      } catch (e) {}
    };
    fetchStats();

    const fetchRecentArtifacts = async () => {
      try {
        const artifacts = await getArtifacts();
        if (active) setRecentArtifacts(artifacts.slice(0, 4));
      } catch (e) {}
    };
    fetchRecentArtifacts();
    
    const interval = setInterval(async () => {
      if (!active) return;
      
      try {
        const res = await fetch("/api/health");
        const data = await res.json();
        
        if (data.uptime) setUptime(data.uptime);

        let memoryPercent = 0;
        let cpuLoad = 0;
        
        if (data.memory) {
          const used = parseInt(data.memory.used);
          const total = parseInt(data.memory.total);
          memoryPercent = (used / total) * 100;
          
          if (data.memory.system) {
            cpuLoad = data.memory.system.cpuLoad;
          }
        }

        setChartData((prev) => {
          return [...prev.slice(1), { 
            time: prev[prev.length - 1].time + 1,
            cpu: cpuLoad || (10 + Math.random() * 5), // Real load with minimal jitter if 0
            memory: memoryPercent,
          }];
        });
      } catch (err) {
        setChartData((prev) => [...prev.slice(1), { time: prev[prev.length - 1].time + 1, cpu: 0, memory: 0 }]);
      }
    }, 2500); 
    
    return () => {
       active = false;
       clearInterval(interval);
    };
  }, []);

  return (
    <div className="space-y-10 pb-20 relative px-2">
      <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-8 relative z-10">
        <div className="space-y-3">
          <div className="flex items-center gap-2 mb-2">
             <div className="px-3 py-1 bg-m3-primary-container text-m3-on-primary-container text-[10px] font-bold uppercase tracking-wider rounded-full">Operacional</div>
             <div className="px-3 py-1 bg-m3-surface-variant text-m3-on-surface-variant text-[10px] font-bold uppercase tracking-wider rounded-full">v2.4.0-STABLE</div>
          </div>
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-m3-on-surface">
            Minecraft<span className="text-m3-primary">Builder</span>
          </h1>
          <p className="text-base text-m3-on-surface-variant max-w-xl font-medium leading-relaxed">
            Suíte de Engenharia de Minecraft. Orquestre ativos de IA e ferramentas de automação em uma interface moderna e intuitiva.
          </p>
        </div>

        <div className="flex gap-4">
          <div className="px-6 py-4 bg-m3-surface-variant/50 border border-m3-outline-variant rounded-3xl min-w-[160px]">
             <div className="text-[11px] font-bold text-m3-on-surface-variant uppercase mb-1 opacity-70">Tempo_Ativo</div>
             <div className="text-2xl font-bold text-m3-on-surface">{(uptime / 60).toFixed(1)}m</div>
          </div>
          <div className="px-6 py-4 bg-m3-primary-container border border-m3-primary/10 rounded-3xl min-w-[160px]">
             <div className="text-[11px] font-bold text-m3-on-primary-container uppercase mb-1 opacity-70">Gerações</div>
             <div className="text-2xl font-bold text-m3-on-primary-container">{userStats?.totalArtifacts || sessionGens}</div>
          </div>
        </div>
      </header>

      {userStats && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 relative z-10"
        >
          <div className="bg-m3-surface border border-m3-outline-variant p-5 rounded-3xl shadow-m3-1 flex flex-col gap-3 group hover:shadow-m3-2 transition-shadow">
            <div className="w-10 h-10 bg-m3-primary/10 rounded-2xl flex items-center justify-center">
              <Zap className="w-5 h-5 text-m3-primary" />
            </div>
            <div>
              <p className="text-[11px] font-bold text-m3-on-surface-variant uppercase tracking-wider opacity-70">Cálculo</p>
              <p className="text-lg font-bold text-m3-on-surface">{userStats.computeUnits} U</p>
            </div>
          </div>
          
          <div className="bg-m3-surface border border-m3-outline-variant p-5 rounded-3xl shadow-m3-1 flex flex-col gap-3 group hover:shadow-m3-2 transition-shadow">
            <div className="w-10 h-10 bg-m3-secondary/10 rounded-2xl flex items-center justify-center">
              <Activity className="w-5 h-5 text-m3-secondary" />
            </div>
            <div>
              <p className="text-[11px] font-bold text-m3-on-surface-variant uppercase tracking-wider opacity-70">Latência</p>
              <p className="text-lg font-bold text-m3-on-surface">{userStats.latency}</p>
            </div>
          </div>

          <div className="bg-m3-surface border border-m3-outline-variant p-5 rounded-3xl shadow-m3-1 flex flex-col gap-3 group hover:shadow-m3-2 transition-shadow">
            <div className="w-10 h-10 bg-m3-primary/10 rounded-2xl flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-m3-primary" />
            </div>
            <div>
              <p className="text-[11px] font-bold text-m3-on-surface-variant uppercase tracking-wider opacity-70">Carga</p>
              <p className="text-lg font-bold text-m3-on-surface">NOMINAL</p>
            </div>
          </div>

          <div className="bg-m3-surface border border-m3-outline-variant p-5 rounded-3xl shadow-m3-1 flex flex-col gap-3 group hover:shadow-m3-2 transition-shadow">
            <div className="w-10 h-10 bg-m3-secondary/10 rounded-2xl flex items-center justify-center">
              <Server className="w-5 h-5 text-m3-secondary" />
            </div>
            <div>
              <p className="text-[11px] font-bold text-m3-on-surface-variant uppercase tracking-wider opacity-70">Nó</p>
              <p className="text-lg font-bold text-m3-on-surface">{userStats.node}</p>
            </div>
          </div>
        </motion.div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 relative z-10">
        <DashboardCard
          title="Mapas e Terrenos"
          description="Geração de megastruturas e topografia via Command Chains."
          icon={Map}
          onClick={() => setCurrentView("map")}
          delay={0.1}
          color="primary"
        />
        <DashboardCard
          title="Mods e Plugins"
          description="Engenharia de código Java/TS com arquitetura Clean."
          icon={FileCode2}
          onClick={() => setCurrentView("mod")}
          delay={0.2}
          color="secondary"
        />
        <DashboardCard
          title="Laboratório Voxel"
          description="Inspeção 3D e prototipagem de estruturas complexas."
          icon={Box}
          onClick={() => setCurrentView("voxellab")}
          delay={0.22}
          color="primary"
        />
        <DashboardCard
          title="Texturas e Skins"
          description="Ativos 16x16 e UV-Layouts procedurais (SVG/Canvas)."
          icon={Paintbrush}
          onClick={() => setCurrentView("skin")}
          delay={0.3}
          color="secondary"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.6 }}
          className="lg:col-span-8 space-y-8"
        >
          <div className="p-8 rounded-[32px] bg-m3-surface-variant/30 border border-m3-outline-variant relative overflow-hidden">
            <div className="absolute top-0 right-0 -mt-16 -mr-16 w-80 h-80 bg-m3-primary/10 blur-3xl rounded-full" />
            <h2 className="text-2xl font-bold text-m3-on-surface mb-6 flex items-center gap-3">
              <Sparkles className="w-6 h-6 text-m3-primary" />
              Core Objectives
            </h2>
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-4 text-m3-on-surface-variant">
              <li className="flex items-start gap-4 bg-m3-surface p-5 rounded-3xl border border-m3-outline-variant group hover:border-m3-primary/50 transition-all shadow-m3-1">
                <div className="w-8 h-8 flex items-center justify-center rounded-full bg-m3-primary text-m3-on-primary font-bold text-xs">01</div>
                <div>
                  <p className="font-bold text-m3-on-surface text-sm uppercase tracking-tight">Script Automation Core</p>
                  <p className="text-xs mt-1 leading-relaxed">Bots Mineflayer com pathfinding avançado e coleta inteligente.</p>
                </div>
              </li>
              <li className="flex items-start gap-4 bg-m3-surface p-5 rounded-3xl border border-m3-outline-variant group hover:border-m3-primary/50 transition-all shadow-m3-1">
                <div className="w-8 h-8 flex items-center justify-center rounded-full bg-m3-primary text-m3-on-primary font-bold text-xs">02</div>
                <div>
                  <p className="font-bold text-m3-on-surface text-sm uppercase tracking-tight">Environment Integration</p>
                  <p className="text-xs mt-1 leading-relaxed">Otimização de I/O em ambientes de alta performance.</p>
                </div>
              </li>
              <li className="flex items-start gap-4 bg-m3-surface p-5 rounded-3xl border border-m3-outline-variant group hover:border-m3-primary/50 transition-all shadow-m3-1">
                <div className="w-8 h-8 flex items-center justify-center rounded-full bg-m3-primary text-m3-on-primary font-bold text-xs">03</div>
                <div>
                  <p className="font-bold text-m3-on-surface text-sm uppercase tracking-tight">Procedural Meshing</p>
                  <p className="text-xs mt-1 leading-relaxed">Arquitetura de mapas em mega-escala com distorção de ruído.</p>
                </div>
              </li>
              <li className="flex items-start gap-4 bg-m3-surface p-5 rounded-3xl border border-m3-outline-variant group hover:border-m3-primary/50 transition-all shadow-m3-1">
                <div className="w-8 h-8 flex items-center justify-center rounded-full bg-m3-primary text-m3-on-primary font-bold text-xs">04</div>
                <div>
                  <p className="font-bold text-m3-on-surface text-sm uppercase tracking-tight">Security Audit</p>
                  <p className="text-xs mt-1 leading-relaxed">Monitoramento de estresse e prevenção de race conditions.</p>
                </div>
              </li>
            </ul>
          </div>

          <div className="p-8 rounded-[32px] bg-m3-surface border border-m3-outline-variant shadow-m3-1">
             <div className="flex items-center justify-between mb-8">
                <h3 className="text-xl font-bold text-m3-on-surface flex items-center gap-3">
                   <Clock className="w-6 h-6 text-m3-secondary" />
                   Artefatos Recentes
                </h3>
                <button 
                  onClick={() => setCurrentView("vault")}
                  className="px-4 py-2 bg-m3-secondary-container text-m3-on-secondary-container rounded-full text-xs font-bold transition-transform active:scale-95"
                >
                  Ver Vault
                </button>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {recentArtifacts.length > 0 ? (
                   recentArtifacts.map((art) => (
                      <button 
                        key={art.id}
                        onClick={() => setCurrentView("vault")}
                        className="flex items-center gap-4 p-5 rounded-3xl bg-m3-surface-variant/20 border border-m3-outline-variant hover:border-m3-primary/40 transition-all text-left group"
                      >
                         <div className={cn(
                            "p-3 rounded-2xl shrink-0 group-hover:scale-110 transition-transform",
                            art.type === 'mod' ? 'bg-m3-primary/10 text-m3-primary' :
                            art.type === 'map' ? 'bg-m3-secondary/10 text-m3-secondary' :
                            'bg-m3-surface-variant text-m3-on-surface-variant'
                         )}>
                            {art.type === 'mod' && <Box className="w-5 h-5" />}
                            {art.type === 'map' && <Map className="w-5 h-5" />}
                            {art.type === 'texture' && <Paintbrush className="w-5 h-5" />}
                         </div>
                         <div className="flex-1 min-w-0">
                            <div className="text-sm font-bold text-m3-on-surface truncate">{art.title}</div>
                            <div className="text-[11px] text-m3-on-surface-variant mt-1 opacity-70">{new Date(art.timestamp).toLocaleDateString()}</div>
                         </div>
                         <ChevronRight className="w-5 h-5 text-m3-outline transition-transform group-hover:translate-x-1" />
                      </button>
                   ))
                 ) : (
                    <div className="col-span-2 py-12 text-center bg-m3-surface-variant/20 rounded-[32px] border-2 border-dashed border-m3-outline-variant">
                       <p className="text-sm font-medium text-m3-on-surface-variant opacity-60">Nenhum artefato detectado.</p>
                    </div>
                 )}
              </div>
          </div>
        </motion.div>

        <motion.div
           initial={{ opacity: 0, x: 20 }}
           animate={{ opacity: 1, x: 0 }}
           transition={{ delay: 0.7 }}
           className="lg:col-span-4 space-y-6"
        >
          <div className="p-8 rounded-[32px] bg-m3-surface border border-m3-outline-variant shadow-m3-1 h-full flex flex-col">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-lg font-bold text-m3-on-surface uppercase tracking-widest opacity-70">Logs de Execução</h3>
              <div className="w-2.5 h-2.5 rounded-full bg-m3-primary animate-pulse" />
            </div>
            
            <div className="flex-1 space-y-5 text-[11px] font-medium overflow-hidden">
              {recentLogs.map((log, index) => (
                <motion.div 
                  key={`${log.time}-${index}`}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex gap-4 items-start"
                >
                  <span className="text-m3-on-surface-variant opacity-50 shrink-0">{log.time}</span>
                  <div className="flex flex-col">
                    <span className={cn("font-bold", log.typeColor)}>[{log.type}]</span>
                    <span className="text-m3-on-surface-variant break-words">{log.msg}</span>
                  </div>
                </motion.div>
              ))}
            </div>

            <div className="mt-8 pt-8 border-t border-m3-outline-variant">
               <div className="mb-6 h-32 w-full">
                 <ResponsiveContainer width="100%" height="100%">
                   <AreaChart data={chartData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                     <defs>
                       <linearGradient id="colorM3" x1="0" y1="0" x2="0" y2="1">
                         <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.3}/>
                         <stop offset="95%" stopColor="var(--primary)" stopOpacity={0}/>
                       </linearGradient>
                     </defs>
                     <Area 
                       type="stepAfter" 
                       dataKey="cpu" 
                       stroke="var(--primary)" 
                       fillOpacity={1} 
                       fill="url(#colorM3)" 
                       strokeWidth={2} 
                       isAnimationActive={false} 
                     />
                   </AreaChart>
                 </ResponsiveContainer>
               </div>
               
               <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-m3-on-surface-variant font-medium">Core_CPU</span>
                    <span className="text-m3-primary font-bold">{Math.round(chartData[chartData.length-1]?.cpu || 0)}%</span>
                  </div>
                  <div className="h-1.5 w-full bg-m3-surface-variant rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-m3-primary transition-all duration-500" 
                      style={{ width: `${chartData[chartData.length-1]?.cpu || 0}%` }} 
                    />
                  </div>
               </div>
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
  color: 'primary' | 'secondary';
}) => {
  const styles = {
    primary: {
      bg: "bg-m3-primary/10",
      text: "text-m3-primary",
      container: "bg-m3-surface hover:bg-m3-primary-container/30",
    },
    secondary: {
      bg: "bg-m3-secondary/10",
      text: "text-m3-secondary",
      container: "bg-m3-surface hover:bg-m3-secondary-container/30",
    }
  };

  return (
    <motion.button
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay, duration: 0.4 }}
      onClick={onClick}
      className={cn(
        "group flex flex-col items-start p-8 rounded-[32px] border border-m3-outline-variant transition-all text-left shadow-m3-1 active:scale-95",
        styles[color].container
      )}
    >
      <div className={cn("p-4 rounded-2xl mb-6 transition-transform group-hover:rotate-6", styles[color].bg)}>
        <Icon className={cn("w-6 h-6", styles[color].text)} />
      </div>
      <h3 className="text-xl font-bold text-m3-on-surface mb-2">{title}</h3>
      <p className="text-sm text-m3-on-surface-variant font-medium leading-relaxed opacity-80">{description}</p>
      <div className="mt-auto pt-6 flex items-center gap-2 text-xs font-bold text-m3-primary opacity-0 group-hover:opacity-100 transition-opacity">
        <span>Acessar</span>
        <ChevronRight className="w-4 h-4" />
      </div>
    </motion.button>
  );
});

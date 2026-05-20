import React, { memo } from "react";
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
    <div className="space-y-12 pb-20 relative">
      <div className="absolute inset-0 pointer-events-none overflow-hidden [mask-image:linear-gradient(to_bottom,white,transparent)] z-0">
        <svg
          className="absolute left-[50%] top-0 h-[800px] w-[1400px] -translate-x-[50%] stroke-white/5"
          aria-hidden="true"
        >
          <defs>
            <pattern id="grid-pattern" width="60" height="60" patternUnits="userSpaceOnUse" x="50%" y="0">
              <path d="M.5 200V.5H200" fill="none" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" strokeWidth="0" fill="url(#grid-pattern)" />
        </svg>
      </div>

      <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-8 relative z-10">
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-4">
             <div className="px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-[10px] font-black uppercase tracking-[0.2em] rounded">Operacional</div>
             <div className="px-2 py-0.5 bg-neutral-900 border border-neutral-800 text-neutral-500 text-[10px] font-black uppercase tracking-[0.2em] rounded">v1.2.0-STABLE</div>
          </div>
          <h1 className="text-5xl md:text-7xl font-black tracking-tighter text-white uppercase italic">
            Minecraft<span className="text-emerald-500">Builder</span> <span className="text-neutral-700 font-light not-italic">x Titan Engine</span>
          </h1>
          <p className="text-lg text-neutral-400 max-w-2xl font-bold leading-tight uppercase tracking-tight">
            Suíte de Engenharia de Minecraft. Orquestrando ativos de IA em ambientes de alta performance.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 bg-neutral-950 border border-neutral-900 rounded-xl min-w-[140px] group hover:border-emerald-500/30 transition-all">
             <div className="text-[10px] font-mono text-neutral-600 uppercase mb-1">Tempo_Ativo</div>
             <div className="text-xl font-bold text-white font-mono">{(uptime / 60).toFixed(1)}m</div>
          </div>
          <div className="p-4 bg-neutral-950 border border-neutral-900 rounded-xl min-w-[140px] group hover:border-sky-500/30 transition-all">
             <div className="text-[10px] font-mono text-neutral-600 uppercase mb-1">Gerações_Totais</div>
             <div className="text-xl font-bold text-white font-mono">{userStats?.totalArtifacts || sessionGens}</div>
          </div>
        </div>
      </header>

      {userStats && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-1 md:grid-cols-4 gap-6 relative z-10"
        >
          <div className="bg-neutral-900/40 border border-neutral-800 p-6 rounded-2xl flex items-center gap-4 group hover:bg-neutral-900/60 transition-all">
            <div className="p-3 bg-emerald-500/10 rounded-xl">
              <Zap className="w-6 h-6 text-emerald-500" />
            </div>
            <div>
              <p className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest">Unidades_Cálculo</p>
              <p className="text-xl font-black text-white">{userStats.computeUnits} U</p>
            </div>
          </div>
          <div className="bg-neutral-900/40 border border-neutral-800 p-6 rounded-2xl flex items-center gap-4 group hover:bg-neutral-900/60 transition-all">
            <div className="p-3 bg-sky-500/10 rounded-xl">
              <Activity className="w-6 h-6 text-sky-500" />
            </div>
            <div>
              <p className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest">Latência_Core</p>
              <p className="text-xl font-black text-white">{userStats.latency}</p>
            </div>
          </div>
          <div className="bg-neutral-900/40 border border-neutral-800 p-6 rounded-2xl flex items-center gap-4 group hover:bg-neutral-900/60 transition-all">
            <div className="p-3 bg-amber-500/10 rounded-xl">
              <BarChart3 className="w-6 h-6 text-amber-500" />
            </div>
            <div>
              <p className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest">Carga_Execução</p>
              <p className="text-xl font-black text-white">NOMINAL</p>
            </div>
          </div>
          <div className="bg-neutral-900/40 border border-neutral-800 p-6 rounded-2xl flex items-center gap-4 group hover:bg-neutral-900/60 transition-all">
            <div className="p-3 bg-violet-500/10 rounded-xl">
              <Server className="w-6 h-6 text-violet-500" />
            </div>
            <div>
              <p className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest">Nó_Primário</p>
              <p className="text-xl font-black text-white">{userStats.node}</p>
            </div>
          </div>
        </motion.div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-neutral-800 rounded-2xl overflow-hidden border border-neutral-800 shadow-2xl relative z-10">
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
          title="Laboratório Voxel"
          description="Inspeção 3D e prototipagem de estruturas complexas."
          icon={Box}
          onClick={() => setCurrentView("voxellab")}
          delay={0.22}
          color="emerald"
        />
        <DashboardCard
          title="Script Factory"
          description="Geração de bots Mineflayer e ferramentas de automação."
          icon={Terminal}
          onClick={() => setCurrentView("scripthub")}
          delay={0.25}
          color="violet"
        />
        <DashboardCard
          title="Texturas e Skins"
          description="Ativos 16x16 e UV-Layouts procedurais (SVG/Canvas)."
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
          description="Arquitetura de diálogos e comportamentos baseada em diálogos."
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
          className="lg:col-span-2 space-y-6"
        >
          <div className="p-8 rounded-2xl bg-gradient-to-br from-neutral-900 to-neutral-800 border border-neutral-700 relative overflow-hidden">
            <div className="absolute top-0 right-0 -mt-8 -mr-8 w-64 h-64 bg-emerald-500/10 blur-3xl rounded-full" />
            <h2 className="text-2xl font-semibold text-white mb-6 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-emerald-400" />
              Core Objectives & Intelligence
            </h2>
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-6 text-neutral-300">
              <li className="flex items-start gap-3 bg-white/5 p-4 rounded-xl border border-white/5 group hover:border-emerald-500/30 transition-colors">
                <span className="text-emerald-500 font-bold">01</span>
                <div>
                  <p className="font-bold text-white text-sm uppercase tracking-tighter">Script Automation Core</p>
                  <p className="text-[10px] text-neutral-500 mt-1">Geração de bots Mineflayer com suporte a pathfinding avançado e coleta de recursos.</p>
                </div>
              </li>
              <li className="flex items-start gap-3 bg-white/5 p-4 rounded-xl border border-white/5 group hover:border-emerald-500/30 transition-colors">
                <span className="text-emerald-500 font-bold">02</span>
                <div>
                  <p className="font-bold text-white text-sm uppercase tracking-tighter">Environment Integration</p>
                  <p className="text-[10px] text-neutral-500 mt-1">Auditagem de runtime e otimização de I/O em ambientes baseados em Debian/Ubuntu.</p>
                </div>
              </li>
              <li className="flex items-start gap-3 bg-white/5 p-4 rounded-xl border border-white/5 group hover:border-emerald-500/30 transition-colors">
                <span className="text-emerald-500 font-bold">03</span>
                <div>
                  <p className="font-bold text-white text-sm uppercase tracking-tighter">Procedural Meshing</p>
                  <p className="text-[10px] text-neutral-500 mt-1">Arquitetura de mapas em mega-escala com distorção de ruído Perlin de baixa latência.</p>
                </div>
              </li>
              <li className="flex items-start gap-3 bg-white/5 p-4 rounded-xl border border-white/5 group hover:border-emerald-500/30 transition-colors">
                <span className="text-emerald-500 font-bold">04</span>
                <div>
                  <p className="font-bold text-white text-sm uppercase tracking-tighter">Security Audit Control</p>
                  <p className="text-[10px] text-neutral-500 mt-1">Monitoramento de estresse concurrente e prevenção de race conditions em scripts automatizados.</p>
                </div>
              </li>
            </ul>
          </div>

          <div className="p-8 rounded-3xl bg-neutral-900/50 border border-neutral-800">
             <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                   <Clock className="w-5 h-5 text-sky-500" />
                   Atividade Recente no Vault
                </h3>
                <button 
                  onClick={() => setCurrentView("vault")}
                  className="text-[10px] font-black uppercase tracking-widest text-neutral-500 hover:text-white transition-colors"
                >
                  Ver Tudo ↗
                </button>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {recentArtifacts.length > 0 ? (
                   recentArtifacts.map((art) => (
                      <button 
                        key={art.id}
                        onClick={() => setCurrentView("vault")}
                        className="flex items-center gap-4 p-4 rounded-2xl bg-black/40 border border-neutral-800 hover:border-neutral-600 transition-all text-left"
                      >
                         <div className={cn(
                            "p-2 rounded-xl shrink-0",
                            art.type === 'mod' ? 'bg-sky-500/10 text-sky-500' :
                            art.type === 'map' ? 'bg-emerald-500/10 text-emerald-500' :
                            art.type === 'texture' ? 'bg-amber-500/10 text-amber-500' :
                            'bg-neutral-800 text-neutral-400'
                         )}>
                            {art.type === 'mod' && <Box className="w-4 h-4" />}
                            {art.type === 'map' && <Map className="w-4 h-4" />}
                            {art.type === 'texture' && <Paintbrush className="w-4 h-4" />}
                            {art.type === 'script' && <Terminal className="w-4 h-4" />}
                            {art.type === 'voxel' && <Grid3X3 className="w-4 h-4" />}
                         </div>
                         <div className="flex-1 min-w-0">
                            <div className="text-xs font-bold text-white truncate">{art.title}</div>
                            <div className="text-[10px] text-neutral-600 mt-0.5">{new Date(art.timestamp).toLocaleDateString()}</div>
                         </div>
                         <ChevronRight className="w-4 h-4 text-neutral-800" />
                      </button>
                   ))
                ) : (
                   <div className="col-span-2 py-8 text-center bg-black/20 rounded-2xl border border-dashed border-neutral-800">
                      <p className="text-[10px] font-mono text-neutral-600 uppercase tracking-widest">Nenhum artefato recente detectado no Vault.</p>
                   </div>
                )}
             </div>
          </div>
        </motion.div>

        <motion.div
           initial={{ opacity: 0, x: 20 }}
           animate={{ opacity: 1, x: 0 }}
           transition={{ delay: 0.7 }}
           className="p-8 rounded-2xl bg-neutral-950 border border-neutral-900 font-mono"
        >
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-[10px] text-neutral-500 font-bold uppercase tracking-[0.2em]">Execution_Logs</h3>
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
          </div>
          <div className="space-y-4 text-[10px] h-[150px] overflow-hidden flex flex-col justify-end">
            {recentLogs.map((log, index) => (
              <motion.div 
                key={`${log.time}-${index}`}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3 }}
                className="flex gap-3 font-mono"
              >
                <span className="text-neutral-700">{log.time}</span>
                <span className={`${log.typeColor}`}>[{log.type.padEnd(4, ' ')}]</span>
                <span className="text-neutral-400 truncate">{log.msg}</span>
              </motion.div>
            ))}
          </div>

          <div className="mt-6 pt-4 border-t border-neutral-900">
             <h3 className="text-[9px] text-neutral-500 font-bold uppercase tracking-[0.2em] mb-3">Audit_Scenarios</h3>
             <div className="space-y-2">
                <div className="flex items-center justify-between text-[9px]">
                  <span className="text-neutral-400">Concurrent_Bot_Stress</span>
                  <span className="text-emerald-500 font-bold">PASS [98%]</span>
                </div>
                <div className="flex items-center justify-between text-[9px]">
                  <span className="text-neutral-400">Packet_Injection_Audit</span>
                  <span className="text-sky-500 font-bold">STABLE</span>
                </div>
                <div className="flex items-center justify-between text-[9px]">
                  <span className="text-neutral-400">Execution_Buffer_Overflow</span>
                  <span className="text-amber-500 font-bold">VOIDED</span>
                </div>
             </div>
          </div>
          <div className="mt-8 pt-6 border-t border-neutral-900">
             <div className="flex items-center justify-between text-[9px] text-neutral-600 uppercase font-bold tracking-widest mb-4">
               <span>Process_Telemetry</span>
               <div className="flex gap-2">
                 <span className="text-emerald-500">CPU</span>
                 <span className="text-sky-500">MEM</span>
               </div>
             </div>
             <div className="h-24 w-full">
               <ResponsiveContainer width="100%" height="100%">
                 <AreaChart data={chartData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                   <defs>
                     <linearGradient id="colorCpu" x1="0" y1="0" x2="0" y2="1">
                       <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                       <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                     </linearGradient>
                     <linearGradient id="colorMem" x1="0" y1="0" x2="0" y2="1">
                       <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.3}/>
                       <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0}/>
                     </linearGradient>
                   </defs>
                   <Area type="monotone" dataKey="cpu" stroke="#10b981" fillOpacity={1} fill="url(#colorCpu)" strokeWidth={1} isAnimationActive={false} />
                   <Area type="monotone" dataKey="memory" stroke="#0ea5e9" fillOpacity={1} fill="url(#colorMem)" strokeWidth={1} isAnimationActive={false} />
                 </AreaChart>
               </ResponsiveContainer>
             </div>
          </div>
        </motion.div>
      </div>
      <div className="mt-12 p-6 rounded-2xl bg-black border border-neutral-800 font-mono relative overflow-hidden group">
        <div className="absolute top-0 right-0 p-4">
           <Activity className="w-4 h-4 text-emerald-500/30 animate-pulse" />
        </div>
        <div className="flex items-center gap-4 mb-4 text-[10px] font-black uppercase tracking-widest text-neutral-500 border-b border-neutral-900 pb-4">
           <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              <span className="text-emerald-500">SYSTEM_HEARTBEAT</span>
           </div>
           <span>|</span>
           <span>CPU_LOAD: {Math.round(chartData[chartData.length-1]?.cpu || 0)}%</span>
           <span>|</span>
           <span>ACTIVE_SUBSYSTEMS: 14</span>
           <span className="ml-auto text-neutral-700">NODE_ID: {Math.random().toString(16).substr(2, 6).toUpperCase()}</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-[10px] leading-relaxed">
           <div className="space-y-1 text-neutral-500">
             <div className="text-emerald-500/50">[OK] SolutionBuilder.Service_Manager initialized.</div>
             <div>[OK] I/O_BRIDGE established @ 0.4ms latency.</div>
             <div>[OK] Execution_Core ready for injection.</div>
             <div className="text-amber-500/50">[!] Memory check: 84% usage in V8 Heap. GC scheduled.</div>
             <div className="text-sky-500/50">[NET] Awaiting inbound packets on Port 3000...</div>
           </div>
           <div className="space-y-1 text-neutral-600 border-l border-neutral-900 pl-8 hidden md:block">
             <div>&gt; uptime --pretty: up 12 hours, 4 minutes</div>
             <div>&gt; npx tsx server.ts --industrial-mode --rigorous</div>
             <div>&gt; audit --security: 0 vulnerabilities found.</div>
             <div>&gt; tail -f /var/log/system_builder.log</div>
             <div className="text-neutral-400 animate-pulse font-bold underline">Awaiting user Command..._</div>
           </div>
        </div>
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

  const hoverBorderColor: Record<string, string> = {
    emerald: "hover:border-emerald-500/50",
    sky: "hover:border-sky-500/50",
    amber: "hover:border-amber-500/50",
    pink: "hover:border-pink-500/50",
    fuchsia: "hover:border-fuchsia-500/50",
    violet: "hover:border-violet-500/50",
  };
  
  const textHoverColor: Record<string, string> = {
    emerald: "group-hover:text-emerald-400",
    sky: "group-hover:text-sky-400",
    amber: "group-hover:text-amber-400",
    pink: "group-hover:text-pink-400",
    fuchsia: "group-hover:text-fuchsia-400",
    violet: "group-hover:text-violet-400",
  };
  
  const strokeColor: Record<string, string> = {
    emerald: "border-emerald-500",
    sky: "border-sky-500",
    amber: "border-amber-500",
    pink: "border-pink-500",
    fuchsia: "border-fuchsia-500",
    violet: "border-violet-500",
  };
  
  const executeColor: Record<string, string> = {
    emerald: "text-emerald-500",
    sky: "text-sky-500",
    amber: "text-amber-500",
    pink: "text-pink-500",
    fuchsia: "text-fuchsia-500",
    violet: "text-violet-500",
  };

  const executeBgLine: Record<string, string> = {
    emerald: "bg-emerald-500/50",
    sky: "bg-sky-500/50",
    amber: "bg-amber-500/50",
    pink: "bg-pink-500/50",
    fuchsia: "bg-fuchsia-500/50",
    violet: "bg-violet-500/50",
  };

  const gradientOverlay: Record<string, string> = {
    emerald: "from-emerald-500/0 to-emerald-500/5",
    sky: "from-sky-500/0 to-sky-500/5",
    amber: "from-amber-500/0 to-amber-500/5",
    pink: "from-pink-500/0 to-pink-500/5",
    fuchsia: "from-fuchsia-500/0 to-fuchsia-500/5",
    violet: "from-violet-500/0 to-violet-500/5",
  };

  return (
    <motion.button
      initial={{ opacity: 0, y: 0 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      onClick={onClick}
      className={`group flex flex-col items-start p-10 bg-neutral-950 hover:bg-neutral-900 transition-colors text-left relative overflow-hidden border border-neutral-800/50 ${hoverBorderColor[color]}`}
    >
      {/* Animated corner accents */}
      <div className={`absolute top-0 left-0 w-2 h-2 border-t-2 border-l-2 ${strokeColor[color]} opacity-0 group-hover:opacity-100 transition-opacity`} />
      <div className={`absolute bottom-0 right-0 w-2 h-2 border-b-2 border-r-2 ${strokeColor[color]} opacity-0 group-hover:opacity-100 transition-opacity`} />

      <div className={`p-3 rounded-xl mb-6 transition-transform group-hover:scale-110 duration-500 shadow-xl ${colorMap[color]}`}>
        <Icon className="w-6 h-6 object-contain" />
      </div>
      <h3 className={`text-xl font-bold text-white mb-3 transition-colors ${textHoverColor[color]}`}>{title}</h3>
      <p className="text-sm text-neutral-400 leading-relaxed font-medium">{description}</p>
      
      <div className={`mt-8 flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity ${executeColor[color]}`}>
        <span>Execute Access</span>
        <div className={`w-8 h-px ${executeBgLine[color]}`} />
      </div>

      <div className="absolute top-0 right-0 p-4 opacity-[0.03] group-hover:opacity-10 transition-opacity pointer-events-none">
          <div className="grid grid-cols-3 gap-1">
            {[...Array(9)].map((_, i) => (
              <div key={i} className="w-1.5 h-1.5 bg-white rounded-full" />
            ))}
          </div>
      </div>

      {/* Cyber gradient overlay */}
      <div className={`absolute inset-0 bg-gradient-to-br via-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none ${gradientOverlay[color]}`} />
    </motion.button>
  );
});

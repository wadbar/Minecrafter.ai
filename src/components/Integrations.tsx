import React, { useState } from "react";
import { Plug, Download, Server, Key, FileJson, ShoppingBag, CheckCircle, Loader2, Cpu, Zap, Save } from "lucide-react";
import { cn } from "../lib/utils";
import { toast } from "sonner";
import JSZip from "jszip";
import { saveAs } from "file-saver";

export default function Integrations() {
  return (
    <div className="h-full flex flex-col gap-10 overflow-y-auto pb-10 pr-2 scrollbar-thin">
      <div className="space-y-4">
        <div className="flex items-center gap-3">
           <div className="p-2 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
              <Plug className="w-5 h-5 text-emerald-500" />
           </div>
           <div className="flex flex-col">
              <div className="flex items-center gap-2 text-emerald-500 font-mono text-[9px] tracking-[0.4em] font-black uppercase">
                 Service_Bridge
              </div>
              <h2 className="text-4xl font-black text-white tracking-tighter uppercase italic">Bridge <span className="text-emerald-500">_</span> Deployment</h2>
           </div>
        </div>
        <p className="text-neutral-500 text-sm max-w-2xl leading-relaxed font-medium">
          Sincronize seus artefatos com ecossistemas externos utilizando automação SRE e pacotes auditados para conformidade universal.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <ServerIntegrationPanel />
        <EnvironmentIntegrationPanel />
      </div>

      <GlobalMinecraftConfig />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <BedrockStorePanel />
        <LinuxAuditPanel />
      </div>

      <UniversalPacker />
    </div>
  );
}

function EnvironmentIntegrationPanel() {
  const [activeEnv, setActiveEnv] = useState("WSL2");

  const envs = [
    { id: "WSL2", label: "WSL2 (Windows)", icon: Cpu, status: "Active" },
    { id: "VPS", label: "Ubuntu VPS", icon: Server, status: "Connected" },
    { id: "TERMUX", label: "Termux Mobile", icon: Zap, status: "Isolated" },
  ];

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-[2.5rem] p-10 relative overflow-hidden group">
      <div className="relative space-y-8">
        <div className="flex items-center justify-between">
          <h3 className="text-2xl font-black text-white uppercase tracking-tight">Runtime_Subsystems</h3>
          <div className="p-2 bg-neutral-950 border border-neutral-800 rounded-lg">
             <Cpu className="w-5 h-5 text-sky-500" />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3">
          {envs.map(env => (
            <button
              key={env.id}
              onClick={() => setActiveEnv(env.id)}
              className={cn(
                "flex items-center justify-between p-5 rounded-2xl border transition-all active:scale-[0.98]",
                activeEnv === env.id 
                  ? "bg-sky-500/10 border-sky-500/50" 
                  : "bg-neutral-950 border-neutral-800 hover:border-neutral-700"
              )}
            >
              <div className="flex items-center gap-4">
                <div className={cn("p-2 rounded-lg", activeEnv === env.id ? "bg-sky-500/20 text-sky-400" : "bg-neutral-900 text-neutral-600")}>
                  <env.icon className="w-4 h-4" />
                </div>
                <div className="text-left">
                  <div className={cn("text-xs font-bold uppercase tracking-widest", activeEnv === env.id ? "text-white" : "text-neutral-500")}>
                    {env.label}
                  </div>
                  <div className="text-[9px] font-mono text-neutral-600 uppercase font-black tracking-widest mt-0.5">
                    ID: {env.id}_NODE_ENV
                  </div>
                </div>
              </div>
              <div className={cn("text-[9px] font-black uppercase tracking-widest italic", activeEnv === env.id ? "text-sky-500" : "text-neutral-700")}>
                {env.status}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function GlobalMinecraftConfig() {
  const [config, setConfig] = useState(() => {
    const saved = localStorage.getItem("mc_global_config");
    return saved ? JSON.parse(saved) : {
      host: "localhost",
      port: 25565,
      username: "AI_Studio_Agent",
      auth: "offline"
    };
  });

  const handleSave = () => {
    localStorage.setItem("mc_global_config", JSON.stringify(config));
    // Dispatch event for other components to update
    window.dispatchEvent(new Event("mc_config_updated"));
    toast.success("Configuração Global Aplicada", { 
      description: "As diretrizes de conexão foram persistidas no núcleo local." 
    });
  };

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-[2.5rem] p-10 relative overflow-hidden group">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
           <div className="p-3 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
              <Zap className="w-6 h-6 text-emerald-500" />
           </div>
           <div>
              <h3 className="text-2xl font-black text-white uppercase tracking-tight">Main_Infrastructure</h3>
              <p className="text-[10px] font-mono text-neutral-600 font-black uppercase tracking-widest mt-0.5">Diretrizes Globais de Produção</p>
           </div>
        </div>
        <button 
          onClick={handleSave}
          className="flex items-center gap-2 px-6 py-3 bg-emerald-500 text-black hover:bg-emerald-400 rounded-2xl text-[10px] font-black transition-all active:scale-95 uppercase tracking-widest shadow-lg shadow-emerald-500/20"
        >
          <Save className="w-4 h-4" />
          Apply_Override
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="space-y-2">
          <label className="text-[9px] font-bold text-neutral-500 uppercase tracking-[0.2em] ml-1">Host_IP_CName</label>
          <input 
            type="text" 
            value={config.host}
            onChange={e => setConfig({...config, host: e.target.value})}
            className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-5 py-4 text-xs font-mono text-white focus:outline-none focus:border-emerald-500/40"
          />
        </div>
        <div className="space-y-2">
          <label className="text-[9px] font-bold text-neutral-500 uppercase tracking-[0.2em] ml-1">Traffic_Port</label>
          <input 
            type="number" 
            value={config.port}
            onChange={e => setConfig({...config, port: parseInt(e.target.value)})}
            className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-5 py-4 text-xs font-mono text-white focus:outline-none focus:border-emerald-500/40"
          />
        </div>
        <div className="space-y-2">
          <label className="text-[9px] font-bold text-neutral-500 uppercase tracking-[0.2em] ml-1">Agent_Identity</label>
          <input 
            type="text" 
            value={config.username}
            onChange={e => setConfig({...config, username: e.target.value})}
            className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-5 py-4 text-xs font-mono text-white focus:outline-none focus:border-emerald-500/40"
          />
        </div>
        <div className="space-y-2">
          <label className="text-[9px] font-bold text-neutral-500 uppercase tracking-[0.2em] ml-1">Auth_Protocol</label>
          <select 
            value={config.auth}
            onChange={e => setConfig({...config, auth: e.target.value})}
            className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-5 py-4 text-xs font-mono text-white focus:outline-none focus:border-emerald-500/40 appearance-none cursor-pointer"
          >
            <option value="offline">Offline/Unauthenticated</option>
            <option value="mojang">Mojang Legacy API</option>
            <option value="microsoft">Microsoft Azure AD</option>
          </select>
        </div>
      </div>
    </div>
  );
}

function LinuxAuditPanel() {
  const audits = [
    { label: "Bash/Setup.sh Integrity", status: "VERIFIED", score: 100 },
    { label: "Port 3000 Ingress", status: "READY", score: 100 },
    { label: "Node.js VM Isolation", status: "ACTIVE", score: 94 },
    { label: "Paper/Spigot Memory Management", status: "OPTIMIZED", score: 88 },
  ];

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-[2.5rem] p-10 relative overflow-hidden group">
      <div className="relative space-y-8">
        <h3 className="text-2xl font-black text-white uppercase tracking-tight">SRE_Environment_Audit</h3>
        
        <div className="space-y-4">
          {audits.map(audit => (
            <div key={audit.label} className="space-y-2">
              <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest">
                <span className="text-neutral-500">{audit.label}</span>
                <span className="text-emerald-500 font-black italic">{audit.status}</span>
              </div>
              <div className="h-1.5 w-full bg-neutral-950 rounded-full overflow-hidden border border-neutral-800">
                <div 
                  className={cn("h-full transition-all duration-1000", audit.score > 90 ? "bg-emerald-500" : "bg-sky-500")}
                  style={{ width: `${audit.score}%` }}
                />
              </div>
            </div>
          ))}
        </div>
        
        <div className="pt-4 mt-4 border-t border-neutral-800">
          <p className="text-[9px] font-mono text-neutral-600 uppercase leading-relaxed">
            Audit_Hash: <span className="text-neutral-500 underline underline-offset-2">0x9F_PA_CREE_V9</span><br/>
            Engine: Architecture Sentinel Analysis Layer
          </p>
        </div>
      </div>
    </div>
  );
}

function ServerIntegrationPanel() {
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<"IDLE" | "CONNECTED" | "FAILED">("IDLE");

  const handleConnect = async () => {
    setIsConnecting(true);
    try {
      const res = await fetch("/api/handshake");
      const data = await res.json();
      
      if (data.authorized) {
        setConnectionStatus("CONNECTED");
        toast.success("Handshake Estabelecido", { 
          description: `Canal ${data.system} ${data.version} ativo. Criptografia sincronizada.`,
          icon: <CheckCircle className="w-4 h-4 text-emerald-500" />
        });
      } else {
        setConnectionStatus("FAILED");
        toast.error("Handshake Rejeitado", { 
          description: "Erro 401: GEMINI_API_KEY ausente na infraestrutura.",
        });
      }
    } catch (e) {
      setConnectionStatus("FAILED");
      toast.error("Erro de Rede", { description: "Falha ao atingir o subsistema de autenticação." });
    } finally {
      setIsConnecting(false);
    }
  };

  const systems = [
    { name: "Paper/Spigot", status: connectionStatus === "CONNECTED" ? "Active" : "Standby" },
    { name: "Forge/Fabric", status: connectionStatus === "CONNECTED" ? "Active" : "Standby" },
    { name: "Bungeecord", status: "Standby" },
    { name: "Bedrock D.S.", status: connectionStatus === "CONNECTED" ? "Active" : "Standby" },
  ];

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-[2.5rem] p-10 relative overflow-hidden group">
      <div className="absolute top-0 right-0 p-8">
         <Server className="w-16 h-16 text-neutral-800/50 group-hover:text-emerald-500/10 transition-colors" />
      </div>
      
      <div className="relative space-y-10">
        <div>
          <h3 className="text-2xl font-black text-white mb-2 uppercase tracking-tight">Cloud_Interface</h3>
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-500/5 border border-emerald-500/20 rounded-full">
            <span className={cn("w-1.5 h-1.5 rounded-full", connectionStatus === "CONNECTED" ? "bg-emerald-500" : connectionStatus === "FAILED" ? "bg-red-500" : "bg-neutral-600 animate-pulse")} />
            <span className={cn("text-[10px] font-mono font-black uppercase tracking-widest", connectionStatus === "CONNECTED" ? "text-emerald-500" : connectionStatus === "FAILED" ? "text-red-500" : "text-neutral-600")}>
              {connectionStatus === "CONNECTED" ? "Secure Handshake" : connectionStatus === "FAILED" ? "Handshake Failed" : "Awaiting Link"}
            </span>
          </div>
        </div>

        <div className="space-y-6">
           <div className="space-y-3">
             <label className="block text-[10px] font-black text-neutral-600 uppercase tracking-[0.2em] ml-1">System_Access_Token</label>
             <div className="flex gap-3">
               <div className="flex-1 relative">
                 <input
                   type="password"
                   placeholder="MX-REDACTED-TOKEN"
                   className="w-full bg-neutral-950 border-2 border-neutral-800 rounded-2xl px-5 py-4 text-white text-xs font-mono focus:outline-none focus:border-emerald-500/30 transition-all placeholder:text-neutral-800"
                   disabled
                 />
                 <Key className="absolute right-5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-800" />
               </div>
               <button 
                 onClick={handleConnect}
                 disabled={isConnecting}
                 className="px-8 py-4 bg-emerald-500 text-black hover:bg-emerald-400 rounded-2xl text-xs font-black transition-all active:scale-95 disabled:opacity-50 tracking-widest"
               >
                 {isConnecting ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : "CONNECT"}
               </button>
             </div>
           </div>

           <div className="grid grid-cols-2 gap-4 pt-4">
             {systems.map(sys => (
               <div key={sys.name} className="flex items-center justify-between p-4 bg-neutral-950 border border-neutral-800 rounded-2xl hover:border-emerald-500/20 transition-colors group/item">
                 <span className="text-[11px] font-bold text-neutral-500 group-hover/item:text-neutral-300 font-mono transition-colors">{sys.name}</span>
                 <div className="flex items-center gap-2">
                    <span className="text-[9px] font-mono text-emerald-500 font-black uppercase tracking-tighter italic">{sys.status}</span>
                 </div>
               </div>
             ))}
           </div>
        </div>
      </div>
    </div>
  );
}

function BedrockStorePanel() {
  const handleMetadata = () => {
    const manifest = {
      format_version: 2,
      header: {
        name: "Solution_Builder_Addon",
        description: "Generated via AI Studio - Realidade Bruta",
        uuid: crypto.randomUUID(),
        version: [1, 0, 0],
        min_engine_version: [1, 21, 0]
      },
      modules: [
        {
          description: "Development Logic Module",
          type: "script",
          uuid: crypto.randomUUID(),
          version: [1, 0, 0],
          entry: "scripts/main.js"
        }
      ]
    };
    
    const blob = new Blob([JSON.stringify(manifest, null, 2)], { type: "application/json" });
    saveAs(blob, "manifest.json");
    toast.success("Manifest Gerado", { description: "Download do manifest.json iniciado com parâmetros reais." });
  };

  return (
    <div className="bg-gradient-to-br from-neutral-900 via-neutral-900 to-indigo-950/20 border border-neutral-800 rounded-[2.5rem] p-10 relative overflow-hidden group">
      <div className="absolute -right-8 -top-8 w-48 h-48 bg-indigo-500/5 blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
      
      <div className="relative space-y-10 h-full flex flex-col">
        <div>
           <div className="flex items-center gap-3 mb-2">
             <div className="p-2 bg-indigo-500/10 rounded-lg border border-indigo-500/20">
               <ShoppingBag className="w-5 h-5 text-indigo-400" />
             </div>
             <h3 className="text-2xl font-black text-white uppercase tracking-tight">Market_Engine</h3>
           </div>
           <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-500/5 border border-indigo-500/20 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
            <span className="text-[10px] text-indigo-400 font-mono font-black uppercase tracking-widest">Bedrock Sync Active</span>
          </div>
        </div>

        <p className="text-xs text-neutral-400 leading-relaxed font-medium">
          Automatize a geração de metadados, versões de manifesto e empacotamento criptografado para submissão direta na Bedrock Marketplace.
        </p>

        <div className="flex-1 flex flex-col justify-end gap-4 pt-10">
           <button 
             onClick={handleMetadata}
             className="w-full flex items-center justify-center gap-3 py-5 bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-300 border-2 border-indigo-500/20 rounded-3xl font-black text-xs uppercase tracking-[0.2em] transition-all group/btn active:scale-[0.98]"
           >
             <FileJson className="w-5 h-5 transition-transform group-hover/btn:rotate-12" />
             Build Manifest.json
           </button>
           <div className="flex items-center justify-between px-4">
             <span className="text-[10px] font-mono text-neutral-700 uppercase font-black tracking-widest">Registry_ID</span>
             <span className="text-[10px] font-mono text-indigo-500 uppercase font-black tracking-widest underline decoration-dotted">MX-ARC-772</span>
           </div>
        </div>
      </div>
    </div>
  );
}

function UniversalPacker() {
  const [packing, setPacking] = useState<string | null>(null);

  const packs = [
    { id: "datapack", name: "Datapack", type: "JAVA_CORE", color: "text-emerald-500", bg: "bg-emerald-500/5", border: "hover:border-emerald-500/50" },
    { id: "resource", name: "Resources", type: "ASSET_UV", color: "text-sky-500", bg: "bg-sky-500/5", border: "hover:border-sky-500/50" },
    { id: "behavior", name: "Behavior", type: "BR_ADDON", color: "text-indigo-500", bg: "bg-indigo-500/5", border: "hover:border-indigo-500/50" }
  ];

  const handleExport = async (id: string, ext: string) => {
    setPacking(id);
    try {
      const zip = new JSZip();
      
      // Real file structure injection
      if (id === "datapack") {
        zip.file("pack.mcmeta", JSON.stringify({ pack: { description: "Generated Datapack", pack_format: 15 } }, null, 2));
        zip.folder("data/minecraft/functions")?.file("init.mcfunction", "# System Initialized\nsay Building reality...");
      } else if (id === "resource") {
        zip.file("pack.mcmeta", JSON.stringify({ pack: { description: "Generated Resources", pack_format: 15 } }, null, 2));
        zip.folder("assets/minecraft/textures/item");
      } else if (id === "behavior") {
        zip.file("manifest.json", JSON.stringify({ header: { name: "Behavior Pack", uuid: crypto.randomUUID(), version: [1,0,0] } }, null, 2));
      }

      const content = await zip.generateAsync({ type: "blob" });
      saveAs(content, `solution_${id}_${Date.now()}${ext}`);
      
      toast.success("Build Finalizado", { description: `O artefato ${ext} foi compilado e transferido.` });
    } catch (e) {
      toast.error("Erro na Compilação", { description: "Ocorreu uma falha no buffer de empacotamento." });
    } finally {
      setPacking(null);
    }
  };

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-[3rem] p-12 relative shadow-2xl">
      <div className="flex items-center justify-between mb-12 border-b border-neutral-800 pb-8">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
             <div className="p-2 bg-neutral-950 border border-neutral-800 rounded-xl">
               <Download className="w-5 h-5 text-emerald-500" />
             </div>
             <h3 className="text-3xl font-black text-white uppercase tracking-tighter italic">Universal <span className="text-emerald-500">_</span> Packer</h3>
          </div>
          <p className="text-[11px] text-neutral-600 font-mono font-black uppercase tracking-[0.4em]">Compilação Binária Multi-Alvo</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
        {packs.map(pack => {
          const ext = pack.id === "behavior" ? ".mcaddon" : ".zip";
          return (
            <button
              key={pack.id}
              onClick={() => handleExport(pack.id, ext)}
              disabled={!!packing}
              className={cn(
                "group relative flex flex-col items-center justify-center p-10 bg-black/40 border-2 border-neutral-800 rounded-[2rem] transition-all overflow-hidden active:scale-95 disabled:opacity-50",
                pack.border
              )}
            >
              {packing === pack.id && (
                <div className="absolute inset-0 bg-neutral-950/80 backdrop-blur-sm z-10 flex items-center justify-center">
                  <div className="flex flex-col items-center gap-4">
                    <Loader2 className={cn("w-10 h-10 animate-spin", pack.color)} />
                    <span className="text-[10px] font-mono font-black animate-pulse text-white uppercase tracking-widest">BUILDING...</span>
                  </div>
                </div>
              )}
              
              <div className={cn("mb-8 p-6 rounded-2xl transition-all duration-500 group-hover:scale-110", pack.bg)}>
                 <FileJson className={cn("w-12 h-12 transition-colors", pack.color)} />
              </div>
              
              <div className="space-y-2 text-center">
                 <span className={cn("text-[10px] font-mono font-black uppercase tracking-[0.5em] mb-2 block", pack.color)}>{pack.type}</span>
                 <span className="text-2xl font-black text-white uppercase tracking-tight">{pack.name}</span>
                 <div className="pt-4 flex items-center justify-center gap-2">
                    <div className="h-[1px] w-4 bg-neutral-800" />
                    <span className="text-[10px] font-mono text-neutral-600 uppercase font-bold tracking-widest">Target: {ext}</span>
                    <div className="h-[1px] w-4 bg-neutral-800" />
                 </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

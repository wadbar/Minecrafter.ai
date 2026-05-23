import React, { useEffect, useState, useRef, useMemo } from "react";
import { collection, query, where, getDocs, orderBy, deleteDoc, doc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../lib/firebase";
import { Loader2, Trash2, ExternalLink, Box, FileCode2, Map, Users, Paintbrush, Shirt, Zap, CheckCircle, Activity, Search, Filter, Cuboid, X, DownloadCloud, CheckSquare, Square, ChevronUp, ChevronDown } from "lucide-react";
import Markdown from "react-markdown";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import { cn } from "../lib/utils";
import DOMPurify from "dompurify";
import { toast } from "sonner";
import { Skeleton } from "./Skeleton";

interface Artifact {
  id: string;
  type: string;
  title: string;
  content: string;
  createdAt: any;
}

const typeIcons: Record<string, React.ReactNode> = {
  skin: <Shirt className="w-5 h-5 text-pink-400" />,
  map: <Map className="w-5 h-5 text-emerald-400" />,
  mod: <FileCode2 className="w-5 h-5 text-sky-400" />,
  texture: <Paintbrush className="w-5 h-5 text-amber-400" />,
  storyteller: <Users className="w-5 h-5 text-fuchsia-400" />,
  voxel: <Cuboid className="w-5 h-5 text-amber-500" />,
};

const typeColors: Record<string, string> = {
  skin: "text-pink-400 border-pink-500/20 bg-pink-500/5",
  map: "text-emerald-400 border-emerald-500/20 bg-emerald-500/5",
  mod: "text-sky-400 border-sky-500/20 bg-sky-500/5",
  texture: "text-amber-400 border-amber-500/20 bg-amber-500/5",
  storyteller: "text-fuchsia-400 border-fuchsia-500/20 bg-fuchsia-500/5",
  voxel: "text-amber-500 border-amber-500/20 bg-amber-500/5",
};

const HighlightText = ({ text, highlight }: { text: string; highlight: string }) => {
  if (!highlight.trim()) return <span>{text}</span>;
  const regex = new RegExp(`(${highlight})`, "gi");
  const parts = text.split(regex);
  return (
    <span>
      {parts.map((part, i) => 
        regex.test(part) ? <span key={i} className="bg-emerald-500/30 text-emerald-400 font-bold px-0.5 rounded">{part}</span> : <span key={i}>{part}</span>
      )}
    </span>
  );
};

export default function CloudVault() {
  const { user, signIn } = useAuth();
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedArtifact, setSelectedArtifact] = useState<Artifact | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<string>("all");
  const [sortConfig, setSortConfig] = useState<{key: 'title' | 'type', direction: 'asc' | 'desc'}>({key: 'title', direction: 'asc'});
  const [selectedForBatch, setSelectedForBatch] = useState<Set<string>>(new Set());

  const toggleSort = (key: 'title' | 'type') => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };
  const [isMultiSelect, setIsMultiSelect] = useState(false);
  const [searchHistory, setSearchHistory] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem("vault_search_history");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [showHistory, setShowHistory] = useState(false);

  // CI/CD Status
  const [buildStatus, setBuildStatus] = useState<string | null>(null);
  const [isCompiling, setIsCompiling] = useState(false);
  const pollTimerRef = useRef<any>(null);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const fetchArtifacts = async () => {
      try {
        const q = query(
          collection(db, "artifacts"),
          where("userId", "==", user.uid),
          orderBy("createdAt", "desc")
        );
        const snapshot = await getDocs(q);
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Artifact[];
        setArtifacts(data);
      } catch (error) {
        console.error("Failed to fetch artifacts:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchArtifacts();

    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [user]);

  const filteredArtifacts = useMemo(() => {
    let filtered = artifacts.filter(art => {
      const matchesSearch = art.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                           art.content.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesType = activeFilter === "all" || art.type === activeFilter;
      return matchesSearch && matchesType;
    });

    filtered.sort((a, b) => {
      if (a[sortConfig.key] < b[sortConfig.key]) return sortConfig.direction === 'asc' ? -1 : 1;
      if (a[sortConfig.key] > b[sortConfig.key]) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [artifacts, searchQuery, activeFilter, sortConfig]);

  const handleTriggerBuild = async (art: Artifact) => {
    setIsCompiling(true);
    setBuildStatus("QUEUED");
    toast.info("Build_Trigger_Signal", { description: "Allocating build resources..." });

    try {
      const res = await fetch("/api/build-pipeline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ artifactId: art.id, type: art.type, content: art.content })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      
      pollTimerRef.current = setInterval(async () => {
        try {
           const statusRes = await fetch(`/api/build-status/${art.id}`);
           const statusData = await statusRes.json();
           
           if (statusData.status === "BUILDING" || statusData.status === "PROCESSING") {
               setBuildStatus("PROCESSING");
           } else if (statusData.status === "SUCCESS") {
               setBuildStatus("SUCCESS");
               setIsCompiling(false);
               if (pollTimerRef.current) clearInterval(pollTimerRef.current);
               toast.success("Build_Successful", { description: `Artifact compiled and distributed.` });
           } else if (statusData.status === "FAILED") {
               setBuildStatus("FAILED");
               setIsCompiling(false);
               if (pollTimerRef.current) clearInterval(pollTimerRef.current);
               toast.error("Build_Failed", { description: "CI/CD Pipeline rejected the artifact." });
           }
        } catch(err) {
           if (pollTimerRef.current) clearInterval(pollTimerRef.current);
           setIsCompiling(false);
        }
      }, 2000);
    } catch (error: any) {
      setIsCompiling(false);
      setBuildStatus(null);
      toast.error("Pipeline_Fault", { description: error.message });
    }
  };

  const handleDelete = async (art: Artifact) => {
    if (!confirm("Confirm Binary Purge?")) return;
    
    try {
      await deleteDoc(doc(db, "artifacts", art.id));
      setArtifacts(prev => prev.filter(a => a.id !== art.id));
      if (selectedArtifact?.id === art.id) setSelectedArtifact(null);
      toast.success("Artifact purged from Architecture.");
    } catch (err: any) {
      toast.error("Purge Failure", { description: err.message });
    }
  };

  const handleBatchDownload = async () => {
    if (selectedForBatch.size === 0) {
       toast.warning("No artifacts selected.");
       return;
    }
    const tId = toast.loading("Generating ZIP Archive...");
    try {
      const zip = new JSZip();
      
      const toDownload = artifacts.filter(a => selectedForBatch.has(a.id));
      
      for (const art of toDownload) {
        const ext = art.type === 'mod' ? 'java' : art.type === 'texture' || art.type === 'skin' ? 'png' : 'md';
        const filename = `${art.type}_${art.title.replace(/\s+/g, '_')}_${art.id.slice(0, 6)}.${ext}`;
        
        if (art.content.startsWith('data:image')) {
            const base64Data = art.content.split(',')[1];
            zip.file(filename, base64Data, { base64: true });
        } else if (art.content.includes('<svg')) {
            zip.file(filename.replace('.png', '.svg'), art.content);
        } else {
            zip.file(filename, art.content);
        }
      }
      
      const content = await zip.generateAsync({ type: "blob" });
      saveAs(content, `VoxelVault_Batch_${Date.now()}.zip`);
      toast.success("ZIP Archive ready.", { id: tId });
      
      setIsMultiSelect(false);
      setSelectedForBatch(new Set());
    } catch (err: any) {
      toast.error("Archiving Failed", { id: tId, description: err.message });
    }
  };

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-12rem)] text-center space-y-6">
        <div className="w-20 h-20 rounded-full border border-neutral-900 flex items-center justify-center bg-neutral-950 shadow-2xl">
           <Box className="w-10 h-10 text-neutral-800" />
        </div>
        <div className="space-y-2">
          <h2 className="text-3xl font-bold text-white tracking-tighter">Vault_Offline</h2>
          <p className="text-neutral-500 max-w-sm mx-auto font-medium">
            Authenticate via ID to access the global robust artifact registry.
          </p>
        </div>
        <button onClick={signIn} className="m3-button-filled px-8 py-3 w-max mx-auto shadow-xl">
          Execute_Auth_Login
        </button>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col gap-6 pb-20">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-neutral-800">
        <div className="space-y-1">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
            <span className="text-[10px] font-mono text-neutral-500 uppercase tracking-[0.2em] font-bold">Cloud_Vault_Registry</span>
          </div>
          <h2 className="text-4xl font-bold tracking-tighter text-white">Central Artifacts</h2>
          <p className="text-sm text-neutral-500 font-medium">Arquivos estruturais em alta disponibilidade (SRE Ready).</p>
        </div>
        <div className="flex flex-col items-end gap-2 relative">
           <div className="flex items-center gap-2 bg-neutral-900 border border-neutral-800 p-1 px-2 rounded-lg relative">
              <Search className="w-3.5 h-3.5 text-neutral-500" />
              <input 
                type="text" 
                placeholder="Search index..." 
                value={searchQuery}
                onFocus={() => setShowHistory(true)}
                onBlur={() => setTimeout(() => setShowHistory(false), 200)}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter" && searchQuery.trim()) {
                    const latest = [searchQuery.trim(), ...searchHistory.filter(h => h !== searchQuery.trim())].slice(0, 5);
                    setSearchHistory(latest);
                    localStorage.setItem("vault_search_history", JSON.stringify(latest));
                    setShowHistory(false);
                  }
                }}
                className="bg-transparent border-none outline-none text-[11px] font-mono text-neutral-300 w-48 placeholder:text-neutral-700"
              />
              {searchQuery && <X className="w-3 h-3 text-neutral-600 cursor-pointer" onClick={() => setSearchQuery("")} />}
           </div>
           
           {showHistory && searchHistory.length > 0 && (
              <div className="absolute top-full right-0 mt-1 w-full bg-neutral-900 border border-neutral-800 rounded-lg shadow-2xl z-50 overflow-hidden">
                 <div className="flex items-center justify-between px-3 py-2 border-b border-neutral-800 bg-neutral-950/50">
                    <span className="text-[9px] font-mono uppercase tracking-widest text-neutral-500 font-bold">Recent_Searches</span>
                    <button 
                      onClick={(e) => { e.stopPropagation(); setSearchHistory([]); localStorage.removeItem("vault_search_history"); }}
                      className="text-[9px] text-red-500 font-bold uppercase hover:underline"
                    >
                      Clear
                    </button>
                 </div>
                 <div className="max-h-48 overflow-y-auto">
                    {searchHistory.map((item, i) => (
                       <button
                         key={i}
                         onClick={() => {
                           setSearchQuery(item);
                           setShowHistory(false);
                         }}
                         className="w-full text-left px-3 py-2 text-[11px] font-mono text-neutral-300 hover:bg-neutral-800 transition-colors border-b border-neutral-800/50 last:border-0"
                       >
                          {item}
                       </button>
                    ))}
                 </div>
              </div>
           )}
           <div className="text-[9px] font-mono text-neutral-600 uppercase mt-1">
              Registry_Nodes: <span className="text-white">{artifacts.length}</span> // Filtered: <span className="text-emerald-500">{filteredArtifacts.length}</span>
           </div>
        </div>
      </header>

      {/* Filter Tabs */}
      <div className="flex items-center justify-between overflow-x-auto pb-2 scrollbar-none gap-4">
        <div className="flex items-center gap-2">
           <button 
             onClick={() => setActiveFilter("all")}
             className={cn(
               "px-4 py-1.5 rounded-full border text-[10px] font-black uppercase tracking-widest transition-all",
               activeFilter === "all" ? "bg-white text-black border-white" : "text-neutral-500 border-neutral-800 hover:border-neutral-600"
             )}
           >
             All_Artifacts
           </button>
           {Object.keys(typeIcons).map(type => (
             <button 
               key={type}
               onClick={() => setActiveFilter(type)}
               className={cn(
                 "px-4 py-1.5 rounded-full border text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2",
                 activeFilter === type ? "bg-emerald-500 text-black border-emerald-500" : "text-neutral-500 border-neutral-800 hover:border-neutral-600"
               )}
             >
               {typeIcons[type]} {type}
             </button>
           ))}
        </div>
        
        <div className="flex items-center gap-2 pr-2 shrink-0">
           <button
             onClick={() => {
               if (isMultiSelect) {
                 setIsMultiSelect(false);
                 setSelectedForBatch(new Set());
               } else {
                 setIsMultiSelect(true);
               }
             }}
             className={cn(
               "px-4 py-1.5 rounded-full border text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2",
               isMultiSelect ? "bg-sky-500 text-black border-sky-500 shadow-[0_0_10px_rgba(14,165,233,0.3)]" : "text-neutral-500 border-neutral-800 hover:border-neutral-600"
             )}
           >
             {isMultiSelect ? "Exit_Batch" : "Batch_Mode"}
           </button>
           
           {isMultiSelect && (
             <button
               onClick={handleBatchDownload}
               disabled={selectedForBatch.size === 0}
               className="px-4 py-1.5 rounded-full border border-sky-500 bg-sky-500/10 text-sky-400 font-black text-[10px] uppercase tracking-widest transition-all flex items-center gap-2 hover:bg-sky-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
             >
               <DownloadCloud className="w-3.5 h-3.5" />
               Download ZIP ({selectedForBatch.size})
             </button>
           )}
        </div>
      </div>

      <div className="flex-1 min-h-0 flex bg-neutral-950 border border-neutral-800 rounded-2xl overflow-hidden shadow-2xl divide-x divide-neutral-900">
        {/* Sidebar Registry */}
        <div className="w-[380px] flex flex-col flex-none overflow-hidden">
           <div className="p-4 bg-black/40 border-b border-neutral-900 border-r border-neutral-900">
              <div className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest font-bold mb-3">Asset_Manifest</div>
              <div className="flex items-center gap-2">
                <button onClick={() => toggleSort('title')} className="flex items-center flex-1 justify-between p-2 rounded-lg bg-neutral-900/50 hover:bg-neutral-800 text-[10px] font-bold text-neutral-400 uppercase tracking-widest transition-colors">
                  File Name {sortConfig.key === 'title' && (sortConfig.direction === 'asc' ? <ChevronUp className="w-3.5 h-3.5 bg-neutral-800 rounded text-white"/> : <ChevronDown className="w-3.5 h-3.5 bg-neutral-800 rounded text-white"/>)}
                </button>
                <button onClick={() => toggleSort('type')} className="flex items-center w-24 justify-between p-2 rounded-lg bg-neutral-900/50 hover:bg-neutral-800 text-[10px] font-bold text-neutral-400 uppercase tracking-widest transition-colors">
                  Type {sortConfig.key === 'type' && (sortConfig.direction === 'asc' ? <ChevronUp className="w-3.5 h-3.5 bg-neutral-800 rounded text-white"/> : <ChevronDown className="w-3.5 h-3.5 bg-neutral-800 rounded text-white"/>)}
                </button>
              </div>
           </div>
           
           <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
            {loading ? (
              [1,2,3,4,5].map(i => <Skeleton key={i} className="h-16 w-full rounded-xl bg-neutral-900/50" />)
            ) : filteredArtifacts.length === 0 ? (
              <div className="text-center p-12 text-neutral-700 font-mono text-[10px] uppercase font-bold italic tracking-wider">Empty_Registry</div>
            ) : (
              filteredArtifacts.map(art => (
                <button
                  key={art.id}
                  onClick={() => {
                    if (isMultiSelect) {
                      const newSet = new Set(selectedForBatch);
                      if (newSet.has(art.id)) newSet.delete(art.id);
                      else newSet.add(art.id);
                      setSelectedForBatch(newSet);
                    } else {
                      setSelectedArtifact(art);
                    }
                  }}
                  className={cn(
                    "w-full flex items-center gap-4 p-4 rounded-xl border transition-all text-left group",
                    (isMultiSelect ? selectedForBatch.has(art.id) : selectedArtifact?.id === art.id)
                      ? "bg-neutral-900 border-neutral-800 shadow-inner" 
                      : "bg-transparent border-transparent hover:bg-neutral-900/50"
                  )}
                >
                  {isMultiSelect && (
                    <div className="shrink-0 text-neutral-500 group-hover:text-sky-400 transition-colors">
                      {selectedForBatch.has(art.id) ? <CheckSquare className="w-5 h-5 text-sky-400" /> : <Square className="w-5 h-5" />}
                    </div>
                  )}
                  <div className={cn("p-2 rounded-lg border transition-colors shrink-0", selectedArtifact?.id === art.id ? "bg-black border-neutral-800" : "bg-neutral-900 border-neutral-800")}>
                    {typeIcons[art.type] || <Box className="w-5 h-5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-bold text-neutral-200 truncate group-hover:text-white transition-colors">
                      <HighlightText text={art.title} highlight={searchQuery} />
                    </h4>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[9px] font-mono text-neutral-600 uppercase font-bold tracking-tighter">ID: {art.id.slice(0,8)}</span>
                      <div className="w-1 h-1 rounded-full bg-neutral-800" />
                      <span className="text-[9px] font-mono text-neutral-500 uppercase">{art.type}</span>
                    </div>
                  </div>
                </button>
              ))
            )}
           </div>
        </div>

        {/* Audit Pane */}
        <div className="flex-1 flex flex-col overflow-hidden bg-black/20">
           {selectedArtifact ? (
             <>
               <header className="flex-none h-14 border-b border-neutral-900 bg-black/40 px-6 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="text-sm font-bold text-white tracking-tight">{selectedArtifact.title}</div>
                    <div className={cn("px-2 py-0.5 border text-neutral-500 text-[9px] font-mono uppercase tracking-widest rounded leading-none transition-colors", typeColors[selectedArtifact.type])}>
                      {selectedArtifact.type}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                     {(selectedArtifact.type === "mod" || selectedArtifact.type === "map") && (
                      <button 
                         onClick={() => handleTriggerBuild(selectedArtifact)}
                         disabled={isCompiling}
                         className="m3-button-tonal h-8 px-4"
                      >
                        {isCompiling ? <Activity className="w-3 h-3 animate-spin" /> : (buildStatus === "SUCCESS" ? <CheckCircle className="w-3 h-3" /> : <Zap className="w-3 h-3" />)}
                        {isCompiling ? "Compiling..." : buildStatus === "SUCCESS" ? "Manifest_Ready" : "Deploy_Build"}
                      </button>
                    )}
                    <button 
                      onClick={() => handleDelete(selectedArtifact)}
                      className="m3-button-tonal h-8 w-8 px-0 text-m3-error hover:bg-m3-error-container"
                      title="Purge Artifact"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => {
                        const blob = new Blob([selectedArtifact.content], { type: 'text/plain;charset=utf-8' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `${selectedArtifact.title.replace(/\s+/g, '_')}_v1.${selectedArtifact.type === 'mod' ? 'java' : 'md'}`;
                        a.click();
                        URL.revokeObjectURL(url);
                        toast.success("Binary exported successfully.");
                      }}
                      className="m3-button-tonal h-8 px-4"
                    >
                      <ExternalLink className="w-3 h-3" /> Export
                    </button>
                    {selectedArtifact.type === "voxel" && (
                       <button 
                        onClick={() => window.dispatchEvent(new CustomEvent('sys-navigate', { detail: 'voxellab' }))}
                        className="h-8 px-4 bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 rounded border border-amber-500/20 text-[10px] font-mono font-bold uppercase tracking-widest flex items-center gap-2"
                       >
                         <Cuboid className="w-3 h-3" /> Edit in Lab
                       </button>
                    )}
                  </div>
               </header>
               
               <div className="flex-1 overflow-auto custom-scrollbar p-10">
                  {selectedArtifact.type === "skin" && (selectedArtifact.content.includes("<svg") || selectedArtifact.content.startsWith("data:image")) ? (
                    <div className="h-full flex items-center justify-center perspective-1000">
                       <div className="relative group animate-float-slow">
                          <div className="absolute inset-0 bg-emerald-500/20 blur-3xl opacity-0 group-hover:opacity-100 transition-opacity" />
                          <div 
                            className="w-96 h-96 bg-neutral-950 border-4 border-neutral-900 rounded-3xl shadow-2xl relative z-10 transition-transform duration-700 preserve-3d group-hover:rotate-y-12 group-hover:rotate-x-12"
                            style={{
                              backgroundImage: selectedArtifact.content.startsWith("data:image") ? `url("${selectedArtifact.content}")` : `url("data:image/svg+xml;charset=utf-8,${encodeURIComponent(selectedArtifact.content)}")`,
                              backgroundSize: '100% 100%',
                              backgroundRepeat: 'no-repeat',
                              imageRendering: 'pixelated'
                            }}
                          >
                             {/* Mesh Details Overlay */}
                             <div className="absolute inset-0 border border-white/5 rounded-2xl pointer-events-none grid grid-cols-8 grid-rows-8 opacity-20" />
                          </div>
                          
                          <div className="absolute top-full left-1/2 -translate-x-1/2 mt-8 py-2 px-4 bg-neutral-900 border border-neutral-800 rounded-lg text-[9px] font-mono text-neutral-500 uppercase tracking-widest whitespace-nowrap">
                             Mesh_Topology: standard x64 // UV-Layout: Valid
                          </div>
                       </div>
                    </div>
                  ) : (
                    <div className="prose prose-invert prose-xs max-w-none prose-pre:bg-black/50 prose-pre:border-neutral-800 prose-code:text-emerald-400">
                       <Markdown>{selectedArtifact.content}</Markdown>
                    </div>
                  )}
               </div>
             </>
           ) : (
             <div className="h-full flex flex-col items-center justify-center text-neutral-800 px-8 text-center space-y-4">
                <div className="w-16 h-16 rounded-3xl border border-neutral-900 bg-neutral-950 flex items-center justify-center shadow-inner">
                   <Activity className="w-8 h-8 opacity-10" />
                </div>
                <p className="text-[10px] font-mono uppercase tracking-[0.3em] font-bold">Registry_Idle // Select_Node</p>
             </div>
           )}
        </div>
      </div>
    </div>
  );
}

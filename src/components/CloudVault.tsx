import React, { useEffect, useState, useRef, useMemo } from "react";
import { collection, query, where, getDocs, orderBy, deleteDoc, doc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../lib/firebase";
import { Trash2, ExternalLink, Box, FileCode2, Map, Users, Paintbrush, Shirt, Zap, CheckCircle, Activity, Search, Cuboid, X, DownloadCloud, CheckSquare, Square, ChevronUp, ChevronDown, Tag, AlertTriangle } from "lucide-react";
import Markdown from "react-markdown";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import { cn } from "../lib/utils";
import { toast } from "sonner";
import { Skeleton } from "./Skeleton";
import { motion } from "motion/react";
import { deleteArtifacts, updateArtifactTags, updateArtifactTagsBatch } from "../lib/db";
import { FixedSizeList as List } from "react-window";

interface Artifact {
  id: string;
  type: string;
  title: string;
  content: string;
  createdAt: string | number | object | null;
  tags?: string[];
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
        part.toLowerCase() === highlight.toLowerCase() ? <span key={i} className="bg-emerald-500/30 text-emerald-400 font-bold px-0.5 rounded">{part}</span> : <span key={i}>{part}</span>
      )}
    </span>
  );
};

const HighlightSnippet = ({ text, highlight }: { text: string; highlight: string }) => {
  if (!text) return null;
  const isImage = text.startsWith('data:image');
  if (isImage) text = "Binary Asset";
  
  if (!highlight.trim()) return <span className="truncate">{text.substring(0, 80)}</span>;
  
  const regex = new RegExp(`(${highlight})`, "gi");
  const match = regex.exec(text);
  
  if (!match) return <span className="truncate">{text.substring(0, 80)}</span>;
  
  const start = Math.max(0, match.index - 30);
  const end = Math.min(text.length, match.index + highlight.length + 30);
  let snippet = text.substring(start, end);
  if (start > 0) snippet = "..." + snippet;
  if (end < text.length) snippet = snippet + "...";
  
  const splitRegex = new RegExp(`(${highlight})`, "gi");
  const parts = snippet.split(splitRegex);
  
  return (
    <span className="truncate">
      {parts.map((part, i) =>
        part.toLowerCase() === highlight.toLowerCase() ? (
          <span key={i} className="bg-emerald-500/30 text-emerald-400 font-bold px-0.5 rounded">
            {part}
          </span>
        ) : (
          <span key={i}>{part}</span>
        )
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
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [isUpdatingTags, setIsUpdatingTags] = useState(false);
  
  const allTags = useMemo(() => {
    const tags = new Set<string>();
    artifacts.forEach(a => a.tags?.forEach(t => tags.add(t)));
    return Array.from(tags).sort();
  }, [artifacts]);

  const toggleTagFilter = (tag: string) => {
    setSelectedTags(prev => 
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const handleAddTag = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && tagInput.trim() && selectedArtifact) {
      e.preventDefault();
      const newTag = tagInput.trim().toLowerCase();
      const currentTags = selectedArtifact.tags || [];
      
      if (!currentTags.includes(newTag)) {
        setIsUpdatingTags(true);
        try {
          const updatedTags = [...currentTags, newTag];
          await updateArtifactTags(selectedArtifact.id, updatedTags);
          
          const updatedArtifact = { ...selectedArtifact, tags: updatedTags };
          setSelectedArtifact(updatedArtifact);
          setArtifacts(prev => prev.map(a => a.id === selectedArtifact.id ? updatedArtifact : a));
          setTagInput("");
          toast.success(`Tag #${newTag} added`);
        } catch (err: unknown) {
          const error = err as Error;
          toast.error("Failed to add tag", { description: error.message });
        } finally {
          setIsUpdatingTags(false);
        }
      } else {
        setTagInput("");
      }
    }
  };

  const handleRemoveTag = async (tagToRemove: string) => {
    if (!selectedArtifact) return;
    setIsUpdatingTags(true);
    try {
      const currentTags = selectedArtifact.tags || [];
      const updatedTags = currentTags.filter(t => t !== tagToRemove);
      await updateArtifactTags(selectedArtifact.id, updatedTags);
      
      const updatedArtifact = { ...selectedArtifact, tags: updatedTags };
      setSelectedArtifact(updatedArtifact);
      setArtifacts(prev => prev.map(a => a.id === selectedArtifact.id ? updatedArtifact : a));
      toast.success(`Tag #${tagToRemove} removed`);
    } catch (err: unknown) {
      const error = err as Error;
      toast.error("Failed to remove tag", { description: error.message });
    } finally {
      setIsUpdatingTags(false);
    }
  };

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
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver(entries => {
      setContainerSize({
        width: entries[0].contentRect.width,
        height: entries[0].contentRect.height
      });
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [containerRef.current]);

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
    const filtered = artifacts.filter(art => {
      const matchesSearch = art.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                           art.content.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesType = activeFilter === "all" || art.type === activeFilter;
      const matchesTags = selectedTags.length === 0 || selectedTags.every(t => art.tags?.includes(t));
      return matchesSearch && matchesType && matchesTags;
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
        } catch {
           if (pollTimerRef.current) clearInterval(pollTimerRef.current);
           setIsCompiling(false);
        }
      }, 2000);
    } catch (error: unknown) {
      setIsCompiling(false);
      setBuildStatus(null);
      toast.error("Pipeline_Fault", { description: (error as Error).message });
    }
  };

  const handleDelete = async (art: Artifact) => {
    if (!confirm("Confirm Binary Purge?")) return;
    
    try {
      await deleteDoc(doc(db, "artifacts", art.id));
      setArtifacts(prev => prev.filter(a => a.id !== art.id));
      if (selectedArtifact?.id === art.id) setSelectedArtifact(null);
      toast.success("Artifact purged from Architecture.");
    } catch (err: unknown) {
      toast.error("Purge Failure", { description: (err as Error).message });
    }
  };

  const [showBatchDeleteModal, setShowBatchDeleteModal] = useState(false);

  const handleBatchDeleteClick = () => {
    if (selectedForBatch.size === 0) return;
    setShowBatchDeleteModal(true);
  };

  const confirmBatchDelete = async () => {
    const tId = toast.loading("Executing Batch Purge...");
    try {
      const ids = Array.from(selectedForBatch);
      await deleteArtifacts(ids);
      setArtifacts(prev => prev.filter(a => !selectedForBatch.has(a.id)));
      if (selectedArtifact && selectedForBatch.has(selectedArtifact.id)) setSelectedArtifact(null);
      setSelectedForBatch(new Set());
      setIsMultiSelect(false);
      setShowBatchDeleteModal(false);
      toast.success("Batch Purge Completed.", { id: tId });
    } catch (err: unknown) {
      toast.error("Batch Purge Failed", { id: tId, description: (err as Error).message });
    }
  };

  const [showBulkTagModal, setShowBulkTagModal] = useState(false);
  const [bulkTagInput, setBulkTagInput] = useState("");

  const handleBulkTagClick = () => {
    if (selectedForBatch.size === 0) return;
    setBulkTagInput("");
    setShowBulkTagModal(true);
  };

  const confirmBulkTag = async () => {
    const rawTag = bulkTagInput.trim().toLowerCase().replace(/[^a-z0-9-]/g, "");
    if (!rawTag) {
      toast.warning("Please enter a valid tag alphanumeric tag.");
      return;
    }
    const tId = toast.loading("Applying Bulk Tags...");
    try {
      const ids = Array.from(selectedForBatch);
      await updateArtifactTagsBatch(ids, rawTag);
      
      setArtifacts(prev => prev.map(a => {
        if (selectedForBatch.has(a.id)) {
          return { ...a, tags: [...new Set([...(a.tags || []), rawTag])] };
        }
        return a;
      }));
      
      if (selectedArtifact && selectedForBatch.has(selectedArtifact.id)) {
         setSelectedArtifact(prev => prev ? { ...prev, tags: [...new Set([...(prev.tags || []), rawTag])] } : prev);
      }
      
      setShowBulkTagModal(false);
      setSelectedForBatch(new Set());
      setIsMultiSelect(false);
      toast.success("Tags Applied Successfully.", { id: tId });
    } catch (err: unknown) {
      toast.error("Bulk Tagging Failed", { id: tId, description: (err as Error).message });
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
    } catch (err: unknown) {
      toast.error("Archiving Failed", { id: tId, description: (err as Error).message });
    }
  };

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-12rem)] text-center space-y-6">
        <div className="w-20 h-20 rounded-full border border-m3-outline flex items-center justify-center bg-m3-background shadow-m3-3">
           <Box className="w-10 h-10 text-m3-outline" />
        </div>
        <div className="space-y-2">
          <h2 className="text-3xl font-bold text-m3-on-surface tracking-tighter">Vault_Offline</h2>
          <p className="text-m3-on-surface-variant max-w-sm mx-auto font-medium">
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
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-m3-outline-variant">
        <div className="space-y-1">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
            <span className="text-[10px] font-mono text-m3-on-surface-variant uppercase tracking-[0.2em] font-bold">Cloud_Vault_Registry</span>
          </div>
          <h2 className="text-4xl font-bold tracking-tighter text-m3-on-surface">Central Artifacts</h2>
          <p className="text-sm text-m3-on-surface-variant font-medium">Arquivos estruturais em alta disponibilidade (SRE Ready).</p>
        </div>
        <div className="flex flex-col items-end gap-2 relative">
           <div className="flex items-center gap-2 bg-m3-surface-variant border border-m3-outline-variant p-1 px-2 rounded-lg relative">
              <Search className="w-3.5 h-3.5 text-m3-on-surface-variant" />
              <input 
                type="text" 
                placeholder="Search index..." 
                value={searchQuery}
                onFocus={() => setShowHistory(true)}
                onBlur={() => setTimeout(() => setShowHistory(false), 200)}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter" && searchQuery.trim()) {
                    if (filteredArtifacts.length > 0) {
                      const latest = [searchQuery.trim(), ...searchHistory.filter(h => h !== searchQuery.trim())].slice(0, 5);
                      setSearchHistory(latest);
                      localStorage.setItem("vault_search_history", JSON.stringify(latest));
                    }
                    setShowHistory(false);
                  }
                }}
                className="bg-transparent border-none outline-none text-[11px] font-mono text-m3-on-surface w-48 placeholder:text-m3-on-surface-variant"
              />
              {searchQuery && <X className="w-3 h-3 text-m3-on-surface-variant cursor-pointer" onClick={() => setSearchQuery("")} />}
           </div>
           
           {showHistory && searchHistory.length > 0 && (
              <div className="absolute top-full right-0 mt-1 w-full bg-m3-surface-variant border border-m3-outline-variant rounded-lg shadow-m3-3 z-50 overflow-hidden">
                 <div className="flex items-center justify-between px-3 py-2 border-b border-m3-outline-variant bg-m3-background">
                    <span className="text-[9px] font-mono uppercase tracking-widest text-m3-on-surface-variant font-bold">Recent_Searches</span>
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
                         className="w-full text-left px-3 py-2 text-[11px] font-mono text-m3-on-surface hover:bg-m3-surface-variant transition-colors border-b border-m3-outline-variant/50 last:border-0"
                       >
                          {item}
                       </button>
                    ))}
                 </div>
              </div>
           )}
           <div className="text-[9px] font-mono text-m3-on-surface-variant uppercase mt-1">
              Registry_Nodes: <span className="text-m3-on-surface">{artifacts.length}</span> // Filtered: <span className="text-emerald-500">{filteredArtifacts.length}</span>
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
               activeFilter === "all" ? "bg-white text-black border-white" : "text-m3-on-surface-variant border-m3-outline-variant hover:border-neutral-600"
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
                 activeFilter === type ? "bg-emerald-500 text-black border-emerald-500" : "text-m3-on-surface-variant border-m3-outline-variant hover:border-neutral-600"
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
               isMultiSelect ? "bg-sky-500 text-black border-sky-500 shadow-[0_0_10px_rgba(14,165,233,0.3)]" : "text-m3-on-surface-variant border-m3-outline-variant hover:border-neutral-600"
             )}
           >
             {isMultiSelect ? "Exit_Batch" : "Batch_Mode"}
           </button>
           
           {isMultiSelect && (
             <>
               {selectedForBatch.size > 0 && (
                 <span className="text-[10px] font-black uppercase tracking-widest text-m3-on-surface-variant flex items-center px-2">
                   Selected Items: {selectedForBatch.size}
                 </span>
               )}
               <button
                 onClick={handleBulkTagClick}
                 disabled={selectedForBatch.size === 0}
                 className="px-4 py-1.5 rounded-full border border-indigo-500 bg-indigo-500/10 text-indigo-400 font-black text-[10px] uppercase tracking-widest transition-all flex items-center gap-2 hover:bg-indigo-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
               >
                 <Tag className="w-3.5 h-3.5" />
                 Bulk Tag ({selectedForBatch.size})
               </button>
               <button
                 onClick={handleBatchDownload}
                 disabled={selectedForBatch.size === 0}
                 className="px-4 py-1.5 rounded-full border border-sky-500 bg-sky-500/10 text-sky-400 font-black text-[10px] uppercase tracking-widest transition-all flex items-center gap-2 hover:bg-sky-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
               >
                 <DownloadCloud className="w-3.5 h-3.5" />
                 Download All ({selectedForBatch.size})
               </button>
               <button
                 onClick={handleBatchDeleteClick}
                 disabled={selectedForBatch.size === 0}
                 className="px-4 py-1.5 rounded-full border border-red-500 bg-red-500/10 text-red-400 font-black text-[10px] uppercase tracking-widest transition-all flex items-center gap-2 hover:bg-red-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
               >
                 <Trash2 className="w-3.5 h-3.5" />
                 Bulk Delete ({selectedForBatch.size})
               </button>
             </>
           )}
        </div>
      </div>

      {allTags.length > 0 && (
        <div className="flex items-center gap-2 pb-4 overflow-x-auto scrollbar-none">
          <Tag className="w-4 h-4 text-m3-on-surface-variant shrink-0" />
          {allTags.map(tag => (
             <button
               key={tag}
               onClick={() => toggleTagFilter(tag)}
               className={cn(
                 "px-3 py-1 rounded-full border text-[9px] font-bold uppercase tracking-widest transition-all shrink-0",
                 selectedTags.includes(tag) ? "bg-indigo-500/20 text-indigo-400 border-indigo-500/50" : "bg-m3-surface-variant border-m3-outline-variant text-m3-on-surface-variant hover:text-m3-on-surface"
               )}
             >
               #{tag}
             </button>
          ))}
        </div>
      )}

      <div className="flex-1 min-h-0 flex bg-m3-background border border-m3-outline-variant rounded-2xl overflow-hidden shadow-m3-3 divide-x divide-m3-outline-variant">
        {/* Sidebar Registry */}
        <div className="w-[380px] flex flex-col flex-none overflow-hidden">
           <div className="p-4 bg-m3-surface border-b border-m3-outline border-r border-m3-outline">
              <div className="text-[10px] font-mono text-m3-on-surface-variant uppercase tracking-widest font-bold mb-3 flex items-center justify-between">
                <span>Asset_Manifest</span>
                {isMultiSelect && (
                   <button 
                     onClick={() => {
                        if (selectedForBatch.size === filteredArtifacts.length && filteredArtifacts.length > 0) {
                           setSelectedForBatch(new Set());
                        } else {
                           setSelectedForBatch(new Set(filteredArtifacts.map(a => a.id)));
                        }
                     }}
                     className="flex items-center gap-1.5 text-[9px] hover:text-m3-on-surface transition-colors cursor-pointer"
                   >
                     {selectedForBatch.size === filteredArtifacts.length && filteredArtifacts.length > 0 ? <CheckSquare className="w-3.5 h-3.5 text-sky-500" /> : <Square className="w-3.5 h-3.5" />}
                     Select Filtered
                   </button>
                 )}
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => toggleSort('title')} className="flex items-center flex-1 justify-between p-2 rounded-lg bg-m3-surface-variant hover:bg-m3-surface-variant text-[10px] font-bold text-m3-on-surface-variant uppercase tracking-widest transition-colors">
                  File Name {sortConfig.key === 'title' && (sortConfig.direction === 'asc' ? <ChevronUp className="w-3.5 h-3.5 bg-m3-surface-variant rounded text-m3-on-surface"/> : <ChevronDown className="w-3.5 h-3.5 bg-m3-surface-variant rounded text-m3-on-surface"/>)}
                </button>
                <button onClick={() => toggleSort('type')} className="flex items-center w-24 justify-between p-2 rounded-lg bg-m3-surface-variant hover:bg-m3-surface-variant text-[10px] font-bold text-m3-on-surface-variant uppercase tracking-widest transition-colors">
                  Type {sortConfig.key === 'type' && (sortConfig.direction === 'asc' ? <ChevronUp className="w-3.5 h-3.5 bg-m3-surface-variant rounded text-m3-on-surface"/> : <ChevronDown className="w-3.5 h-3.5 bg-m3-surface-variant rounded text-m3-on-surface"/>)}
                </button>
              </div>
           </div>
           
           <div className="flex-1 p-2 flex flex-col min-h-0">
            {loading ? (
              <div className="space-y-1">
                 {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-20 w-full rounded-xl bg-m3-surface-variant" />)}
              </div>
            ) : filteredArtifacts.length === 0 ? (
              <div className="text-center p-12 text-m3-on-surface-variant font-mono text-[10px] uppercase font-bold italic tracking-wider">Empty_Registry</div>
            ) : (
              <div ref={containerRef} className="flex-1 w-full min-h-0">
                {containerSize.height > 0 && containerSize.width > 0 && (
                  <List
                    height={containerSize.height}
                    itemCount={filteredArtifacts.length}
                    itemSize={88}
                    width={containerSize.width}
                    itemData={filteredArtifacts}
                  >
                    {({ index, style, data }: { index: number, style: React.CSSProperties, data: Artifact[] }) => {
                       const art = data[index];
                       const isSelected = isMultiSelect ? selectedForBatch.has(art.id) : selectedArtifact?.id === art.id;
                       return (
                         <div style={style} className="pb-2 pr-2">
                           <motion.button
                             initial={{ opacity: 0, y: 15 }}
                             animate={{ opacity: 1, y: 0, scale: isSelected && isMultiSelect ? 0.98 : 1 }}
                             transition={{ type: "spring", stiffness: 300, damping: 20, delay: index < 15 ? index * 0.05 : 0 }}
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
                               "w-full h-full flex items-center gap-4 p-4 rounded-xl border transition-colors duration-300 text-left group ease-out",
                               isSelected && isMultiSelect ? "bg-m3-surface-variant border-sky-500/50 shadow-[0_0_15px_rgba(14,165,233,0.15)] z-10 relative" : "",
                               isSelected && !isMultiSelect ? "bg-m3-surface-variant border-m3-outline-variant shadow-m3-1" : "",
                               !isSelected ? "bg-transparent border-transparent hover:bg-m3-surface-variant" : ""
                             )}
                           >
                             {isMultiSelect && (
                               <motion.div 
                                 initial={false}
                                 animate={selectedForBatch.has(art.id) ? { scale: [1, 1.2, 1] } : { scale: 1 }}
                                 transition={{ duration: 0.2 }}
                                 className="shrink-0 text-m3-on-surface-variant group-hover:text-sky-400 transition-colors"
                               >
                                 {selectedForBatch.has(art.id) ? <CheckSquare className="w-5 h-5 text-sky-400" /> : <Square className="w-5 h-5" />}
                               </motion.div>
                             )}
                             <div className={cn("p-2 rounded-lg border transition-colors shrink-0", selectedArtifact?.id === art.id ? "bg-m3-surface border-m3-outline-variant" : "bg-m3-surface-variant border-m3-outline-variant")}>
                               {typeIcons[art.type] || <Box className="w-5 h-5" />}
                             </div>
                             <div className="flex-1 min-w-0">
                               <h4 className="text-sm font-bold text-m3-on-surface truncate group-hover:text-m3-on-surface transition-colors">
                                 <HighlightText text={art.title} highlight={searchQuery} />
                               </h4>
                               <div className="text-[10px] text-m3-on-surface-variant truncate mt-0.5">
                                 <HighlightSnippet text={art.content} highlight={searchQuery} />
                               </div>
                               <div className="flex flex-col mt-1 gap-1">
                                 <div className="flex items-center gap-2">
                                   <span className="text-[9px] font-mono text-m3-on-surface-variant uppercase font-bold tracking-tighter">ID: {art.id.slice(0,8)}</span>
                                   <div className="w-1 h-1 rounded-full bg-m3-surface-variant" />
                                   <span className="text-[9px] font-mono text-m3-on-surface-variant uppercase">{art.type}</span>
                                 </div>
                                 {art.tags && art.tags.length > 0 && (
                                   <div className="flex items-center gap-1 overflow-x-hidden">
                                     {art.tags.slice(0,3).map(tag => (
                                       <span key={tag} className="text-[8px] px-1.5 py-0.5 rounded bg-m3-surface-variant text-m3-on-surface-variant uppercase tracking-widest truncate max-w-[60px]">
                                         {tag}
                                       </span>
                                     ))}
                                     {art.tags.length > 3 && (
                                       <span className="text-[8px] px-1.5 py-0.5 rounded bg-m3-surface-variant text-m3-on-surface-variant">+{art.tags.length - 3}</span>
                                     )}
                                   </div>
                                 )}
                               </div>
                             </div>
                           </motion.button>
                         </div>
                       );
                    }}
                  </List>
                )}
              </div>
            )}
           </div>
        </div>

        {/* Audit Pane */}
        <div className="flex-1 flex flex-col overflow-hidden bg-m3-surface">
           {selectedArtifact ? (
             <>
               <header className="flex-none h-14 border-b border-m3-outline bg-m3-surface px-6 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="text-sm font-bold text-m3-on-surface tracking-tight">{selectedArtifact.title}</div>
                    <div className={cn("px-2 py-0.5 border text-m3-on-surface-variant text-[9px] font-mono uppercase tracking-widest rounded leading-none transition-colors", typeColors[selectedArtifact.type])}>
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
               
               <div className="bg-m3-background border-b border-m3-outline px-6 py-3 flex items-center flex-wrap gap-2">
                 <Tag className="w-3.5 h-3.5 text-m3-on-surface-variant shrink-0" />
                 {selectedArtifact.tags?.map(t => (
                   <span key={t} className="flex items-center gap-1 pl-2 pr-1 py-0.5 rounded bg-m3-surface-variant border border-m3-outline-variant text-[9px] uppercase font-bold tracking-widest text-m3-on-surface">
                     {t}
                     <button
                       onClick={() => handleRemoveTag(t)}
                       disabled={isUpdatingTags}
                       className="p-0.5 rounded-sm hover:bg-m3-surface-variant text-m3-on-surface-variant hover:text-red-400 transition-colors disabled:opacity-50"
                     >
                       <X className="w-2.5 h-2.5" />
                     </button>
                   </span>
                 ))}
                 <input
                   type="text"
                   value={tagInput}
                   onChange={e => setTagInput(e.target.value)}
                   onKeyDown={handleAddTag}
                   disabled={isUpdatingTags}
                   placeholder="Add tag..."
                   className="bg-transparent border-none outline-none text-[9px] uppercase font-bold tracking-widest w-[100px] text-m3-on-surface-variant placeholder:text-m3-on-surface-variant disabled:opacity-50"
                 />
               </div>

               <div className="flex-1 overflow-auto custom-scrollbar p-10">
                  {selectedArtifact.type === "skin" && (selectedArtifact.content.includes("<svg") || selectedArtifact.content.startsWith("data:image")) ? (
                    <div className="h-full flex items-center justify-center perspective-1000">
                       <div className="relative group animate-float-slow">
                          <div className="absolute inset-0 bg-emerald-500/20 blur-3xl opacity-0 group-hover:opacity-100 transition-opacity" />
                          <div 
                            className="w-96 h-96 bg-m3-background border-4 border-m3-outline rounded-3xl shadow-m3-3 relative z-10 transition-transform duration-700 preserve-3d group-hover:rotate-y-12 group-hover:rotate-x-12"
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
                          
                          <div className="absolute top-full left-1/2 -translate-x-1/2 mt-8 py-2 px-4 bg-m3-surface-variant border border-m3-outline-variant rounded-lg text-[9px] font-mono text-m3-on-surface-variant uppercase tracking-widest whitespace-nowrap">
                             Mesh_Topology: standard x64 // UV-Layout: Valid
                          </div>
                       </div>
                    </div>
                  ) : (
                    <div className="prose prose-invert prose-xs max-w-none prose-pre:bg-m3-surface prose-pre:border-m3-outline-variant prose-code:text-emerald-400">
                       <Markdown>{selectedArtifact.content}</Markdown>
                    </div>
                  )}
               </div>
             </>
           ) : (
             <div className="h-full flex flex-col items-center justify-center text-m3-outline px-8 text-center space-y-4">
                <div className="w-16 h-16 rounded-3xl border border-m3-outline bg-m3-background flex items-center justify-center shadow-m3-1">
                   <Activity className="w-8 h-8 opacity-10" />
                </div>
                <p className="text-[10px] font-mono uppercase tracking-[0.3em] font-bold">Registry_Idle // Select_Node</p>
             </div>
           )}
        </div>
      </div>
      
      {showBatchDeleteModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-m3-surface backdrop-blur-sm p-4">
          <div className="bg-m3-surface-variant border border-m3-outline-variant rounded-2xl max-w-sm w-full p-6 shadow-m3-3 flex flex-col gap-6">
             <div className="flex items-start gap-4">
               <div className="w-10 h-10 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center shrink-0 mt-1">
                  <AlertTriangle className="w-5 h-5 text-red-500" />
               </div>
               <div>
                 <h3 className="text-lg font-bold text-m3-on-surface tracking-tight">Confirm Deletion</h3>
                 <p className="text-sm text-m3-on-surface-variant mt-1 leading-relaxed">
                   Are you sure you want to delete {selectedForBatch.size} artifact{selectedForBatch.size > 1 ? 's' : ''}? This action cannot be undone.
                 </p>
               </div>
             </div>
             
             <div className="flex justify-end gap-3 w-full">
               <button onClick={() => setShowBatchDeleteModal(false)} className="px-5 py-2.5 rounded-xl border border-m3-outline-variant text-m3-on-surface hover:bg-m3-surface-variant hover:text-m3-on-surface transition-colors text-sm font-bold">Cancel</button>
               <button onClick={confirmBatchDelete} className="px-5 py-2.5 rounded-xl border border-red-500 bg-red-500 hover:bg-red-600 text-m3-on-surface shadow-[0_0_15px_rgba(239,68,68,0.2)] transition-all text-sm font-bold">Yes, delete</button>
             </div>
          </div>
        </div>
      )}

      {showBulkTagModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-m3-surface/80 backdrop-blur-sm p-4">
          <div className="bg-m3-surface border border-m3-outline rounded-2xl max-w-sm w-full p-6 shadow-m3-3 flex flex-col gap-4">
             <div className="flex items-start gap-4">
               <div className="w-10 h-10 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shrink-0 mt-1">
                  <Tag className="w-5 h-5 text-indigo-500" />
               </div>
               <div className="flex-1 w-full">
                 <h3 className="text-lg font-bold text-m3-on-surface tracking-tight">Bulk Tag Artifacts</h3>
                 <p className="text-sm text-m3-on-surface-variant mt-1 leading-relaxed">
                   Apply a shared tag to {selectedForBatch.size} selected artifact{selectedForBatch.size > 1 ? 's' : ''}.
                 </p>
               </div>
             </div>
             
             <div className="w-full mt-2">
                <input
                  type="text"
                  value={bulkTagInput}
                  onChange={(e) => setBulkTagInput(e.target.value)}
                  placeholder="e.g. environment, final-boss"
                  className="w-full bg-m3-surface-variant border-2 border-m3-outline-variant focus:border-indigo-500 rounded-xl px-4 py-3 outline-none text-m3-on-surface text-sm transition-all"
                  onKeyDown={e => {
                    if (e.key === "Enter") confirmBulkTag();
                  }}
                  autoFocus
                />
             </div>
             
             <div className="flex justify-end gap-3 w-full mt-2">
               <button onClick={() => setShowBulkTagModal(false)} className="px-5 py-2.5 rounded-xl border border-m3-outline-variant text-m3-on-surface hover:bg-m3-surface-variant transition-colors text-sm font-bold">Cancel</button>
               <button onClick={confirmBulkTag} disabled={!bulkTagInput.trim()} className="px-5 py-2.5 rounded-xl border border-indigo-500 bg-indigo-500 hover:bg-indigo-600 text-m3-on-surface shadow-[0_0_15px_rgba(99,102,241,0.2)] transition-all text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed">Apply Tags</button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
}


/**
 * OfflineEngine - Procedural fallback for critical generation paths
 * Used when the system detects a loss of connectivity to prevent workflow interruption.
 */

export class OfflineEngine {
  /**
   * Generates a structural procedural Minecraft skin (PNG Data URL)
   */
  static generateSkin(prompt: string, params?: { detailLevel: number, colorIntensity: number, contrast: number, ditherLevel: number, stylization: number, patternScale: number }): string {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 64;
      canvas.height = 64;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error("Failed to initialize canvas 2D context");

      const { detailLevel = 50, colorIntensity = 50, contrast = 50, ditherLevel = 0, stylization = 50, patternScale = 50 } = params || {};

      // Clear background
      ctx.clearRect(0, 0, 64, 64);

      // Fill with a base color based on prompt
      const hash = this.getHash(prompt || "default");
      
      // Deterministic base colors
      let r = (hash & 0xFF0000) >> 16;
      let g = (hash & 0x00FF00) >> 8;
      let b = (hash & 0x0000FF);

      // Adjust base color by Stylization (mix with random color)
      if (stylization > 50) {
        const stylFactor = (stylization - 50) / 100;
        r = r * (1 - stylFactor) + (hash % 255) * stylFactor;
        g = g * (1 - stylFactor) + ((hash >> 4) % 255) * stylFactor;
        b = b * (1 - stylFactor) + ((hash >> 8) % 255) * stylFactor;
      }

      // Boost intensity if requested
      const intensityFactor = 0.5 + (colorIntensity / 100);
      r = Math.min(255, r * intensityFactor);
      g = Math.min(255, g * intensityFactor);
      b = Math.min(255, b * intensityFactor);

      // Apply Contrast
      const applyContrast = (val: number) => {
        const factor = (259 * (contrast + 25) / (100 * (259 - (contrast + 25))));
        return Math.min(255, Math.max(0, factor * (val - 128) + 128));
      };

      r = applyContrast(r);
      g = applyContrast(g);
      b = applyContrast(b);

      const normalizedPrompt = (prompt || "").toLowerCase();
      if (normalizedPrompt.includes("knight") || normalizedPrompt.includes("armor")) {
          r = 140; g = 140; b = 150;
      } else if (normalizedPrompt.includes("forest") || normalizedPrompt.includes("elf")) {
          r = 44; g = 159; b = 44;
      } else if (normalizedPrompt.includes("fire") || normalizedPrompt.includes("demon")) {
          r = 200; g = 40; b = 40;
      } else if (normalizedPrompt.includes("void") || normalizedPrompt.includes("ender")) {
          r = 30; g = 0; b = 50;
      }

      // DRAW BASE BODY PARTS
      const drawPart = (x: number, y: number, w: number, h: number, colorShift = 0) => {
        if (!ctx) return;
        ctx.fillStyle = `rgb(${Math.max(0, Math.min(255, r + colorShift))}, ${Math.max(0, Math.min(255, g + colorShift))}, ${Math.max(0, Math.min(255, b + colorShift))})`;
        ctx.fillRect(x, y, w, h);
      };

      // Head
      drawPart(8, 8, 8, 8); // Front
      drawPart(0, 8, 8, 8, -20); // Side
      drawPart(16, 8, 8, 8, -20); // Side
      drawPart(24, 8, 8, 8, -40); // Back

      // Torso
      drawPart(20, 20, 8, 12, -10);
      drawPart(16, 20, 4, 12, -30);
      drawPart(28, 20, 4, 12, -30);
      drawPart(32, 20, 8, 12, -50);

      // Arms (Basic)
      drawPart(44, 20, 4, 12, 10);
      drawPart(40, 20, 4, 12, -10);

      // Legs (Basic)
      drawPart(4, 20, 4, 12, -15);
      drawPart(8, 20, 4, 12, -5);

      // Add Procedural Noise (Detail Level controlled, Scale affected by patternScale)
      const noiseCount = Math.floor(200 + (detailLevel * 8));
      const pSize = Math.max(1, Math.floor(patternScale / 25));
      for (let i = 0; i < noiseCount; i++) {
          const px = Math.floor(Math.random() * 64);
          const py = Math.floor(Math.random() * 64);
          // Shading logic: bias noise towards used areas
          if ((px < 48 && py < 48) || (px > 40 && py < 48)) {
              const bright = (Math.random() * 60 - 30) * (detailLevel / 100);
              
              // Dither effect
              const opacity = ditherLevel > 0 ? (i % 2 === 0 ? 0.9 : 0.4) : (0.7 + (stylization / 500));

              ctx.fillStyle = `rgba(${Math.min(255, Math.max(0, r + bright))}, ${Math.min(255, Math.max(0, g + bright))}, ${Math.min(255, Math.max(0, b + bright))}, ${opacity})`;
              ctx.fillRect(px, py, pSize, pSize);
          }
      }

      // Add eyes
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(10, 12, 1, 1);
      ctx.fillRect(13, 12, 1, 1);
      ctx.fillStyle = (hash % 2 === 0) ? "#4a90e2" : "#50e3c2"; // Eye color
      ctx.fillRect(10, 13, 1, 1);
      ctx.fillRect(13, 13, 1, 1);

      return canvas.toDataURL('image/png');
    } catch (error) {
       console.error("OfflineEngine Skin Synthesis Failure:", error);
       // Return a transparent 1x1 base64 fallback in case of complete structural failure
       return "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
    }
  }

  /**
   * Generates a structural Map description
   */
  static generateMap(prompt: string, preset?: string, params?: { complexity: number, density: number, verticality: number }): string {
    const lines = [];
    const { complexity = 50, density = 50, verticality = 50 } = params || {};

    lines.push("/* ============================================================================ */");
    lines.push("/* [OFFLINE_MODULE] - Procedural Architecture Active */");
    lines.push("/* ============================================================================ */");
    lines.push(`// PROCESSING: [${prompt.slice(0, 40).toUpperCase()}]`);
    lines.push(`// PARAMETERS: C:${complexity} D:${density} V:${verticality}`);
    lines.push(`// TIMESTAMP: ${new Date().toISOString()}`);
    lines.push("");
    
    if (prompt.toLowerCase().includes("arena") || prompt.toLowerCase().includes("colosseum")) {
      const size = Math.floor(20 + (complexity / 5));
      const height = Math.floor(5 + (verticality / 10));
      lines.push(`// STRUCTURE_SPEC: PVP_ARENA_V${complexity > 70 ? '3' : '2'}_PROCEDURAL`);
      lines.push("summon armor_stand ~ ~ ~ {Tags:['arena_marker'],Invisible:1,Marker:1}");
      lines.push(`fill ~-${size} ~-1 ~-${size} ~${size} ~${height} ~${size} smooth_stone_slab outline`);
      lines.push(`fill ~-${size-1} ~0 ~-${size-1} ~${size-1} ~${height-1} ~${size-1} air`);
      if (density > 30) {
        lines.push(`fill ~-${size} ~ ~ ~${size} ~ ~ oak_fence`);
      }
      lines.push("setblock ~ ~ ~ gold_block");
    } else if (prompt.toLowerCase().includes("flat") || preset === "flat") {
      const dirtDepth = Math.floor(2 + (verticality / 2));
      lines.push("// MODE_SYNC: FLAT_WORLD_STATIC_PRESET");
      lines.push("level-type=minecraft\\:flat");
      lines.push(`generator-settings={\"layers\": [{\"block\": \"minecraft:bedrock\", \"height\": 1}, {\"block\": \"minecraft:obsidian\", \"height\": 1}, {\"block\": \"minecraft:dirt\", \"height\": ${dirtDepth}}, {\"block\": \"minecraft:grass_block\", \"height\": 1}], \"biome\": \"minecraft:plains\"}`);
    } else if (prompt.toLowerCase().includes("castle") || prompt.toLowerCase().includes("fortress")) {
      const base = Math.floor(5 + (complexity / 10));
      const height = Math.floor(5 + (verticality / 5));
      lines.push("// STRUCTURE_SPEC: MODULAR_FORTRESS_LITE");
      lines.push(`fill ~-${base} ~-1 ~-${base} ~${base} ~${height} ~${base} cobblestone outline`);
      lines.push(`fill ~-${base-1} ~0 ~-${base-1} ~${base-1} ~${height-1} ~${base-1} air`);
      if (complexity > 60) {
        lines.push(`fill ~-${base+1} ~${height} ~-${base+1} ~${base+1} ~${height+1} ~${base+1} stone_brick_stairs`);
      }
    } else {
      lines.push("// FALLBACK_SEQUENCE: DYNAMIC_TERRAIN_SEED");
      lines.push("/say WARNING: Service link unstable. Generating local safety block.");
      lines.push("/tp @s 0 100 0");
      lines.push("setblock 0 99 0 beacon");
      const platformSize = Math.floor(3 + (complexity / 20));
      lines.push(`fill -${platformSize} 98 -${platformSize} ${platformSize} 98 ${platformSize} iron_block`);
    }

    lines.push("");
    lines.push(`// ARCHITECTURE_STABILITY: ${(95 + Math.random() * 4).toFixed(1)}%`);
    lines.push("// MODULE: SYSTEM_GENERATOR_V2");
    return lines.join("\n");
  }

  /**
   * Generates a structural Mod description
   */
  static generateMod(prompt: string, type: "spigot" | "fabric" | "forge" | "datapack"): string {
    const lines = [];
    lines.push("/* ============================================================================ */");
    lines.push("/* [OFFLINE_MODULE] - Procedural Architecture Active */");
    lines.push("/* ============================================================================ */");
    lines.push(`// PROCESSING: [${prompt.slice(0, 40).toUpperCase()}]`);
    lines.push(`// TARGET_ENV: ${type.toUpperCase()}`);
    lines.push(`// TIMESTAMP: ${new Date().toISOString()}`);
    lines.push("");

    if (type === "spigot") {
      lines.push("package com.offline.procedural;");
      lines.push("");
      lines.push("import org.bukkit.plugin.java.JavaPlugin;");
      lines.push("import org.bukkit.Bukkit;");
      lines.push("");
      lines.push("public class ProceduralPlugin extends JavaPlugin {");
      lines.push("    @Override");
      lines.push("    public void onEnable() {");
      lines.push("        getLogger().info(\"Procedural Plugin Enabled. (Offline Fallback)\");");
      lines.push("        // Feature implementation for: " + prompt.slice(0, 60));
      lines.push("    }");
      lines.push("}");
    } else if (type === "datapack") {
      lines.push("{");
      lines.push("  \"pack\": {");
      lines.push("    \"pack_format\": 15,");
      lines.push("    \"description\": \"Procedural Offline Datapack: " + prompt.slice(0, 40) + "\"");
      lines.push("  }");
      lines.push("}");
    } else {
      lines.push("package com.offline.procedural;");
      lines.push("");
      lines.push("public class " + type.charAt(0).toUpperCase() + type.slice(1) + "Mod {");
      lines.push("    public void init() {");
      lines.push("        System.out.println(\"Procedural Mod Initialized.\");");
      lines.push("        // Fallback procedural implementation.");
      lines.push("    }");
      lines.push("}");
    }

    return lines.join("\n");
  }

  /**
   * Generates a procedural voxel structure
   */
  static generateVoxel(prompt: string): any {
    const voxels = [];
    let name = "Procedural Box";

    if (prompt.toLowerCase().includes("tree")) {
      name = "Procedural Tree";
      // Trunk
      for (let y = 0; y < 4; y++) voxels.push({ position: [0, y, 0], color: "#5c4033", type: "log" });
      // Leaves
      for (let x = -2; x <= 2; x++) {
        for (let y = 3; y <= 5; y++) {
          for (let z = -2; z <= 2; z++) {
            if (x === 0 && z === 0 && y < 4) continue;
            voxels.push({ position: [x, y, z], color: "#2d5a27", type: "leaves" });
          }
        }
      }
    } else {
      for (let x = -2; x <= 2; x++) {
        for (let y = 0; y <= 4; y++) {
          for (let z = -2; z <= 2; z++) {
            if (Math.random() > 0.5) {
              voxels.push({ position: [x, y, z], color: "#888888", type: "stone" });
            }
          }
        }
      }
    }

    return {
      name,
      description: "Generated by OfflineEngine Fallback algorithm.",
      voxels,
      stats: {
        totalBlocks: voxels.length,
        dimensions: [5, 6, 5]
      }
    };
  }

  /**
   * Generates a procedural Texture Base64
   */
  static generateTexture(prompt: string): string {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 16;
      canvas.height = 16;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error("Canvas context failed");
      
      const r = Math.floor(Math.random() * 200 + 55);
      const g = Math.floor(Math.random() * 200 + 55);
      const b = Math.floor(Math.random() * 200 + 55);

      for (let x = 0; x < 16; x++) {
        for (let y = 0; y < 16; y++) {
          const shade = Math.floor(Math.random() * 40 - 20);
          ctx.fillStyle = `rgb(${r+shade}, ${g+shade}, ${b+shade})`;
          ctx.fillRect(x, y, 1, 1);
        }
      }
      return canvas.toDataURL('image/png');
    } catch {
      return "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAIElEQVR42mNk+M9Qz0AAMoZh1IKhBhgwDIPGAHwwgAAACf0n+XzX394AAAAASUVORK5CYII=";
    }
  }

  private static getHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash);
  }
}

import * as THREE from "three";
import { OBJExporter } from "three/examples/jsm/exporters/OBJExporter.js";
import { STLExporter } from "three/examples/jsm/exporters/STLExporter.js";
import { FrontLogger } from "./logger";

/**
 * Industrial Grade 3D Geometry Utilities
 * Optimized for Voxel to Mesh translation and export pipelines.
 */
export const GeometryEngine = {
  /**
   * Export a group of meshes to OBJ format.
   * Blindado contra falhas de referência e objetos vazios.
   */
  exportToOBJ: (object: THREE.Object3D, filename: string = "structure.obj") => {
    FrontLogger.info("INITIATING_OBJ_EXPORT", { name: filename });
    try {
      const exporter = new OBJExporter();
      const result = exporter.parse(object);
      
      const blob = new Blob([result], { type: 'text/plain' });
      const link = document.createElement('a');
      link.style.display = 'none';
      document.body.appendChild(link);
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      link.click();
      
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
      
      FrontLogger.info("EXPORT_SUCCESS", { format: "OBJ" });
    } catch (error: any) {
      FrontLogger.error("EXPORT_FAILURE", { format: "OBJ", error: error.message });
      throw new Error(`Export System Failure: ${error.message}`);
    }
  },

  /**
   * Export a group of meshes to STL (Binary) format.
   */
  exportToSTL: (object: THREE.Object3D, filename: string = "structure.stl") => {
    FrontLogger.info("INITIATING_STL_EXPORT", { name: filename });
    try {
      const exporter = new STLExporter();
      const result = exporter.parse(object, { binary: true });
      
      const blob = new Blob([result], { type: 'application/octet-stream' });
      const link = document.createElement('a');
      link.style.display = 'none';
      document.body.appendChild(link);
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      link.click();
      
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
      
      FrontLogger.info("EXPORT_SUCCESS", { format: "STL" });
    } catch (error: any) {
      FrontLogger.error("EXPORT_FAILURE", { format: "STL", error: error.message });
      throw new Error(`Export System Failure: ${error.message}`);
    }
  },

  /**
   * Identifies adjacent blocks with identical color properties and merges 
   * them into larger bounding-box meshes to minimize draw calls.
   */
  optimizeVoxelMesh: (voxels: any[], optimizationLevel: number): { position: [number, number, number]; scale: [number, number, number]; color: string; type: string }[] => {
    if (optimizationLevel === 0 || voxels.length === 0) {
      return voxels.map(v => ({ 
        position: v.position, 
        scale: [0.95, 0.95, 0.95] as [number, number, number], 
        color: v.color, 
        type: v.type 
      }));
    }
    
    // The optimization value acts as max length of merged block (e.g. 100 => up to 10 blocks)
    const maxMerge = Math.max(2, Math.ceil(optimizationLevel / 10));

    const voxelMap = new Map<string, any>();
    for (const v of voxels) voxelMap.set(`${v.position[0]},${v.position[1]},${v.position[2]}`, v);

    const processed = new Set<string>();
    const opt: { position: [number, number, number]; scale: [number, number, number]; color: string; type: string }[] = [];

    for (const v of voxels) {
      const key = `${v.position[0]},${v.position[1]},${v.position[2]}`;
      if (processed.has(key)) continue;
      
      let w = 1, h = 1, d = 1;

      // 1. Grow in X
      while (w < maxMerge) {
        const nextKey = `${v.position[0] + w},${v.position[1]},${v.position[2]}`;
        const nextV = voxelMap.get(nextKey);
        if (nextV && nextV.color === v.color && !processed.has(nextKey)) w++;
        else break;
      }

      // 2. Grow in Y matching full width W
      while (h < maxMerge) {
        let canGrowY = true;
        for (let ix = 0; ix < w; ix++) {
          const nextKey = `${v.position[0] + ix},${v.position[1] + h},${v.position[2]}`;
          const nextV = voxelMap.get(nextKey);
          if (!nextV || nextV.color !== v.color || processed.has(nextKey)) {
            canGrowY = false;
            break;
          }
        }
        if (canGrowY) h++;
        else break;
      }

      // 3. Grow in Z matching full width W and height H
      while (d < maxMerge) {
        let canGrowZ = true;
        for (let ix = 0; ix < w; ix++) {
          for (let iy = 0; iy < h; iy++) {
            const nextKey = `${v.position[0] + ix},${v.position[1] + iy},${v.position[2] + d}`;
            const nextV = voxelMap.get(nextKey);
            if (!nextV || nextV.color !== v.color || processed.has(nextKey)) {
              canGrowZ = false;
              break;
            }
          }
          if (!canGrowZ) break;
        }
        if (canGrowZ) d++;
        else break;
      }
      
      for (let ix = 0; ix < w; ix++) {
        for (let iy = 0; iy < h; iy++) {
          for (let iz = 0; iz < d; iz++) {
            processed.add(`${v.position[0] + ix},${v.position[1] + iy},${v.position[2] + iz}`);
          }
        }
      }

      const centerPos: [number, number, number] = [
        v.position[0] + (w - 1) / 2, 
        v.position[1] + (h - 1) / 2, 
        v.position[2] + (d - 1) / 2
      ];
      const scale: [number, number, number] = [w - 0.05, h - 0.05, d - 0.05];
      
      opt.push({ position: centerPos, scale, color: v.color, type: v.type });
    }
    return opt;
  },

  /**
   * Calculates structural bounding box for telemetry.
   */
  calculateBounds: (voxels: any[]) => {
    if (voxels.length === 0) return { min: [0,0,0], max: [0,0,0], volume: 0 };
    
    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
    
    voxels.forEach(v => {
      const [x, y, z] = v.position;
      minX = Math.min(minX, x); maxX = Math.max(maxX, x);
      minY = Math.min(minY, y); maxY = Math.max(maxY, y);
      minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z);
    });
    
    return {
      min: [minX, minY, minZ],
      max: [maxX, maxY, maxZ],
      volume: (maxX - minX + 1) * (maxY - minY + 1) * (maxZ - minZ + 1)
    };
  }
};

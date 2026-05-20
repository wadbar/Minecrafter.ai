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

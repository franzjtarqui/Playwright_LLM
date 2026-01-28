import * as fs from 'fs';
import * as path from 'path';
import { pathToFileURL } from 'url';
import { FlowDefinition, LoadedFlow, RunnerOptions } from './types.js';

/**
 * Carga flows de test desde archivos .flow.ts
 */
export class FlowLoader {
  
  /**
   * Carga todos los flows de un directorio
   */
  async loadFromDirectory(testDir: string): Promise<LoadedFlow[]> {
    const flows: LoadedFlow[] = [];
    const files = this.findFlowFiles(testDir);
    
    for (const filePath of files) {
      try {
        const loaded = await this.loadFlowFile(filePath);
        if (Array.isArray(loaded)) {
          // Archivo con múltiples flows (defineFlows)
          for (const def of loaded) {
            flows.push({ filePath, definition: def });
          }
        } else {
          // Archivo con un solo flow (defineFlow)
          flows.push({ filePath, definition: loaded });
        }
      } catch (error) {
        console.error(`❌ Error cargando ${filePath}:`, (error as Error).message);
      }
    }
    
    return flows;
  }
  
  /**
   * Carga un archivo de flow específico
   */
  async loadFlowFile(filePath: string): Promise<FlowDefinition | FlowDefinition[]> {
    // Convertir a URL para import dinámico en Windows
    const fileUrl = pathToFileURL(filePath).href;
    const module = await import(fileUrl);
    return module.default;
  }
  
  /**
   * Busca archivos .flow.ts en un directorio (recursivo)
   * Nota: Busca los archivos compilados .flow.js en el directorio dist
   */
  findFlowFiles(dir: string): string[] {
    const files: string[] = [];
    
    // Convertir ruta de tests/ a dist/tests/
    const distDir = dir.replace(/^\.\/tests/, './dist/tests').replace(/^tests/, 'dist/tests');
    
    if (!fs.existsSync(distDir)) {
      console.warn(`⚠️  Directorio no existe: ${distDir}`);
      return files;
    }
    
    const entries = fs.readdirSync(distDir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(distDir, entry.name);
      
      if (entry.isDirectory()) {
        // Recursivo
        files.push(...this.findFlowFiles(fullPath));
      } else if (entry.isFile() && entry.name.endsWith('.flow.js')) {
        files.push(fullPath);
      }
    }
    
    return files;
  }
  
  /**
   * Filtra flows por tags
   */
  filterByTags(
    flows: LoadedFlow[], 
    includeTags?: string[], 
    excludeTags?: string[]
  ): LoadedFlow[] {
    let filtered = flows;
    
    // Filtrar por tags a incluir (OR logic)
    if (includeTags && includeTags.length > 0) {
      filtered = filtered.filter(flow => {
        const flowTags = flow.definition.tags || [];
        return includeTags.some(tag => flowTags.includes(tag));
      });
    }
    
    // Excluir por tags
    if (excludeTags && excludeTags.length > 0) {
      filtered = filtered.filter(flow => {
        const flowTags = flow.definition.tags || [];
        return !excludeTags.some(tag => flowTags.includes(tag));
      });
    }
    
    return filtered;
  }
  
  /**
   * Filtra flows por nombre (búsqueda parcial)
   */
  filterByName(flows: LoadedFlow[], nameFilter: string): LoadedFlow[] {
    const lowerFilter = nameFilter.toLowerCase();
    return flows.filter(flow => 
      flow.definition.name.toLowerCase().includes(lowerFilter)
    );
  }
  
  /**
   * Aplica todos los filtros según las opciones
   */
  applyFilters(flows: LoadedFlow[], options: RunnerOptions): LoadedFlow[] {
    let filtered = flows;
    
    // Filtrar por tags
    filtered = this.filterByTags(filtered, options.tags, options.excludeTags);
    
    // Filtrar por nombre
    if (options.nameFilter) {
      filtered = this.filterByName(filtered, options.nameFilter);
    }
    
    return filtered;
  }
}

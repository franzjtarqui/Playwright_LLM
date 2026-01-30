import * as fs from 'fs';
import * as path from 'path';
import { globalFileLock } from './utils/locks.js';

/**
 * Acción cacheada individual
 */
export interface CachedAction {
  /** El selector/locator que devolvió la IA */
  selector: string;
  /** Tipo de acción: click, fill, etc */
  actionType: string;
  /** Descripción de la acción */
  description: string;
  /** Valor para acciones tipo fill (opcional) */
  value?: string;
}

/**
 * Entrada cacheada de una instrucción (puede tener múltiples acciones)
 */
export interface CachedSelector {
  /** Lista de acciones para esta instrucción */
  actions: CachedAction[];
  /** Razonamiento original de la IA */
  reasoning: string;
  /** Timestamp de creación */
  timestamp: number;
  /** Último uso exitoso */
  lastSuccess: number;
  /** Contador de éxitos */
  successCount: number;
  /** Contador de fallos consecutivos */
  failureCount: number;
}

/**
 * Estructura del caché
 */
export interface SelectorCacheData {
  [cacheKey: string]: CachedSelector;
}

/**
 * Metadata del archivo de caché
 */
interface CacheFileData {
  version: string;
  createdAt: number;
  lastModified: number;
  entries: SelectorCacheData;
}

/**
 * Configuración del caché
 */
export interface SelectorCacheConfig {
  /** Máximo de entradas en el caché (default: 500) */
  maxSize: number;
  /** TTL por defecto en ms (default: 24 horas) */
  defaultTTL: number;
  /** Máximo de fallos antes de invalidar (default: 3) */
  maxFailures: number;
  /** Intervalo de limpieza automática en ms (default: 1 hora) */
  cleanupInterval: number;
  /** Ruta del archivo de caché (default: './selector-cache.json') */
  cacheFilePath: string;
  /** Versión de la app (para invalidar caché en deploys) */
  appVersion: string;
  /** Umbral de similitud para fuzzy matching (0-1, default: 0.85) */
  similarityThreshold: number;
  /** Habilitar logs de debug */
  debug: boolean;
}

const DEFAULT_CONFIG: SelectorCacheConfig = {
  maxSize: 500,
  defaultTTL: 24 * 60 * 60 * 1000,      // 24 horas
  maxFailures: 3,
  cleanupInterval: 60 * 60 * 1000,       // 1 hora
  cacheFilePath: './selector-cache.json',
  appVersion: '1.0.0',
  similarityThreshold: 0.85,
  debug: false,
};

/**
 * Estadísticas del caché
 */
export interface CacheStats {
  totalEntries: number;
  hits: number;
  misses: number;
  hitRate: string;
  oldestEntry: Date | null;
  newestEntry: Date | null;
  totalSuccesses: number;
  totalFailures: number;
}

/**
 * Gestor de caché de selectores para ahorrar tokens de IA
 * 
 * Almacena selectores ya descubiertos para no volver a consultar al LLM
 * por acciones repetitivas o similares.
 */
export class SelectorCacheManager {
  private cache: SelectorCacheData = {};
  private config: SelectorCacheConfig;
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;
  private stats = { hits: 0, misses: 0 };

  constructor(config: Partial<SelectorCacheConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.loadFromDisk();
    this.startCleanupTimer();
  }

  /**
   * Normaliza una instrucción para usarla como clave de caché
   * Elimina variaciones de escritura para matchear instrucciones similares
   */
  private normalizeInstruction(instruction: string): string {
    return instruction
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')  // Quitar acentos
      .replace(/\s+/g, ' ')              // Múltiples espacios → uno
      .replace(/[^\w\s]/g, '')           // Quitar puntuación
      .trim();
  }

  /**
   * Extrae el path de una URL para usarlo como parte de la clave
   */
  private extractUrlPattern(url: string): string {
    try {
      const urlObj = new URL(url);
      // Usar pathname, opcionalmente podrías incluir el host
      return urlObj.pathname;
    } catch {
      // Si no es URL válida, usar como está
      return url;
    }
  }

  /**
   * Genera una clave única de caché basada en URL + instrucción
   */
  generateCacheKey(url: string, instruction: string): string {
    const urlPattern = this.extractUrlPattern(url);
    const normalizedInstruction = this.normalizeInstruction(instruction);
    return `${urlPattern}::${normalizedInstruction}`;
  }

  /**
   * Calcula la similitud entre dos strings (Dice coefficient)
   * Retorna un valor entre 0 y 1
   */
  private calculateSimilarity(str1: string, str2: string): number {
    const words1 = new Set(str1.split(' ').filter(w => w.length > 2));
    const words2 = new Set(str2.split(' ').filter(w => w.length > 2));
    
    if (words1.size === 0 && words2.size === 0) return 1;
    if (words1.size === 0 || words2.size === 0) return 0;
    
    const intersection = [...words1].filter(w => words2.has(w)).length;
    return (2 * intersection) / (words1.size + words2.size);
  }

  /**
   * Verifica si una entrada está expirada
   */
  private isExpired(entry: CachedSelector): boolean {
    const age = Date.now() - entry.timestamp;
    return age > this.config.defaultTTL;
  }

  /**
   * Busca en el caché (exacto o fuzzy)
   * @returns La entrada cacheada o null si no existe
   */
  find(url: string, instruction: string): CachedSelector | null {
    const exactKey = this.generateCacheKey(url, instruction);
    
    // 1. Búsqueda exacta
    if (this.cache[exactKey]) {
      const entry = this.cache[exactKey];
      
      // Verificar expiración
      if (this.isExpired(entry)) {
        this.log('⏰ Cache expirado, eliminando...');
        delete this.cache[exactKey];
        this.saveToDisk();
        return null;
      }
      
      // Verificar si tiene demasiados fallos
      if (entry.failureCount >= this.config.maxFailures) {
        this.log('❌ Selector con muchos fallos, eliminando...');
        delete this.cache[exactKey];
        this.saveToDisk();
        return null;
      }
      
      this.stats.hits++;
      this.log(`✅ Cache HIT (exacto) - ${this.getHitRateStr()}`);
      return entry;
    }
    
    // 2. Búsqueda fuzzy
    const urlPattern = this.extractUrlPattern(url);
    const normalizedInstruction = this.normalizeInstruction(instruction);
    
    for (const [key, entry] of Object.entries(this.cache)) {
      // Solo buscar en el mismo path
      if (!key.startsWith(urlPattern + '::')) continue;
      
      // Verificar expiración y fallos
      if (this.isExpired(entry) || entry.failureCount >= this.config.maxFailures) {
        continue;
      }
      
      const cachedInstruction = key.split('::')[1];
      const similarity = this.calculateSimilarity(normalizedInstruction, cachedInstruction);
      
      if (similarity >= this.config.similarityThreshold) {
        this.stats.hits++;
        this.log(`✅ Cache HIT (fuzzy ${Math.round(similarity * 100)}%) - ${this.getHitRateStr()}`);
        return entry;
      }
    }
    
    this.stats.misses++;
    this.log(`❌ Cache MISS - ${this.getHitRateStr()}`);
    return null;
  }

  /**
   * Guarda múltiples acciones en el caché para una instrucción
   */
  set(url: string, instruction: string, actions: CachedAction[], reasoning: string): void {
    // Aplicar límite LRU si es necesario
    this.enforceMaxSize();
    
    const key = this.generateCacheKey(url, instruction);
    
    this.cache[key] = {
      actions,
      reasoning,
      timestamp: Date.now(),
      lastSuccess: Date.now(),
      successCount: 1,
      failureCount: 0,
    };
    
    this.log(`💾 Guardado en caché: "${instruction.substring(0, 50)}..." (${actions.length} acciones)`);
    this.saveToDisk();
  }

  /**
   * Marca un selector como exitoso
   */
  markSuccess(url: string, instruction: string): void {
    const key = this.generateCacheKey(url, instruction);
    const entry = this.cache[key];
    
    if (entry) {
      entry.successCount++;
      entry.lastSuccess = Date.now();
      entry.failureCount = 0; // Reset fallos en éxito
      this.saveToDisk();
    }
  }

  /**
   * Marca un selector como fallido
   * @returns true si el selector fue invalidado
   */
  markFailure(url: string, instruction: string): boolean {
    const key = this.generateCacheKey(url, instruction);
    const entry = this.cache[key];
    
    if (entry) {
      entry.failureCount++;
      
      if (entry.failureCount >= this.config.maxFailures) {
        this.log(`⚠️ Selector invalidado después de ${this.config.maxFailures} fallos`);
        delete this.cache[key];
        this.saveToDisk();
        return true;
      }
      
      this.saveToDisk();
    }
    
    return false;
  }

  /**
   * Elimina una entrada específica del caché
   */
  invalidate(url: string, instruction: string): void {
    const key = this.generateCacheKey(url, instruction);
    if (this.cache[key]) {
      delete this.cache[key];
      this.log(`🗑️ Entrada eliminada del caché`);
      this.saveToDisk();
    }
  }

  /**
   * Aplica el límite de tamaño LRU
   */
  private enforceMaxSize(): void {
    const entries = Object.entries(this.cache);
    
    if (entries.length >= this.config.maxSize) {
      // Ordenar por último uso (más antiguo primero)
      entries.sort((a, b) => a[1].lastSuccess - b[1].lastSuccess);
      
      // Eliminar el 20% más antiguo
      const toRemove = Math.floor(this.config.maxSize * 0.2);
      for (let i = 0; i < toRemove; i++) {
        delete this.cache[entries[i][0]];
      }
      
      this.log(`🧹 LRU: eliminadas ${toRemove} entradas antiguas`);
    }
  }

  /**
   * Limpieza periódica de entradas expiradas
   */
  cleanup(): number {
    const now = Date.now();
    let removed = 0;
    
    for (const [key, entry] of Object.entries(this.cache)) {
      // Eliminar expirados
      if (now - entry.timestamp > this.config.defaultTTL) {
        delete this.cache[key];
        removed++;
        continue;
      }
      
      // Eliminar con muchos fallos
      if (entry.failureCount >= this.config.maxFailures) {
        delete this.cache[key];
        removed++;
      }
    }
    
    if (removed > 0) {
      this.log(`🧹 Limpieza: ${removed} entradas eliminadas`);
      this.saveToDisk();
    }
    
    return removed;
  }

  /**
   * Inicia el timer de limpieza automática
   */
  private startCleanupTimer(): void {
    if (this.config.cleanupInterval > 0) {
      this.cleanupTimer = setInterval(() => {
        this.cleanup();
      }, this.config.cleanupInterval);
    }
  }

  /**
   * Limpia todo el caché
   */
  clear(): void {
    this.cache = {};
    this.stats = { hits: 0, misses: 0 };
    this.saveToDisk();
    this.log('🗑️ Caché completamente limpiado');
  }

  /**
   * Carga el caché desde disco
   */
  private loadFromDisk(): void {
    try {
      const filePath = path.resolve(this.config.cacheFilePath);
      
      if (fs.existsSync(filePath)) {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as CacheFileData;
        
        // Verificar versión - si cambió, invalidar todo
        if (data.version !== this.config.appVersion) {
          this.log(`🔄 Nueva versión detectada (${data.version} → ${this.config.appVersion}), limpiando caché`);
          this.cache = {};
          return;
        }
        
        this.cache = data.entries || {};
        this.log(`📂 Caché cargado: ${Object.keys(this.cache).length} entradas`);
        
        // Limpiar entradas expiradas al cargar
        this.cleanup();
      }
    } catch (error) {
      this.log(`⚠️ Error cargando caché: ${(error as Error).message}`);
      this.cache = {};
    }
  }

  /**
   * Guarda el caché a disco (thread-safe)
   */
  private saveToDisk(): void {
    const filePath = path.resolve(this.config.cacheFilePath);
    
    // Usar lock para escritura thread-safe
    globalFileLock.withLock(filePath, async () => {
      try {
        const data: CacheFileData = {
          version: this.config.appVersion,
          createdAt: Date.now(),
          lastModified: Date.now(),
          entries: this.cache,
        };
        
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
      } catch (error) {
        this.log(`⚠️ Error guardando caché: ${(error as Error).message}`);
      }
    }).catch(err => {
      this.log(`⚠️ Error en lock de caché: ${err.message}`);
    });
  }

  /**
   * Obtiene estadísticas del caché
   */
  getStats(): CacheStats {
    const entries = Object.values(this.cache);
    const timestamps = entries.map(e => e.timestamp);
    
    return {
      totalEntries: entries.length,
      hits: this.stats.hits,
      misses: this.stats.misses,
      hitRate: this.getHitRateStr(),
      oldestEntry: timestamps.length > 0 ? new Date(Math.min(...timestamps)) : null,
      newestEntry: timestamps.length > 0 ? new Date(Math.max(...timestamps)) : null,
      totalSuccesses: entries.reduce((sum, e) => sum + e.successCount, 0),
      totalFailures: entries.reduce((sum, e) => sum + e.failureCount, 0),
    };
  }

  /**
   * Calcula el hit rate como string
   */
  private getHitRateStr(): string {
    const total = this.stats.hits + this.stats.misses;
    if (total === 0) return '0%';
    return `${Math.round((this.stats.hits / total) * 100)}%`;
  }

  /**
   * Log condicional según configuración debug
   */
  private log(message: string): void {
    if (this.config.debug) {
      console.log(`[SelectorCache] ${message}`);
    }
  }

  /**
   * Detiene el timer y guarda el caché (llamar al cerrar la app)
   */
  dispose(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    this.saveToDisk();
    this.log('👋 Caché guardado y timer detenido');
  }

  /**
   * Imprime un resumen del estado del caché
   */
  printSummary(): void {
    const stats = this.getStats();
    console.log('\n' + '='.repeat(50));
    console.log('📊 ESTADÍSTICAS DEL CACHÉ DE SELECTORES');
    console.log('='.repeat(50));
    console.log(`   Entradas totales: ${stats.totalEntries}`);
    console.log(`   Hits: ${stats.hits} | Misses: ${stats.misses}`);
    console.log(`   Hit Rate: ${stats.hitRate}`);
    console.log(`   Éxitos acumulados: ${stats.totalSuccesses}`);
    if (stats.oldestEntry) {
      console.log(`   Entrada más antigua: ${stats.oldestEntry.toLocaleString()}`);
    }
    console.log('='.repeat(50) + '\n');
  }
}

// Singleton para uso global (opcional)
let globalCacheInstance: SelectorCacheManager | null = null;

export function getSelectorCache(config?: Partial<SelectorCacheConfig>): SelectorCacheManager {
  if (!globalCacheInstance) {
    globalCacheInstance = new SelectorCacheManager(config);
  }
  return globalCacheInstance;
}

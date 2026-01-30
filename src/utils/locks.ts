/**
 * Mutex simple para operaciones de archivo thread-safe
 */

export class FileLock {
  private locks: Map<string, Promise<void>> = new Map();
  
  /**
   * Ejecuta una función con lock exclusivo sobre un archivo
   */
  async withLock<T>(filePath: string, fn: () => Promise<T>): Promise<T> {
    // Esperar a que se libere el lock actual (si existe)
    while (this.locks.has(filePath)) {
      await this.locks.get(filePath);
    }
    
    // Crear un nuevo lock
    let resolve: () => void;
    const lockPromise = new Promise<void>(r => { resolve = r; });
    this.locks.set(filePath, lockPromise);
    
    try {
      return await fn();
    } finally {
      this.locks.delete(filePath);
      resolve!();
    }
  }
  
  /**
   * Verifica si un archivo está bloqueado
   */
  isLocked(filePath: string): boolean {
    return this.locks.has(filePath);
  }
}

// Instancia global del lock
export const globalFileLock = new FileLock();

/**
 * Semáforo para limitar concurrencia de llamadas a API
 */
export class Semaphore {
  private permits: number;
  private waiters: (() => void)[] = [];
  
  constructor(permits: number) {
    this.permits = permits;
  }
  
  async acquire(): Promise<void> {
    if (this.permits > 0) {
      this.permits--;
      return;
    }
    
    return new Promise(resolve => {
      this.waiters.push(resolve);
    });
  }
  
  release(): void {
    if (this.waiters.length > 0) {
      const waiter = this.waiters.shift();
      waiter!();
    } else {
      this.permits++;
    }
  }
  
  /**
   * Ejecuta una función con el semáforo adquirido
   */
  async withPermit<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await fn();
    } finally {
      this.release();
    }
  }
}

// Semáforo global para llamadas a IA (evitar rate limits)
// Limitar a 3 llamadas concurrentes por defecto
export const aiCallSemaphore = new Semaphore(3);

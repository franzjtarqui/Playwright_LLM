/**
 * Pool de ejecución paralela con límite de concurrencia
 */

export interface PoolOptions {
  maxWorkers: number;
  onProgress?: (completed: number, total: number, result: any) => void;
}

export interface PoolTask<T> {
  id: string;
  execute: () => Promise<T>;
}

export interface PoolResult<T> {
  id: string;
  success: boolean;
  result?: T;
  error?: Error;
  duration: number;
}

/**
 * Ejecuta tareas en paralelo con un límite de concurrencia
 */
export async function runInPool<T>(
  tasks: PoolTask<T>[],
  options: PoolOptions
): Promise<PoolResult<T>[]> {
  const { maxWorkers, onProgress } = options;
  const results: PoolResult<T>[] = [];
  let completed = 0;
  let currentIndex = 0;
  
  const executeTask = async (task: PoolTask<T>): Promise<PoolResult<T>> => {
    const startTime = Date.now();
    try {
      const result = await task.execute();
      return {
        id: task.id,
        success: true,
        result,
        duration: Date.now() - startTime
      };
    } catch (error) {
      return {
        id: task.id,
        success: false,
        error: error as Error,
        duration: Date.now() - startTime
      };
    }
  };
  
  const runNext = async (): Promise<void> => {
    while (currentIndex < tasks.length) {
      const taskIndex = currentIndex++;
      const task = tasks[taskIndex];
      
      const result = await executeTask(task);
      results.push(result);
      completed++;
      
      if (onProgress) {
        onProgress(completed, tasks.length, result);
      }
    }
  };
  
  // Crear workers (máximo según configuración o tareas disponibles)
  const workerCount = Math.min(maxWorkers, tasks.length);
  const workers = Array(workerCount).fill(null).map(() => runNext());
  
  await Promise.all(workers);
  
  // Ordenar resultados por ID para mantener orden predecible
  return results.sort((a, b) => {
    const indexA = tasks.findIndex(t => t.id === a.id);
    const indexB = tasks.findIndex(t => t.id === b.id);
    return indexA - indexB;
  });
}

/**
 * Retry con backoff exponencial para manejar rate limits
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number;
    initialDelayMs?: number;
    maxDelayMs?: number;
    retryOn?: (error: Error) => boolean;
  } = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelayMs = 1000,
    maxDelayMs = 30000,
    retryOn = (e) => e.message.includes('rate') || e.message.includes('429') || e.message.includes('quota')
  } = options;
  
  let lastError: Error;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      if (attempt === maxRetries || !retryOn(lastError)) {
        throw lastError;
      }
      
      const delay = Math.min(initialDelayMs * Math.pow(2, attempt), maxDelayMs);
      console.log(`⏳ Rate limit detectado. Reintentando en ${delay}ms... (intento ${attempt + 1}/${maxRetries})`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError!;
}

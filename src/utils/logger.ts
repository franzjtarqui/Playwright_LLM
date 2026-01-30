/**
 * Logger con prefijos para ejecución paralela
 * Permite distinguir logs de diferentes flows
 */

export interface LoggerOptions {
  prefix: string;
  color?: string;
}

// Colores ANSI para terminal
const COLORS = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m'
};

const WORKER_COLORS = [
  COLORS.cyan,
  COLORS.magenta,
  COLORS.yellow,
  COLORS.green,
  COLORS.blue
];

export class PrefixLogger {
  private prefix: string;
  private color: string;
  private originalConsole: {
    log: typeof console.log;
    error: typeof console.error;
    warn: typeof console.warn;
    info: typeof console.info;
  };
  
  constructor(options: LoggerOptions) {
    this.prefix = options.prefix;
    this.color = options.color || COLORS.white;
    this.originalConsole = {
      log: console.log.bind(console),
      error: console.error.bind(console),
      warn: console.warn.bind(console),
      info: console.info.bind(console)
    };
  }
  
  private formatPrefix(): string {
    return `${this.color}[${this.prefix}]${COLORS.reset}`;
  }
  
  log(...args: any[]): void {
    this.originalConsole.log(this.formatPrefix(), ...args);
  }
  
  error(...args: any[]): void {
    this.originalConsole.error(this.formatPrefix(), COLORS.red, ...args, COLORS.reset);
  }
  
  warn(...args: any[]): void {
    this.originalConsole.warn(this.formatPrefix(), COLORS.yellow, ...args, COLORS.reset);
  }
  
  info(...args: any[]): void {
    this.originalConsole.info(this.formatPrefix(), ...args);
  }
  
  /**
   * Intercepta console.log para agregar prefijo
   * Útil cuando el código interno usa console.log directamente
   */
  intercept(): () => void {
    const original = { ...this.originalConsole };
    const prefix = this.formatPrefix();
    
    console.log = (...args: any[]) => original.log(prefix, ...args);
    console.error = (...args: any[]) => original.error(prefix, ...args);
    console.warn = (...args: any[]) => original.warn(prefix, ...args);
    console.info = (...args: any[]) => original.info(prefix, ...args);
    
    // Retornar función para restaurar
    return () => {
      console.log = original.log;
      console.error = original.error;
      console.warn = original.warn;
      console.info = original.info;
    };
  }
  
  /**
   * Obtiene un color para un worker específico
   */
  static getWorkerColor(workerIndex: number): string {
    return WORKER_COLORS[workerIndex % WORKER_COLORS.length];
  }
}

/**
 * Buffer de logs para capturar output y mostrarlo ordenado después
 */
export class LogBuffer {
  private logs: { timestamp: number; level: string; args: any[] }[] = [];
  
  log(...args: any[]): void {
    this.logs.push({ timestamp: Date.now(), level: 'log', args });
  }
  
  error(...args: any[]): void {
    this.logs.push({ timestamp: Date.now(), level: 'error', args });
  }
  
  warn(...args: any[]): void {
    this.logs.push({ timestamp: Date.now(), level: 'warn', args });
  }
  
  flush(prefix: string = ''): void {
    for (const log of this.logs) {
      const prefixStr = prefix ? `[${prefix}] ` : '';
      switch (log.level) {
        case 'error':
          console.error(prefixStr, ...log.args);
          break;
        case 'warn':
          console.warn(prefixStr, ...log.args);
          break;
        default:
          console.log(prefixStr, ...log.args);
      }
    }
  }
  
  clear(): void {
    this.logs = [];
  }
  
  getLines(): string[] {
    return this.logs.map(l => l.args.join(' '));
  }
}

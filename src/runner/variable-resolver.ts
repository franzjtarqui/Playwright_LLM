import 'dotenv/config';

/**
 * Resuelve variables en formato ${VAR_NAME} usando:
 * 1. Variables de entorno (process.env)
 * 2. Variables locales pasadas como parámetro
 * 
 * @example
 * ```typescript
 * const resolver = new VariableResolver({ nombre: 'Jonas' });
 * resolver.resolve('Hola ${nombre}, tu email es ${TEST_EMAIL}');
 * // -> 'Hola Jonas, tu email es usuario@test.com'
 * ```
 */
export class VariableResolver {
  private localVariables: Record<string, string>;
  
  constructor(localVariables: Record<string, string> = {}) {
    this.localVariables = localVariables;
  }
  
  /**
   * Agrega o actualiza variables locales
   */
  setVariables(variables: Record<string, string>): void {
    this.localVariables = { ...this.localVariables, ...variables };
  }
  
  /**
   * Resuelve todas las variables ${VAR} en un string
   */
  resolve(text: string): string {
    return text.replace(/\$\{([^}]+)\}/g, (match, varName) => {
      // Primero buscar en variables locales
      if (this.localVariables[varName] !== undefined) {
        return this.localVariables[varName];
      }
      
      // Luego en variables de entorno
      if (process.env[varName] !== undefined) {
        return process.env[varName]!;
      }
      
      // Si no se encuentra, dejar el placeholder (o lanzar error)
      console.warn(`⚠️  Variable no encontrada: ${varName}`);
      return match;
    });
  }
  
  /**
   * Resuelve variables en un array de strings
   */
  resolveArray(texts: string[]): string[] {
    return texts.map(text => this.resolve(text));
  }
  
  /**
   * Verifica si un texto contiene variables sin resolver
   */
  hasUnresolvedVariables(text: string): boolean {
    return /\$\{[^}]+\}/.test(text);
  }
  
  /**
   * Obtiene la lista de variables requeridas en un texto
   */
  getRequiredVariables(text: string): string[] {
    const matches = text.matchAll(/\$\{([^}]+)\}/g);
    return [...new Set([...matches].map(m => m[1]))];
  }
  
  /**
   * Valida que todas las variables requeridas estén disponibles
   */
  validateVariables(texts: string[]): { valid: boolean; missing: string[] } {
    const allText = texts.join(' ');
    const required = this.getRequiredVariables(allText);
    const missing: string[] = [];
    
    for (const varName of required) {
      if (this.localVariables[varName] === undefined && 
          process.env[varName] === undefined) {
        missing.push(varName);
      }
    }
    
    return {
      valid: missing.length === 0,
      missing
    };
  }
}

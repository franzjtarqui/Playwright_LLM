import { Page } from '@playwright/test';
import { AIDecision } from './llm-providers.js';
import 'dotenv/config';
/**
 * Resultado de la ejecución del agente
 */
export interface ExecutionResult {
    success: boolean;
    decision?: AIDecision;
    finalUrl?: string;
    error?: string;
}
/**
 * Resultado de un paso en el flujo
 */
export interface StepResult {
    step: number;
    instruction: string;
    success: boolean;
    error?: string;
}
/**
 * Resultado de la ejecución de un flujo completo
 */
export interface FlowResult {
    success: boolean;
    totalSteps: number;
    completedSteps: number;
    steps: StepResult[];
    finalUrl?: string;
    error?: string;
}
/**
 * Parámetros para ejecutar el agente
 */
export interface ExecuteParams {
    url: string;
    instruction: string;
    /** Modo de análisis: 'screenshot' | 'html' | 'hybrid' */
    analysisMode?: AnalysisMode;
}
/**
 * Parámetros para ejecutar un flujo con múltiples pasos
 */
export interface ExecuteFlowParams {
    url: string;
    steps: string[];
    stopOnError?: boolean;
    delayBetweenSteps?: number;
    /**
     * Modo de análisis de la página:
     * - 'screenshot': Solo imagen (más visual, más tokens)
     * - 'html': Solo HTML filtrado (más barato, más rápido)
     * - 'hybrid': Ambos (más preciso, balance de tokens)
     */
    analysisMode?: AnalysisMode;
}
/**
 * Modo de análisis de la página
 * - 'screenshot': Solo imagen (más visual, más tokens)
 * - 'html': Solo HTML filtrado (más barato, más rápido)
 * - 'hybrid': Ambos (más preciso, balance de tokens)
 */
export type AnalysisMode = 'screenshot' | 'html' | 'hybrid';
/**
 * Elemento interactivo extraído del DOM
 */
export interface InteractiveElement {
    tag: string;
    type?: string;
    id?: string;
    name?: string;
    placeholder?: string;
    text?: string;
    ariaLabel?: string;
    value?: string;
    href?: string;
    role?: string;
    visible?: boolean;
}
/**
 * Agente IA que usa Playwright y LLM Vision para automatizar páginas web
 * sin necesidad de selectores predefinidos
 *
 * Soporta múltiples proveedores: Google AI, OpenAI, Anthropic, DeepSeek, Ollama, Azure
 */
export declare class PlaywrightAIAgent {
    private llmProvider;
    private browser;
    page: Page | null;
    private maxRetries;
    /**
     * Modo de análisis: 'screenshot', 'html', o 'hybrid'
     * Cambia esto para optimizar costos vs precisión
     */
    analysisMode: AnalysisMode;
    /**
     * Configura el modo de análisis de la página
     * @param mode 'screenshot' | 'html' | 'hybrid'
     * @returns this (para encadenamiento)
     */
    setAnalysisMode(mode: AnalysisMode): this;
    /**
     * Inicializa el navegador y el proveedor de LLM
     */
    initialize(): Promise<void>;
    /**
     * Captura un screenshot de la página actual
     */
    private captureScreenshot;
    /**
     * Espera a que la página esté completamente cargada y estable
     * Esto es crucial después de navegaciones o acciones que cambian la página
     */
    private waitForPageStable;
    /**
     * Extrae solo los elementos interactivos del DOM
     * Esto reduce significativamente los tokens enviados a la IA
     */
    private extractInteractiveElements;
    /**
     * Formatea los elementos interactivos como texto legible para la IA
     */
    private formatElementsForAI;
    /**
     * Obtiene el contexto de la página para información adicional
     */
    private getPageContext;
    /**
     * Genera el prompt para el LLM - adaptado según el modo de análisis
     * NOTA: Prompt en inglés para mejor comprensión de la IA
     */
    private generatePrompt;
    /**
     * Consulta al LLM para analizar la página y decidir acciones
     * Soporta 3 modos: 'screenshot', 'html', 'hybrid'
     */
    private analyzePageAndDecide;
    /**
     * Encuentra un elemento en la página usando descripción flexible
     * Soporta: selectores CSS, texto, placeholder, name, id
     */
    private findElementByDescription;
    /**
     * Ejecuta una acción de Playwright basada en la decisión de la IA
     */
    private executeAction;
    /**
     * Ejecuta una instrucción completa
     */
    execute({ url, instruction, analysisMode }: ExecuteParams): Promise<ExecutionResult>;
    /**
     * Ejecuta un flujo completo con múltiples pasos/instrucciones
     * Ideal para automatizar flujos de trabajo complejos
     *
     * @example
     * await agent.executeFlow({
     *   url: 'https://ejemplo.com/login',
     *   steps: [
     *     'Ingresar usuario admin y password 1234',
     *     'Hacer click en el menú Reportes',
     *     'Seleccionar el reporte de ventas',
     *     'Exportar a Excel'
     *   ]
     * });
     */
    executeFlow({ url, steps, stopOnError, delayBetweenSteps, analysisMode }: ExecuteFlowParams): Promise<FlowResult>;
    /**
     * Ejecuta una instrucción en la página actual (sin navegar)
     * Útil para continuar un flujo desde donde quedó
     */
    executeStep(instruction: string): Promise<ExecutionResult>;
    /**
     * Cierra el navegador
     */
    close(): Promise<void>;
}
//# sourceMappingURL=ai-agent.d.ts.map
import { PlaywrightAIAgent } from '../core/agent.js';
import { FlowLoader } from './flow-loader.js';
import { VariableResolver } from './variable-resolver.js';
import { AITestConfig, defaultConfig } from '../config/types.js';
import { runInPool, PoolTask } from '../utils/parallel-pool.js';
import { PrefixLogger } from '../utils/logger.js';
import * as fs from 'fs';
import * as path from 'path';
import { 
  FlowDefinition, 
  RunnerOptions, 
  FlowExecutionResult,
  StepExecutionResult,
  TestRunResult,
  LoadedFlow
} from './types.js';

/**
 * Ejecutor principal de flows de test
 */
export class FlowRunner {
  private loader: FlowLoader;
  private agent: PlaywrightAIAgent | null = null;
  private options: RunnerOptions;
  private config: AITestConfig;
  
  constructor(options: RunnerOptions = {}) {
    this.loader = new FlowLoader();
    this.config = options.config || defaultConfig;
    this.options = {
      testDir: options.testDir || this.config.testDir,
      generateReport: options.generateReport ?? this.config.reports.html.enabled,
      reportDir: options.reportDir || this.config.reportDir,
      enableTracing: options.enableTracing ?? this.config.reports.trace.enabled,
      traceMode: options.traceMode || this.config.reports.trace.mode,
      headless: options.headless ?? this.config.browser.headless,
      slowMo: options.slowMo ?? this.config.browser.slowMo,
      retries: options.retries ?? this.config.execution.retries,
      failFast: options.failFast ?? this.config.execution.failFast,
      baseUrl: options.baseUrl || this.config.baseUrl,
      tags: options.tags,
      excludeTags: options.excludeTags,
      nameFilter: options.nameFilter,
      config: this.config
    };
  }
  
  /**
   * Ejecuta todos los tests según los filtros
   */
  async run(): Promise<TestRunResult> {
    const startTime = Date.now();
    const results: FlowExecutionResult[] = [];
    
    console.log('\n🚀 Iniciando AI Test Runner...\n');
    
    // Cargar flows
    const allFlows = await this.loader.loadFromDirectory(this.options.testDir!);
    console.log(`📁 Flows encontrados: ${allFlows.length}`);
    
    // Aplicar filtros
    const flowsToRun = this.loader.applyFilters(allFlows, this.options);
    console.log(`🎯 Flows a ejecutar: ${flowsToRun.length}`);
    
    if (flowsToRun.length === 0) {
      console.log('\n⚠️  No hay flows que coincidan con los filtros\n');
      return {
        totalFlows: 0,
        passed: 0,
        failed: 0,
        skipped: allFlows.length,
        duration: 0,
        flows: []
      };
    }
    
    // Mostrar flows a ejecutar
    console.log('\n📋 Flows a ejecutar:');
    flowsToRun.forEach((flow, i) => {
      const tags = flow.definition.tags?.join(', ') || 'sin tags';
      console.log(`   ${i + 1}. ${flow.definition.name} [${tags}]`);
    });
    console.log('');
    
    // Decidir si ejecutar en paralelo o secuencial
    if (this.config.execution.parallel && flowsToRun.length > 1) {
      const parallelResults = await this.runParallel(flowsToRun);
      results.push(...parallelResults);
    } else {
      // Ejecución secuencial (comportamiento original)
      for (let i = 0; i < flowsToRun.length; i++) {
        const flow = flowsToRun[i];
        console.log(`\n${'='.repeat(60)}`);
        console.log(`🧪 [${i + 1}/${flowsToRun.length}] ${flow.definition.name}`);
        console.log(`${'='.repeat(60)}\n`);
        
        // Crear nuevo agente para cada flow (aislamiento completo)
        this.agent = new PlaywrightAIAgent();
        
        try {
          await this.agent.initialize({ 
            headless: this.options.headless,
            slowMo: this.options.slowMo
          });
          const result = await this.runFlow(flow);
          results.push(result);
          
          // Fail fast
          if (!result.success && this.options.failFast) {
            console.log('\n⛔ Fail fast activado. Deteniendo ejecución.\n');
            await this.agent.close();
            break;
          }
        } catch (error) {
          results.push({
            name: flow.definition.name,
            tags: flow.definition.tags || [],
            success: false,
            totalSteps: flow.definition.steps.length,
            completedSteps: 0,
            duration: 0,
            error: (error as Error).message,
            steps: []
          });
        } finally {
          await this.agent.close();
        }
      }
    }
    
    const duration = Date.now() - startTime;
    
    // Calcular estadísticas (solo de los tests ejecutados)
    const passed = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    const filtered = allFlows.length - flowsToRun.length;
    
    const testResult: TestRunResult = {
      totalFlows: flowsToRun.length,
      passed,
      failed,
      skipped: 0,
      duration,
      flows: results
    };
    
    // Mostrar resumen
    this.printSummary(testResult, filtered);
    
    // Generar reporte consolidado (un solo archivo con todos los flows)
    if (this.options.generateReport) {
      await this.generateConsolidatedReport(testResult, startTime);
    }
    
    return testResult;
  }
  
  /**
   * Ejecuta flows en paralelo
   */
  private async runParallel(flows: LoadedFlow[]): Promise<FlowExecutionResult[]> {
    const maxWorkers = this.config.execution.maxWorkers || 5;
    
    console.log(`\n🚀 Ejecutando ${flows.length} flows en paralelo (max ${maxWorkers} workers)\n`);
    console.log('═'.repeat(60));
    
    // Crear tareas para el pool
    const tasks: PoolTask<FlowExecutionResult>[] = flows.map((flow, index) => ({
      id: flow.definition.name,
      execute: async () => {
        const workerIndex = index % maxWorkers;
        const color = PrefixLogger.getWorkerColor(workerIndex);
        const prefix = `W${workerIndex + 1}`;
        const logger = new PrefixLogger({ prefix, color });
        
        // Interceptar console para agregar prefijo
        const restore = logger.intercept();
        
        // Crear agente propio para este worker
        const agent = new PlaywrightAIAgent();
        
        try {
          await agent.initialize({ 
            headless: this.options.headless,
            slowMo: this.options.slowMo
          });
          
          console.log(`🧪 Iniciando: ${flow.definition.name}`);
          
          const result = await this.runFlowWithAgent(flow, agent);
          
          if (result.success) {
            console.log(`✅ Completado: ${flow.definition.name} (${(result.duration / 1000).toFixed(1)}s)`);
          } else {
            console.log(`❌ Fallido: ${flow.definition.name} - ${result.error}`);
          }
          
          return result;
        } catch (error) {
          console.error(`💥 Error fatal: ${flow.definition.name} - ${(error as Error).message}`);
          return {
            name: flow.definition.name,
            tags: flow.definition.tags || [],
            success: false,
            totalSteps: flow.definition.steps.length,
            completedSteps: 0,
            duration: 0,
            error: (error as Error).message,
            steps: []
          };
        } finally {
          await agent.close();
          restore(); // Restaurar console original
        }
      }
    }));
    
    // Ejecutar en pool
    const poolResults = await runInPool(tasks, {
      maxWorkers,
      onProgress: (completed, total, result) => {
        const pct = Math.round((completed / total) * 100);
        console.log(`\n📊 Progreso: ${completed}/${total} (${pct}%) - ${result.id}: ${result.success ? '✅' : '❌'}`);
      }
    });
    
    console.log('\n' + '═'.repeat(60));
    console.log(`🏁 Ejecución paralela completada\n`);
    
    // Convertir resultados del pool a FlowExecutionResult
    return poolResults.map(pr => {
      if (pr.success && pr.result) {
        return pr.result;
      }
      // Buscar el flow original para obtener metadata
      const flow = flows.find(f => f.definition.name === pr.id);
      return {
        name: pr.id,
        tags: flow?.definition.tags || [],
        success: false,
        totalSteps: flow?.definition.steps.length || 0,
        completedSteps: 0,
        duration: pr.duration,
        error: pr.error?.message || 'Unknown error',
        steps: []
      };
    });
  }
  
  /**
   * Ejecuta un flow con un agente específico (para ejecución paralela)
   */
  private async runFlowWithAgent(loadedFlow: LoadedFlow, agent: PlaywrightAIAgent): Promise<FlowExecutionResult> {
    const { definition } = loadedFlow;
    const startTime = Date.now();
    const stepResults: StepExecutionResult[] = [];
    
    // Resolver variables
    const resolver = new VariableResolver(definition.variables);
    const resolvedSteps = resolver.resolveArray(definition.steps);
    const resolvedUrl = definition.url ? resolver.resolve(definition.url) : this.options.baseUrl;
    
    // Validar variables
    const validation = resolver.validateVariables(definition.steps);
    if (!validation.valid) {
      return {
        name: definition.name,
        tags: definition.tags || [],
        success: false,
        totalSteps: definition.steps.length,
        completedSteps: 0,
        duration: Date.now() - startTime,
        error: `Variables faltantes: ${validation.missing.join(', ')}`,
        steps: []
      };
    }
    
    try {
      if (definition.beforeAll) {
        await definition.beforeAll();
      }
      
      // No generar reportes individuales - se genera uno consolidado al final
      const result = await agent.executeFlow({
        url: resolvedUrl || '',
        steps: resolvedSteps,
        stopOnError: this.config.execution.stopOnError,
        delayBetweenSteps: definition.delayBetweenSteps || this.config.execution.delayBetweenSteps,
        analysisMode: definition.analysisMode || this.config.ai.analysisMode,
        enableTracing: this.options.enableTracing,
        traceMode: this.options.traceMode,
        generateReport: false,
        generateJsonReport: false,
        reportDir: this.options.reportDir,
        screenshots: this.config.screenshots,
        flowName: definition.name
      });
      
      for (const step of result.steps) {
        stepResults.push({
          step: step.step,
          instruction: step.instruction,
          success: step.success,
          duration: step.duration || 0,
          error: step.error,
          screenshot: step.screenshot
        });
      }
      
      if (definition.afterAll) {
        await definition.afterAll();
      }
      
      return {
        name: definition.name,
        tags: definition.tags || [],
        success: result.success,
        totalSteps: result.totalSteps,
        completedSteps: result.completedSteps,
        duration: Date.now() - startTime,
        steps: stepResults
      };
    } catch (error) {
      return {
        name: definition.name,
        tags: definition.tags || [],
        success: false,
        totalSteps: definition.steps.length,
        completedSteps: stepResults.filter(s => s.success).length,
        duration: Date.now() - startTime,
        error: (error as Error).message,
        steps: stepResults
      };
    }
  }
  
  /**
   * Ejecuta un flow individual (para ejecución secuencial)
   */
  private async runFlow(loadedFlow: LoadedFlow): Promise<FlowExecutionResult> {
    const { definition } = loadedFlow;
    const startTime = Date.now();
    const stepResults: StepExecutionResult[] = [];
    
    // Resolver variables
    const resolver = new VariableResolver(definition.variables);
    const resolvedSteps = resolver.resolveArray(definition.steps);
    const resolvedUrl = definition.url ? resolver.resolve(definition.url) : this.options.baseUrl;
    
    // Validar variables
    const validation = resolver.validateVariables(definition.steps);
    if (!validation.valid) {
      console.error(`❌ Variables faltantes: ${validation.missing.join(', ')}`);
      return {
        name: definition.name,
        tags: definition.tags || [],
        success: false,
        totalSteps: definition.steps.length,
        completedSteps: 0,
        duration: Date.now() - startTime,
        error: `Variables faltantes: ${validation.missing.join(', ')}`,
        steps: []
      };
    }
    
    try {
      // Ejecutar beforeAll hook
      if (definition.beforeAll) {
        await definition.beforeAll();
      }
      
      // No generar reportes individuales - se genera uno consolidado al final
      const result = await this.agent!.executeFlow({
        url: resolvedUrl || '',
        steps: resolvedSteps,
        stopOnError: this.config.execution.stopOnError,
        delayBetweenSteps: definition.delayBetweenSteps || this.config.execution.delayBetweenSteps,
        analysisMode: definition.analysisMode || this.config.ai.analysisMode,
        enableTracing: this.options.enableTracing,
        traceMode: this.options.traceMode,
        generateReport: false,
        generateJsonReport: false,
        reportDir: this.options.reportDir,
        screenshots: this.config.screenshots,
        flowName: definition.name
      });
      
      // Convertir resultados
      for (const step of result.steps) {
        const stepResult: StepExecutionResult = {
          step: step.step,
          instruction: step.instruction,
          success: step.success,
          duration: step.duration || 0,
          error: step.error,
          screenshot: step.screenshot
        };
        stepResults.push(stepResult);
        
        // Callbacks
        if (step.success && definition.onStepSuccess) {
          definition.onStepSuccess(step.instruction);
        } else if (!step.success && definition.onStepError) {
          definition.onStepError(step.instruction, new Error(step.error));
        }
      }
      
      // Ejecutar afterAll hook
      if (definition.afterAll) {
        await definition.afterAll();
      }
      
      const flowResult: FlowExecutionResult = {
        name: definition.name,
        tags: definition.tags || [],
        success: result.success,
        totalSteps: result.totalSteps,
        completedSteps: result.completedSteps,
        duration: Date.now() - startTime,
        error: result.error,
        steps: stepResults
      };
      
      // Log resultado
      if (result.success) {
        console.log(`\n✅ ${definition.name} - PASSED (${flowResult.duration}ms)`);
      } else {
        console.log(`\n❌ ${definition.name} - FAILED`);
        console.log(`   Error: ${result.error}`);
      }
      
      return flowResult;
      
    } catch (error) {
      const errorMessage = (error as Error).message;
      console.log(`\n❌ ${definition.name} - ERROR`);
      console.log(`   ${errorMessage}`);
      
      // Generar reporte de error si está habilitado
      if (this.options.generateReport && this.agent) {
        try {
          const errorResult = {
            success: false,
            totalSteps: definition.steps.length,
            completedSteps: 0,
            steps: [{
              step: 0,
              instruction: 'Inicialización / Navegación',
              success: false,
              error: errorMessage
            }],
            finalUrl: resolvedUrl,
            error: errorMessage
          };
          await this.agent.generateHTMLReport(errorResult as any, this.options.reportDir || './playwright-report');
          console.log('📄 Reporte de error generado');
        } catch (reportError) {
          console.log('⚠️  No se pudo generar reporte de error');
        }
      }
      
      return {
        name: definition.name,
        tags: definition.tags || [],
        success: false,
        totalSteps: definition.steps.length,
        completedSteps: stepResults.filter(s => s.success).length,
        duration: Date.now() - startTime,
        error: errorMessage,
        steps: stepResults
      };
    }
  }
  
  /**
   * Imprime resumen de la ejecución
   */
  private printSummary(result: TestRunResult, filtered: number = 0): void {
    console.log('\n' + '='.repeat(60));
    console.log('📊 RESUMEN DE EJECUCIÓN');
    console.log('='.repeat(60));
    console.log(`   Total:    ${result.totalFlows} flows`);
    console.log(`   ✅ Passed:  ${result.passed}`);
    console.log(`   ❌ Failed:  ${result.failed}`);
    console.log(`   ⏱️  Tiempo:  ${(result.duration / 1000).toFixed(2)}s`);
    if (filtered > 0) {
      console.log(`   🔍 Filtrados: ${filtered} (no coinciden con el filtro)`);
    }
    console.log('='.repeat(60) + '\n');
    
    // Mostrar flows fallidos
    const failed = result.flows.filter(f => !f.success);
    if (failed.length > 0) {
      console.log('❌ Flows fallidos:');
      failed.forEach(f => {
        console.log(`   • ${f.name}`);
        console.log(`     Error: ${f.error}`);
      });
      console.log('');
    }
  }
  
  /**
   * Limpia códigos ANSI de escape de un texto (colores de terminal)
   */
  private stripAnsiCodes(text: string): string {
    // eslint-disable-next-line no-control-regex
    return text.replace(/\x1b\[[0-9;]*m/g, '').replace(/\[[\d;]*m/g, '');
  }
  
  /**
   * Genera un reporte HTML consolidado con todos los flows
   */
  private async generateConsolidatedReport(result: TestRunResult, startTime: number): Promise<string> {
    const reportDir = this.options.reportDir || './playwright-report';
    
    // Asegurar que existe el directorio
    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true });
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const reportPath = path.join(reportDir, `report-${timestamp}.html`);
    
    // Generar HTML de cada flow
    const flowsHtml = result.flows.map((flow, index) => {
      const flowStatus = flow.success ? 'passed' : 'failed';
      const flowDuration = flow.duration ? `${(flow.duration / 1000).toFixed(1)}s` : 'N/A';
      const tagsHtml = flow.tags.map(t => `<span class="tag">${t}</span>`).join(' ');
      
      const stepsHtml = flow.steps.map(step => {
        const stepStatus = step.success ? 'passed' : 'failed';
        const stepDuration = step.duration ? `${(step.duration / 1000).toFixed(1)}s` : 'N/A';
        const cleanError = step.error ? this.stripAnsiCodes(step.error) : '';
        
        // Generar HTML de screenshot si existe
        const screenshotHtml = step.screenshot 
          ? `<div class="step-screenshot">
              <img src="data:image/png;base64,${step.screenshot}" alt="Screenshot paso ${step.step}" />
             </div>` 
          : '';
        
        return `
          <div class="step ${stepStatus}">
            <div class="step-header">
              <span class="step-number">Paso ${step.step}</span>
              <span class="step-time">⏱️ ${stepDuration}</span>
              <span class="step-status ${stepStatus}">${step.success ? '✅' : '❌'}</span>
            </div>
            <div class="step-instruction">${step.instruction}</div>
            ${cleanError ? `<div class="step-error">❌ ${cleanError}</div>` : ''}
            ${screenshotHtml}
          </div>
        `;
      }).join('');
      
      const cleanFlowError = flow.error ? this.stripAnsiCodes(flow.error) : '';
      
      return `
        <div class="flow-card ${flowStatus}">
          <div class="flow-header" onclick="toggleFlow('flow-${index}')">
            <div class="flow-title">
              <span class="flow-icon">${flow.success ? '✅' : '❌'}</span>
              <span class="flow-name">${flow.name}</span>
              <span class="flow-tags">${tagsHtml}</span>
            </div>
            <div class="flow-meta">
              <span class="flow-steps">${flow.completedSteps}/${flow.totalSteps} pasos</span>
              <span class="flow-time">⏱️ ${flowDuration}</span>
              <span class="flow-toggle">▼</span>
            </div>
          </div>
          <div class="flow-body" id="flow-${index}" style="display: none;">
            ${cleanFlowError && !flow.steps.length ? `<div class="flow-error">❌ ${cleanFlowError}</div>` : ''}
            ${stepsHtml}
          </div>
        </div>
      `;
    }).join('');
    
    const totalDuration = `${(result.duration / 1000).toFixed(1)}s`;
    const startTimeStr = new Date(startTime).toLocaleString('es-ES');
    const endTimeStr = new Date().toLocaleString('es-ES');
    const executionMode = this.config.execution.parallel ? 'Paralelo' : 'Secuencial';
    const workersInfo = this.config.execution.parallel ? ` (${this.config.execution.maxWorkers} workers)` : '';
    
    const html = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AI Test Runner - Reporte Consolidado</title>
  <style>
    * { box-sizing: border-box; }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
      margin: 0; 
      padding: 20px; 
      background: #f5f5f5; 
    }
    .container { max-width: 1400px; margin: 0 auto; }
    .header { 
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
      color: white; 
      padding: 30px; 
      border-radius: 10px; 
      margin-bottom: 20px;
    }
    .header h1 { margin: 0 0 10px 0; font-size: 28px; }
    .header-meta { opacity: 0.9; font-size: 14px; }
    .header-meta span { margin-right: 20px; }
    
    .summary { 
      display: grid; 
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); 
      gap: 15px; 
      margin-bottom: 20px; 
    }
    .summary-card { 
      background: white; 
      padding: 20px; 
      border-radius: 10px; 
      box-shadow: 0 2px 4px rgba(0,0,0,0.1); 
      text-align: center;
    }
    .summary-card h3 { margin: 0; color: #666; font-size: 14px; }
    .summary-card .value { font-size: 32px; font-weight: bold; margin: 10px 0; }
    .summary-card .value.success { color: #22c55e; }
    .summary-card .value.error { color: #ef4444; }
    .summary-card .value.total { color: #3b82f6; }
    .summary-card .value.time { color: #8b5cf6; }
    .summary-card .value.mode { color: #f59e0b; font-size: 18px; }
    
    .flows-container { background: white; border-radius: 10px; padding: 20px; }
    .flows-container h2 { margin-top: 0; }
    
    .flow-card { 
      border: 1px solid #e5e7eb; 
      border-radius: 8px; 
      margin-bottom: 10px;
      overflow: hidden;
    }
    .flow-card.passed { border-left: 4px solid #22c55e; }
    .flow-card.failed { border-left: 4px solid #ef4444; }
    
    .flow-header { 
      display: flex; 
      justify-content: space-between; 
      align-items: center; 
      padding: 15px;
      background: #f9fafb;
      cursor: pointer;
      user-select: none;
    }
    .flow-header:hover { background: #f3f4f6; }
    .flow-title { display: flex; align-items: center; gap: 10px; }
    .flow-icon { font-size: 18px; }
    .flow-name { font-weight: 600; font-size: 16px; }
    .flow-tags { display: flex; gap: 5px; }
    .tag { 
      background: #e0e7ff; 
      color: #4338ca; 
      padding: 2px 8px; 
      border-radius: 4px; 
      font-size: 12px; 
    }
    .flow-meta { display: flex; align-items: center; gap: 15px; color: #6b7280; font-size: 14px; }
    .flow-toggle { transition: transform 0.2s; }
    .flow-toggle.open { transform: rotate(180deg); }
    
    .flow-body { padding: 15px; border-top: 1px solid #e5e7eb; }
    .flow-error { 
      color: #ef4444; 
      background: #fee2e2; 
      padding: 10px; 
      border-radius: 4px; 
      margin-bottom: 10px; 
    }
    
    .step { 
      border: 1px solid #e5e7eb; 
      border-radius: 6px; 
      padding: 12px; 
      margin-bottom: 8px; 
    }
    .step.passed { border-left: 3px solid #22c55e; }
    .step.failed { border-left: 3px solid #ef4444; background: #fef2f2; }
    .step-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
    .step-number { font-weight: 600; color: #374151; }
    .step-time { color: #8b5cf6; font-size: 13px; }
    .step-status.passed { color: #22c55e; }
    .step-status.failed { color: #ef4444; }
    .step-instruction { color: #4b5563; }
    .step-error { color: #ef4444; font-size: 13px; background: #fee2e2; padding: 8px; border-radius: 4px; margin-top: 8px; }
    
    .step-screenshot { margin-top: 10px; }
    .step-screenshot img { 
      max-width: 100%; 
      height: auto; 
      border: 1px solid #e5e7eb; 
      border-radius: 6px; 
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      cursor: pointer;
      transition: transform 0.2s;
    }
    .step-screenshot img:hover { transform: scale(1.02); }
    
    .modal { 
      display: none; 
      position: fixed; 
      z-index: 1000; 
      left: 0; 
      top: 0; 
      width: 100%; 
      height: 100%; 
      background: rgba(0,0,0,0.9); 
      justify-content: center; 
      align-items: center; 
    }
    .modal.active { display: flex; }
    .modal img { max-width: 95%; max-height: 95%; }
    .modal-close { 
      position: absolute; 
      top: 20px; 
      right: 30px; 
      color: white; 
      font-size: 40px; 
      cursor: pointer; 
    }
    
    .footer { text-align: center; color: #9ca3af; margin-top: 20px; font-size: 14px; }
    
    .expand-all { 
      background: #3b82f6; 
      color: white; 
      border: none; 
      padding: 8px 16px; 
      border-radius: 5px; 
      cursor: pointer; 
      margin-bottom: 15px;
    }
    .expand-all:hover { background: #2563eb; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🤖 AI Test Runner - Reporte Consolidado</h1>
      <div class="header-meta">
        <span>📅 Inicio: ${startTimeStr}</span>
        <span>🏁 Fin: ${endTimeStr}</span>
        <span>⚙️ Modo: ${executionMode}${workersInfo}</span>
      </div>
    </div>
    
    <div class="summary">
      <div class="summary-card">
        <h3>Total Flows</h3>
        <div class="value total">${result.totalFlows}</div>
      </div>
      <div class="summary-card">
        <h3>Pasados</h3>
        <div class="value success">${result.passed}</div>
      </div>
      <div class="summary-card">
        <h3>Fallidos</h3>
        <div class="value error">${result.failed}</div>
      </div>
      <div class="summary-card">
        <h3>Tiempo Total</h3>
        <div class="value time">${totalDuration}</div>
      </div>
      <div class="summary-card">
        <h3>Estado</h3>
        <div class="value ${result.failed === 0 ? 'success' : 'error'}">
          ${result.failed === 0 ? '✅ PASSED' : '❌ FAILED'}
        </div>
      </div>
      <div class="summary-card">
        <h3>Modo Ejecución</h3>
        <div class="value mode">${executionMode}</div>
      </div>
    </div>

    <div class="flows-container">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
        <h2>📋 Detalle de Flows (${result.totalFlows})</h2>
        <button class="expand-all" onclick="toggleAll()">Expandir/Contraer Todos</button>
      </div>
      ${flowsHtml}
    </div>

    <div class="footer">
      <p>Generado por AI Test Runner</p>
    </div>
    
    <!-- Modal para zoom de imágenes -->
    <div id="imageModal" class="modal" onclick="closeModal()">
      <span class="modal-close" onclick="closeModal()">&times;</span>
      <img id="modalImg" src="" alt="Screenshot ampliado" />
    </div>
  </div>
  
  <script>
    function toggleFlow(id) {
      const el = document.getElementById(id);
      const toggle = el.previousElementSibling.querySelector('.flow-toggle');
      if (el.style.display === 'none') {
        el.style.display = 'block';
        toggle.classList.add('open');
      } else {
        el.style.display = 'none';
        toggle.classList.remove('open');
      }
    }
    
    let allExpanded = false;
    function toggleAll() {
      const bodies = document.querySelectorAll('.flow-body');
      const toggles = document.querySelectorAll('.flow-toggle');
      allExpanded = !allExpanded;
      bodies.forEach(b => b.style.display = allExpanded ? 'block' : 'none');
      toggles.forEach(t => allExpanded ? t.classList.add('open') : t.classList.remove('open'));
    }
    
    // Auto-expandir flows fallidos
    document.querySelectorAll('.flow-card.failed .flow-body').forEach(el => {
      el.style.display = 'block';
      el.previousElementSibling.querySelector('.flow-toggle').classList.add('open');
    });
    
    // Modal para ampliar imágenes
    function openModal(src) {
      document.getElementById('modalImg').src = src;
      document.getElementById('imageModal').classList.add('active');
    }
    
    function closeModal() {
      document.getElementById('imageModal').classList.remove('active');
    }
    
    // Click en screenshots para abrir modal
    document.querySelectorAll('.step-screenshot img').forEach(img => {
      img.onclick = (e) => {
        e.stopPropagation();
        openModal(img.src);
      };
    });
    
    // Cerrar modal con ESC
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeModal();
    });
  </script>
</body>
</html>
    `;
    
    fs.writeFileSync(reportPath, html);
    console.log(`\n📄 Reporte HTML consolidado: ${reportPath}`);
    
    // Generar JSON si está habilitado
    if (this.config.reports.json.enabled) {
      const jsonPath = path.join(reportDir, `report-${timestamp}.json`);
      const jsonReport = {
        timestamp: new Date().toISOString(),
        executionMode: this.config.execution.parallel ? 'parallel' : 'sequential',
        workers: this.config.execution.parallel ? this.config.execution.maxWorkers : 1,
        summary: {
          total: result.totalFlows,
          passed: result.passed,
          failed: result.failed,
          duration: result.duration,
          durationFormatted: totalDuration
        },
        flows: result.flows.map(f => ({
          name: f.name,
          tags: f.tags,
          success: f.success,
          totalSteps: f.totalSteps,
          completedSteps: f.completedSteps,
          duration: f.duration,
          error: f.error || null,
          steps: f.steps.map(s => ({
            step: s.step,
            instruction: s.instruction,
            success: s.success,
            duration: s.duration,
            error: s.error || null
          }))
        }))
      };
      fs.writeFileSync(jsonPath, JSON.stringify(jsonReport, null, 2));
      console.log(`📊 Reporte JSON consolidado: ${jsonPath}`);
    }
    
    return reportPath;
  }
}

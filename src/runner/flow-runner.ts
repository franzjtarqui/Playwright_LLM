import { PlaywrightAIAgent } from '../core/agent.js';
import { FlowLoader } from './flow-loader.js';
import { VariableResolver } from './variable-resolver.js';
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
  
  constructor(options: RunnerOptions = {}) {
    this.loader = new FlowLoader();
    this.options = {
      testDir: './tests/flows',
      generateReport: true,
      reportDir: './playwright-report',
      enableTracing: true,
      headless: false,
      retries: 0,
      failFast: false,
      ...options
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
    
    // Ejecutar cada flow (cada uno con su propio agente para evitar problemas de estado)
    for (let i = 0; i < flowsToRun.length; i++) {
      const flow = flowsToRun[i];
      console.log(`\n${'='.repeat(60)}`);
      console.log(`🧪 [${i + 1}/${flowsToRun.length}] ${flow.definition.name}`);
      console.log(`${'='.repeat(60)}\n`);
      
      // Crear nuevo agente para cada flow (aislamiento completo)
      this.agent = new PlaywrightAIAgent();
      
      try {
        await this.agent.initialize({ headless: this.options.headless });
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
    
    const duration = Date.now() - startTime;
    
    // Calcular estadísticas
    const passed = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    const skipped = allFlows.length - flowsToRun.length;
    
    // Mostrar resumen
    this.printSummary({ totalFlows: flowsToRun.length, passed, failed, skipped, duration, flows: results });
    
    return {
      totalFlows: flowsToRun.length,
      passed,
      failed,
      skipped,
      duration,
      flows: results
    };
  }
  
  /**
   * Ejecuta un flow individual
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
      
      // Ejecutar el flow usando el agente
      const result = await this.agent!.executeFlow({
        url: resolvedUrl || '',
        steps: resolvedSteps,
        stopOnError: true,
        delayBetweenSteps: definition.delayBetweenSteps || 2000,
        analysisMode: definition.analysisMode || 'html',
        enableTracing: this.options.enableTracing,
        generateReport: this.options.generateReport,
        reportDir: this.options.reportDir
      });
      
      // Convertir resultados
      for (const step of result.steps) {
        const stepResult: StepExecutionResult = {
          step: step.step,
          instruction: step.instruction,
          success: step.success,
          duration: 0, // TODO: medir por paso
          error: step.error
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
  private printSummary(result: TestRunResult): void {
    console.log('\n' + '='.repeat(60));
    console.log('📊 RESUMEN DE EJECUCIÓN');
    console.log('='.repeat(60));
    console.log(`   Total:    ${result.totalFlows} flows`);
    console.log(`   ✅ Passed:  ${result.passed}`);
    console.log(`   ❌ Failed:  ${result.failed}`);
    console.log(`   ⏭️  Skipped: ${result.skipped}`);
    console.log(`   ⏱️  Tiempo:  ${(result.duration / 1000).toFixed(2)}s`);
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
}

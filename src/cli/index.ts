#!/usr/bin/env node
/**
 * CLI para AI Test Runner
 * 
 * Uso:
 *   npx ai-test run                    # Ejecutar todos los tests
 *   npx ai-test run --tag smoke        # Solo tests con tag 'smoke'
 *   npx ai-test run --tag login --tag operadores  # Múltiples tags
 *   npx ai-test run --exclude slow     # Excluir tests lentos
 *   npx ai-test run --name "Login"     # Filtrar por nombre
 *   npx ai-test run --headless         # Modo sin interfaz
 *   npx ai-test run --fail-fast        # Detener al primer error
 */

import { FlowRunner, RunnerOptions } from '../runner/index.js';
import { loadConfig } from '../config/index.js';

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  
  if (!command || command === 'help' || command === '--help' || command === '-h') {
    printHelp();
    return;
  }
  
  if (command === 'run') {
    const options = parseRunOptions(args.slice(1));
    await runTests(options);
  } else {
    console.error(`❌ Comando desconocido: ${command}`);
    printHelp();
    process.exit(1);
  }
}

function printHelp() {
  console.log(`
🤖 AI Test Runner - Tests en Lenguaje Natural

Uso:
  npx ai-test <comando> [opciones]

Comandos:
  run       Ejecutar tests
  help      Mostrar esta ayuda

Opciones de 'run':
  --tag <tag>         Incluir tests con este tag (puede repetirse)
  --exclude <tag>     Excluir tests con este tag (puede repetirse)
  --name <nombre>     Filtrar por nombre del test
  --dir <directorio>  Directorio de tests (default: ./tests/flows)
  --headless          Ejecutar sin interfaz gráfica
  --fail-fast         Detener al primer error
  --no-report         No generar reporte HTML
  --retries <n>       Reintentos por test fallido

Ejemplos:
  npx ai-test run                           # Todos los tests
  npx ai-test run --tag smoke               # Solo smoke tests
  npx ai-test run --tag login --tag api     # Tests con tag login O api
  npx ai-test run --exclude slow            # Excluir tests lentos
  npx ai-test run --name "operador"         # Tests que contengan "operador"
  npx ai-test run --headless --fail-fast    # CI/CD mode
`);
}

function parseRunOptions(args: string[]): RunnerOptions {
  const options: RunnerOptions = {
    tags: [],
    excludeTags: []
  };
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const nextArg = args[i + 1];
    
    switch (arg) {
      case '--tag':
      case '-t':
        if (nextArg) {
          options.tags!.push(nextArg);
          i++;
        }
        break;
        
      case '--exclude':
      case '-e':
        if (nextArg) {
          options.excludeTags!.push(nextArg);
          i++;
        }
        break;
        
      case '--name':
      case '-n':
        if (nextArg) {
          options.nameFilter = nextArg;
          i++;
        }
        break;
        
      case '--dir':
      case '-d':
        if (nextArg) {
          options.testDir = nextArg;
          i++;
        }
        break;
        
      case '--headless':
        options.headless = true;
        break;
        
      case '--fail-fast':
        options.failFast = true;
        break;
        
      case '--no-report':
        options.generateReport = false;
        break;
        
      case '--retries':
      case '-r':
        if (nextArg) {
          options.retries = parseInt(nextArg, 10);
          i++;
        }
        break;
        
      case '--base-url':
        if (nextArg) {
          options.baseUrl = nextArg;
          i++;
        }
        break;
    }
  }
  
  // Limpiar arrays vacíos
  if (options.tags!.length === 0) delete options.tags;
  if (options.excludeTags!.length === 0) delete options.excludeTags;
  
  return options;
}

async function runTests(cliOptions: RunnerOptions) {
  console.log('\n🤖 AI Test Runner v1.0.0\n');
  
  // Cargar configuración desde archivo
  const config = await loadConfig();
  console.log('📝 Configuración cargada desde ai-test.config.ts');
  
  // Merge: CLI options sobreescriben config file
  const options: RunnerOptions = {
    testDir: cliOptions.testDir || config.testDir,
    reportDir: config.reportDir,
    baseUrl: cliOptions.baseUrl || config.baseUrl,
    headless: cliOptions.headless ?? config.browser.headless,
    slowMo: config.browser.slowMo,
    failFast: cliOptions.failFast ?? config.execution.failFast,
    retries: cliOptions.retries ?? config.execution.retries,
    generateReport: cliOptions.generateReport ?? config.reports.html.enabled,
    enableTracing: config.reports.trace.enabled,
    traceMode: config.reports.trace.mode,
    tags: cliOptions.tags,
    excludeTags: cliOptions.excludeTags,
    nameFilter: cliOptions.nameFilter,
    // Pasar config completo para que el runner pueda usarlo
    config: config
  };
  
  if (options.tags) {
    console.log(`🏷️  Tags incluidos: ${options.tags.join(', ')}`);
  }
  if (options.excludeTags) {
    console.log(`🚫 Tags excluidos: ${options.excludeTags.join(', ')}`);
  }
  if (options.nameFilter) {
    console.log(`🔍 Filtro por nombre: "${options.nameFilter}"`);
  }
  
  const runner = new FlowRunner(options);
  const result = await runner.run();
  
  // Exit code basado en resultados
  process.exit(result.failed > 0 ? 1 : 0);
}

// Ejecutar
main().catch(error => {
  console.error('❌ Error fatal:', error.message);
  process.exit(1);
});

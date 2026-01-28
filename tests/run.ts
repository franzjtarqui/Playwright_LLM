/**
 * Script simple para ejecutar tests con configuración
 */
import { FlowRunner } from '../src/runner/index.js';
import config from './config.js';

async function main() {
  // Parsear argumentos de línea de comandos
  const args = process.argv.slice(2);
  
  // Buscar tags en argumentos
  const tags: string[] = [];
  const excludeTags: string[] = [];
  let nameFilter: string | undefined;
  
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--tag' && args[i + 1]) {
      tags.push(args[i + 1]);
      i++;
    } else if (args[i] === '--exclude' && args[i + 1]) {
      excludeTags.push(args[i + 1]);
      i++;
    } else if (args[i] === '--name' && args[i + 1]) {
      nameFilter = args[i + 1];
      i++;
    }
  }
  
  const runner = new FlowRunner({
    ...config,
    tags: tags.length > 0 ? tags : undefined,
    excludeTags: excludeTags.length > 0 ? excludeTags : undefined,
    nameFilter
  });
  
  const result = await runner.run();
  
  process.exit(result.failed > 0 ? 1 : 0);
}

main().catch(console.error);

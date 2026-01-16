import { PlaywrightAIAgent } from './ai-agent.js';

/**
 * Ejemplo avanzado: Uso personalizado del agente
 */
async function customExample(): Promise<void> {
  const agent = new PlaywrightAIAgent();
  
  try {
    await agent.initialize();
    
    // Puedes usar cualquier URL y instrucción
    const result = await agent.execute({
      url: 'https://www.google.com',
      instruction: 'Buscar "Playwright automation tutorial" y presionar Enter'
    });
    
    if (result.success) {
      console.log('✅ Búsqueda realizada exitosamente');
      console.log('URL final:', result.finalUrl);
    }
    
    // Esperar para observar
    await agent.page?.waitForTimeout(5000);
    
  } catch (error) {
    console.error('Error:', (error as Error).message);
  } finally {
    await agent.close();
  }
}

/**
 * Ejemplo de múltiples instrucciones secuenciales
 */
async function multiStepExample(): Promise<void> {
  const agent = new PlaywrightAIAgent();
  
  try {
    await agent.initialize();
    
    // Primer paso: Login
    await agent.execute({
      url: 'http://localhost:3000',
      instruction: 'Ingresar usuario Franz, password 1234 y hacer login'
    });
    
    // Segundo paso: (Agregar según tu aplicación)
    // await agent.execute({
    //   url: 'http://localhost:3000/dashboard',
    //   instruction: 'Navegar a la sección de perfil'
    // });
    
    await agent.page?.waitForTimeout(3000);
    
  } catch (error) {
    console.error('Error:', (error as Error).message);
  } finally {
    await agent.close();
  }
}

// Información de ejemplos disponibles
console.log(`
📚 Ejemplos disponibles:
  
  1. customExample() - Búsqueda en Google
  2. multiStepExample() - Múltiples pasos secuenciales
  
Para ejecutar un ejemplo, descomenta la función al final de este archivo.
`);

// Descomentar para ejecutar:
// customExample();
// multiStepExample();

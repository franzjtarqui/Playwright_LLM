import { PlaywrightAIAgent } from './ai-agent.js';
/**
 * Demo principal del agente de IA
 *
 * MODOS DE ANÁLISIS:
 * - 'html': Solo extrae elementos interactivos del DOM (más barato, rápido)
 * - 'screenshot': Solo envía imagen de la página (más visual, más tokens)
 * - 'hybrid': Envía ambos (más preciso, balance de costo)
 */
async function runDemo() {
    const agent = new PlaywrightAIAgent();
    try {
        // Inicializar navegador
        await agent.initialize();
        console.log('\n🎯 Iniciando demostración...\n');
        console.log('Este demo mostrará cómo el agente IA puede:');
        console.log('  1. Analizar visualmente una página de login');
        console.log('  2. Entender instrucciones en lenguaje natural');
        console.log('  3. Ejecutar múltiples pasos SIN selectores predefinidos\n');
        // Ejecutar flujo completo con múltiples pasos
        // NOTA: Cada paso es independiente y debe describir exactamente lo que debe hacer
        const result = await agent.executeFlow({
            url: 'https://gmodelo.deltaxbeta.com/',
            steps: [
                // Paso 1: Login
                'Ingresar correo electronico: ab.demo@deltax.la, contraseña: 12345678 y hacer click en el botón de ingresar',
                // Paso 2: Verificar título
                'Verificar el titulo: Informe operativo, hacer click en la opcion: Rutas, despues hacer click en: Configuración de rutas',
                // Paso 3: Configuración
                'En la sección de Configuración de rutas, hacer click en el botón: Crear ruta',
                // Paso 4: Llenar formulario
                'Llenar el formulario campo Tiempo en origen: 10, Tiempo en destino: 15, Distancia: 3'
            ],
            stopOnError: true, // Detener si hay error
            delayBetweenSteps: 4000, // Esperar 4 segundos entre pasos
            // 👇 MODO DE ANÁLISIS - Cambia esto para probar diferentes modos:
            analysisMode: 'html' // 'html' | 'screenshot' | 'hybrid'
        });
        if (result.success) {
            console.log('\n🎉 ¡Flujo completado exitosamente!');
            console.log(`   Pasos completados: ${result.completedSteps}/${result.totalSteps}`);
        }
        else {
            console.log('\n⚠️  El flujo encontró errores:');
            result.steps.filter(s => !s.success).forEach(s => {
                console.log(`   Paso ${s.step}: ${s.error}`);
            });
        }
        // Esperar para observar el resultado
        console.log('\n⏸️  Esperando 5 segundos para que puedas ver el resultado...');
        await agent.page?.waitForTimeout(5000);
    }
    catch (error) {
        console.error('\n❌ Error en el demo:', error.message);
        if (error.message.includes('API key') || error.message.includes('No se encontró')) {
            console.error('\n💡 Sugerencia: Configura tu API key en el archivo .env');
            console.error('   Opciones gratuitas:');
            console.error('   - GOOGLE_AI_API_KEY (https://aistudio.google.com/apikey)');
            console.error('   - OLLAMA_ENABLED=true (local)\n');
        }
    }
    finally {
        // Cerrar navegador
        await agent.close();
        console.log('\n✅ Navegador cerrado. Demo finalizado.\n');
    }
}
// Ejecutar demo
runDemo();
//# sourceMappingURL=demo.js.map
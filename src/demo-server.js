import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

// Servir archivos estáticos desde la carpeta demo-page
app.use(express.static(path.join(__dirname, '../demo-page')));

// Ruta principal
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../demo-page/login.html'));
});

app.listen(PORT, () => {
  console.log('\n' + '='.repeat(60));
  console.log('🚀 Servidor demo iniciado');
  console.log('='.repeat(60));
  console.log(`\n📍 URL: http://localhost:${PORT}`);
  console.log(`\n💡 Abre esta URL en tu navegador o úsala con el agente AI`);
  console.log(`\n⏹️  Presiona Ctrl+C para detener el servidor\n`);
});

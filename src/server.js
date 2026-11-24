require('dotenv').config();
const express = require('express');
const connectDatabase = require('./config/database');
const acervoRoutes = require('./routes/acervoRoutes');
const errorHandler = require('./middlewares/errorHandler');

const app = express();
app.use(express.json({ limit: '1mb' }));

app.get('/health', (req, res) => res.json({ status: 'ok', aplicacao: 'MuseumArchive API' }));
app.use('/api', acervoRoutes);
app.use((req, res) => res.status(404).json({ erro: true, mensagem: 'Rota não encontrada.' }));
app.use(errorHandler);

const PORT = process.env.PORT || 3000;

async function iniciarServidor() {
  try {
    await connectDatabase();
    app.listen(PORT, () => console.log(`MuseumArchive API executando na porta ${PORT}.`));
  } catch (error) {
    console.error('Falha ao iniciar a aplicação:', error.message);
    process.exit(1);
  }
}

if (require.main === module) iniciarServidor();
module.exports = app;

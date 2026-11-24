const express = require('express');
const controller = require('../controllers/acervoController');
const router = express.Router();

router.post('/curadores', controller.criarCurador);
router.get('/curadores', controller.listarCuradores);
router.get('/curadores/:id', controller.buscarCurador);
router.put('/curadores/:id', controller.atualizarCurador);
router.delete('/curadores/:id', controller.excluirCurador);

router.post('/artefatos', controller.criarArtefato);
router.get('/artefatos', controller.listarArtefatos);
router.get('/artefatos/:id', controller.buscarArtefato);
router.patch('/artefatos/:id', controller.atualizarArtefato);
router.delete('/artefatos/:id', controller.excluirArtefato);
router.post('/artefatos/:id/laudos', controller.adicionarLaudo);
router.post('/artefatos/:id/movimentacoes', controller.adicionarMovimentacao);
router.patch('/artefatos/:id/transicoes', controller.executarTransicao);
router.get('/relatorios/acervo', controller.gerarRelatorio);

module.exports = router;

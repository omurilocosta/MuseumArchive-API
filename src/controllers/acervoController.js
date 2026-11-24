const service = require('../services/acervoService');
const asyncHandler = require('./asyncHandler');

const criarArtefato = asyncHandler(async (req, res) => res.status(201).json(await service.criarArtefato(req.body)));
const listarArtefatos = asyncHandler(async (req, res) => {
  const filtros = {};
  for (const campo of ['tipoItem', 'statusAtual', 'responsavelId']) {
    if (req.query[campo] !== undefined) filtros[campo] = req.query[campo];
  }
  res.json(await service.listarArtefatos(filtros));
});
const buscarArtefato = asyncHandler(async (req, res) => res.json(await service.buscarArtefato(req.params.id)));
const atualizarArtefato = asyncHandler(async (req, res) => res.json(await service.atualizarArtefato(req.params.id, req.body)));
const excluirArtefato = asyncHandler(async (req, res) => res.json(await service.excluirArtefato(req.params.id)));
const adicionarLaudo = asyncHandler(async (req, res) => res.status(201).json(await service.adicionarLaudo(req.params.id, req.body)));
const adicionarMovimentacao = asyncHandler(async (req, res) => res.status(201).json(await service.adicionarMovimentacao(req.params.id, req.body)));
const executarTransicao = asyncHandler(async (req, res) => res.json(await service.executarTransicao(req.params.id, req.body.acao)));
const gerarRelatorio = asyncHandler(async (req, res) => res.json(await service.gerarRelatorio(req.query.dias ?? 30)));

const criarCurador = asyncHandler(async (req, res) => res.status(201).json(await service.criarCurador(req.body)));
const listarCuradores = asyncHandler(async (req, res) => res.json(await service.listarCuradores()));
const buscarCurador = asyncHandler(async (req, res) => res.json(await service.buscarCurador(req.params.id)));
const atualizarCurador = asyncHandler(async (req, res) => res.json(await service.atualizarCurador(req.params.id, req.body)));
const excluirCurador = asyncHandler(async (req, res) => res.json(await service.excluirCurador(req.params.id)));

module.exports = {
  criarArtefato, listarArtefatos, buscarArtefato, atualizarArtefato, excluirArtefato,
  adicionarLaudo, adicionarMovimentacao, executarTransicao, gerarRelatorio,
  criarCurador, listarCuradores, buscarCurador, atualizarCurador, excluirCurador
};

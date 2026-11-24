const mongoose = require('mongoose');
const Curador = require('../models/curadorModel');
const repository = require('../repositories/acervoRepository');
const { TIPOS_ITEM, CAMPOS_POR_TIPO } = require('../models/artefatoModel');
const { ValidationError, NotFoundError, ConflictError } = require('./erros');

const TRANSICOES = {
  EmReservaTecnica: {
    AGENDAR_EXIBICAO: 'EmExposicao',
    CONCEDER_EMPRESTIMO: 'EmEmprestimo',
    IDENTIFICAR_DANOS: 'EmAnaliseRestauracao'
  },
  EmExposicao: { FIM_EXIBICAO: 'EmReservaTecnica' },
  EmEmprestimo: { DEVOLUCAO: 'EmReservaTecnica' },
  EmAnaliseRestauracao: { APROVAR_LAUDO: 'EmProcessoRestauracao' },
  EmProcessoRestauracao: { CONCLUIR_RESTAURACAO: 'EmReservaTecnica' }
};

const CAMPOS_ARTEFATO_EDITAVEIS = ['numeroTombamento', 'titulo', 'tipoItem', 'dataAquisicao', 'responsavelId', 'especificidades'];
const CAMPOS_ESPECIFICIDADES = Object.values(CAMPOS_POR_TIPO).flat();

function validarId(id, entidade = 'identificador') {
  if (!mongoose.isValidObjectId(id)) throw new ValidationError(`${entidade} inválido.`);
}

function validarEspecificidades(tipoItem, especificidades = {}) {
  if (!TIPOS_ITEM.includes(tipoItem)) {
    throw new ValidationError(`tipoItem deve ser um dos seguintes: ${TIPOS_ITEM.join(', ')}.`);
  }
  if (!especificidades || typeof especificidades !== 'object' || Array.isArray(especificidades)) {
    throw new ValidationError('especificidades deve ser um objeto.');
  }
  const camposRecebidos = Object.keys(especificidades);
  const camposPermitidos = CAMPOS_POR_TIPO[tipoItem];
  const desconhecidos = camposRecebidos.filter(campo => !CAMPOS_ESPECIFICIDADES.includes(campo));
  const incompatíveis = camposRecebidos.filter(campo => CAMPOS_ESPECIFICIDADES.includes(campo) && !camposPermitidos.includes(campo));
  if (desconhecidos.length) throw new ValidationError(`Propriedades desconhecidas em especificidades: ${desconhecidos.join(', ')}.`);
  if (incompatíveis.length) throw new ValidationError(`As propriedades ${incompatíveis.join(', ')} não pertencem ao tipo ${tipoItem}.`);
}

function validarCamposPermitidos(objeto, permitidos, contexto) {
  if (!objeto || typeof objeto !== 'object' || Array.isArray(objeto)) {
    throw new ValidationError(`O conteúdo de ${contexto} deve ser um objeto JSON.`);
  }
  const proibidos = Object.keys(objeto).filter(campo => !permitidos.includes(campo));
  if (proibidos.length) throw new ValidationError(`Campos não permitidos em ${contexto}: ${proibidos.join(', ')}.`);
}

class AcervoService {
  async criarArtefato(dados) {
    validarCamposPermitidos(dados, CAMPOS_ARTEFATO_EDITAVEIS, 'cadastro do artefato');
    validarEspecificidades(dados.tipoItem, dados.especificidades || {});
    validarId(dados.responsavelId, 'responsavelId');
    const curador = await Curador.findById(dados.responsavelId);
    if (!curador) throw new ValidationError('O curador informado em responsavelId não existe.');

    return repository.criarArtefato({
      numeroTombamento: dados.numeroTombamento,
      titulo: dados.titulo,
      tipoItem: dados.tipoItem,
      dataAquisicao: dados.dataAquisicao,
      statusAtual: 'EmReservaTecnica',
      responsavelId: dados.responsavelId,
      especificidades: dados.especificidades || {},
      laudosRestauracao: [],
      movimentacoes: []
    });
  }

  listarArtefatos(filtros) {
    const filtrosPermitidos = ['tipoItem', 'statusAtual', 'responsavelId'];
    validarCamposPermitidos(filtros, filtrosPermitidos, 'filtros');
    if (filtros.responsavelId) validarId(filtros.responsavelId, 'responsavelId');
    return repository.listarArtefatos(filtros);
  }

  async buscarArtefato(id) {
    validarId(id, 'artefatoId');
    const artefato = await repository.buscarArtefatoPorId(id);
    if (!artefato) throw new NotFoundError('Artefato não encontrado.');
    return artefato;
  }

  async atualizarArtefato(id, dados) {
    validarId(id, 'artefatoId');
    validarCamposPermitidos(dados, CAMPOS_ARTEFATO_EDITAVEIS, 'atualização do artefato');
    if (Object.prototype.hasOwnProperty.call(dados, 'responsavelId')) {
      validarId(dados.responsavelId, 'responsavelId');
      if (!await Curador.exists({ _id: dados.responsavelId })) throw new ValidationError('O curador informado não existe.');
    }

    const atual = await repository.buscarArtefatoPorId(id);
    if (!atual) throw new NotFoundError('Artefato não encontrado.');
    const tipoFinal = dados.tipoItem || atual.tipoItem;
    const especificidadesFinais = dados.especificidades || atual.especificidades?.toObject?.() || {};
    validarEspecificidades(tipoFinal, especificidadesFinais);

    const atualizado = await repository.atualizarArtefato(id, dados);
    if (!atualizado) throw new NotFoundError('Artefato não encontrado.');
    return atualizado;
  }

  async excluirArtefato(id) {
    validarId(id, 'artefatoId');
    const excluido = await repository.excluirArtefato(id);
    if (!excluido) throw new NotFoundError('Artefato não encontrado.');
    return { mensagem: 'Artefato excluído com sucesso.' };
  }

  async adicionarLaudo(id, laudo) {
    validarId(id, 'artefatoId');
    validarCamposPermitidos(laudo, ['dataLaudo', 'restaurador', 'procedimentoRealizado', 'observacoes'], 'laudo');
    const artefato = await repository.adicionarLaudo(id, laudo);
    if (!artefato) throw new NotFoundError('Artefato não encontrado.');
    return artefato;
  }

  async adicionarMovimentacao(id, movimentacao) {
    validarId(id, 'artefatoId');
    validarCamposPermitidos(movimentacao, ['origem', 'destino', 'dataMovimento', 'responsavelTransporte'], 'movimentação');
    const artefato = await repository.adicionarMovimentacao(id, movimentacao);
    if (!artefato) throw new NotFoundError('Artefato não encontrado.');
    return artefato;
  }

  async executarTransicao(id, acao) {
    validarId(id, 'artefatoId');
    if (typeof acao !== 'string' || !acao.trim()) throw new ValidationError('Informe a ação da transição.');
    const artefato = await repository.buscarArtefatoPorId(id);
    if (!artefato) throw new NotFoundError('Artefato não encontrado.');

    const novoStatus = TRANSICOES[artefato.statusAtual]?.[acao];
    if (!novoStatus) {
      throw new ConflictError(`Transição não permitida: ${acao} não pode ser executada quando o artefato está em ${artefato.statusAtual}.`);
    }

    const atualizado = await repository.atualizarStatusSeAtualCorresponder(id, artefato.statusAtual, novoStatus);
    if (!atualizado) throw new ConflictError('O status do artefato foi alterado por outra operação. Consulte o artefato e tente novamente.');
    return atualizado;
  }

  async criarCurador(dados) {
    validarCamposPermitidos(dados, ['nome', 'matricula', 'departamento'], 'curador');
    return repository.criarCurador(dados);
  }

  listarCuradores() { return repository.listarCuradores(); }

  async buscarCurador(id) {
    validarId(id, 'curadorId');
    const curador = await repository.buscarCuradorPorId(id);
    if (!curador) throw new NotFoundError('Curador não encontrado.');
    return curador;
  }

  async atualizarCurador(id, dados) {
    validarId(id, 'curadorId');
    validarCamposPermitidos(dados, ['nome', 'matricula', 'departamento'], 'atualização do curador');
    const curador = await repository.atualizarCurador(id, dados);
    if (!curador) throw new NotFoundError('Curador não encontrado.');
    return curador;
  }

  async excluirCurador(id) {
    validarId(id, 'curadorId');
    if (!await repository.buscarCuradorPorId(id)) throw new NotFoundError('Curador não encontrado.');
    if (await repository.curadorPossuiArtefatos(id)) {
      throw new ConflictError('Não é possível excluir o curador: existem artefatos vinculados a ele.');
    }
    await repository.excluirCurador(id);
    return { mensagem: 'Curador excluído com sucesso.' };
  }

  async gerarRelatorio(dias = 30) {
    const quantidadeDias = Number(dias);
    if (!Number.isInteger(quantidadeDias) || quantidadeDias < 1 || quantidadeDias > 3650) {
      throw new ValidationError('O parâmetro dias deve ser um número inteiro entre 1 e 3650.');
    }
    const dataLimite = new Date(Date.now() - quantidadeDias * 24 * 60 * 60 * 1000);
    const [relatorio] = await repository.relatorioAnalitico(dataLimite);
    return {
      periodoDias: quantidadeDias,
      criterioRestauracaoRecente: 'Data do laudo mais recente (dataLaudo) dentro do período informado.',
      contagemPorTipo: relatorio?.contagemPorTipo || [],
      artefatosRestauradosRecentemente: relatorio?.artefatosRestauradosRecentemente || []
    };
  }
}

module.exports = new AcervoService();

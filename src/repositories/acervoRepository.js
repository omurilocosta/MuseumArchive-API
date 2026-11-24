const { Artefato } = require('../models/artefatoModel');
const Curador = require('../models/curadorModel');

class AcervoRepository {
  criarCurador(dados) { return Curador.create(dados); }
  listarCuradores() { return Curador.find().sort({ nome: 1 }); }
  buscarCuradorPorId(id) { return Curador.findById(id); }
  atualizarCurador(id, dados) { return Curador.findByIdAndUpdate(id, dados, { new: true, runValidators: true }); }
  excluirCurador(id) { return Curador.findByIdAndDelete(id); }
  curadorPossuiArtefatos(id) { return Artefato.exists({ responsavelId: id }); }

  criarArtefato(dados) {
    return Artefato.create(dados);
  }

  listarArtefatos(filtros = {}) {
    return Artefato.find(filtros).populate('responsavelId', 'nome matricula departamento').sort({ numeroTombamento: 1 });
  }

  buscarArtefatoPorId(id) {
    return Artefato.findById(id).populate('responsavelId', 'nome matricula departamento');
  }

  async atualizarArtefato(id, dados) {
    const artefato = await Artefato.findById(id);
    if (!artefato) return null;
    artefato.set(dados);
    await artefato.save();
    return Artefato.findById(id).populate('responsavelId', 'nome matricula departamento');
  }

  excluirArtefato(id) {
    return Artefato.findByIdAndDelete(id);
  }

  adicionarLaudo(id, laudo) {
    return Artefato.findByIdAndUpdate(
      id,
      { $push: { laudosRestauracao: { $each: [laudo], $slice: -5 } } },
      { new: true, runValidators: true }
    ).populate('responsavelId', 'nome matricula departamento');
  }

  adicionarMovimentacao(id, movimentacao) {
    return Artefato.findByIdAndUpdate(
      id,
      { $push: { movimentacoes: movimentacao } },
      { new: true, runValidators: true }
    ).populate('responsavelId', 'nome matricula departamento');
  }

  atualizarStatusSeAtualCorresponder(id, statusAtual, novoStatus) {
    return Artefato.findOneAndUpdate(
      { _id: id, statusAtual },
      { $set: { statusAtual: novoStatus } },
      { new: true, runValidators: true }
    ).populate('responsavelId', 'nome matricula departamento');
  }

  relatorioAnalitico(dataLimite) {
    return Artefato.aggregate([
      {
        $facet: {
          contagemPorTipo: [
            { $group: { _id: '$tipoItem', quantidade: { $sum: 1 } } },
            { $project: { _id: 0, tipoItem: '$_id', quantidade: 1 } },
            { $sort: { tipoItem: 1 } }
          ],
          artefatosRestauradosRecentemente: [
            { $match: { 'laudosRestauracao.0': { $exists: true } } },
            { $addFields: { ultimoLaudo: { $max: '$laudosRestauracao.dataLaudo' } } },
            { $match: { ultimoLaudo: { $gte: dataLimite } } },
            {
              $project: {
                _id: 1,
                numeroTombamento: 1,
                titulo: 1,
                tipoItem: 1,
                statusAtual: 1,
                ultimoLaudo: 1
              }
            },
            { $sort: { ultimoLaudo: -1 } }
          ]
        }
      }
    ]);
  }
}

module.exports = new AcervoRepository();

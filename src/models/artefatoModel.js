const mongoose = require('mongoose');

const TIPOS_ITEM = ['Paleontologia', 'Arqueologia', 'Pintura'];
const STATUS_ARTEFATO = [
  'EmReservaTecnica',
  'EmExposicao',
  'EmEmprestimo',
  'EmAnaliseRestauracao',
  'EmProcessoRestauracao'
];

const CAMPOS_POR_TIPO = {
  Paleontologia: ['eraGeologica', 'formacaoRochosa'],
  Arqueologia: ['sitioEscavacao', 'culturaAssociada'],
  Pintura: ['tecnica', 'suporte']
};

const especificidadesSchema = new mongoose.Schema({
  eraGeologica: { type: String, trim: true },
  formacaoRochosa: { type: String, trim: true },
  sitioEscavacao: { type: String, trim: true },
  culturaAssociada: { type: String, trim: true },
  tecnica: { type: String, trim: true },
  suporte: { type: String, trim: true }
}, { _id: false, strict: 'throw' });

const laudoRestauracaoSchema = new mongoose.Schema({
  dataLaudo: { type: Date, required: true },
  restaurador: { type: String, required: true, trim: true },
  procedimentoRealizado: { type: String, required: true, trim: true },
  observacoes: { type: String, trim: true, default: '' }
}, { _id: false, strict: 'throw' });

const movimentacaoSchema = new mongoose.Schema({
  origem: { type: String, required: true, trim: true },
  destino: { type: String, required: true, trim: true },
  dataMovimento: { type: Date, required: true },
  responsavelTransporte: { type: String, required: true, trim: true }
}, { _id: false, strict: 'throw' });

const artefatoSchema = new mongoose.Schema({
  numeroTombamento: { type: String, required: true, trim: true, unique: true },
  titulo: { type: String, required: true, trim: true },
  tipoItem: { type: String, required: true, enum: TIPOS_ITEM },
  dataAquisicao: { type: Date, required: true },
  statusAtual: { type: String, required: true, enum: STATUS_ARTEFATO, default: 'EmReservaTecnica' },
  responsavelId: { type: mongoose.Schema.Types.ObjectId, ref: 'Curador', required: true },
  especificidades: { type: especificidadesSchema, default: () => ({}) },
  laudosRestauracao: {
    type: [laudoRestauracaoSchema],
    default: [],
    validate: {
      validator: value => value.length <= 5,
      message: 'O histórico pode conter no máximo 5 laudos de restauração.'
    }
  },
  movimentacoes: { type: [movimentacaoSchema], default: [] }
}, {
  collection: 'artefatos',
  timestamps: false,
  versionKey: false,
  strict: 'throw'
});

artefatoSchema.pre('validate', function validarEspecificidades(next) {
  const camposPermitidos = CAMPOS_POR_TIPO[this.tipoItem];
  if (!camposPermitidos) return next();

  const especificidades = this.especificidades ? this.especificidades.toObject() : {};
  const camposPreenchidos = Object.entries(especificidades)
    .filter(([, valor]) => valor !== undefined && valor !== null && valor !== '')
    .map(([campo]) => campo);
  const incompatíveis = camposPreenchidos.filter(campo => !camposPermitidos.includes(campo));

  if (incompatíveis.length) {
    this.invalidate(
      'especificidades',
      `O tipoItem ${this.tipoItem} não aceita as propriedades: ${incompatíveis.join(', ')}.`
    );
  }
  next();
});

module.exports = {
  Artefato: mongoose.model('Artefato', artefatoSchema),
  TIPOS_ITEM,
  STATUS_ARTEFATO,
  CAMPOS_POR_TIPO
};

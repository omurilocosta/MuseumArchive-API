const mongoose = require('mongoose');

const curadorSchema = new mongoose.Schema({
  nome: { type: String, required: true, trim: true },
  matricula: { type: String, required: true, trim: true, unique: true },
  departamento: { type: String, required: true, trim: true }
}, {
  collection: 'curadores',
  timestamps: false,
  versionKey: false
});

module.exports = mongoose.model('Curador', curadorSchema);

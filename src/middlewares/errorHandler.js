const { AppError } = require('../services/erros');

function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);

  let statusCode = err.statusCode || 500;
  let message = err.message || 'Erro interno do servidor.';

  if (err.name === 'ValidationError' && err.errors) {
    statusCode = 400;
    message = Object.values(err.errors).map(item => item.message).join('; ');
  } else if (err.name === 'CastError' || err.name === 'SyntaxError') {
    statusCode = 400;
    message = 'Dados ou identificador em formato inválido.';
  } else if (err.code === 11000) {
    statusCode = 409;
    const campo = Object.keys(err.keyPattern || {})[0] || 'campo';
    message = `Já existe um registro com esse valor para ${campo}.`;
  } else if (!(err instanceof AppError) && statusCode === 500) {
    console.error(err);
    message = 'Erro interno do servidor.';
  }

  res.status(statusCode).json({
    erro: true,
    mensagem: message
  });
}

module.exports = errorHandler;

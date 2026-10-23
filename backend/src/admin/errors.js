class HttpError extends Error {
  constructor(status, message, code = null) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.code = code;
  }
}

function isUniqueConstraintError(error) {
  return Boolean(
    error && typeof error.message === 'string' && error.message.includes('UNIQUE constraint failed')
  );
}

module.exports = { HttpError, isUniqueConstraintError };

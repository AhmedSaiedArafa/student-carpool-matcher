const AppError = require('../utils/AppError');

function validate(schema, source) {
  return (req, res, next) => {
    const errors = [];
    const data = source === 'query' ? req.query : (source === 'params' ? req.params : req.body);
    for (const [field, rules] of Object.entries(schema)) {
      let value = data[field];
      if (value === undefined || value === null) value = req.query[field] ?? req.params[field];
      if (rules.required && (value === undefined || value === null || value === '')) {
        errors.push(`${field} is required`);
        continue;
      }
      if (value === undefined || value === null || value === '') continue;

      if (rules.type === 'number' && isNaN(Number(value))) {
        errors.push(`${field} must be a number`);
        continue;
      }
      if (rules.type === 'integer') {
        const n = Number(value);
        if (!Number.isInteger(n)) { errors.push(`${field} must be an integer`); continue; }
      }
      if (rules.type === 'boolean' && typeof value !== 'boolean' && value !== 'true' && value !== 'false') {
        errors.push(`${field} must be a boolean`);
        continue;
      }
      if (rules.type === 'array' && !Array.isArray(value)) {
        errors.push(`${field} must be an array`);
        continue;
      }
      if (rules.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
        errors.push(`${field} must be a valid email`);
      }
      if (rules.min !== undefined && Number(value) < rules.min) {
        errors.push(`${field} must be at least ${rules.min}`);
      }
      if (rules.max !== undefined && Number(value) > rules.max) {
        errors.push(`${field} must be at most ${rules.max}`);
      }
      if (rules.minLength !== undefined && String(value).length < rules.minLength) {
        errors.push(`${field} must be at least ${rules.minLength} characters`);
      }
      if (rules.maxLength !== undefined && String(value).length > rules.maxLength) {
        errors.push(`${field} must be at most ${rules.maxLength} characters`);
      }
      if (rules.pattern && !rules.pattern.test(String(value))) {
        errors.push(`${field} has an invalid format`);
      }
      if (rules.oneOf && !rules.oneOf.includes(value)) {
        errors.push(`${field} must be one of: ${rules.oneOf.join(', ')}`);
      }
    }
    if (errors.length > 0) {
      throw new AppError(400, 'VALIDATION_ERROR', errors.join('; '));
    }
    next();
  };
}

module.exports = validate;

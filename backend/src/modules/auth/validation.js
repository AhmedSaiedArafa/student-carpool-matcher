const registerSchema = {
  university_email: { required: true, type: 'email' },
  password: { required: true, minLength: 8 },
  name: { required: true, minLength: 2 },
  role: { required: true, oneOf: ['driver', 'rider'] },
};

const loginSchema = {
  university_email: { required: true, type: 'email' },
  password: { required: true },
};

module.exports = { registerSchema, loginSchema };

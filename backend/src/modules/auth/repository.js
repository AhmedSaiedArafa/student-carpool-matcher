const { query } = require('../../db');

async function findByEmail(email) {
  const { rows } = await query('SELECT * FROM users WHERE university_email = $1', [email]);
  return rows[0] || null;
}

async function findById(id) {
  const { rows } = await query('SELECT id, university_email, name, role, email_verified, created_at FROM users WHERE id = $1', [id]);
  return rows[0] || null;
}

async function create({ university_email, password_hash, name, role, verification_token }) {
  const { rows } = await query(
    `INSERT INTO users (university_email, password_hash, name, role, verification_token)
     VALUES ($1, $2, $3, $4, $5) RETURNING id, university_email, name, role, email_verified`,
    [university_email, password_hash, name, role, verification_token]
  );
  return rows[0];
}

async function verifyEmail(token) {
  const { rows } = await query(
    `UPDATE users SET email_verified = true, verification_token = NULL
     WHERE verification_token = $1 AND email_verified = false
     RETURNING id, university_email, name, role, email_verified`,
    [token]
  );
  return rows[0] || null;
}

module.exports = { findByEmail, findById, create, verifyEmail };

// AWS Lambda entry point: runs the SAME Express app as server.js.
// serverless-http translates the Lambda event into an Express request (req),
// and the Express response (res) back into the answer Lambda returns.
//
// On a cold start, DATABASE_URL and JWT_SECRET are loaded from Secrets Manager
// (secret name in the SECRET_ID setting), so no secrets are stored in the function.
// Lambda setting: handler = lambda.handler
const serverless = require('serverless-http');

let handler;

async function loadSecrets() {
  const secretId = process.env.SECRET_ID;
  if (!secretId) return;

  const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
  const client = new SecretsManagerClient({});
  const result = await client.send(new GetSecretValueCommand({ SecretId: secretId }));
  const values = JSON.parse(result.SecretString);

  for (const [key, value] of Object.entries(values)) {
    if (!process.env[key]) process.env[key] = value;
  }
  console.log(`Configuration loaded from secret ${secretId}`);
}

module.exports.handler = async (event, context) => {
  if (!handler) {
    await loadSecrets();
    const app = require('./src/app');
    handler = serverless(app);
  }
  return handler(event, context);
};

const { loadSecrets } = require('./lambda');

let initialized = false;

module.exports.handler = async (event) => {
  if (!initialized) {
    await loadSecrets();
    initialized = true;
  }

  const { runExpiry } = require('./src/modules/matching/service');
  const result = await runExpiry();

  const trigger = event.source || 'unknown';
  console.log(`Expiry job (${trigger}): ${JSON.stringify(result)}`);
  return result;
};

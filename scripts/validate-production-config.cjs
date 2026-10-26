const fs = require('node:fs');
const path = require('node:path');

function validateConfig(raw) {
  const key = String(raw.REACT_APP_GOOGLE_MAPS_API_KEY || '').trim();
  if (!key) throw new Error('Configure REACT_APP_GOOGLE_MAPS_API_KEY para publicar o mapa operacional.');
  return key;
}

function validateArtifact(buildPath, key) {
  const manifest = JSON.parse(fs.readFileSync(path.join(buildPath, 'asset-manifest.json'), 'utf8'));
  // Include lazy page chunks listed by this release; never scan stale files in build/.
  if (!manifest.files?.['main.js']) throw new Error('Build sem entrada principal no manifesto.');
  const scripts = Object.values(manifest.files).filter(value => typeof value === 'string' && value.endsWith('.js'));
  let found = false;
  for (const entry of scripts) {
    const relative = entry.slice(entry.indexOf('/static/') + 1);
    if (!relative.startsWith('static/') || relative.includes('..')) throw new Error('Entrada JavaScript inválida.');
    if (fs.readFileSync(path.join(buildPath, relative), 'utf8').includes(key)) found = true;
  }
  if (!found) throw new Error('O JavaScript publicado não contém a chave do mapa configurada.');
}

if (require.main === module) {
  try {
    process.env.NODE_ENV = 'production';
    const { raw } = require('react-scripts/config/env')();
    const key = validateConfig(raw);
    if (process.argv.includes('--artifact')) validateArtifact(require('react-scripts/config/paths').appBuild, key);
    console.log('Configuração do mapa validada' + (process.argv.includes('--artifact') ? ' no artefato compilado.' : '.'));
  } catch (error) {
    console.error('Publicação bloqueada: ' + error.message);
    process.exitCode = 1;
  }
}
module.exports = { validateConfig, validateArtifact };

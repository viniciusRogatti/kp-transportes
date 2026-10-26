const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { validateConfig, validateArtifact } = require('./validate-production-config.cjs');
for (const key of [undefined, '', '   ']) assert.throws(() => validateConfig({ REACT_APP_GOOGLE_MAPS_API_KEY: key }), /REACT_APP_GOOGLE_MAPS_API_KEY/);
assert.equal(validateConfig({ REACT_APP_GOOGLE_MAPS_API_KEY: 'synthetic-map-key' }), 'synthetic-map-key');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kp-build-guard-'));
try {
  fs.mkdirSync(path.join(dir, 'static/js'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'asset-manifest.json'), JSON.stringify({ files: { 'main.js': '/kp-transportes/static/js/main.test.js' } }));
  fs.writeFileSync(path.join(dir, 'static/js/main.old.js'), 'synthetic-map-key');
  fs.writeFileSync(path.join(dir, 'static/js/main.test.js'), 'bundle without key');
  assert.throws(() => validateArtifact(dir, 'synthetic-map-key'), /não contém/);
  fs.writeFileSync(path.join(dir, 'static/js/main.test.js'), 'const key="synthetic-map-key";');
  validateArtifact(dir, 'synthetic-map-key');
  fs.writeFileSync(path.join(dir, 'static/js/main.test.js'), 'main with lazy monitoring');
  fs.writeFileSync(path.join(dir, 'static/js/monitoring.js'), 'synthetic-map-key');
  fs.writeFileSync(path.join(dir, 'asset-manifest.json'), JSON.stringify({ files: { 'main.js': '/kp-transportes/static/js/main.test.js', 'monitoring.js': '/kp-transportes/static/js/monitoring.js' } }));
  validateArtifact(dir, 'synthetic-map-key');
  fs.writeFileSync(path.join(dir, 'asset-manifest.json'), '{}');
  assert.throws(() => validateArtifact(dir, 'synthetic-map-key'), /entrada principal/);
} finally { fs.rmSync(dir, { recursive: true, force: true }); }
console.log('PASS configuração ausente/vazia e chave no artefato realmente publicado');

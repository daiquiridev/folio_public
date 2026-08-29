#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const AdmZip = require('adm-zip');

// Step 1: Build React + Kumo UI assets with Vite
console.log('Building React UI assets...');
execSync('npx vite build', { stdio: 'inherit', cwd: path.join(__dirname, '..') });

// Read version from manifest.json
const manifestPath = path.join(__dirname, '..', 'extension', 'manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const version = manifest.version;

// Create dist directory if it doesn't exist
const distDir = path.join(__dirname, '..', 'dist');
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

// Output filename with version
const zipFileName = `folio-v${version}.zip`;
const zipPath = path.join(distDir, zipFileName);

// Remove old zip if exists
if (fs.existsSync(zipPath)) {
  fs.unlinkSync(zipPath);
  console.log(`Removed existing: ${zipFileName}`);
}

console.log(`Building Chrome Web Store package...`);
console.log(`Version: ${version}`);

try {
  const zip = new AdmZip();
  const extensionDir = path.join(__dirname, '..', 'extension');

  function addDirToZip(dirPath, zipRelPath) {
    for (const entry of fs.readdirSync(dirPath)) {
      if (entry === '.DS_Store') continue;
      const fullPath = path.join(dirPath, entry);
      const relPath = zipRelPath ? `${zipRelPath}/${entry}` : entry;
      if (fs.statSync(fullPath).isDirectory()) {
        addDirToZip(fullPath, relPath);
      } else {
        zip.addLocalFile(fullPath, zipRelPath || '');
      }
    }
  }

  addDirToZip(extensionDir, '');
  zip.writeZip(zipPath);

  console.log(`\n✓ Package created: dist/${zipFileName}`);
  const fileSizeInMB = (fs.statSync(zipPath).size / (1024 * 1024)).toFixed(2);
  console.log(`  Size: ${fileSizeInMB} MB`);
  console.log(`\nReady to upload to Chrome Web Store!`);
} catch (error) {
  console.error('Error creating zip:', error.message);
  process.exit(1);
}
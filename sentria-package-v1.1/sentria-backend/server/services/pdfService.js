// server/services/pdfService.js
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

let _loCmd = null; // resolved command, or false if unavailable

// Try candidate commands in order; resolve with the first that works.
function resolveLibreOfficeCmd() {
  if (_loCmd !== null) return Promise.resolve(_loCmd);

  const candidates = ['libreoffice', 'soffice'];
  if (os.platform() === 'win32') {
    candidates.push(
      'C:\\Program Files\\LibreOffice\\program\\soffice.exe',
      'C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe'
    );
  }

  return new Promise(resolve => {
    let i = 0;
    function tryNext() {
      if (i >= candidates.length) {
        _loCmd = false;
        console.warn('LibreOffice not found — install it to enable PDF export');
        return resolve(false);
      }
      const cmd = candidates[i++];
      exec(`"${cmd}" --version`, { timeout: 5000 }, (err) => {
        if (!err) { _loCmd = cmd; return resolve(cmd); }
        tryNext();
      });
    }
    tryNext();
  });
}

// Returns { path, type } where type is 'pdf' or 'docx'.
async function convertToPdf(docxPath, outputDir = os.tmpdir()) {
  const cmd = await resolveLibreOfficeCmd();
  if (!cmd) {
    return { path: docxPath, type: 'docx' };
  }
  return new Promise((resolve) => {
    const command = `"${cmd}" --headless --convert-to pdf "${docxPath}" --outdir "${outputDir}"`;
    exec(command, { timeout: 30000 }, (err, stdout, stderr) => {
      if (err) {
        console.error('LibreOffice conversion error:', stderr);
        return resolve({ path: docxPath, type: 'docx' });
      }
      const basename = path.basename(docxPath, '.docx');
      const pdfPath = path.join(outputDir, `${basename}.pdf`);
      if (!fs.existsSync(pdfPath)) {
        return resolve({ path: docxPath, type: 'docx' });
      }
      resolve({ path: pdfPath, type: 'pdf' });
    });
  });
}

module.exports = { convertToPdf };

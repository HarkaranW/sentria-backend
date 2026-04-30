// server/services/pdfService.js
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

/**
 * Convert a Word .docx file to PDF using LibreOffice (headless).
 * LibreOffice must be installed: sudo apt-get install -y libreoffice
 * @param {string} docxPath - absolute path to .docx file
 * @param {string} outputDir - directory for output PDF
 * @returns {Promise<string>} - absolute path to generated PDF
 */
function convertToPdf(docxPath, outputDir = '/tmp') {
  return new Promise((resolve, reject) => {
    const cmd = `libreoffice --headless --convert-to pdf "${docxPath}" --outdir "${outputDir}"`;
    exec(cmd, { timeout: 30000 }, (err, stdout, stderr) => {
      if (err) {
        console.error('LibreOffice error:', stderr);
        return reject(new Error('PDF conversion failed: ' + err.message));
      }
      const basename = path.basename(docxPath, '.docx');
      const pdfPath = path.join(outputDir, `${basename}.pdf`);
      if (!fs.existsSync(pdfPath)) {
        return reject(new Error('PDF file not found after conversion'));
      }
      resolve(pdfPath);
    });
  });
}

module.exports = { convertToPdf };

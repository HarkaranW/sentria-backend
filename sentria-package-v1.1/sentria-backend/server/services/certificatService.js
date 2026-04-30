// server/services/certificatService.js
// Wrapper around gen_certificat.js for use in API routes

const fs = require('fs');
const path = require('path');

// The gen_certificat.js script uses process.argv — we refactor it as a function here.
// For now, call it as a child process with JSON data piped in.
const { execSync } = require('child_process');
const { Packer } = require('docx');

async function genCertificatDocx(data) {
  // If logoBuffer is set, convert to base64 for the script
  if (data.medecin?.logoBuffer) {
    data.medecin.logoBase64 = data.medecin.logoBuffer.toString('base64');
    delete data.medecin.logoBuffer;
  }
  const scriptPath = path.join(__dirname, 'gen_certificat.js');
  const tmpOut = `/tmp/cert_${Date.now()}.docx`;
  const jsonArg = JSON.stringify(data).replace(/'/g, "\\'");
  execSync(`node "${scriptPath}" '${jsonArg}' "${tmpOut}"`, { timeout: 15000 });
  const buffer = fs.readFileSync(tmpOut);
  fs.unlinkSync(tmpOut);
  return buffer;
}

module.exports = { genCertificatDocx };

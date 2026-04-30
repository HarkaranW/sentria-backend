// server/services/emailService.js
const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

function fmtMoney(n) {
  return (parseInt(n) || 0).toLocaleString('fr-FR') + ' FCFA';
}

/**
 * Send invoice by email
 */
async function sendInvoiceEmail({ to, facture, medecin }) {
  const nomMed = `Dr ${medecin.prenom || ''} ${medecin.nom || 'Latoundji'}`.trim();
  const subject = `Facture ${facture.numero} — ${nomMed} — Cabinet SST`;
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
      <div style="background:#1a3a52;padding:20px 24px;border-radius:8px 8px 0 0;">
        <div style="color:#fff;font-size:18px;font-weight:700;">${nomMed}</div>
        <div style="color:rgba(255,255,255,.6);font-size:12px;">${medecin.titre || 'Médecin du Travail'}</div>
      </div>
      <div style="background:#fff;padding:28px 24px;border:1px solid #e2e8ed;border-top:none;border-radius:0 0 8px 8px;">
        <p style="color:#333;font-size:14px;">Madame, Monsieur,</p>
        <p style="color:#333;font-size:14px;line-height:1.6;">
          Veuillez trouver ci-joint la facture <strong>${facture.numero}</strong>
          d'un montant de <strong>${fmtMoney(facture.montant_total)}</strong>
          pour les services de médecine du travail rendus.
        </p>
        <div style="background:#f6f8fa;border-radius:8px;padding:16px;margin:20px 0;">
          <div style="font-size:12px;color:#888;margin-bottom:4px;">POUR TOUT RÈGLEMENT PAR VIREMENT</div>
          <div style="font-size:13px;color:#333;"><strong>Banque :</strong> ${medecin.banque || '—'}</div>
          <div style="font-size:13px;color:#333;"><strong>Titulaire :</strong> ${medecin.titulaire || nomMed}</div>
          <div style="font-size:13px;color:#333;"><strong>N° de compte :</strong> ${medecin.compte || '—'}</div>
        </div>
        <p style="color:#333;font-size:14px;">Cordialement,</p>
        <p style="color:#1a3a52;font-size:14px;font-weight:700;">${nomMed}</p>
        <p style="color:#888;font-size:12px;">${medecin.tel1 || ''} · ${medecin.email || ''}</p>
      </div>
    </div>
  `;
  await resend.emails.send({
    from: `${process.env.FROM_NAME || 'Cabinet SST'} <${process.env.FROM_EMAIL || 'noreply@sentria.io'}>`,
    to,
    subject,
    html,
  });
}

async function sendPasswordResetEmail({ to, resetUrl }) {
  await resend.emails.send({
    from: `${process.env.FROM_NAME || 'Cabinet SST'} <${process.env.FROM_EMAIL || 'noreply@sentria.io'}>`,
    to,
    subject: 'Réinitialisation de votre mot de passe — Cabinet SST',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
        <div style="background:#1a3a52;padding:20px 24px;border-radius:8px 8px 0 0;">
          <div style="color:#fff;font-size:18px;font-weight:700;">Cabinet SST</div>
          <div style="color:rgba(255,255,255,.6);font-size:12px;">Médecine du travail</div>
        </div>
        <div style="background:#fff;padding:28px 24px;border:1px solid #e2e8ed;border-top:none;border-radius:0 0 8px 8px;">
          <p style="color:#333;font-size:14px;">Bonjour,</p>
          <p style="color:#333;font-size:14px;line-height:1.6;">
            Vous avez demandé la réinitialisation de votre mot de passe.<br>
            Cliquez sur le bouton ci-dessous pour choisir un nouveau mot de passe. Ce lien est valable <strong>1 heure</strong>.
          </p>
          <div style="text-align:center;margin:28px 0;">
            <a href="${resetUrl}" style="background:#1a3a52;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:700;">Réinitialiser mon mot de passe</a>
          </div>
          <p style="color:#888;font-size:12px;line-height:1.6;">
            Si vous n'avez pas demandé cette réinitialisation, ignorez cet email — votre mot de passe ne sera pas modifié.<br>
            Lien alternatif : <a href="${resetUrl}" style="color:#1a3a52;">${resetUrl}</a>
          </p>
        </div>
      </div>
    `,
  });
}

module.exports = { sendInvoiceEmail, sendPasswordResetEmail };

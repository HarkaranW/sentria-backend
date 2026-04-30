// server/routes/consultations.js
const express = require('express');
const authMiddleware = require('../middleware/auth');
const makeCrudRouter = require('./_crud');

const router = express.Router();
router.use(authMiddleware);

const COLUMNS = [
  'salarie_id','client_id','date','nom','prenom','service','sexe','date_naissance',
  'ant_med','ant_chir','tension','temperature','poids','imc','motif','interrogatoire',
  'signes_cliniques','hypothese','examens','diagnostic','diagnostic_autre','traitement',
  'medicaments','orientation','arret','duree_arret','observations','custom_fields'
];

module.exports = makeCrudRouter(router, 'consultations', COLUMNS, ['client_id','date','nom','motif']);

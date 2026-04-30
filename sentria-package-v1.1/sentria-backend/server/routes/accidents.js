// server/routes/accidents.js
const express = require('express');
const authMiddleware = require('../middleware/auth');
const makeCrudRouter = require('./_crud');
const router = express.Router();
router.use(authMiddleware);
const COLUMNS = [
  'salarie_id','client_id','date','heure','nom','prenom','service','poste','lieu',
  'description','interrogatoire','tache','temoins','natures_lesion','localisations',
  'gravite','soins_immed','arret','duree_arret','orientation','declare_cnss',
  'observations','custom_fields'
];
module.exports = makeCrudRouter(router, 'accidents', COLUMNS, ['client_id','date','nom','description']);

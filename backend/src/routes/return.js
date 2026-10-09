/**
 * Reap requires an HTTPS returnUrl after hosted steps.
 * This route bounces the user back into the app through its deep link.
 */
const express = require('express');
const { config } = require('../config');

const router = express.Router();

router.get('/', (req, res) => {
  const target = new URL(config.appDeepLink);
  ['kind', 'ref'].forEach(key => {
    if (typeof req.query[key] === 'string') target.searchParams.set(key, req.query[key]);
  });
  res.redirect(302, target.toString());
});

module.exports = router;

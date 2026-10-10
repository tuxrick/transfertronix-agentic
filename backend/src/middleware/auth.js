/**
 * Validates the Supabase JWT sent by the app and exposes req.user.
 * The Reap enrollment owner always comes from here, never from the request body.
 */
const { createClient } = require('@supabase/supabase-js');
const { config } = require('../config');
const { languageOf, message } = require('../i18n');

const supabase = config.supabase.url
  ? createClient(config.supabase.url, config.supabase.anonKey, { auth: { persistSession: false } })
  : null;

async function requireUser(req, res, next) {
  if (!supabase) {
    return res.status(500).json({ error: { code: 'SUPABASE_NOT_CONFIGURED', message: 'Supabase no está configurado en el backend' } });
  }

  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
  if (!token) {
    return res.status(401).json({ error: { code: 'UNAUTHENTICATED', message: message(languageOf(req), 'MISSING_TOKEN') } });
  }

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) {
    return res.status(401).json({ error: { code: 'UNAUTHENTICATED', message: message(languageOf(req), 'INVALID_SESSION') } });
  }

  req.user = { id: data.user.id, email: data.user.email };
  next();
}

module.exports = { requireUser };

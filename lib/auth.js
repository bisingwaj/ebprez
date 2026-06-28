// Admin secret check for mutating API routes.
// The secret protects writes (command / upload / set-active). The activation code
// (332003) is only a UI gate and is NOT a security boundary.

export function getAdminSecret() {
  return process.env.ADMIN_SECRET || 'etoile-bleue-admin';
}

export function checkAdmin(req) {
  const expected = getAdminSecret();
  const auth = req.headers.get('authorization') || '';
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  const header = req.headers.get('x-admin-secret') || '';
  const provided = bearer || header;
  return provided && provided === expected;
}

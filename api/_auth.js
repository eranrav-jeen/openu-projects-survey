const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASS || 'jeen2025';

function checkAuth(req, res) {
  const auth = req.headers['authorization'];
  if (!auth || !auth.startsWith('Basic ')) {
    res.setHeader('WWW-Authenticate', 'Basic realm="Jeen Admin"');
    res.status(401).json({ error: 'Unauthorized' });
    return false;
  }
  const decoded = Buffer.from(auth.slice(6), 'base64').toString();
  const colonIdx = decoded.indexOf(':');
  const user = decoded.slice(0, colonIdx);
  const pass = decoded.slice(colonIdx + 1);
  if (user !== ADMIN_USER || pass !== ADMIN_PASS) {
    res.setHeader('WWW-Authenticate', 'Basic realm="Jeen Admin"');
    res.status(401).json({ error: 'Unauthorized' });
    return false;
  }
  return true;
}

module.exports = { checkAuth };

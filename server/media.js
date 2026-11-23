import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import multer from 'multer';
import { getAdminClient, requireAdmin, requireUser } from './supabase-admin.js';

const MEDIA_ROOT = process.env.MEDIA_ROOT || '/var/www/afrizone-media';
const APP_URL = (process.env.APP_URL || 'https://afrizones.com').replace(/\/$/, '');
const SIGN_SECRET =
  process.env.MEDIA_SIGN_SECRET || process.env.EMAIL_HOOK_SECRET || 'afrizone-media-dev';

const PUBLIC_BUCKETS = new Set(['product-images', 'avatars']);
const PRIVATE_BUCKETS = new Set(['vendor-documents', 'delivery-proofs']);
const ALLOWED = new Set([...PUBLIC_BUCKETS, ...PRIVATE_BUCKETS]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 12 * 1024 * 1024 },
});

function safeSegment(s) {
  return String(s || '')
    .replace(/[^a-zA-Z0-9._/-]/g, '')
    .replace(/\.\./g, '')
    .replace(/^\/+/, '');
}

function absPath(bucket, relPath) {
  const visibility = PUBLIC_BUCKETS.has(bucket) ? 'public' : 'private';
  return path.join(MEDIA_ROOT, visibility, bucket, relPath);
}

function publicUrl(bucket, relPath) {
  return `${APP_URL}/media/public/${bucket}/${relPath.split(path.sep).join('/')}`;
}

function signPayload(payload, expiresSec) {
  const exp = Math.floor(Date.now() / 1000) + expiresSec;
  const body = Buffer.from(JSON.stringify({ ...payload, exp })).toString('base64url');
  const sig = crypto.createHmac('sha256', SIGN_SECRET).update(body).digest('base64url');
  return `${body}.${sig}`;
}

function verifySigned(token) {
  const [body, sig] = String(token || '').split('.');
  if (!body || !sig) return null;
  const expected = crypto.createHmac('sha256', SIGN_SECRET).update(body).digest('base64url');
  if (expected !== sig) return null;
  try {
    const data = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (!data.exp || data.exp < Math.floor(Date.now() / 1000)) return null;
    return data;
  } catch {
    return null;
  }
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

export function mountMediaRoutes(app) {
  ensureDir(path.join(MEDIA_ROOT, 'public'));
  ensureDir(path.join(MEDIA_ROOT, 'private'));

  app.post('/media/upload', upload.single('file'), async (req, res) => {
    try {
      const { user } = await requireUser(req);
      const bucket = String(req.body?.bucket || '').trim();
      const folder = safeSegment(req.body?.folder || 'misc');
      const claimedUserId = String(req.body?.userId || user.id).trim();
      if (claimedUserId !== user.id) {
        return res.status(403).json({ ok: false, error: 'userId incohérent avec la session.' });
      }
      if (!ALLOWED.has(bucket)) {
        return res.status(400).json({ ok: false, error: 'Bucket non autorisé.' });
      }
      if (!req.file) {
        return res.status(400).json({ ok: false, error: 'Fichier manquant.' });
      }

      const rawExt = (req.file.originalname.split('.').pop() || 'bin')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '');
      const ext = rawExt || 'bin';
      const relPath = `${user.id}/${folder}/${Date.now()}-${crypto.randomBytes(3).toString('hex')}.${ext}`;
      const dest = absPath(bucket, relPath);
      ensureDir(path.dirname(dest));
      fs.writeFileSync(dest, req.file.buffer);

      const isPublic = PUBLIC_BUCKETS.has(bucket);
      return res.json({
        ok: true,
        path: relPath.replace(/\\/g, '/'),
        url: isPublic ? publicUrl(bucket, relPath) : null,
        bucket,
      });
    } catch (e) {
      const status = e.status || 500;
      return res.status(status).json({
        ok: false,
        error: e instanceof Error ? e.message : 'Upload échoué',
      });
    }
  });

  app.post('/media/sign', async (req, res) => {
    try {
      const { user } = await requireUser(req);
      const bucket = String(req.body?.bucket || '').trim();
      const relPath = safeSegment(req.body?.path || '');
      const expiresSec = Math.min(Number(req.body?.expiresSec) || 1800, 3600 * 6);
      if (!ALLOWED.has(bucket) || !relPath) {
        return res.status(400).json({ ok: false, error: 'bucket/path requis' });
      }

      const isOwner = relPath.startsWith(`${user.id}/`);
      if (!isOwner) {
        await requireAdmin(req);
      } else if (PRIVATE_BUCKETS.has(bucket) && !isOwner) {
        await requireAdmin(req);
      }

      // Fichier local Hostinger ?
      const local = absPath(bucket, relPath);
      if (fs.existsSync(local)) {
        if (PUBLIC_BUCKETS.has(bucket)) {
          return res.json({ ok: true, url: publicUrl(bucket, relPath) });
        }
        const token = signPayload({ bucket, path: relPath }, expiresSec);
        return res.json({
          ok: true,
          url: `${APP_URL}/api/media/signed/${token}`,
        });
      }

      // Historique Supabase
      const admin = getAdminClient();
      const { data, error } = await admin.storage
        .from(bucket)
        .createSignedUrl(relPath, expiresSec);
      if (error || !data?.signedUrl) {
        return res.status(404).json({ ok: false, error: error?.message || 'Fichier introuvable' });
      }
      return res.json({ ok: true, url: data.signedUrl, source: 'supabase' });
    } catch (e) {
      const status = e.status || 500;
      return res.status(status).json({
        ok: false,
        error: e instanceof Error ? e.message : 'Signature impossible',
      });
    }
  });

  app.get('/media/signed/:token', (req, res) => {
    const data = verifySigned(req.params.token);
    if (!data?.bucket || !data?.path) {
      return res.status(403).json({ ok: false, error: 'Lien expiré ou invalide' });
    }
    const filePath = absPath(data.bucket, safeSegment(data.path));
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ ok: false, error: 'Fichier introuvable' });
    }
    return res.sendFile(filePath);
  });
}

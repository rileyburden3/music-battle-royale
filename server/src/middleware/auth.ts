import { Request, Response, NextFunction } from 'express';
import admin from 'firebase-admin';
import { query } from '../db/index.js';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    firebase_uid: string;
    username: string;
    display_name: string;
    emblem: string;
    genre_preferences: string[];
    total_points: number;
    email?: string;
  };
}

let firebaseInitialized = false;

function initFirebase() {
  if (firebaseInitialized || admin.apps.length > 0) return;
  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      }),
    });
    firebaseInitialized = true;
  } catch (err) {
    console.error('Firebase init error:', err);
  }
}

export async function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'No token provided' });
  }

  const token = authHeader.slice(7);

  try {
    initFirebase();
    const decoded = await admin.auth().verifyIdToken(token);
    const result = await query(
      'SELECT id, firebase_uid, username, display_name, emblem, genre_preferences, total_points FROM users WHERE firebase_uid = $1',
      [decoded.uid]
    );

    if (!result.rows[0]) {
      return res.status(401).json({ success: false, error: 'User not found. Please complete profile setup.' });
    }

    req.user = result.rows[0];
    next();
  } catch (err) {
    return res.status(401).json({ success: false, error: 'Invalid or expired token' });
  }
}

// Verifies Firebase token only — does NOT require user to exist in DB yet
// Use this for endpoints that create the user (like /init)
export async function verifyFirebaseToken(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'No token provided' });
  }
  const token = authHeader.slice(7);
  try {
    initFirebase();
    const decoded = await admin.auth().verifyIdToken(token);
    req.user = { firebase_uid: decoded.uid, email: decoded.email } as AuthRequest['user'];
    next();
  } catch {
    return res.status(401).json({ success: false, error: 'Invalid or expired token' });
  }
}

export async function optionalAuth(req: AuthRequest, _res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return next();

  const token = authHeader.slice(7);
  try {
    initFirebase();
    const decoded = await admin.auth().verifyIdToken(token);
    const result = await query(
      'SELECT id, firebase_uid, username, display_name, emblem, genre_preferences, total_points FROM users WHERE firebase_uid = $1',
      [decoded.uid]
    );
    if (result.rows[0]) req.user = result.rows[0];
  } catch {
    // ignore - optional auth
  }
  next();
}

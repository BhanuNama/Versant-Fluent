import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { PublicUser } from '@fluentpath/shared';
import { config } from '../config.ts';
import { db } from '../db/index.ts';
import { newId, nowIso } from '../db/store.ts';
import type { UserDoc } from '../db/types.ts';

export interface TokenPayload {
  uid: string;
  guest: boolean;
  role: 'user' | 'admin';
}

export function toPublicUser(u: UserDoc): PublicUser {
  return {
    id: u._id,
    email: u.email,
    name: u.name,
    guest: u.guest,
    role: u.role,
    targetProfile: u.targetProfile,
    targetScore: u.targetScore,
  };
}

export function signToken(payload: TokenPayload): string {
  return jwt.sign(payload, config.jwtSecret, { expiresIn: '14d' });
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, config.jwtSecret) as TokenPayload;
  } catch {
    return null;
  }
}

export async function registerUser(email: string, password: string, name?: string): Promise<{ user: PublicUser; token: string }> {
  const normEmail = email.trim().toLowerCase();
  const existing = await db().users.findOne({ email: normEmail });
  if (existing) {
    throw new Error('An account with this email already exists.');
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const role = config.adminEmails.includes(normEmail) ? 'admin' : 'user';
  const displayName = name?.trim() || normEmail.split('@')[0] || 'User';

  const userDoc: UserDoc = {
    _id: newId('u'),
    email: normEmail,
    passwordHash,
    name: displayName,
    role,
    guest: false,
    targetProfile: 'voice',
    targetScore: 58,
    createdAt: nowIso(),
  };

  await db().users.insert(userDoc);
  const token = signToken({ uid: userDoc._id, guest: false, role: userDoc.role });
  return { user: toPublicUser(userDoc), token };
}

export async function loginUser(email: string, password: string): Promise<{ user: PublicUser; token: string }> {
  const normEmail = email.trim().toLowerCase();
  const user = await db().users.findOne({ email: normEmail });
  if (!user || !user.passwordHash) {
    throw new Error('Invalid email or password.');
  }

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    throw new Error('Invalid email or password.');
  }

  // Update role if admin emails list changed
  if (config.adminEmails.includes(normEmail) && user.role !== 'admin') {
    user.role = 'admin';
    await db().users.update(user._id, { role: 'admin' });
  }

  const token = signToken({ uid: user._id, guest: false, role: user.role });
  return { user: toPublicUser(user), token };
}

export async function createGuestUser(): Promise<{ user: PublicUser; token: string }> {
  const guestId = newId('guest');
  const userDoc: UserDoc = {
    _id: guestId,
    email: null,
    passwordHash: null,
    name: `Guest ${guestId.slice(-4)}`,
    role: 'user',
    guest: true,
    targetProfile: 'voice',
    targetScore: 58,
    createdAt: nowIso(),
  };

  await db().users.insert(userDoc);
  const token = signToken({ uid: userDoc._id, guest: true, role: 'user' });
  return { user: toPublicUser(userDoc), token };
}

export async function getUserById(id: string): Promise<UserDoc | null> {
  return db().users.get(id);
}

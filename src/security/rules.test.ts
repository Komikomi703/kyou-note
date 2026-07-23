// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('Firebaseセキュリティルール', () => {
  it('Firestoreは認証UIDとパスのユーザーIDを照合し、既定拒否する', () => {
    const rules = readFileSync(new URL('../../firestore.rules', import.meta.url), 'utf8');
    expect(rules).toContain('request.auth.uid == userId');
    expect(rules).toContain('state.currentUser.id == userId');
    expect(rules).toContain("state.settings.theme in ['light', 'dark', 'system']");
    expect(rules).toContain('request.resource.data.updatedAt is timestamp');
    expect(rules).toContain('allow read, write: if false');
  });

  it('Storageは所有者、MIME、2MB上限を検証する', () => {
    const rules = readFileSync(new URL('../../storage.rules', import.meta.url), 'utf8');
    expect(rules).toContain('request.resource.metadata.ownerId == userId');
    expect(rules).toContain("request.resource.contentType.matches('image/(jpeg|png|webp|gif)')");
    expect(rules).toContain('request.resource.size <= 2 * 1024 * 1024');
  });
});

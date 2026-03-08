'use client';

import { useState, useEffect, type FormEvent } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { apiGet, apiPatch } from '@/lib/api';

interface UserProfile {
  id: string;
  displayName: string;
  bio: string | null;
}

export default function ProfileSettingsPage() {
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    apiGet<UserProfile>('/v1/users/me')
      .then((user) => {
        setDisplayName(user.displayName);
        setBio(user.bio ?? '');
      })
      .catch(() => { /* user may not be logged in */ });
  }, []);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setSaved(false);
    setSaving(true);

    try {
      await apiPatch('/v1/users/me', { displayName, bio });
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save profile.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="mx-auto max-w-3xl p-4 sm:p-8">
      <h1 className="font-heading text-3xl font-bold">Profile settings</h1>
      <Card className="mt-6 p-6">
        {error && <p className="mb-4 text-sm text-red-500">{error}</p>}
        {saved && <p className="mb-4 text-sm text-green-600">Profile updated successfully.</p>}
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="displayName" className="mb-1 block text-sm font-medium">Display name</label>
            <input
              id="displayName"
              name="displayName"
              className="w-full rounded-md border border-border bg-background px-3 py-2"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
            />
          </div>
          <div>
            <label htmlFor="bio" className="mb-1 block text-sm font-medium">Bio</label>
            <textarea
              id="bio"
              name="bio"
              rows={3}
              className="w-full rounded-md border border-border bg-background px-3 py-2"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
            />
          </div>
          <Button type="submit" disabled={saving}>
            {saving ? 'Saving…' : 'Save changes'}
          </Button>
        </form>
      </Card>
    </main>
  );
}

'use client';

import { useState, useEffect, type FormEvent } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { apiGet, apiPost, apiPatch, apiDelete } from '@/lib/api';

interface Session {
  id: string;
  deviceName: string | null;
  ipAddress: string | null;
  createdAt: string;
  current: boolean;
}

export default function SecuritySettingsPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    apiGet<Session[]>('/v1/auth/sessions')
      .then(setSessions)
      .catch(() => { /* not logged in or endpoint not ready */ });
  }, []);

  async function handleChangePassword(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');
    setLoading(true);

    const form = e.currentTarget;
    const currentPassword = (form.elements.namedItem('currentPassword') as HTMLInputElement).value;
    const newPassword = (form.elements.namedItem('newPassword') as HTMLInputElement).value;
    const confirmPassword = (form.elements.namedItem('confirmPassword') as HTMLInputElement).value;

    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match.');
      setLoading(false);
      return;
    }

    try {
      await apiPatch('/v1/users/me/password', { currentPassword, newPassword });
      setPasswordSuccess('Password updated successfully.');
      setShowPasswordForm(false);
      form.reset();
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : 'Failed to update password.');
    } finally {
      setLoading(false);
    }
  }

  async function handleRevokeAll() {
    try {
      await apiDelete('/v1/auth/sessions');
      setSessions((prev) => prev.filter((s) => s.current));
    } catch {
      /* ignore */
    }
  }

  return (
    <main className="mx-auto max-w-3xl p-4 sm:p-8">
      <h1 className="font-heading text-3xl font-bold">Security</h1>
      <div className="mt-6 space-y-4">
        <Card className="p-6">
          <h2 className="font-heading text-xl font-semibold">Password</h2>
          <p className="text-sm text-muted-foreground">Update your password and revoke existing sessions if needed.</p>
          {passwordError && <p className="mt-2 text-sm text-red-500">{passwordError}</p>}
          {passwordSuccess && <p className="mt-2 text-sm text-green-600">{passwordSuccess}</p>}
          {showPasswordForm ? (
            <form className="mt-4 space-y-3" onSubmit={handleChangePassword}>
              <input name="currentPassword" type="password" placeholder="Current password" className="w-full rounded-md border border-border bg-background px-3 py-2" required />
              <input name="newPassword" type="password" placeholder="New password" minLength={8} className="w-full rounded-md border border-border bg-background px-3 py-2" required />
              <input name="confirmPassword" type="password" placeholder="Confirm new password" minLength={8} className="w-full rounded-md border border-border bg-background px-3 py-2" required />
              <div className="flex gap-2">
                <Button type="submit" disabled={loading}>{loading ? 'Updating…' : 'Update password'}</Button>
                <Button type="button" variant="outline" onClick={() => setShowPasswordForm(false)}>Cancel</Button>
              </div>
            </form>
          ) : (
            <Button className="mt-4" onClick={() => setShowPasswordForm(true)}>Change password</Button>
          )}
        </Card>
        <Card className="p-6">
          <h2 className="font-heading text-xl font-semibold">Active sessions</h2>
          <p className="text-sm text-muted-foreground">Current device and session activity with revoke controls.</p>
          {sessions.length > 0 && (
            <ul className="mt-3 space-y-2 text-sm">
              {sessions.map((s) => (
                <li key={s.id} className="flex items-center justify-between rounded border border-border px-3 py-2">
                  <span>{s.deviceName ?? 'Unknown device'} {s.current && <span className="text-green-600">(current)</span>}</span>
                  <span className="text-muted-foreground">{new Date(s.createdAt).toLocaleDateString()}</span>
                </li>
              ))}
            </ul>
          )}
          <Button className="mt-4" variant="outline" onClick={handleRevokeAll}>Revoke all other sessions</Button>
        </Card>
      </div>
    </main>
  );
}

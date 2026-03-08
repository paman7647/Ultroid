'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export default function ForgotPasswordPage() {
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    // Password reset is not yet implemented on the backend.
    // Show a confirmation message so the UI isn't broken.
    await new Promise((r) => setTimeout(r, 500));
    setSubmitted(true);
    setLoading(false);
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-4 gradient-bg">
      <Card className="w-full max-w-md p-6">
        <h1 className="font-heading text-2xl font-bold">Reset password</h1>
        {submitted ? (
          <div className="mt-4 space-y-3">
            <p className="text-sm text-muted-foreground">
              If an account with that email exists, we&apos;ve sent reset instructions.
            </p>
            <Link href="/login" className="text-primary underline text-sm">Back to login</Link>
          </div>
        ) : (
          <>
            <p className="mt-2 text-sm text-muted-foreground">Enter your account email and we will send reset instructions.</p>
            <form className="mt-6 space-y-4" aria-label="forgot password form" onSubmit={handleSubmit}>
              <div>
                <label htmlFor="email" className="mb-1 block text-sm font-medium">Email</label>
                <input id="email" name="email" type="email" className="w-full rounded-md border border-border bg-background px-3 py-2" required />
              </div>
              <Button className="w-full" type="submit" disabled={loading}>
                {loading ? 'Sending…' : 'Send reset link'}
              </Button>
            </form>
          </>
        )}
      </Card>
    </main>
  );
}

import type { ReactNode } from 'react';

interface AuthFormLayoutProps {
  title: string;
  footer: ReactNode;
  children: ReactNode;
}

export function AuthFormLayout({ title, footer, children }: AuthFormLayoutProps) {
  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <p className="text-center text-lg font-bold tracking-tight">
          Profit<span className="text-accent">HQ</span>
        </p>
        <div className="mt-6 rounded-lg border border-line bg-card p-6 shadow-sm">
          <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
          <div className="mt-4">{children}</div>
        </div>
        <p className="mt-4 text-center text-sm text-ink-muted">{footer}</p>
      </div>
    </div>
  );
}

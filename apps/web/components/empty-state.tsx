'use client';

import Link from 'next/link';

type EmptyStateProps = {
  title: string;
  message: string;
  action?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
  icon?: string;
};

export default function EmptyState({ title, message, action, icon = '📭' }: EmptyStateProps) {
  return (
    <div className="empty-state">
      {icon && <span className="text-4xl">{icon}</span>}
      <strong className="text-sm text-slate-600">{title}</strong>
      <span>{message}</span>
      {action && (
        <div className="mt-4">
          {action.href ? (
            <Link
              href={action.href}
              className="inline-flex items-center justify-center rounded-full bg-brand px-5 py-2 text-sm font-semibold text-white shadow-card transition hover:bg-brand/90"
            >
              {action.label}
            </Link>
          ) : (
            <button
              onClick={action.onClick}
              className="inline-flex items-center justify-center rounded-full bg-brand px-5 py-2 text-sm font-semibold text-white shadow-card transition hover:bg-brand/90"
            >
              {action.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
}



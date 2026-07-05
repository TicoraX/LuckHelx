'use client';

import ThemeToggle from './ThemeToggle';

export default function Header({
  left,
  children,
}: {
  left: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <header className="app-header">
      {left}
      <div className="header-actions">
        {children}
        <ThemeToggle />
      </div>
    </header>
  );
}

'use client';

import React from 'react';

export default function FadeIn({ children }: { children: React.ReactNode }) {
  return <div className="fade-in">{children}</div>;
}

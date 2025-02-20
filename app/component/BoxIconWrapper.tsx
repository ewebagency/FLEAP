"use client";
import dynamic from 'next/dynamic';

// Supprime les messages d'erreur de boxicons
if (typeof window !== 'undefined') {
  const originalError = console.error;
  console.error = (...args) => {
    if (typeof args[0] === 'string' && args[0].includes('Failed to load icon: factory')) {
      return;
    }
    originalError.apply(console, args);
  };
}

const BoxIcon = dynamic(
  () => import('boxicons').then((mod) => {
    import('boxicons');
    return function BoxIconWrapper({ name, size, color, type, className }: {
      name?: string;
      size?: string;
      color?: string;
      type?: string;
      className?: string;
    }) {
      return <box-icon name={name} size={size} color={color} type={type} className={className}></box-icon>;
    };
  }),
  { ssr: false }
);

export default BoxIcon; 
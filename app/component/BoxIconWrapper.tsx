"use client";
import dynamic from 'next/dynamic';

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
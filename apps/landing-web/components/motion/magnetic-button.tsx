'use client';

import { ArrowUpRight } from 'lucide-react';
import { motion, useMotionValue, useSpring } from 'framer-motion';
import type { ReactNode } from 'react';
import { useRef } from 'react';

type MagneticButtonProps = {
  children: ReactNode;
  href: string;
  variant?: 'primary' | 'secondary' | 'gold';
  className?: string;
  showArrow?: boolean;
};

export function MagneticButton({
  children,
  href,
  variant = 'primary',
  className = '',
  showArrow = true,
}: MagneticButtonProps) {
  const buttonRef = useRef<HTMLAnchorElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const springX = useSpring(x, { stiffness: 230, damping: 17, mass: 0.32 });
  const springY = useSpring(y, { stiffness: 230, damping: 17, mass: 0.32 });

  function handleMove(event: React.MouseEvent<HTMLAnchorElement>) {
    const bounds = buttonRef.current?.getBoundingClientRect();
    if (!bounds) return;

    const offsetX = event.clientX - bounds.left - bounds.width / 2;
    const offsetY = event.clientY - bounds.top - bounds.height / 2;
    x.set(offsetX * 0.14);
    y.set(offsetY * 0.14);
  }

  function handleLeave() {
    x.set(0);
    y.set(0);
  }

  return (
    <motion.a
      ref={buttonRef}
      href={href}
      className={'magnetic-button magnetic-button--' + variant + ' ' + className}
      style={{ x: springX, y: springY }}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
    >
      <span>{children}</span>
      {showArrow && <ArrowUpRight aria-hidden="true" size={16} strokeWidth={1.8} />}
    </motion.a>
  );
}

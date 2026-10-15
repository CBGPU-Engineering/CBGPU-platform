'use client';

import { useEffect, useRef, type ReactNode } from 'react';

/** Content stays visible without JavaScript; only offscreen sections are prepared. */
export function ScrollReveal({ children, className }: { children: ReactNode; className?: string }) {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = root.current;
    if (!element || !('IntersectionObserver' in window)) return;
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sections = Array.from(element.querySelectorAll<HTMLElement>(':scope > section'));
    const reveal = (section: HTMLElement) => section.removeAttribute('data-reveal-pending');
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          reveal(entry.target as HTMLElement);
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0, rootMargin: '0px 0px -24px 0px' });
    if (!preference.matches) {
      sections.forEach(section => {
        if (section.getBoundingClientRect().top > window.innerHeight) {
          section.dataset.revealPending = 'true';
          observer.observe(section);
        }
      });
    }
    const showAll = () => { if (preference.matches) { sections.forEach(reveal); observer.disconnect(); } };
    const onFocus = (event: FocusEvent) => {
      if (event.target instanceof Element) {
        const section = event.target.closest<HTMLElement>('[data-reveal-pending]');
        if (section) { reveal(section); observer.unobserve(section); }
      }
    };
    preference.addEventListener('change', showAll);
    element.addEventListener('focusin', onFocus);
    return () => {
      observer.disconnect();
      sections.forEach(reveal);
      preference.removeEventListener('change', showAll);
      element.removeEventListener('focusin', onFocus);
    };
  }, []);
  return <div ref={root} className={`scroll-reveal ${className ?? ''}`}>{children}</div>;
}

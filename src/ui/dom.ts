import { createElement, type IconNode } from 'lucide';

export const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

export const icon = (node: IconNode, size = 18) =>
  createElement(node, { width: size, height: size, 'stroke-width': 1.75, 'aria-hidden': 'true' });

/** Tiny element builder. Text always goes through text nodes, never innerHTML. */
export const el = <K extends keyof HTMLElementTagNameMap>(tag: K, props: Record<string, unknown> = {}, ...children: (Node | string)[]) => {
  const node: HTMLElementTagNameMap[K] = Object.assign(document.createElement(tag), props);
  node.append(...children);
  return node;
};

let toastTimer = 0;
export function toast(message: string) {
  const t = $('toast');
  t.textContent = message;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => t.classList.remove('show'), 2800);
}

export function relativeTime(ms: number) {
  const min = Math.round(ms / 60_000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min} min ago`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  return d === 1 ? 'yesterday' : `${d} days ago`;
}

export const ordinal = (n: number) => ['1st', '2nd', '3rd'][n - 1] ?? `${n}th`;

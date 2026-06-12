/** Tiny DOM helpers for the meta-game screens. */

export function el<T extends HTMLElement = HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`missing #${id}`);
  return node as T;
}

/** Build an element from an HTML string (single root). */
export function fromHtml<T extends HTMLElement = HTMLElement>(html: string): T {
  const tpl = document.createElement('template');
  tpl.innerHTML = html.trim();
  return tpl.content.firstElementChild as T;
}

export function clear(node: HTMLElement): void {
  node.innerHTML = '';
}

/** The shared overlay root for campaign screens. */
export function overlayRoot(): HTMLElement {
  return el('overlay');
}

export function showOverlay(content: HTMLElement): void {
  const root = overlayRoot();
  clear(root);
  root.appendChild(content);
  root.style.display = 'flex';
}

export function hideOverlay(): void {
  const root = overlayRoot();
  root.style.display = 'none';
  clear(root);
}

export function esc(text: string): string {
  return text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

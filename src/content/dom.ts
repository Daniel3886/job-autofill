/** Shadow hosts this extension draws itself (the field picker). Their controls are not the form's. */
const OWN_HOST = /^job-autofill/;

/**
 * querySelectorAll that also searches open shadow roots, in document order (a host's shadow
 * content follows the host). Some application forms render entirely inside web components.
 */
export function queryAllDeep<T extends Element>(root: ParentNode, selector: string): T[] {
  const found: T[] = [];
  for (const el of root.querySelectorAll("*")) {
    if (el.matches(selector)) found.push(el as T);
    if (el.shadowRoot && !OWN_HOST.test(el.id)) found.push(...queryAllDeep<T>(el.shadowRoot, selector));
  }
  return found;
}

/** Looks an id up where the element lives: its shadow root, or the document. */
export function byIdNear(el: Element, id: string): HTMLElement | null {
  const root = el.getRootNode();
  if (root instanceof ShadowRoot || root instanceof Document) return root.getElementById(id);
  return el.ownerDocument.getElementById(id);
}

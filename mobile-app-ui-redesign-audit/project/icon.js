// <l-icon name="dumbbell" size="20" stroke="2"> — Lucide icon as a web component.
// Fetches the real Lucide SVG (lucide-static, ISC) so nothing is hand-drawn.
// Lives in shadow DOM so React never reconciles its internals.
// Body is wrapped in an IIFE and the cache hangs off window, so re-evaluating
// this file (helmet re-injection) is a harmless no-op.
(() => {
  const CACHE = (window.__lIconCache = window.__lIconCache || new Map());
  const BASE = 'https://unpkg.com/lucide-static@0.454.0/icons/';

  function load(name) {
    if (!CACHE.has(name)) {
      CACHE.set(name, fetch(BASE + name + '.svg')
        .then(r => (r.ok ? r.text() : ''))
        .catch(() => ''));
    }
    return CACHE.get(name);
  }

  class LIcon extends HTMLElement {
    static get observedAttributes() { return ['name', 'size', 'stroke']; }
    constructor() {
      super();
      this.attachShadow({ mode: 'open' });
      this.shadowRoot.innerHTML = '<style id="s">:host{display:inline-flex;align-items:center;justify-content:center;line-height:0;flex:none}svg{display:block;stroke:currentColor;fill:none}</style><span part="slot"></span>';
      this._holder = this.shadowRoot.querySelector('span');
      this._sheet = this.shadowRoot.getElementById('s');
    }
    connectedCallback() { this.render(); }
    attributeChangedCallback() { this.render(); }
    async render() {
      const name = this.getAttribute('name');
      const size = this.getAttribute('size') || '20';
      const stroke = this.getAttribute('stroke') || '2';
      // Size inside the shadow root — React owns the host's style attribute and
      // would wipe anything written there.
      this._sheet.textContent = ':host{display:inline-flex;align-items:center;justify-content:center;line-height:0;flex:none;width:' + size + 'px;height:' + size + 'px}svg{display:block;width:' + size + 'px;height:' + size + 'px;stroke:currentColor;fill:none}';
      if (!name) return;
      const txt = await load(name);
      if (!txt || this.getAttribute('name') !== name) return;
      this._holder.innerHTML = txt;
      const svg = this._holder.querySelector('svg');
      if (svg) {
        svg.setAttribute('stroke-width', stroke);
        svg.setAttribute('width', size);
        svg.setAttribute('height', size);
      }
    }
  }

  if (!customElements.get('l-icon')) customElements.define('l-icon', LIcon);
})();

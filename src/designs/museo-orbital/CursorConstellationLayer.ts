interface MaskRect {
  x: number; y: number; w: number; h: number;
  strength: number; feather: number; chapterFade?: boolean;
}

const TEXT_SELECTOR = 'h1,h2,h3,h4,h5,h6,p,li,dt,dd,blockquote,figcaption,label,a,button,span,b,strong,small';
const CONTROL_SELECTOR = 'button,input,select,textarea,[role="button"]';
const smooth = (v: number) => {
  const t = Math.max(0, Math.min(1, v));
  return t * t * (3 - 2 * t);
};

/** A private drawing surface: the mask affects only automatic cursor constellations. */
export class CursorConstellationLayer {
  readonly canvas = document.createElement('canvas');
  readonly context = this.canvas.getContext('2d')!;
  private readonly mask = document.createElement('canvas');
  private readonly maskContext = this.mask.getContext('2d')!;
  private readonly visible = new Set<Element>();
  private readonly observed = new Set<Element>();
  private readonly observer: IntersectionObserver;
  private readonly structureObserver: MutationObserver;
  private readonly resizeObserver: ResizeObserver;
  private width = 0;
  private height = 0;
  private signature = '';
  private readonly root: HTMLElement;
  blocked = false;

  constructor(root: HTMLElement, invalidate: () => void) {
    this.root = root;
    this.observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (entry.isIntersecting) this.visible.add(entry.target);
        else this.visible.delete(entry.target);
      }
      invalidate();
    }, { root, rootMargin: '32px' });
    this.resizeObserver = new ResizeObserver(invalidate);
    this.structureObserver = new MutationObserver(records => {
      if (records.some(record => record.type === 'childList')) this.sync();
      if (records.some(record => record.type !== 'attributes' ||
        (record.target instanceof Element && record.target.matches('.mo-chapter-intro,.mo-hero,.mo-image-lightbox,.mo-menu,.mo-studio')))) invalidate();
    });
    this.structureObserver.observe(root, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['class'] });
    this.sync();
    document.fonts.ready.then(() => { if (this.width) invalidate(); });
  }

  private sync() {
    const next = new Set(this.root.querySelectorAll(`${TEXT_SELECTOR},${CONTROL_SELECTOR},img,.mo-vitrina-card`));
    for (const element of this.observed) {
      if (next.has(element)) continue;
      this.observer.unobserve(element);
      this.resizeObserver.unobserve(element);
      this.observed.delete(element);
      this.visible.delete(element);
    }
    for (const element of next) {
      if (this.observed.has(element)) continue;
      this.observed.add(element);
      this.observer.observe(element);
      this.resizeObserver.observe(element);
    }
  }

  resize(width: number, height: number, dpr: number) {
    this.width = width;
    this.height = height;
    this.canvas.width = Math.round(width * dpr);
    this.canvas.height = Math.round(height * dpr);
    this.context.setTransform(dpr, 0, 0, dpr, 0, 0);
    // Half-resolution masks are smoothly upscaled; geometry stays in CSS pixels.
    this.mask.width = Math.ceil(width / 2);
    this.mask.height = Math.ceil(height / 2);
    this.signature = '';
  }

  refresh() {
    const inViewport = (r: DOMRect) => r.width > 0 && r.height > 0 &&
      r.right > -32 && r.left < this.width + 32 && r.bottom > -32 && r.top < this.height + 32;
    this.blocked = Boolean(document.querySelector('.mo-image-lightbox,.mo-menu,.mo-studio-panel')) ||
      Array.from(this.root.querySelectorAll('.mo-chapter-intro.is-image-focus')).some(el => inViewport(el.getBoundingClientRect()));
    const rects: MaskRect[] = [];
    const add = (r: DOMRect, strength: number, feather: number, padding = 0, chapterFade = false) => {
      if (!inViewport(r)) return;
      rects.push({ x: r.left - padding, y: r.top - padding,
        w: r.width + padding * 2, h: r.height + padding * 2, strength, feather, chapterFade });
    };
    const seenText = new Set<Node>();
    const range = document.createRange();
    for (const element of this.visible) {
      if (!element.isConnected || !inViewport(element.getBoundingClientRect())) continue;
      if (element.matches('img,.mo-vitrina-card')) {
        const chapter = element.closest('.mo-chapter-image');
        add((chapter ?? element).getBoundingClientRect(), 0.45, 32, 0, Boolean(chapter));
        continue;
      }
      if (element.matches(CONTROL_SELECTOR)) {
        add(element.getBoundingClientRect(), 1, 16, 6);
        continue;
      }
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) {
        const node = walker.currentNode;
        if (seenText.has(node) || !node.textContent?.trim()) continue;
        seenText.add(node);
        range.selectNodeContents(node);
        for (const rect of range.getClientRects()) add(rect, 1, 16, 6);
      }
    }
    const signature = JSON.stringify(rects);
    if (signature === this.signature) return;
    this.signature = signature;
    const w = this.mask.width;
    const h = this.mask.height;
    const sx = this.width / w;
    const sy = this.height / h;
    const pixels = this.maskContext.createImageData(w, h);
    pixels.data.fill(255);
    for (const rect of rects) {
      const isImage = rect.strength < 1;
      const outside = isImage ? 0 : rect.feather;
      const left = Math.max(0, Math.floor((rect.x - outside) / sx));
      const right = Math.min(w, Math.ceil((rect.x + rect.w + outside) / sx));
      const top = Math.max(0, Math.floor((rect.y - outside) / sy));
      const bottom = Math.min(h, Math.ceil((rect.y + rect.h + outside) / sy));
      for (let y = top; y < bottom; y++) {
        const py = (y + 0.5) * sy;
        const chapterAlpha = rect.chapterFade
          ? Math.min(1, Math.max(0, (py - rect.y) / (rect.h * 0.16)), Math.max(0, (rect.y + rect.h - py) / (rect.h * 0.16))) : 1;
        for (let x = left; x < right; x++) {
          const px = (x + 0.5) * sx;
          const distance = Math.min(px - rect.x, rect.x + rect.w - px, py - rect.y, rect.y + rect.h - py);
          const coverage = isImage ? smooth(distance / rect.feather) : smooth(1 + distance / rect.feather);
          const alpha = Math.round(255 * (1 - rect.strength * coverage * chapterAlpha));
          const offset = (y * w + x) * 4 + 3;
          // Minimum transmission: overlaps never multiply the attenuation.
          pixels.data[offset] = Math.min(pixels.data[offset], alpha);
        }
      }
    }
    this.maskContext.putImageData(pixels, 0, 0);
  }

  clear() { this.context.clearRect(0, 0, this.width, this.height); }

  composite(target: CanvasRenderingContext2D, protectedContent: boolean,
    bounds: { x: number; y: number; w: number; h: number }) {
    const x = Math.max(0, Math.floor(bounds.x));
    const y = Math.max(0, Math.floor(bounds.y));
    const w = Math.min(this.width, Math.ceil(bounds.x + bounds.w)) - x;
    const h = Math.min(this.height, Math.ceil(bounds.y + bounds.h)) - y;
    if (w <= 0 || h <= 0) return;
    if (protectedContent) {
      this.context.save();
      this.context.beginPath();
      this.context.rect(x, y, w, h);
      this.context.clip();
      this.context.globalCompositeOperation = 'destination-in';
      const sx = this.mask.width / this.width;
      const sy = this.mask.height / this.height;
      this.context.drawImage(this.mask, x * sx, y * sy, w * sx, h * sy, x, y, w, h);
      this.context.restore();
    }
    const sx = this.canvas.width / this.width;
    const sy = this.canvas.height / this.height;
    target.drawImage(this.canvas, x * sx, y * sy, w * sx, h * sy, x, y, w, h);
  }

  dispose() {
    this.observer.disconnect();
    this.resizeObserver.disconnect();
    this.structureObserver.disconnect();
    this.observed.clear();
    this.visible.clear();
    this.width = this.height = 0;
    this.canvas.width = this.canvas.height = this.mask.width = this.mask.height = 0;
  }
}

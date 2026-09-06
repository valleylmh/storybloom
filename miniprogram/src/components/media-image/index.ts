const viewports = new WeakMap<object, WechatMiniprogram.IntersectionObserver>();
const attached = new WeakSet<object>();
Component({
  properties: { src: String, label: String, mode: { type: String, value: "aspectFill" }, eager: Boolean },
  data: { status: "loading", visible: true, sourceKey: "", requested: false },
  observers: { src(value: string) {
    if (value === this.data.sourceKey) return;
    this.setData({ sourceKey: value, status: "loading", visible: true, requested: Boolean(this.properties?.eager) });
    if (attached.has(this)) this.watchViewport();
  } },
  lifetimes: {
    attached() { attached.add(this); this.watchViewport(); },
    detached() { attached.delete(this); viewports.get(this)?.disconnect(); viewports.delete(this); },
  },
  methods: {
    watchViewport() {
      viewports.get(this)?.disconnect(); viewports.delete(this);
      if (!this.properties.src) return;
      if (this.properties.eager) { this.setData({ requested: true }); return; }
      // No image element or network request until its reserved square is visible.
      // Use the actual viewport, not a large prefetch margin that competes with visible covers.
      const viewport = this.createIntersectionObserver({ thresholds: [0] });
      viewports.set(this, viewport);
      viewport.relativeToViewport().observe(".media", result => {
        if (!attached.has(this) || result.intersectionRatio <= 0) return;
        this.setData({ requested: true });
        viewports.get(this)?.disconnect(); viewports.delete(this);
      });
    },
    loaded(event: WechatMiniprogram.CustomEvent) {
      if (event?.currentTarget?.dataset.source && event.currentTarget.dataset.source !== this.data.sourceKey) return;
      this.setData({ status: "ready" });
    },
    failed(event: WechatMiniprogram.CustomEvent) {
      if (event?.currentTarget?.dataset.source && event.currentTarget.dataset.source !== this.data.sourceKey) return;
      this.setData({ status: "error" });
    },
    retry() {
      this.setData({ visible: false, requested: true, status: "loading" }, () => this.setData({ visible: true }));
    },
    preview() { if (this.data.status === "ready") this.triggerEvent("open"); },
  },
});

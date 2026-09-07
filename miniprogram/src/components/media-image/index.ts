const viewports = new WeakMap<object, WechatMiniprogram.IntersectionObserver>();
const loadingTimers = new WeakMap<object, ReturnType<typeof setTimeout>>();
function clearLoadingTimer(component: object) {
  const timer = loadingTimers.get(component);
  if (timer !== undefined) clearTimeout(timer);
  loadingTimers.delete(component);
}
const attached = new WeakSet<object>();
Component({
  properties: { src: String, label: String, mode: { type: String, value: "aspectFill" }, eager: Boolean },
  data: { status: "loading", visible: true, sourceKey: "", requested: false },
  observers: { src(value: string) {
    if (value === this.data.sourceKey) return;
    clearLoadingTimer(this);
    this.setData({ sourceKey: value, status: "loading", visible: true, requested: Boolean(this.properties?.eager) });
    if (attached.has(this)) this.watchViewport();
  } },
  lifetimes: {
    attached() { attached.add(this); this.watchViewport(); },
    detached() { clearLoadingTimer(this); attached.delete(this); viewports.get(this)?.disconnect(); viewports.delete(this); },
  },
  methods: {
    watchLoading() {
      clearLoadingTimer(this);
      const source = this.data.sourceKey || this.properties.src;
      loadingTimers.set(this, setTimeout(() => {
        loadingTimers.delete(this);
        if (attached.has(this) && source === (this.data.sourceKey || this.properties.src) && this.data.status === "loading") this.setData({ status: "slow" });
      }, 15000));
    },
    watchViewport() {
      viewports.get(this)?.disconnect(); viewports.delete(this);
      if (!this.properties.src) return;
      if (this.properties.eager) { this.setData({ requested: true }); this.watchLoading(); return; }
      // No image element or network request until its reserved square is visible.
      // Use the actual viewport, not a large prefetch margin that competes with visible covers.
      const viewport = this.createIntersectionObserver({ thresholds: [0] });
      viewports.set(this, viewport);
      viewport.relativeToViewport().observe(".media", result => {
        if (!attached.has(this) || result.intersectionRatio <= 0) return;
        this.setData({ requested: true });
        this.watchLoading();
        viewports.get(this)?.disconnect(); viewports.delete(this);
      });
    },
    loaded(event: WechatMiniprogram.CustomEvent) {
      if (event?.currentTarget?.dataset.source && event.currentTarget.dataset.source !== this.data.sourceKey) return;
      clearLoadingTimer(this);
      this.setData({ status: "ready" });
      this.triggerEvent?.("ready", { src: this.data.sourceKey || this.properties.src });
    },
    failed(event: WechatMiniprogram.CustomEvent) {
      if (event?.currentTarget?.dataset.source && event.currentTarget.dataset.source !== this.data.sourceKey) return;
      clearLoadingTimer(this);
      this.setData({ status: "error" });
    },
    retry() {
      this.setData({ visible: false, requested: true, status: "loading" }, () => { this.setData({ visible: true }); this.watchLoading(); });
    },
    preview() { if (this.data.status === "ready") this.triggerEvent("open"); },
  },
});

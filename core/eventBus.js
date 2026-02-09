export class EventBus {
  constructor() {
    this.listeners = new Map();
  }

  on(event, listener) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(listener);
    return () => this.off(event, listener);
  }

  off(event, listener) {
    const bucket = this.listeners.get(event);
    if (!bucket) {
      return;
    }
    bucket.delete(listener);
    if (bucket.size === 0) {
      this.listeners.delete(event);
    }
  }

  emit(event, payload) {
    const bucket = this.listeners.get(event);
    if (!bucket) {
      return;
    }
    for (const listener of bucket) {
      listener(payload);
    }
  }
}

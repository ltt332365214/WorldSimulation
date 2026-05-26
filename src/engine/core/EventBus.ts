type EventHandler = (event: string, data: unknown) => void;

export class EventBus {
  private handlers: Map<string, EventHandler[]>;

  constructor() {
    this.handlers = new Map();
  }

  on(event: string, handler: EventHandler): void {
    const existing = this.handlers.get(event) ?? [];
    existing.push(handler);
    this.handlers.set(event, [...existing]);
  }

  off(event: string, handler: EventHandler): void {
    const existing = this.handlers.get(event) ?? [];
    this.handlers.set(event, existing.filter(h => h !== handler));
  }

  emit(event: string, data: unknown): void {
    const handlers = this.handlers.get(event) ?? [];
    for (const handler of handlers) {
      handler(event, data);
    }
    // Also notify wildcard listeners
    const wildcardHandlers = this.handlers.get('*') ?? [];
    for (const handler of wildcardHandlers) {
      handler(event, data);
    }
  }
}
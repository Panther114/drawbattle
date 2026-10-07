// Minimal reconnecting WebSocket: reopens with backoff until disconnect() is called.
export class ReconnectingSocket {
  constructor({ url, onMessage }) {
    this.url = url;
    this.onMessage = onMessage;
    this.attempt = 0;
    this.closed = false;
    this.ws = undefined;
    this.timer = undefined;
    this.connect();
  }

  connect() {
    if (this.closed) return;
    const ws = new WebSocket(this.url);
    this.ws = ws;
    ws.addEventListener('open', () => {
      this.attempt = 0;
    });
    ws.addEventListener('message', (e) => this.onMessage(e));
    ws.addEventListener('close', () => {
      if (this.closed || this.ws !== ws) return;
      const delay = Math.min(1000 * 2 ** this.attempt, 10000) + Math.random() * 500;
      this.attempt += 1;
      this.timer = setTimeout(() => this.connect(), delay);
    });
    ws.addEventListener('error', () => {
      try {
        ws.close();
      } catch {
        // ignore
      }
    });
  }

  send(data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) this.ws.send(data);
  }

  disconnect() {
    this.closed = true;
    if (this.timer !== undefined) clearTimeout(this.timer);
    if (this.ws) {
      try {
        this.ws.close(1000);
      } catch {
        // ignore
      }
    }
  }
}

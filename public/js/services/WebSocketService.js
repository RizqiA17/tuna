export class WebSocketService {
  constructor() {
    this.socket = null;
    this.eventHandlers = {};
  }

  connect() {
    this.socket = io();
    return this.socket;
  }

  on(event, callback) {
    this.eventHandlers[event] = callback;
    if (this.socket) {
      this.socket.on(event, callback);
    }
  }

  onAny(callback) {
    if (this.socket) {
      this.socket.onAny(callback);
    }
  }

  emit(event, data) {
    if (this.socket) {
      this.socket.emit(event, data);
    }
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
    }
  }

  get connected() {
    return this.socket && this.socket.connected;
  }
}
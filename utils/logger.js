class Logger {
  constructor() {
    this.logs = [];
    this.maxLogs = 1000;
  }

  _format(level, module, message) {
    return `[${new Date().toLocaleTimeString()}] [${level}] [${module}] ${message}`;
  }

  _log(level, module, message, data, stack) {
    this.logs.push({ timestamp: new Date().toISOString(), level, module, message, data, stack });
    if (this.logs.length > this.maxLogs) this.logs.shift();
    const formatted = this._format(level, module, message);
    switch (level) {
      case 'DEBUG': console.debug(formatted, data || ''); break;
      case 'INFO': console.info(formatted, data || ''); break;
      case 'WARN': console.warn(formatted, data || ''); break;
      case 'ERROR': console.error(formatted, data || '', stack || ''); break;
      case 'CRITICAL': console.error('CRITICAL:', formatted, data || '', stack || ''); break;
    }
  }

  debug(module, message, data) { this._log('DEBUG', module, message, data); }
  info(module, message, data) { this._log('INFO', module, message, data); }
  warn(module, message, data) { this._log('WARN', module, message, data); }
  error(module, message, err) {
    const msg = err?.message || String(err || '');
    this._log('ERROR', module, message, { error: msg }, err?.stack);
  }
  critical(module, message, err) {
    const msg = err?.message || String(err || '');
    this._log('CRITICAL', module, message, { error: msg }, err?.stack);
  }
}

export const logger = new Logger();

/**
 * Logger centralizado para debugging y monitoreo
 */

export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
  CRITICAL = 'CRITICAL'
}

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  module: string;
  message: string;
  data?: any;
  stack?: string;
}

class Logger {
  private isDevelopment = typeof process !== 'undefined' && process.env.NODE_ENV === 'development';
  private logs: LogEntry[] = [];
  private maxLogs = 1000;

  private formatMessage(level: LogLevel, module: string, message: string): string {
    return `[${new Date().toLocaleTimeString()}] [${level}] [${module}] ${message}`;
  }

  private log(level: LogLevel, module: string, message: string, data?: any, stack?: string) {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      module,
      message,
      data,
      stack
    };

    this.logs.push(entry);
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    const formatted = this.formatMessage(level, module, message);

    if (this.isDevelopment) {
      switch (level) {
        case LogLevel.DEBUG:
          console.debug(formatted, data);
          break;
        case LogLevel.INFO:
          console.info(formatted, data);
          break;
        case LogLevel.WARN:
          console.warn(formatted, data);
          break;
        case LogLevel.ERROR:
          console.error(formatted, data, stack);
          break;
        case LogLevel.CRITICAL:
          console.error('🔴 CRITICAL:', formatted, data, stack);
          break;
      }
    }
  }

  debug(module: string, message: string, data?: any) {
    this.log(LogLevel.DEBUG, module, message, data);
  }

  info(module: string, message: string, data?: any) {
    this.log(LogLevel.INFO, module, message, data);
  }

  warn(module: string, message: string, data?: any) {
    this.log(LogLevel.WARN, module, message, data);
  }

  error(module: string, message: string, error?: any) {
    const errorMessage = error?.message || String(error);
    const stack = error?.stack;
    this.log(LogLevel.ERROR, module, message, { error: errorMessage }, stack);
  }

  critical(module: string, message: string, error?: any) {
    const errorMessage = error?.message || String(error);
    const stack = error?.stack;
    this.log(LogLevel.CRITICAL, module, message, { error: errorMessage }, stack);
  }

  getLogs(filter?: { level?: LogLevel; module?: string; limit?: number }): LogEntry[] {
    let filtered = [...this.logs];

    if (filter?.level) {
      filtered = filtered.filter(l => l.level === filter.level);
    }

    if (filter?.module) {
      filtered = filtered.filter(l => l.module === filter.module);
    }

    if (filter?.limit) {
      filtered = filtered.slice(-filter.limit);
    }

    return filtered;
  }

  clearLogs() {
    this.logs = [];
  }

  exportLogs(): string {
    return JSON.stringify(this.logs, null, 2);
  }
}

export const logger = new Logger();

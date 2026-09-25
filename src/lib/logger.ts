type LogLevel = "info" | "warn" | "error" | "debug";

interface LogContext {
  [key: string]: unknown;
}

interface ApiLogContext extends LogContext {
  method?: string;
  path?: string;
  status?: number;
  durationMs?: number;
  action?: string;
  userId?: string;
  requestId?: string;
  error?: string;
}

interface LoggerConfig {
  level?: LogLevel;
  enableRequestId?: boolean;
  slowThresholdMs?: number;
  prettyPrint?: boolean;
}

function getTimestamp(): string {
  return new Date().toISOString();
}

function formatLog(level: LogLevel, message: string, context?: LogContext, prettyPrint: boolean = false): string {
  const ts = getTimestamp();
  const ctxStr = context 
    ? prettyPrint 
      ? `\n${JSON.stringify(context, null, 2)}`
      : ` ${JSON.stringify(context)}`
    : "";
  return `[${ts}] [${level.toUpperCase()}] ${message}${ctxStr}`;
}

function generateRequestId(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

export class Logger {
  protected config: LoggerConfig;
  private name: string;

  constructor(name: string, config?: LoggerConfig) {
    this.name = name;
    this.config = {
      level: "debug",
      enableRequestId: true,
      slowThresholdMs: 1000,
      prettyPrint: false,
      ...config,
    };
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ["debug", "info", "warn", "error"];
    return levels.indexOf(level) >= levels.indexOf(this.config.level || "debug");
  }

  info(message: string, context?: LogContext) {
    if (this.shouldLog("info")) {
      console.log(formatLog("info", `[${this.name}] ${message}`, context, this.config.prettyPrint));
    }
  }

  warn(message: string, context?: LogContext) {
    if (this.shouldLog("warn")) {
      console.warn(formatLog("warn", `[${this.name}] ${message}`, context, this.config.prettyPrint));
    }
  }

  error(message: string, context?: LogContext) {
    if (this.shouldLog("error")) {
      console.error(formatLog("error", `[${this.name}] ${message}`, context, this.config.prettyPrint));
    }
  }

  debug(message: string, context?: LogContext) {
    if (this.shouldLog("debug")) {
      console.debug(formatLog("debug", `[${this.name}] ${message}`, context, this.config.prettyPrint));
    }
  }
}

export class ApiLogger extends Logger {
  private requestId?: string;

  constructor(name: string, config?: LoggerConfig) {
    super(name, config);
  }

  start(method: string, path: string, extra?: LogContext): number {
    if (this.config.enableRequestId) {
      this.requestId = generateRequestId();
    }
    const ctx: ApiLogContext = { method, path, requestId: this.requestId, ...extra };
    this.info("请求开始", ctx);
    return Date.now();
  }

  success(startTime: number, method: string, path: string, status: number = 200, extra?: LogContext) {
    const durationMs = Date.now() - startTime;
    const ctx: ApiLogContext = { 
      method, 
      path, 
      status, 
      durationMs, 
      requestId: this.requestId,
      ...extra 
    };
    
    if (durationMs > (this.config.slowThresholdMs || 1000)) {
      this.warn(`请求较慢 (${durationMs}ms)`, ctx);
    }
    
    this.info("请求成功", ctx);
  }

  requestError(startTime: number, method: string, path: string, status: number, err: unknown, extra?: LogContext) {
    const durationMs = Date.now() - startTime;
    const errMsg = err instanceof Error ? err.message : String(err);
    const errStack = err instanceof Error ? err.stack : undefined;
    const ctx: ApiLogContext = { 
      method, 
      path, 
      status, 
      durationMs, 
      error: errMsg,
      requestId: this.requestId,
      ...extra 
    };
    if (errStack && process.env.NODE_ENV === "development") {
      console.error(errStack);
    }
    this.error("请求失败", ctx);
  }

  authFailed(message: string, status: number = 401) {
    this.warn(`认证失败: ${message}`, { status });
  }

  invalidParams(message: string, status: number = 400) {
    this.warn(`参数错误: ${message}`, { status });
  }

  dbUnavailable(status: number = 503) {
    this.warn("数据库不可用", { status });
  }

  unknownAction(action: string, status: number = 400) {
    this.warn(`未知操作: ${action}`, { status });
  }
}

export function createLogger(name: string, config?: LoggerConfig): Logger {
  return new Logger(name, config);
}

export function createApiLogger(name: string, config?: LoggerConfig): ApiLogger {
  return new ApiLogger(name, config);
}

export const defaultLogger = new Logger("app");

export const apiLogger = new ApiLogger("api");

export function withApiLogging<T extends (...args: unknown[]) => Promise<Response>>(
  apiName: string,
  handler: T
): T {
  const logger = new ApiLogger(apiName);
  
  return async function(this: unknown, ...args: unknown[]): Promise<Response> {
    const request = args[0] as Request;
    const startTime = logger.start(request.method, request.url);
    
    try {
      const response = await handler.apply(this, args);
      logger.success(startTime, request.method, request.url, response.status);
      return response;
    } catch (err) {
      logger.requestError(startTime, request.method, request.url, 500, err);
      throw err;
    }
  } as T;
}
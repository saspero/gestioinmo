// Logging tècnic estructurat (docs/architecture.md §6). Diferent de l'auditoria de
// negoci (taula `auditoria`, alimentada per triggers de BD, §6.4) — aquest logger és
// només per a diagnòstic d'infraestructura i mai rep dades de la llista negra
// (password_hash, JWT, NIF/IBAN en clar — docs/db-schema.md §7.7).

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogContext {
  requestId?: string;
  tenantId?: string;
  [key: string]: unknown;
}

function write(level: LogLevel, message: string, context?: LogContext): void {
  if (level === 'debug' && process.env.NODE_ENV === 'production') return;

  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...context,
  };

  const line = JSON.stringify(entry);
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

export const logger = {
  debug: (message: string, context?: LogContext) => write('debug', message, context),
  info: (message: string, context?: LogContext) => write('info', message, context),
  warn: (message: string, context?: LogContext) => write('warn', message, context),
  error: (message: string, context?: LogContext) => write('error', message, context),
};

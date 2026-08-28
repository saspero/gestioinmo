// Regles de negoci que depenen de context no expressable en un CHECK/trigger de BD
// (docs/agents/AGENT_API.md §8, ex: paginació, permisos, camps calculats). Les funcions
// de `src/lib/db/[domini].ts` la llencen; els route handlers la capturen i la
// tradueixen a `409 CONFLICT` amb el mateix missatge (mai un 500).

export class BusinessRuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BusinessRuleError';
  }
}

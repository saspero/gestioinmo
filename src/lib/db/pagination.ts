// Helper compartit de paginació i ordenació per a tots els llistats (docs/agents/
// AGENT_API.md §6). LIMIT/OFFSET sempre parametritzats; la columna d'ordenació es tria
// d'una llista blanca perquè un identificador de columna no es pot vincular com a
// paràmetre preparat (evita injecció via `sort`).

export interface Pagination {
  page: number;
  pageSize: number;
}

export interface Sorting {
  sort?: string;
  order: 'asc' | 'desc';
}

export function buildLimitOffsetClause(
  pagination: Pagination,
  paramIndex: number
): { clause: string; values: [number, number] } {
  const offset = (pagination.page - 1) * pagination.pageSize;
  return {
    clause: `LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
    values: [pagination.pageSize, offset],
  };
}

export function buildOrderByClause(
  sorting: Sorting,
  allowedColumns: readonly string[],
  defaultColumn: string
): string {
  const column = sorting.sort && allowedColumns.includes(sorting.sort) ? sorting.sort : defaultColumn;
  const direction = sorting.order === 'desc' ? 'DESC' : 'ASC';
  return `ORDER BY ${column} ${direction}`;
}

export function buildMeta(pagination: Pagination, total: number): { page: number; pageSize: number; total: number } {
  return { page: pagination.page, pageSize: pagination.pageSize, total };
}

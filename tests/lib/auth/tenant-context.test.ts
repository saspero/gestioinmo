// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const client = { query: vi.fn(), release: vi.fn() };

vi.mock('@/lib/db/pool', () => ({
  getDomainPool: () => ({ connect: async () => client }),
}));

import { withTenantContext } from '@/lib/auth/tenant-context';

const SESSIO = {
  tenant_id: '22222222-2222-4222-8222-222222222222',
  sub: '11111111-1111-4111-8111-111111111111',
};

describe('withTenantContext', () => {
  beforeEach(() => {
    client.query.mockReset().mockResolvedValue({ rows: [] });
    client.release.mockReset();
  });

  it('fixa search_path (amb extensions) i les variables abans de la funció, i fa COMMIT', async () => {
    const result = await withTenantContext(SESSIO, async () => 'fet');

    expect(result).toBe('fet');
    expect(client.query.mock.calls).toEqual([
      ['BEGIN'],
      ["SELECT set_config('search_path', $1, true)", [`tenant_${SESSIO.tenant_id}, public, extensions`]],
      ["SELECT set_config('app.tenant_id', $1, true)", [SESSIO.tenant_id]],
      ["SELECT set_config('app.current_user_id', $1, true)", [SESSIO.sub]],
      ['COMMIT'],
    ]);
    expect(client.release).toHaveBeenCalledOnce();
  });

  it('fa ROLLBACK i allibera la connexió si la funció falla', async () => {
    await expect(withTenantContext(SESSIO, () => Promise.reject(new Error('ko')))).rejects.toThrow('ko');
    expect(client.query).toHaveBeenLastCalledWith('ROLLBACK');
    expect(client.release).toHaveBeenCalledOnce();
  });

  it('rebutja un tenant_id que no és UUID sense tocar la BD', async () => {
    await expect(
      withTenantContext({ ...SESSIO, tenant_id: 'x"; DROP SCHEMA public; --' }, async () => 'fet')
    ).rejects.toThrow();
    expect(client.query).not.toHaveBeenCalled();
  });
});

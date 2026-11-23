export type Call = [string, ...unknown[]];

/** A PostgREST builder double: records the chain, resolves to the table's rows. */
export function fakeFrom(tables: Record<string, unknown[]>, fail?: string) {
  const calls: Call[][] = [];
  const from = (table: string) => {
    const chain: Call[] = [['from', table]];
    calls.push(chain);
    const result = () =>
      fail === table
        ? { data: null, error: { message: `${table} failed` } }
        : { data: tables[table] ?? [], error: null };
    const builder: Record<string, unknown> = {
      maybeSingle: async () => {
        chain.push(['maybeSingle']);
        const r = result();
        return { ...r, data: Array.isArray(r.data) ? (r.data[0] ?? null) : r.data };
      },
      then: (ok: (v: unknown) => unknown, ko: (e: unknown) => unknown) =>
        Promise.resolve(result()).then(ok, ko),
    };
    for (const m of ['select', 'is', 'eq', 'gte', 'order', 'limit'])
      builder[m] = (...args: unknown[]) => {
        chain.push([m, ...args]);
        return builder;
      };
    return builder;
  };
  return { from, calls };
}

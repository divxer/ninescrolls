/**
 * Minimal in-memory DynamoDB fake with REAL conditional-write semantics for the
 * expression subset price-api uses. Not a general emulator — supported grammar:
 *   Conditions: attribute_not_exists(f) | f = :v | f < :v | f > :v,
 *               joined by a single AND/OR
 *   Updates:    SET f = :v [, ...] | SET f = f + :v | ADD f :v | REMOVE f [, ...]
 * TransactWrite evaluates ALL conditions first, applies all-or-nothing, and throws
 * name='TransactionCanceledException' on any failure — matching the real client.
 */
type Item = Record<string, unknown>;

const key = (it: { PK: unknown; SK: unknown }) => `${it.PK}|${it.SK}`;

function subNames(expr: string, names?: Record<string, string>): string {
  let out = expr;
  for (const [alias, real] of Object.entries(names ?? {})) out = out.split(alias).join(real);
  return out;
}

function evalAtom(atom: string, item: Item | undefined, values: Record<string, unknown>): boolean {
  const notExists = atom.match(/^attribute_not_exists\((\w+)\)$/);
  if (notExists) return item === undefined || !(notExists[1] in item);
  const exists = atom.match(/^attribute_exists\((\w+)\)$/);
  if (exists) return item !== undefined && exists[1] in item;
  const eq = atom.match(/^(\w+) = (:\w+)$/);
  if (eq) return item !== undefined && item[eq[1]] === values[eq[2]];
  const lt = atom.match(/^(\w+) < (:\w+)$/);
  if (lt) return item !== undefined && (item[lt[1]] as number) < (values[lt[2]] as number);
  const gt = atom.match(/^(\w+) > (:\w+)$/);
  if (gt && item !== undefined) {
    const left = item[gt[1]];
    const right = values[gt[2]];
    if (typeof left === 'number' && typeof right === 'number') return left > right;
    if (typeof left === 'string' && typeof right === 'string') return left > right;
    return false;
  }
  throw new Error(`fakeDdb: unsupported condition atom: ${atom}`);
}

function evalCondition(expr: string | undefined, item: Item | undefined, values: Record<string, unknown>, names?: Record<string, string>): boolean {
  if (!expr) return true;
  const e = subNames(expr.trim(), names);
  if (e.includes(' OR ')) return e.split(' OR ').some((a) => evalAtom(a.trim(), item, values));
  if (e.includes(' AND ')) return e.split(' AND ').every((a) => evalAtom(a.trim(), item, values));
  return evalAtom(e, item, values);
}

function applyUpdate(expr: string, item: Item, values: Record<string, unknown>, names?: Record<string, string>): void {
  const e = subNames(expr.trim(), names);
  const addMatch = e.match(/(?:^|\s)ADD (\w+) (:\w+)/);
  if (addMatch) {
    item[addMatch[1]] = ((item[addMatch[1]] as number) ?? 0) + (values[addMatch[2]] as number);
  }
  const setMatch = e.match(/SET (.+?)(?:\sADD\s|\sREMOVE\s|$)/);
  if (setMatch) {
    for (const clause of setMatch[1].split(',').map((c) => c.trim())) {
      const incr = clause.match(/^(\w+) = (\w+) \+ (:\w+)$/);
      if (incr) { item[incr[1]] = ((item[incr[2]] as number) ?? 0) + (values[incr[3]] as number); continue; }
      const assign = clause.match(/^(\w+) = (:\w+)$/);
      if (assign) { item[assign[1]] = values[assign[2]]; continue; }
      throw new Error(`fakeDdb: unsupported SET clause: ${clause}`);
    }
  }
  const removeMatch = e.match(/(?:^|\s)REMOVE (.+?)(?:\sSET\s|\sADD\s|$)/);
  if (removeMatch) {
    for (const field of removeMatch[1].split(',').map((f) => f.trim())) {
      if (!/^\w+$/.test(field)) throw new Error(`fakeDdb: unsupported REMOVE clause: ${field}`);
      delete item[field];
    }
  }
}

interface CommandLike { constructor: { name: string }; input: Record<string, never> & Record<string, unknown> }

export class FakeDdb {
  store = new Map<string, Item>();

  seed(items: Item[]) { for (const it of items) this.store.set(key(it as never), { ...it }); }

  async send(cmd: CommandLike): Promise<Record<string, unknown>> {
    const input = cmd.input as Record<string, unknown>;
    switch (cmd.constructor.name) {
      case 'GetCommand': {
        const item = this.store.get(key(input.Key as never));
        return item ? { Item: { ...item } } : {};
      }
      case 'QueryCommand': {
        const values = (input.ExpressionAttributeValues ?? {}) as Record<string, unknown>;
        const cond = input.KeyConditionExpression as string;
        const pkMatch = cond.match(/PK = (:\w+)/) ?? cond.match(/GSI1PK = (:\w+)/);
        const gsi = Boolean(input.IndexName);
        const pkField = gsi ? 'GSI1PK' : 'PK';
        const pkVal = values[pkMatch![1]];
        const bw = cond.match(/begins_with\((\w+), (:\w+)\)/);
        let items = [...this.store.values()].filter((it) => it[pkField] === pkVal
          && (!bw || String(it[bw[1]]).startsWith(String(values[bw[2]]))));
        const sortField = gsi ? 'GSI1SK' : 'SK';
        items = items.sort((a, b) => String(a[sortField]).localeCompare(String(b[sortField])));
        if (input.ScanIndexForward === false) items.reverse();
        return { Items: items.map((it) => ({ ...it })) };
      }
      case 'PutCommand':
      case 'UpdateCommand':
      case 'TransactWriteCommand': {
        const ops = cmd.constructor.name === 'TransactWriteCommand'
          ? (input.TransactItems as Array<Record<string, Record<string, unknown>>>)
          : [cmd.constructor.name === 'PutCommand' ? { Put: input } : { Update: input }];
        for (const op of ops) {
          const spec = op.Put ?? op.Update ?? op.Delete ?? op.ConditionCheck;
          const targetKey = op.Put ? key(spec.Item as never) : key(spec.Key as never);
          const ok = evalCondition(
            spec.ConditionExpression as string | undefined,
            this.store.get(targetKey),
            (spec.ExpressionAttributeValues ?? {}) as Record<string, unknown>,
            spec.ExpressionAttributeNames as Record<string, string> | undefined,
          );
          if (!ok) throw Object.assign(new Error('ConditionalCheckFailed'), {
            name: cmd.constructor.name === 'TransactWriteCommand'
              ? 'TransactionCanceledException' : 'ConditionalCheckFailedException',
          });
        }
        for (const op of ops) {
          if (op.Put) {
            this.store.set(key(op.Put.Item as never), { ...(op.Put.Item as Item) });
          } else if (op.Update) {
            const k = key(op.Update.Key as never);
            const item = this.store.get(k) ?? { ...(op.Update.Key as Item) };
            applyUpdate(
              op.Update.UpdateExpression as string, item,
              (op.Update.ExpressionAttributeValues ?? {}) as Record<string, unknown>,
              op.Update.ExpressionAttributeNames as Record<string, string> | undefined,
            );
            this.store.set(k, item);
          } else if (op.Delete) {
            this.store.delete(key(op.Delete.Key as never));
          }
        }
        return {};
      }
      default:
        throw new Error(`fakeDdb: unsupported command ${cmd.constructor.name}`);
    }
  }
}

/**
 * Race gate: both contenders complete all their READS before EITHER transaction
 * commits — the deterministic worst-case interleaving for read-then-CAS protocols.
 */
export function gatedSend(fake: FakeDdb, expectedReads: number) {
  let reads = 0;
  let release!: () => void;
  const gate = new Promise<void>((r) => { release = r; });
  return async (cmd: CommandLike) => {
    if (cmd.constructor.name === 'TransactWriteCommand') await gate;
    const res = await fake.send(cmd);
    if (cmd.constructor.name === 'GetCommand' || cmd.constructor.name === 'QueryCommand') {
      reads += 1;
      if (reads >= expectedReads) release();
    }
    return res;
  };
}

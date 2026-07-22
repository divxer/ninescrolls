/* ------------------------------------------------------------------------------------------------
 * Task 14 (plan-review R3): STATEFUL in-memory DynamoDB harness with deterministic interleaving
 * gates. The adversarial suite runs the REAL production functions (linkStructuredUnit /
 * replayStructuredSideEffects / upsertContact / reconcileRepair / mergeOrganization / the Task-8b
 * guarded writer) against this store — only `docClient.send` is rerouted here (via the suite's
 * vi.mock of '@aws-sdk/lib-dynamodb'); everything else is untouched production code.
 *
 * The store APPLIES Get/Put/Update/Delete/Query/TransactWrite semantics and EVALUATES the
 * ConditionExpressions this plan actually uses:
 *   attribute_not_exists / attribute_exists / attribute_type(x,'NULL') — with the typed-NULL vs
 *   absent distinction (a JS `null` item value is a PRESENT NULL-typed attribute, exactly like
 *   lib-dynamodb marshalling) / equality / `< :gen` (cross-type, e.g. NULL < S, is FALSE) /
 *   begins_with / contains / NOT / AND-OR chains with parens.
 * A failed condition throws ConditionalCheckFailedException; a failed TransactWrite throws
 * TransactionCanceledException with POSITIONAL per-item CancellationReasons.
 *
 * Deterministic gates: `store.gateOn(predicate)` → { released, release(), releaseWithCrash() }.
 * The FIRST send whose command matches the predicate suspends (its promise unresolved) until
 * release() applies it against the THEN-current store (or releaseWithCrash() rejects it without
 * applying — a simulated crash). `store.idle()` awaits quiescence (every non-parked send drained).
 *
 * Part 2's chain test imports this module — keep it free of vitest dependencies.
 * ---------------------------------------------------------------------------------------------- */
import { UpdateCommand } from '@aws-sdk/lib-dynamodb';
import {
  MATCHED_ORG_WRITE_GUARD_CONDITION,
  MATCHED_ORG_WRITE_GUARD_VALUES,
  isConditionalCheckFailed,
  logMatchedOrgWriteSuperseded,
} from '../../../../lib/crm/matched-org-write-guard';

export type Item = Record<string, unknown>;
type Names = Record<string, string> | undefined;
type Values = Record<string, unknown> | undefined;

const ABSENT = Symbol('absent');

const clone = <T>(v: T): T => (v === undefined ? v : structuredClone(v));

function ccfe(): Error {
  return Object.assign(new Error('The conditional request failed'), { name: 'ConditionalCheckFailedException' });
}

// ------------------------------------------------------------------------------------------------
// Condition / key-condition / filter expression evaluator
// ------------------------------------------------------------------------------------------------

function tokenize(expr: string): string[] {
  const re = /<>|<=|>=|<|>|=|\(|\)|,|[#:]?[A-Za-z_][A-Za-z0-9_]*|\S/g;
  return expr.match(re) ?? [];
}

function dynamoTypeOf(v: unknown): string {
  if (v === null) return 'NULL';
  if (typeof v === 'string') return 'S';
  if (typeof v === 'number') return 'N';
  if (typeof v === 'boolean') return 'BOOL';
  if (Array.isArray(v)) return 'L';
  if (v instanceof Set) return 'SS';
  return 'M';
}

function eq(a: unknown, b: unknown): boolean {
  if (a === null && b === null) return true;
  if (a === null || b === null) return false;
  if (typeof a !== typeof b) return false;
  if (typeof a === 'object') return JSON.stringify(a) === JSON.stringify(b);
  return a === b;
}

// Cross-type ordering (incl. NULL vs S) is FALSE — exactly DynamoDB's typed comparison semantics.
function ordered(a: unknown, op: string, b: unknown): boolean {
  if (!((typeof a === 'string' && typeof b === 'string') || (typeof a === 'number' && typeof b === 'number'))) return false;
  if (op === '<') return a < b;
  if (op === '<=') return a <= b;
  if (op === '>') return a > b;
  if (op === '>=') return a >= b;
  return false;
}

class ConditionEvaluator {
  private toks: string[];
  private i = 0;
  private item: Item | undefined;

  constructor(expr: string, private names: Names, private values: Values) {
    this.toks = tokenize(expr);
  }

  evaluate(item: Item | undefined): boolean {
    this.item = item;
    this.i = 0;
    const out = this.parseOr();
    if (this.i !== this.toks.length) throw new Error(`harness: trailing tokens in condition at '${this.toks[this.i]}'`);
    return out;
  }

  private peek(): string | undefined { return this.toks[this.i]; }
  private next(): string {
    const t = this.toks[this.i++];
    if (t === undefined) throw new Error('harness: unexpected end of condition expression');
    return t;
  }
  private expect(t: string): void {
    const got = this.next();
    if (got !== t) throw new Error(`harness: expected '${t}' got '${got}'`);
  }

  private parseOr(): boolean {
    let v = this.parseAnd();
    while (this.peek()?.toUpperCase() === 'OR') { this.next(); const r = this.parseAnd(); v = v || r; }
    return v;
  }
  private parseAnd(): boolean {
    let v = this.parseNot();
    while (this.peek()?.toUpperCase() === 'AND') { this.next(); const r = this.parseNot(); v = v && r; }
    return v;
  }
  private parseNot(): boolean {
    if (this.peek()?.toUpperCase() === 'NOT') { this.next(); return !this.parseNot(); }
    return this.parsePrimary();
  }

  private resolveName(tok: string): string {
    if (tok.startsWith('#')) {
      const n = this.names?.[tok];
      if (n === undefined) throw new Error(`harness: unresolved expression attribute name ${tok}`);
      return n;
    }
    return tok;
  }
  private resolveValue(tok: string): unknown {
    if (this.values === undefined || !(tok in this.values)) throw new Error(`harness: unresolved expression attribute value ${tok}`);
    return this.values[tok];
  }
  private attr(path: string): unknown {
    if (!this.item || !(path in this.item)) return ABSENT;
    return this.item[path];
  }
  /** operand := :value | path — returns the resolved runtime value (ABSENT for a missing attr). */
  private operand(): unknown {
    const t = this.next();
    if (t.startsWith(':')) return this.resolveValue(t);
    return this.attr(this.resolveName(t));
  }

  private parsePrimary(): boolean {
    const t = this.peek();
    if (t === '(') { this.next(); const v = this.parseOr(); this.expect(')'); return v; }
    // function call?
    const fn = t?.toLowerCase();
    if ((fn === 'attribute_not_exists' || fn === 'attribute_exists' || fn === 'attribute_type'
      || fn === 'begins_with' || fn === 'contains') && this.toks[this.i + 1] === '(') {
      this.next(); this.expect('(');
      const path = this.resolveName(this.next());
      if (fn === 'attribute_not_exists') { this.expect(')'); return this.attr(path) === ABSENT; }
      if (fn === 'attribute_exists') { this.expect(')'); return this.attr(path) !== ABSENT; }
      this.expect(',');
      const arg = this.operand();
      this.expect(')');
      const v = this.attr(path);
      if (fn === 'attribute_type') return v !== ABSENT && dynamoTypeOf(v) === arg;
      if (v === ABSENT || arg === ABSENT) return false;
      if (fn === 'begins_with') return typeof v === 'string' && typeof arg === 'string' && v.startsWith(arg);
      // contains
      if (v instanceof Set) return v.has(arg);
      if (Array.isArray(v)) return v.includes(arg);
      if (typeof v === 'string') return typeof arg === 'string' && v.includes(arg);
      return false;
    }
    // comparison
    const left = this.operand();
    const op = this.next();
    const right = this.operand();
    if (left === ABSENT || right === ABSENT) return false;
    if (op === '=') return eq(left, right);
    if (op === '<>') return !eq(left, right);
    return ordered(left, op, right);
  }
}

export function evalCondition(expr: string | undefined, item: Item | undefined, names: Names, values: Values): boolean {
  if (!expr) return true;
  return new ConditionEvaluator(expr, names, values).evaluate(item);
}

// ------------------------------------------------------------------------------------------------
// UpdateExpression applier: SET (with `+`/`-` and if_not_exists) / REMOVE / ADD (number + set)
// ------------------------------------------------------------------------------------------------

function splitTopLevel(s: string, sep: string): string[] {
  const parts: string[] = [];
  let depth = 0, cur = '';
  for (const ch of s) {
    if (ch === '(') depth += 1;
    if (ch === ')') depth -= 1;
    if (ch === sep && depth === 0) { parts.push(cur); cur = ''; } else cur += ch;
  }
  if (cur.trim() !== '') parts.push(cur);
  return parts.map((p) => p.trim()).filter((p) => p !== '');
}

function applyUpdateExpression(existing: Item | undefined, key: { PK: unknown; SK: unknown }, input: Item): Item {
  const names = input.ExpressionAttributeNames as Names;
  const values = input.ExpressionAttributeValues as Values;
  const item: Item = existing ? clone(existing) : { PK: key.PK, SK: key.SK };

  const resolveName = (tok: string): string => {
    if (tok.startsWith('#')) {
      const n = names?.[tok];
      if (n === undefined) throw new Error(`harness: unresolved name ${tok} in UpdateExpression`);
      return n;
    }
    return tok;
  };
  const operandValue = (raw: string): unknown => {
    const s = raw.trim();
    if (s.startsWith(':')) {
      if (values === undefined || !(s in values)) throw new Error(`harness: unresolved value ${s} in UpdateExpression`);
      return clone(values[s]);
    }
    if (/^if_not_exists\(/i.test(s)) {
      const inner = s.slice(s.indexOf('(') + 1, s.lastIndexOf(')'));
      const [pathRaw, fallback] = splitTopLevel(inner, ',');
      const path = resolveName(pathRaw.trim());
      return path in item ? clone(item[path]) : operandValue(fallback);
    }
    const path = resolveName(s);
    return clone(item[path]);
  };
  const setValue = (raw: string): unknown => {
    // operand ((+|-) operand)? — split at depth 0
    let depth = 0;
    for (let i = 0; i < raw.length; i++) {
      const ch = raw[i];
      if (ch === '(') depth += 1;
      if (ch === ')') depth -= 1;
      if ((ch === '+' || ch === '-') && depth === 0) {
        const a = operandValue(raw.slice(0, i));
        const b = operandValue(raw.slice(i + 1));
        if (typeof a !== 'number' || typeof b !== 'number') throw new Error('harness: arithmetic on non-numbers in UpdateExpression');
        return ch === '+' ? a + b : a - b;
      }
    }
    return operandValue(raw);
  };

  const expr = String(input.UpdateExpression ?? '');
  const clauseRe = /\b(SET|REMOVE|ADD|DELETE)\b/gi;
  const marks: Array<{ kw: string; kwStart: number; bodyStart: number }> = [];
  let m: RegExpExecArray | null;
  while ((m = clauseRe.exec(expr)) !== null) marks.push({ kw: m[1].toUpperCase(), kwStart: m.index, bodyStart: m.index + m[0].length });

  for (let idx = 0; idx < marks.length; idx++) {
    const mk = marks[idx];
    const body = expr.slice(mk.bodyStart, idx + 1 < marks.length ? marks[idx + 1].kwStart : expr.length);
    if (mk.kw === 'SET') {
      for (const part of splitTopLevel(body, ',')) {
        const eqIdx = part.indexOf('=');
        if (eqIdx < 0) throw new Error(`harness: malformed SET part '${part}'`);
        const path = resolveName(part.slice(0, eqIdx).trim());
        item[path] = setValue(part.slice(eqIdx + 1));
      }
    } else if (mk.kw === 'REMOVE') {
      for (const part of splitTopLevel(body, ',')) delete item[resolveName(part)];
    } else if (mk.kw === 'ADD') {
      for (const part of splitTopLevel(body, ',')) {
        const [pathRaw, valRaw] = part.split(/\s+/).filter(Boolean);
        const path = resolveName(pathRaw);
        const v = operandValue(valRaw);
        if (typeof v === 'number') {
          const cur = item[path];
          item[path] = (typeof cur === 'number' ? cur : 0) + v;
        } else if (v instanceof Set) {
          const cur = item[path];
          item[path] = new Set([...(cur instanceof Set ? cur : []), ...v]);
        } else {
          throw new Error(`harness: unsupported ADD value type for '${part}'`);
        }
      }
    } else {
      throw new Error(`harness: unsupported update clause ${mk.kw}`);
    }
  }
  // key attributes always stay authoritative
  item.PK = key.PK; item.SK = key.SK;
  return item;
}

// ------------------------------------------------------------------------------------------------
// Gates
// ------------------------------------------------------------------------------------------------

// Predicate over the raw sent command: (cmd, input, n) — n is the 1-based count of commands with
// the SAME constructor name this gate has seen (so `n === 2 && TransactWriteCommand` = the second
// transaction issued after the gate was registered).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type GatePredicate = (cmd: { constructor: { name: string } }, input: any, n: number) => boolean;

export interface GateHandle {
  /** resolves after release()/releaseWithCrash() has run */
  released: Promise<void>;
  release: () => void;
  releaseWithCrash: () => void;
}

interface InternalGate {
  predicate: GatePredicate;
  counts: Map<string, number>;
  triggered: boolean;
  releasedFlag: boolean;
  parked: { apply: () => void; crash: (err: Error) => void } | null;
  onReleased: () => void;
}

// ------------------------------------------------------------------------------------------------
// The store
// ------------------------------------------------------------------------------------------------

const INDEXES: Record<string, [string, string]> = {
  GSI1: ['GSI1PK', 'GSI1SK'], GSI2: ['GSI2PK', 'GSI2SK'],
  GSI3: ['GSI3PK', 'GSI3SK'], GSI4: ['GSI4PK', 'GSI4SK'],
};

export class HarnessStore {
  private items = new Map<string, Item>();
  private deletedMarkers: Item[] = [];
  private writeLog = new Map<string, Array<{ name: string; input: Item }>>();
  private dirty: string[] = [];
  private gates: InternalGate[] = [];
  private opCounter = 0;
  /** raw items examined per Query page (DynamoDB: Limit precedes FilterExpression) */
  pageSize = 100;

  private static k(pk: unknown, sk: unknown): string { return `${String(pk)}\u0000${String(sk)}`; }

  private static strip(item: Item): Item {
    const out: Item = {};
    for (const [k, v] of Object.entries(item)) if (v !== undefined) out[k] = v;
    return out;
  }

  // ---- direct state access (seeding + assertions) ----------------------------------------------

  put(key: string | { PK: string; SK?: string }, item: Item): void {
    const PK = typeof key === 'string' ? key : key.PK;
    const SK = (typeof key === 'object' && key.SK !== undefined ? key.SK : (item.SK as string | undefined)) ?? 'A';
    this.items.set(HarnessStore.k(PK, SK), clone(HarnessStore.strip({ ...item, PK, SK })));
  }

  seed(item: Item): void {
    if (item.PK === undefined || item.SK === undefined) throw new Error('harness: seeded items need PK and SK');
    this.items.set(HarnessStore.k(item.PK, item.SK), clone(HarnessStore.strip(item)));
  }

  get(key: string | { PK: string; SK?: string }): Item {
    let found: Item | undefined;
    if (typeof key === 'string') {
      for (const it of this.items.values()) if (it.PK === key) { found = it; break; }
    } else if (key.SK !== undefined) {
      found = this.items.get(HarnessStore.k(key.PK, key.SK));
    } else {
      for (const it of this.items.values()) if (it.PK === key.PK) { found = it; break; }
    }
    return clone(found) as Item;
  }

  keys(): string[] { return [...this.items.values()].map((it) => String(it.PK)); }

  markersFor(unitKey: string): Item[] {
    const prefix = `CRM_REPAIR#structured#${unitKey}#`;
    return [...this.items.values()].filter((it) => String(it.PK).startsWith(prefix)).map((it) => clone(it));
  }
  /** live markers PLUS snapshots taken at deletion time — the committed state a crash would replay from */
  markersHistoryFor(unitKey: string): Item[] {
    const prefix = `CRM_REPAIR#structured#${unitKey}#`;
    return [
      ...this.deletedMarkers.filter((it) => String(it.PK).startsWith(prefix)).map((it) => clone(it)),
      ...this.markersFor(unitKey),
    ];
  }

  contactByEmail(email: string): Item {
    const norm = email.trim().toLowerCase();
    return clone([...this.items.values()].find((it) => it.entityType === 'CONTACT' && it.email === norm)) as Item;
  }

  /** the stored PK of the contact row for an email (throws if absent — a fixture error) */
  contactPkOf(email: string): string {
    const c = this.contactByEmail(email);
    if (!c) throw new Error(`harness: no contact in store for ${email}`);
    return String(c.PK);
  }

  auditFor(generation: string): Item {
    return clone([...this.items.values()].find((it) =>
      it.entityType === 'LINK_AUDIT' && (it.details as Item | null)?.generation === generation)) as Item;
  }
  /** ALL LINK_AUDIT rows carrying this generation — a redirect across invocations legitimately
   *  leaves one row per effective target (deterministic id = unitKey + effective org + generation) */
  auditsFor(generation: string): Item[] {
    return [...this.items.values()]
      .filter((it) => it.entityType === 'LINK_AUDIT' && (it.details as Item | null)?.generation === generation)
      .map((it) => clone(it));
  }

  dirtyRollups(): string[] { return [...this.dirty]; }
  recordDirtyRollup(orgId: string): void { this.dirty.push(orgId); }

  commandsFor(pk: string): Item[] { return (this.writeLog.get(pk) ?? []).map((c) => c.input); }
  lastCommandFor(pk: string): { name: string; input: Item } | undefined {
    const log = this.writeLog.get(pk) ?? [];
    return log[log.length - 1];
  }

  // ---- gates -----------------------------------------------------------------------------------

  gateOn(predicate: GatePredicate): GateHandle {
    const gate: InternalGate = {
      predicate, counts: new Map(), triggered: false, releasedFlag: false, parked: null,
      onReleased: () => undefined,
    };
    const released = new Promise<void>((res) => { gate.onReleased = res; });
    this.gates.push(gate);
    return {
      released,
      release: () => {
        gate.releasedFlag = true;
        const p = gate.parked; gate.parked = null;
        p?.apply();
        gate.onReleased();
      },
      releaseWithCrash: () => {
        gate.releasedFlag = true;
        const p = gate.parked; gate.parked = null;
        p?.crash(Object.assign(new Error('harness: simulated crash at gated operation'), { name: 'HarnessSimulatedCrash' }));
        gate.onReleased();
      },
    };
  }

  clearGates(): void {
    for (const g of this.gates) {
      const p = g.parked; g.parked = null;
      g.releasedFlag = true;
      p?.apply();
    }
    this.gates = [];
  }

  /** await quiescence: resolves once a full macrotask tick passes with no new sends (parked sends excluded) */
  async idle(): Promise<void> {
    for (;;) {
      const before = this.opCounter;
      await new Promise((r) => setTimeout(r, 0));
      if (this.opCounter === before) return;
    }
  }

  // ---- the send mock ---------------------------------------------------------------------------

  async send(cmd: unknown): Promise<unknown> {
    const c = cmd as { input?: Item; constructor?: { name?: string } };
    const name = c?.constructor?.name ?? 'UnknownCommand';
    const input = (c?.input ?? {}) as Item;
    this.opCounter += 1;
    for (const gate of this.gates) {
      if (gate.triggered || gate.releasedFlag) continue;
      const n = (gate.counts.get(name) ?? 0) + 1;
      gate.counts.set(name, n);
      if (gate.predicate(c as { constructor: { name: string } }, input, n)) {
        gate.triggered = true;
        return new Promise((resolve, reject) => {
          gate.parked = {
            apply: () => { try { resolve(this.apply(name, input)); } catch (err) { reject(err); } },
            crash: (err) => reject(err),
          };
        });
      }
    }
    return this.apply(name, input);
  }

  // ---- command semantics -----------------------------------------------------------------------

  private recordWrite(name: string, input: Item): void {
    const pks = new Set<string>();
    const push = (pk: unknown) => { if (typeof pk === 'string') pks.add(pk); };
    if (name === 'TransactWriteCommand') {
      for (const el of (input.TransactItems as Item[] | undefined) ?? []) {
        const spec = (el.Put ?? el.Update ?? el.Delete ?? el.ConditionCheck) as Item | undefined;
        push(((spec?.Item as Item | undefined)?.PK) ?? ((spec?.Key as Item | undefined)?.PK));
      }
    } else {
      push(((input.Item as Item | undefined)?.PK) ?? ((input.Key as Item | undefined)?.PK));
    }
    for (const pk of pks) {
      const log = this.writeLog.get(pk) ?? [];
      log.push({ name, input });
      this.writeLog.set(pk, log);
    }
  }

  private existingFor(key: Item): Item | undefined {
    return this.items.get(HarnessStore.k(key.PK, key.SK));
  }

  private applyPut(input: Item): void {
    const item = input.Item as Item;
    const existing = this.existingFor({ PK: item.PK, SK: item.SK });
    if (!evalCondition(input.ConditionExpression as string | undefined, existing,
      input.ExpressionAttributeNames as Names, input.ExpressionAttributeValues as Values)) throw ccfe();
    this.items.set(HarnessStore.k(item.PK, item.SK), clone(HarnessStore.strip(item)));
  }

  private applyUpdate(input: Item): Item {
    const key = input.Key as { PK: unknown; SK: unknown };
    const existing = this.existingFor(key as Item);
    if (!evalCondition(input.ConditionExpression as string | undefined, existing,
      input.ExpressionAttributeNames as Names, input.ExpressionAttributeValues as Values)) throw ccfe();
    const updated = applyUpdateExpression(existing, key, input);
    this.items.set(HarnessStore.k(key.PK, key.SK), updated);
    return updated;
  }

  private applyDelete(input: Item): void {
    const key = input.Key as { PK: unknown; SK: unknown };
    const existing = this.existingFor(key as Item);
    if (!evalCondition(input.ConditionExpression as string | undefined, existing,
      input.ExpressionAttributeNames as Names, input.ExpressionAttributeValues as Values)) throw ccfe();
    if (existing && String(key.PK).startsWith('CRM_REPAIR#')) this.deletedMarkers.push(clone(existing));
    this.items.delete(HarnessStore.k(key.PK, key.SK));
  }

  private applyTransact(input: Item): void {
    const els = (input.TransactItems as Item[] | undefined) ?? [];
    const reasons = els.map((el) => {
      const spec = (el.Put ?? el.Update ?? el.Delete ?? el.ConditionCheck) as Item;
      const key = el.Put
        ? { PK: (spec.Item as Item).PK, SK: (spec.Item as Item).SK }
        : (spec.Key as Item);
      const existing = this.existingFor(key);
      const ok = evalCondition(spec.ConditionExpression as string | undefined, existing,
        spec.ExpressionAttributeNames as Names, spec.ExpressionAttributeValues as Values);
      return ok ? { Code: 'None' } : { Code: 'ConditionalCheckFailed', Message: 'The conditional request failed' };
    });
    if (reasons.some((r) => r.Code !== 'None')) {
      throw Object.assign(new Error('Transaction cancelled, please refer cancellation reasons for specific reasons'), {
        name: 'TransactionCanceledException', CancellationReasons: reasons,
      });
    }
    // all conditions hold against the PRE-state → apply atomically
    for (const el of els) {
      if (el.ConditionCheck) continue;
      if (el.Put) {
        const item = (el.Put as Item).Item as Item;
        this.items.set(HarnessStore.k(item.PK, item.SK), clone(HarnessStore.strip(item)));
      } else if (el.Update) {
        const spec = el.Update as Item;
        const key = spec.Key as { PK: unknown; SK: unknown };
        this.items.set(HarnessStore.k(key.PK, key.SK), applyUpdateExpression(this.existingFor(key as Item), key, spec));
      } else if (el.Delete) {
        const spec = el.Delete as Item;
        const key = spec.Key as { PK: unknown; SK: unknown };
        const existing = this.existingFor(key as Item);
        if (existing && String(key.PK).startsWith('CRM_REPAIR#')) this.deletedMarkers.push(clone(existing));
        this.items.delete(HarnessStore.k(key.PK, key.SK));
      }
    }
  }

  private applyQuery(input: Item): { Items: Item[]; LastEvaluatedKey?: Item } {
    const [pkAttr, skAttr] = input.IndexName ? INDEXES[String(input.IndexName)] : ['PK', 'SK'];
    if (!pkAttr) throw new Error(`harness: unknown index ${String(input.IndexName)}`);
    const keyCond = new ConditionEvaluator(String(input.KeyConditionExpression),
      input.ExpressionAttributeNames as Names, input.ExpressionAttributeValues as Values);
    let candidates = [...this.items.values()].filter((it) => it[pkAttr] !== undefined && keyCond.evaluate(it));
    const skOf = (it: Item): string => String(it[skAttr] ?? '');
    candidates.sort((a, b) => (skOf(a) < skOf(b) ? -1 : skOf(a) > skOf(b) ? 1 : 0));
    const forward = input.ScanIndexForward !== false;
    if (!forward) candidates.reverse();
    const esk = input.ExclusiveStartKey as Item | null | undefined;
    if (esk && esk[skAttr] !== undefined) {
      const bound = String(esk[skAttr]);
      candidates = candidates.filter((it) => (forward ? skOf(it) > bound : skOf(it) < bound));
    }
    const limit = Math.min(typeof input.Limit === 'number' ? input.Limit : Number.POSITIVE_INFINITY, this.pageSize);
    const page = candidates.slice(0, limit);
    const hasMore = candidates.length > page.length;
    const filter = input.FilterExpression
      ? new ConditionEvaluator(String(input.FilterExpression), input.ExpressionAttributeNames as Names, input.ExpressionAttributeValues as Values)
      : null;
    const items = (filter ? page.filter((it) => filter.evaluate(it)) : page).map((it) => clone(it));
    const last = page[page.length - 1];
    return {
      Items: items,
      ...(hasMore && last ? { LastEvaluatedKey: { PK: last.PK, SK: last.SK, [pkAttr]: last[pkAttr], [skAttr]: last[skAttr] } } : {}),
    };
  }

  private apply(name: string, input: Item): unknown {
    if (name === 'GetCommand') {
      const key = input.Key as Item;
      const existing = this.existingFor(key);
      return existing ? { Item: clone(existing) } : {};
    }
    if (name === 'QueryCommand') return this.applyQuery(input);
    this.recordWrite(name, input);
    if (name === 'PutCommand') { this.applyPut(input); return {}; }
    if (name === 'UpdateCommand') {
      const updated = this.applyUpdate(input);
      return input.ReturnValues === 'ALL_NEW' ? { Attributes: clone(updated) } : {};
    }
    if (name === 'DeleteCommand') { this.applyDelete(input); return {}; }
    if (name === 'TransactWriteCommand') { this.applyTransact(input); return {}; }
    throw new Error(`harness: unsupported command ${name}`);
  }
}

// ------------------------------------------------------------------------------------------------
// Active-store routing: the suite's vi.mock of '@aws-sdk/lib-dynamodb' routes EVERY DocumentClient
// send (crm-api AND organization-api import paths) into harnessSend.
// ------------------------------------------------------------------------------------------------

let active: HarnessStore | null = null;

export function seedStore(items: Item[]): HarnessStore {
  const store = new HarnessStore();
  for (const it of items) store.seed(it);
  active = store;
  return store;
}

export function activeHarness(): HarnessStore | null { return active; }

export function harnessSend(cmd: unknown): Promise<unknown> {
  if (!active) return Promise.reject(new Error('harness: no active store — call seedStore() first'));
  return active.send(cmd);
}

/** rollup pass-through target: the suite mocks orgStore.recomputeRollupsForOrg to record here */
export function recordDirtyRollup(orgId: string): void { active?.recordDirtyRollup(orgId); }

// ------------------------------------------------------------------------------------------------
// Fixtures (plan Task 14: GEN_1 < GEN_2 fixed ULID literals; unresolvedEvent → unit
// 'unresolved-rfq-r1' with sourceEntityId 'r1'; orgItem seeds the organization keyspace)
// ------------------------------------------------------------------------------------------------

export const GEN_1 = '01J0AAAAAAAAAAAAAAAAAAAAAA';
export const GEN_2 = '01J0BBBBBBBBBBBBBBBBBBBBBB';

export const T0 = '2026-07-01T00:00:00.000Z';
export const T1 = '2026-07-01T01:00:00.000Z';
export const T2 = '2026-07-01T02:00:00.000Z';
export const T3 = '2026-07-01T03:00:00.000Z';
export const NOW_ISO = '2026-07-02T00:00:00.000Z';
/** an aging cutoff every marker's createdAt precedes (promotes immediately) */
export const PAST_CUTOFF = '9999-01-01T00:00:00.000Z';

const UNIT_KEY = 'unresolved-rfq-r1';

function occurredAtFor(id: string): string {
  const n = Number(/(\d+)$/.exec(id)?.[1] ?? 0);
  return new Date(Date.parse(T0) + n * 1000).toISOString();
}

/** an unresolved rfq event in unit 'unresolved-rfq-r1' (sourceEntityId 'r1') */
export function unresolvedEvent(id: string, over: Item = {}): Item {
  const occurredAt = occurredAtFor(id);
  const base: Item = {
    PK: `TLEVENT#${id}`, SK: 'A',
    GSI1PK: 'TLEVENT_STATUS#unresolved', GSI1SK: `${occurredAt}#${id}`,
    GSI2PK: `ORG#${UNIT_KEY}`, GSI2SK: `TLEVENT#${occurredAt}#${id}`,
    GSI3PK: 'SRC#rfq#r1', GSI3SK: `TLEVENT#${occurredAt}#${id}`,
    entityType: 'TIMELINE_EVENT', id, orgId: UNIT_KEY,
    resolutionStatus: 'unresolved', resolutionReason: 'unresolved', confidence: 0,
    contactId: null, occurredAt, source: 'rfq', kind: 'rfq_submitted',
    summary: `RFQ ${id}`, sourceEntityType: 'rfq', sourceEntityId: 'r1',
    isInternalOnly: false, voided: false, createdBy: null, payload: null,
    rollupApplied: false, rollupPendingOrgId: null,
    direction: null, externalId: null, threadId: null, from: null, to: null, subject: null, bodySnippet: null,
    createdAt: occurredAt, updatedAt: occurredAt,
  };
  return { ...base, ...over };
}

/** an already-moved (manually_linked) event stamped with a linkGeneration, sitting under `orgId` */
export function movedEvent(id: string, over: { orgId: string; linkGeneration: string } & Item): Item {
  return unresolvedEvent(id, {
    resolutionStatus: 'manually_linked', resolutionReason: 'manual', confidence: 1,
    GSI2PK: `ORG#${String(over.orgId)}`, GSI1PK: undefined, GSI1SK: undefined,
    rollupApplied: true,
    ...over,
  });
}

export function rfqRecord(pk: string, fields: Item = {}): Item {
  const matched = fields.matchedOrgId;
  const real = typeof matched === 'string' && matched !== '' && !matched.startsWith('unresolved-');
  return {
    PK: pk, SK: 'META', entityType: 'RFQ',
    submittedAt: T0, createdAt: T0, email: null,
    ...(real ? { GSI2PK: `ORG#${String(matched)}`, GSI2SK: `RFQ#${T0}` } : {}),
    ...fields,
  };
}

export function orgItem(id: string, fields: Item = {}): Item {
  return {
    PK: `ORG#${id}`, SK: 'META', entityType: 'ORGANIZATION', orgId: id,
    GSI2PK: `ORG_DOMAIN#${id}`, GSI2SK: 'ORG',
    status: 'active', createdAt: T0, updatedAt: T0,
    ...fields,
  };
}

export function orgKeyOf(orgId: string): { PK: string; SK: string } {
  return { PK: `ORG#${orgId}`, SK: 'META' };
}
export function reconKeyOf(fromOrgId: string, toOrgId: string): { PK: string; SK: string } {
  return { PK: `MERGE_RECON#${fromOrgId}`, SK: `TO#${toOrgId}` };
}

/** archive an org directly in the store (as a competing merge's committed archive would) */
export function archiveOrgInStore(store: HarnessStore, orgId: string, opts: { mergedInto?: string } = {}): void {
  const existing = store.get(orgKeyOf(orgId)) ?? orgItem(orgId);
  store.put(orgKeyOf(orgId), {
    ...existing, status: 'archived', mergedAt: NOW_ISO, updatedAt: NOW_ISO,
    ...(opts.mergedInto ? { mergedInto: opts.mergedInto } : {}),
  });
}

function markerBase(args: Item): Item {
  const unitKey = String(args.unitKey);
  const generation = String(args.generation ?? GEN_1);
  return {
    PK: `CRM_REPAIR#structured#${unitKey}#${generation}`, SK: 'STATE',
    entityType: 'CRM_REPAIR', unitType: 'structured',
    unitKey, generation, version: 1,
    targetOrgId: args.targetOrgId ?? 'a.com', operator: 'op', createdAt: T0,
    stuckReason: null, attemptCount: 0, lastAttemptAt: null, lastError: null,
    sourceType: 'rfq', sourceEntityId: 'r1', backfillPk: 'RFQ#1',
    customerEmail: null, movedCount: 1, affectedEventIdsSample: ['tev-1'], contactStatus: 'missing_email',
    ...args,
  };
}

/** seed a v2 PENDING structured marker (as a sealed/promoted link would leave it) */
export function putPendingMarker(store: HarnessStore, args: Item): Item {
  const item = markerBase({ ...args, status: 'pending', GSI1PK: 'CRM_REPAIR#pending', GSI1SK: `${T0}#${String(args.unitKey)}` });
  store.seed(item);
  return clone(item);
}

/** seed a v2 STUCK structured marker into its reason-keyed partition */
export function putStuckMarker(store: HarnessStore, args: Item): Item {
  const reasonClass = String(args.reasonClass ?? 'other');
  const item = markerBase({
    ...args, status: 'stuck', stuckReason: String(args.stuckReason ?? reasonClass), stuckReasonClass: reasonClass,
    GSI1PK: `CRM_REPAIR#stuck#${reasonClass}`, GSI1SK: `${T0}#${String(args.unitKey)}`, attemptCount: 1,
  });
  delete item.reasonClass;
  store.seed(item);
  return clone(item);
}

// ------------------------------------------------------------------------------------------------
// Task 8b delayed writer (Scenario 11): the REAL guarded write every delayed matchedOrgId writer
// issues (submit-rfq / submit-lead / createOrder / convert-rfq-to-order), verbatim — the guard
// condition, values, CCFE classification and superseded-log all come from the shared production
// module amplify/lib/crm/matched-org-write-guard.ts.
// ------------------------------------------------------------------------------------------------

export async function runDelayedWriterUpdate(store: HarnessStore, args: { pk: string; resolvedOrgId: string }): Promise<void> {
  try {
    await store.send(new UpdateCommand({
      TableName: process.env.INTELLIGENCE_TABLE ?? 'T',
      Key: { PK: args.pk, SK: 'META' },
      UpdateExpression: 'SET matchedOrgId = :id, GSI2PK = :gsi2',
      ConditionExpression: MATCHED_ORG_WRITE_GUARD_CONDITION,
      ExpressionAttributeValues: {
        ':id': args.resolvedOrgId,
        ':gsi2': `ORG#${args.resolvedOrgId}`,
        ...MATCHED_ORG_WRITE_GUARD_VALUES,
      },
    }));
  } catch (err) {
    if (!isConditionalCheckFailed(err)) throw err;
    logMatchedOrgWriteSuperseded('adversarial.delayed_writer', { pk: args.pk, attemptedOrgId: args.resolvedOrgId });
  }
}

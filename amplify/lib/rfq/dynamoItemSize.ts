// amplify/lib/rfq/dynamoItemSize.ts

/**
 * CONSERVATIVE DynamoDB item-size estimate (bytes). Over-counts real AttributeValue
 * size; never under-counts. NOT JSON.stringify length. Domain: JSON scalars, string,
 * number, boolean, null, plain arrays, plain objects. Fails closed on any other value
 * type (Buffer/Set/BigInt/function/symbol) so an unmodelled type can never slip a
 * large payload past the limit.
 */
// Over-count the JSON/AttributeValue framing per attribute (key quotes + colon +
// value quotes + comma ≈ 6 bytes) so the estimate never under-counts a text-heavy item.
const PER_ATTRIBUTE_OVERHEAD = 7;
// DynamoDB numbers cap at 38 significant digits (~21 bytes stored). Over-count to 38 so
// the guard can never be defeated by a large number; item numbers here are tiny anyway.
const NUMBER_BYTES = 38;
const STRUCTURAL_OVERHEAD = 3;

export const MAX_ITEM_BYTES = 400 * 1024;             // DynamoDB item hard limit
export const MAX_TRANSACTION_BYTES = 4 * 1024 * 1024; // TransactWrite payload hard limit

function utf8Bytes(s: string): number { return Buffer.byteLength(s, 'utf8'); }

function valueBytes(value: unknown): number {
  // Fail closed: `undefined` is not a storable DynamoDB value — its presence signals a
  // marshalling bug and must be rejected, not silently counted. `null` IS storable (NULL).
  if (value === undefined) throw new TypeError('dynamoItemSize: undefined is not a storable value');
  if (value === null) return 1;
  const t = typeof value;
  if (t === 'string') return utf8Bytes(value as string);
  if (t === 'number') {
    if (!Number.isFinite(value as number)) {
      throw new TypeError('dynamoItemSize: non-finite numbers (NaN/Infinity) are not storable');
    }
    return NUMBER_BYTES;
  }
  if (t === 'boolean') return 1;
  if (Array.isArray(value)) {
    return value.reduce<number>((sum, el) => sum + STRUCTURAL_OVERHEAD + valueBytes(el), 0);
  }
  if (t === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    return Object.entries(value as Record<string, unknown>).reduce<number>(
      (sum, [k, v]) => sum + STRUCTURAL_OVERHEAD + utf8Bytes(k) + valueBytes(v), 0,
    );
  }
  throw new TypeError(`dynamoItemSize: unsupported value type ${t} (${Object.prototype.toString.call(value)})`);
}

export function estimateDynamoItemBytes(item: Record<string, unknown>): number {
  return Object.entries(item).reduce<number>(
    (sum, [name, value]) => sum + PER_ATTRIBUTE_OVERHEAD + utf8Bytes(name) + valueBytes(value), 0,
  );
}

export function assertWithinItemLimits(item: Record<string, unknown>): void {
  const bytes = estimateDynamoItemBytes(item);
  if (bytes > MAX_ITEM_BYTES) throw new Error(`RFQ item size ${bytes}B exceeds limit ${MAX_ITEM_BYTES}B`);
}

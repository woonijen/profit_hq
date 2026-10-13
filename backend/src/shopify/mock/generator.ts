import type {
  ShopifyCustomer,
  ShopifyLineItem,
  ShopifyMoneyBag,
  ShopifyOrder,
  ShopifyProduct,
  ShopifyProductVariant,
  ShopifyRefund,
} from '../schemas.js';
import { singlePage } from './connection.js';
import { createRng, type Rng } from './rng.js';

const DAY_MS = 86_400_000;
const TAX_RATE = 0.08;

const ADJECTIVES = [
  'Classic',
  'Urban',
  'Vintage',
  'Eco',
  'Premium',
  'Everyday',
  'Cozy',
  'Bold',
] as const;
const NOUNS = [
  'Tote',
  'Hoodie',
  'Mug',
  'Sneaker',
  'Backpack',
  'Beanie',
  'Candle',
  'Notebook',
] as const;
const FIRST_NAMES = ['Ava', 'Liam', 'Noah', 'Mia', 'Ethan', 'Zoe', 'Lucas', 'Ivy'] as const;
const LAST_NAMES = [
  'Nguyen',
  'Garcia',
  'Smith',
  'Khan',
  'Rossi',
  'Silva',
  'Kim',
  'Muller',
] as const;
const SIZE_TITLES = ['Small', 'Medium', 'Large'] as const;

export interface MockShopOptions {
  /** Same seed (and options) ⇒ identical payloads. */
  seed: number;
  /** Length of the order history, in days. */
  days: number;
  /**
   * End of the history window (exclusive). Passed in rather than read from the clock so the
   * output stays reproducible.
   */
  endDate: Date;
  productCount?: number;
  customerCount?: number;
  /** Average orders per day; each day gets 50%–150% of it. */
  ordersPerDay?: number;
  currencyCode?: string;
}

export interface MockShopData {
  products: ShopifyProduct[];
  customers: ShopifyCustomer[];
  orders: ShopifyOrder[];
}

/** A sellable variant plus what orders need to reference it. */
interface CatalogEntry {
  productId: string;
  productTitle: string;
  variant: ShopifyProductVariant;
  priceCents: number;
}

const gid = (type: string, n: number) => `gid://shopify/${type}/${n}`;

function toMoney(cents: number, currencyCode: string): ShopifyMoneyBag['shopMoney'] {
  return { amount: (cents / 100).toFixed(2), currencyCode };
}

function toBag(cents: number, currencyCode: string): ShopifyMoneyBag {
  return { shopMoney: toMoney(cents, currencyCode) };
}

function buildProducts(rng: Rng, count: number, currencyCode: string, updatedAt: string) {
  const catalog: CatalogEntry[] = [];
  let variantSeq = 0;

  const products = Array.from({ length: count }, (_, i): ShopifyProduct => {
    const productId = gid('Product', 1_000_000 + i);
    const productTitle = `${rng.pick(ADJECTIVES)} ${rng.pick(NOUNS)}`;
    const basePriceCents = rng.int(15, 120) * 100 - 1; // e.g. 2499
    const variantCount = rng.int(1, 3);

    const variants = Array.from({ length: variantCount }, (_, v): ShopifyProductVariant => {
      variantSeq += 1;
      const priceCents = basePriceCents + v * 500;
      // ~5% of variants have no cost entered, so downstream code has to handle unknown COGS.
      const hasCost = !rng.chance(0.05);
      const costCents = Math.round(priceCents * (0.25 + rng.next() * 0.35));
      return {
        id: gid('ProductVariant', 4_000_000 + variantSeq),
        title: variantCount === 1 ? 'Default Title' : (SIZE_TITLES[v] ?? `Option ${v + 1}`),
        sku: `SKU-${1000 + i}-${v + 1}`,
        price: (priceCents / 100).toFixed(2),
        inventoryQuantity: rng.int(0, 200),
        inventoryItem: { unitCost: hasCost ? toMoney(costCents, currencyCode) : null },
      };
    });

    for (const variant of variants) {
      catalog.push({
        productId,
        productTitle,
        variant,
        priceCents: Math.round(Number(variant.price) * 100),
      });
    }

    return {
      id: productId,
      title: productTitle,
      status: rng.chance(0.08) ? 'ARCHIVED' : 'ACTIVE',
      updatedAt,
      variants: singlePage(variants),
    };
  });

  return { products, catalog };
}

function buildCustomers(rng: Rng, count: number, windowStartMs: number): ShopifyCustomer[] {
  return Array.from({ length: count }, (_, i) => {
    const firstName = rng.pick(FIRST_NAMES);
    const lastName = rng.pick(LAST_NAMES);
    return {
      id: gid('Customer', 6_000_000 + i),
      email: `${firstName}.${lastName}${i + 1}@example.test`.toLowerCase(),
      firstName,
      lastName,
      createdAt: new Date(windowStartMs - rng.int(1, 365) * DAY_MS).toISOString(),
    };
  });
}

interface OrderContext {
  rng: Rng;
  catalog: readonly CatalogEntry[];
  customers: readonly ShopifyCustomer[];
  currencyCode: string;
  endMs: number;
}

/** Hands out ids for nested objects so they stay unique across the whole dataset. */
function createIdCounters() {
  let lineItem = 0;
  let refund = 0;
  return {
    nextLineItemId: () => gid('LineItem', 9_000_000 + ++lineItem),
    nextRefundId: () => gid('Refund', 8_000_000 + ++refund),
  };
}

function buildOrder(
  ctx: OrderContext,
  ids: ReturnType<typeof createIdCounters>,
  index: number,
  processedAtMs: number,
): ShopifyOrder {
  const { rng, catalog, customers, currencyCode, endMs } = ctx;

  // Lower catalog indexes sell more, so a few best-sellers dominate like in a real shop.
  const entries = new Set<CatalogEntry>();
  const lineCount = Math.min(rng.int(1, 3), catalog.length);
  while (entries.size < lineCount) {
    const entry = catalog[Math.floor(rng.next() ** 2 * catalog.length)];
    if (entry) entries.add(entry);
  }

  const discountPercent = rng.chance(0.2) ? rng.pick([10, 15, 20, 25]) : 0;
  const lines = [...entries].map((entry) => {
    const quantity = rng.chance(0.75) ? 1 : rng.int(2, 3);
    const grossCents = entry.priceCents * quantity;
    const discountCents = Math.round((grossCents * discountPercent) / 100);
    return { id: ids.nextLineItemId(), entry, quantity, grossCents, discountCents };
  });

  const grossCents = lines.reduce((sum, l) => sum + l.grossCents, 0);
  const discountCents = lines.reduce((sum, l) => sum + l.discountCents, 0);
  const subtotalCents = grossCents - discountCents;
  const taxCents = Math.round(subtotalCents * TAX_RATE);

  // Refunds only cover the net line value; tax is not refunded in the simulation.
  const voided = rng.chance(0.02);
  const refunded = !voided && rng.chance(0.07);
  let refundedCents = 0;
  const refundedLines: { lineId: string; quantity: number }[] = [];
  if (refunded) {
    if (rng.chance(0.4)) {
      refundedCents = subtotalCents;
      refundedLines.push(...lines.map((l) => ({ lineId: l.id, quantity: l.quantity })));
    } else {
      const line = lines[rng.int(0, lines.length - 1)];
      if (line) {
        const quantity = rng.int(1, line.quantity);
        refundedCents = Math.round(
          ((line.grossCents - line.discountCents) * quantity) / line.quantity,
        );
        refundedLines.push({ lineId: line.id, quantity });
      }
    }
  }

  const refunds: ShopifyRefund[] = [];
  let updatedAtMs = processedAtMs;
  if (refundedLines.length > 0) {
    // Refunds land 1–14 days after the sale, but never in the future.
    const refundedAtMs = Math.min(processedAtMs + rng.int(1, 14) * DAY_MS, endMs - 1);
    updatedAtMs = refundedAtMs;
    refunds.push({
      id: ids.nextRefundId(),
      createdAt: new Date(refundedAtMs).toISOString(),
      totalRefundedSet: toBag(refundedCents, currencyCode),
      refundLineItems: singlePage(
        refundedLines.map((l) => ({ quantity: l.quantity, lineItem: { id: l.lineId } })),
      ),
    });
  }

  let displayFinancialStatus: ShopifyOrder['displayFinancialStatus'] = 'PAID';
  if (voided) displayFinancialStatus = 'VOIDED';
  else if (refundedCents > 0) {
    displayFinancialStatus = refundedCents >= subtotalCents ? 'REFUNDED' : 'PARTIALLY_REFUNDED';
  }

  const customer = rng.chance(0.85)
    ? customers[Math.floor(rng.next() ** 2 * customers.length)]
    : undefined;

  const lineItems = lines.map((l): ShopifyLineItem => ({
    id: l.id,
    title:
      l.entry.variant.title === 'Default Title'
        ? l.entry.productTitle
        : `${l.entry.productTitle} - ${l.entry.variant.title}`,
    sku: l.entry.variant.sku,
    quantity: l.quantity,
    originalUnitPriceSet: toBag(l.entry.priceCents, currencyCode),
    totalDiscountSet: toBag(l.discountCents, currencyCode),
    product: { id: l.entry.productId },
    variant: { id: l.entry.variant.id },
  }));

  return {
    id: gid('Order', 5_000_000 + index),
    name: `#${1001 + index}`,
    processedAt: new Date(processedAtMs).toISOString(),
    updatedAt: new Date(updatedAtMs).toISOString(),
    displayFinancialStatus,
    currencyCode,
    customer: customer ? { id: customer.id, email: customer.email } : null,
    subtotalPriceSet: toBag(subtotalCents, currencyCode),
    totalDiscountsSet: toBag(discountCents, currencyCode),
    totalTaxSet: toBag(taxCents, currencyCode),
    totalPriceSet: toBag(subtotalCents + taxCents, currencyCode),
    totalRefundedSet: toBag(refundedCents, currencyCode),
    lineItems: singlePage(lineItems),
    refunds,
  };
}

/**
 * Generates a whole simulated shop: catalog, customers and `days` of order history with
 * discounts, partial/full refunds and the odd voided order. Pure and deterministic.
 */
export function generateMockShop(options: MockShopOptions): MockShopData {
  const {
    seed,
    days,
    endDate,
    productCount = 24,
    customerCount = 150,
    ordersPerDay = 12,
    currencyCode = 'USD',
  } = options;

  const rng = createRng(seed);
  const endMs = endDate.getTime();
  const startMs = endMs - days * DAY_MS;

  const { products, catalog } = buildProducts(
    rng,
    productCount,
    currencyCode,
    new Date(startMs).toISOString(),
  );
  const customers = buildCustomers(rng, customerCount, startMs);

  // Pick every timestamp first and sort, so order numbers and ids increase with time.
  const timestamps: number[] = [];
  for (let day = 0; day < days; day += 1) {
    const count = rng.int(Math.floor(ordersPerDay * 0.5), Math.ceil(ordersPerDay * 1.5));
    for (let i = 0; i < count; i += 1) {
      timestamps.push(startMs + day * DAY_MS + Math.floor(rng.next() * DAY_MS));
    }
  }
  timestamps.sort((a, b) => a - b);

  const ctx: OrderContext = { rng, catalog, customers, currencyCode, endMs };
  const ids = createIdCounters();
  const orders = timestamps.map((ts, index) => buildOrder(ctx, ids, index, ts));

  return { products, customers, orders };
}

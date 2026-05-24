import {
  pgTable,
  pgEnum,
  serial,
  varchar,
  text,
  numeric,
  integer,
  timestamp,
  date,
  char,
  jsonb,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';

// ─── Enums ────────────────────────────────────────────────────────────────────

export const invoiceStatusEnum = pgEnum('invoice_status', [
  'PROCESSING',
  'DRAFT',
  'PENDING_VALIDATION',
  'VALIDATED',
  'REJECTED',
  'ARCHIVED',
]);

export const userRoleEnum = pgEnum('user_role', ['admin', 'accountant', 'viewer']);

// ─── Organizations ────────────────────────────────────────────────────────────

export const organizations = pgTable('organizations', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ─── Users ────────────────────────────────────────────────────────────────────

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  role: userRoleEnum('role').notNull().default('viewer'),
  organizationId: integer('organization_id')
    .notNull()
    .references(() => organizations.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ─── Suppliers ────────────────────────────────────────────────────────────────

export const suppliers = pgTable('suppliers', {
  id: serial('id').primaryKey(),
  organizationId: integer('organization_id')
    .notNull()
    .references(() => organizations.id),
  name: varchar('name', { length: 255 }).notNull(),
  siret: varchar('siret', { length: 14 }).unique(),
  vatNumber: varchar('vat_number', { length: 20 }),
  iban: varchar('iban', { length: 34 }),
  address: text('address'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ─── Invoices ─────────────────────────────────────────────────────────────────

export const invoices = pgTable(
  'invoices',
  {
    id: serial('id').primaryKey(),
    organizationId: integer('organization_id')
      .notNull()
      .references(() => organizations.id),
    supplierId: integer('supplier_id').references(() => suppliers.id),
    invoiceNumber: varchar('invoice_number', { length: 100 }),
    issueDate: date('issue_date'),
    dueDate: date('due_date'),
    amountHt: numeric('amount_ht', { precision: 12, scale: 2 }),
    amountTva: numeric('amount_tva', { precision: 12, scale: 2 }),
    amountTtc: numeric('amount_ttc', { precision: 12, scale: 2 }),
    currency: char('currency', { length: 3 }).notNull().default('EUR'),
    status: invoiceStatusEnum('status').notNull().default('DRAFT'),
    filePath: varchar('file_path', { length: 512 }).notNull(),
    fileMime: varchar('file_mime', { length: 100 }),
    ocrRawText: text('ocr_raw_text'),
    ocrConfidence: jsonb('ocr_confidence'),
    fileHash: varchar('file_hash', { length: 64 }),
    riskAssessment: jsonb('risk_assessment').$type<{ score: number; flags: string[] }>(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('idx_invoices_status').on(t.status),
    index('idx_invoices_supplier').on(t.supplierId),
    index('idx_invoices_issue_date').on(t.issueDate),
    index('idx_invoices_file_hash').on(t.fileHash),
    index('idx_invoices_org').on(t.organizationId),
    // uq_invoices_supplier_number est un index partiel (WHERE NOT NULL) :
    // non supporté dans la config Drizzle, géré en raw SQL dans la migration.
  ],
);

export const invoiceLines = pgTable('invoice_lines', {
  id: serial('id').primaryKey(),
  invoiceId: integer('invoice_id')
    .notNull()
    .references(() => invoices.id, { onDelete: 'cascade' }),
  description: text('description').notNull().default(''),
  quantity: numeric('quantity', { precision: 10, scale: 2 }).notNull().default('1'),
  unitPrice: numeric('unit_price', { precision: 12, scale: 2 }).notNull().default('0'),
  total: numeric('total', { precision: 12, scale: 2 }).notNull().default('0'),
  position: integer('position').notNull().default(0),
});

export const invoiceStatusHistory = pgTable('invoice_status_history', {
  id: serial('id').primaryKey(),
  invoiceId: integer('invoice_id')
    .notNull()
    .references(() => invoices.id, { onDelete: 'cascade' }),
  fromStatus: invoiceStatusEnum('from_status'),
  toStatus: invoiceStatusEnum('to_status').notNull(),
  reason: text('reason'),
  actor: varchar('actor', { length: 100 }).notNull().default('system'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ─── Refresh tokens ───────────────────────────────────────────────────────────

export const refreshTokens = pgTable('refresh_tokens', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  // On stocke le SHA-256 du token, jamais le token brut (défense en profondeur).
  tokenHash: varchar('token_hash', { length: 64 }).notNull().unique(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ─── Webhooks ─────────────────────────────────────────────────────────────────

export const webhooks = pgTable('webhooks', {
  id: serial('id').primaryKey(),
  orgId: integer('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  url: varchar('url', { length: 512 }).notNull(),
  secret: varchar('secret', { length: 128 }).notNull(),
  events: jsonb('events').notNull().$type<string[]>().default([]),
  active: integer('active').notNull().default(1), // 1 = true, 0 = false (pg boolean workaround for drizzle)
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const webhookDeliveries = pgTable('webhook_deliveries', {
  id: serial('id').primaryKey(),
  webhookId: integer('webhook_id').notNull().references(() => webhooks.id, { onDelete: 'cascade' }),
  event: varchar('event', { length: 100 }).notNull(),
  payload: jsonb('payload').notNull(),
  status: varchar('status', { length: 20 }).notNull().default('pending'),
  statusCode: integer('status_code'),
  responseBody: text('response_body'),
  attempt: integer('attempt').notNull().default(1),
  deliveredAt: timestamp('delivered_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ─── Legacy (Collection Manager v1) ──────────────────────────────────────────

export const collections = pgTable('collections', {
  id: serial('id').primaryKey(),
  title: varchar('title', { length: 255 }).notNull().default('My Collection'),
});

export const items = pgTable('items', {
  id: serial('id').primaryKey(),
  collectionId: integer('collection_id')
    .notNull()
    .references(() => collections.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull().default(''),
  description: text('description').notNull().default(''),
  image: varchar('image', { length: 512 }).default(''),
  rarity: varchar('rarity', { length: 50 }).notNull().default('Legendary'),
  price: numeric('price', { precision: 10, scale: 2 }).notNull().default('0'),
  position: integer('position').notNull().default(0),
});

// ─── Extraction corrections (Sprint 3) ───────────────────────────────────────

export const extractionCorrections = pgTable('extraction_corrections', {
  id: serial('id').primaryKey(),
  orgId: integer('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  supplierId: integer('supplier_id').references(() => suppliers.id, { onDelete: 'cascade' }),
  invoiceId: integer('invoice_id').references(() => invoices.id, { onDelete: 'set null' }),
  field: varchar('field', { length: 50 }).notNull(),
  rawTextSnippet: text('raw_text_snippet').notNull().default(''),
  aiValue: text('ai_value').notNull().default(''),
  correctedValue: text('corrected_value').notNull(),
  costUsd: numeric('cost_usd', { precision: 10, scale: 8 }).default('0'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ─── Inferred types ───────────────────────────────────────────────────────────

export type Organization = typeof organizations.$inferSelect;
export type NewOrganization = typeof organizations.$inferInsert;
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type UserRole = 'admin' | 'accountant' | 'viewer';

import { z } from 'zod';
import { logger } from '../../config/logger';
import type { ToolDefinition, AgentContext } from '../../types/agent';
import {
  agentSearchInvoices,
  agentGetInvoiceDetail,
  agentAggregateInvoices,
  agentComparePeriods,
  agentSemanticSearch,
} from '../../db/agent-queries';
import { ollamaEmbed } from './providers/ollama-provider';
import { env } from '../../config/env';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function zodToJsonSchema(schema: z.ZodObject<z.ZodRawShape>): Record<string, unknown> {
  const shape = schema.shape;
  const properties: Record<string, unknown> = {};
  const required: string[] = [];

  for (const [key, field] of Object.entries(shape)) {
    const isOptional = field instanceof z.ZodOptional;
    const inner = isOptional ? (field as z.ZodOptional<z.ZodTypeAny>).unwrap() : field;

    if (!isOptional) required.push(key);

    if (inner instanceof z.ZodString) {
      properties[key] = { type: 'string', description: inner.description };
    } else if (inner instanceof z.ZodNumber) {
      properties[key] = { type: 'number', description: inner.description };
    } else if (inner instanceof z.ZodEnum) {
      properties[key] = { type: 'string', enum: inner.options, description: inner.description };
    } else {
      properties[key] = { type: 'string' };
    }
  }

  return { type: 'object', properties, required };
}

// ─── Tool: search_invoices ────────────────────────────────────────────────────

const SearchInvoicesInput = z.object({
  supplier_id: z.number().optional().describe('ID du fournisseur'),
  status: z.enum(['DRAFT', 'PENDING_VALIDATION', 'VALIDATED', 'REJECTED', 'ARCHIVED', 'PROCESSING']).optional().describe('Statut de la facture'),
  date_from: z.string().optional().describe('Date de début ISO 8601 (YYYY-MM-DD)'),
  date_to: z.string().optional().describe('Date de fin ISO 8601 (YYYY-MM-DD)'),
  amount_min: z.number().optional().describe('Montant TTC minimum'),
  amount_max: z.number().optional().describe('Montant TTC maximum'),
  limit: z.number().optional().describe('Nombre max de résultats (défaut 20, max 50)'),
});

type SearchInvoicesInput = z.infer<typeof SearchInvoicesInput>;

const searchInvoicesTool: ToolDefinition<SearchInvoicesInput> = {
  name: 'search_invoices',
  description: `Recherche des factures selon des critères. Renvoie une liste paginée (max 50).
When to use: pour trouver des factures d'un fournisseur, dans une plage de dates, par statut, ou par montant.
Exemples: "factures EDF de 2025", "factures > 1000€ non validées".`,
  parameters: zodToJsonSchema(SearchInvoicesInput),
  async handler(rawInput: unknown, ctx: AgentContext) {
    const input = SearchInvoicesInput.parse(rawInput);
    const start = Date.now();
    const results = await agentSearchInvoices(ctx.orgId, {
      supplierId: input.supplier_id,
      status: input.status,
      dateFrom: input.date_from,
      dateTo: input.date_to,
      amountMin: input.amount_min,
      amountMax: input.amount_max,
      limit: input.limit,
    });
    logger.info('agent.tool.search_invoices', {
      orgId: ctx.orgId, input, resultCount: results.length, durationMs: Date.now() - start,
    });
    return results;
  },
};

// ─── Tool: get_invoice_details ────────────────────────────────────────────────

const GetInvoiceDetailsInput = z.object({
  invoice_id: z.number().describe('ID de la facture'),
});

type GetInvoiceDetailsInput = z.infer<typeof GetInvoiceDetailsInput>;

const getInvoiceDetailsTool: ToolDefinition<GetInvoiceDetailsInput> = {
  name: 'get_invoice_details',
  description: `Renvoie tous les détails d'une facture : lignes, scores de confiance OCR, flags de fraude.
When to use: après search_invoices pour inspecter une facture précise.`,
  parameters: zodToJsonSchema(GetInvoiceDetailsInput),
  async handler(rawInput: unknown, ctx: AgentContext) {
    const input = GetInvoiceDetailsInput.parse(rawInput);
    const result = await agentGetInvoiceDetail(ctx.orgId, input.invoice_id);
    if (!result) return { error: `Facture ${input.invoice_id} introuvable` };
    logger.info('agent.tool.get_invoice_details', { orgId: ctx.orgId, invoiceId: input.invoice_id });
    return result;
  },
};

// ─── Tool: aggregate_invoices ─────────────────────────────────────────────────

const AggregateInvoicesInput = z.object({
  group_by: z.enum(['supplier', 'month', 'status']).optional().describe('Dimension de regroupement : "supplier", "month" ou "status". Défaut : "status"'),
  metric: z.enum(['count', 'sum_total', 'avg_total']).optional().describe('Métrique à calculer : "count", "sum_total" ou "avg_total". Défaut : "count"'),
  supplier_id: z.number().optional().describe('Filtrer sur un fournisseur'),
  date_from: z.string().optional().describe('Date de début ISO 8601'),
  date_to: z.string().optional().describe('Date de fin ISO 8601'),
});

type AggregateInvoicesInput = z.infer<typeof AggregateInvoicesInput>;

const aggregateInvoicesTool: ToolDefinition<AggregateInvoicesInput> = {
  name: 'aggregate_invoices',
  description: `Agrège les factures par fournisseur, mois ou statut. Renvoie count, somme et moyenne TTC.
When to use: pour des questions analytiques — "top 5 fournisseurs par dépense", "évolution mensuelle", "répartition par statut", "résumé des factures".
Pour un résumé général sans dimension précise, utiliser group_by="status" et metric="count".
Tous les paramètres sont optionnels — ne pas passer null, omettre simplement les champs non utilisés.`,
  parameters: zodToJsonSchema(AggregateInvoicesInput),
  async handler(rawInput: unknown, ctx: AgentContext) {
    const input = AggregateInvoicesInput.parse(rawInput);
    const start = Date.now();
    const results = await agentAggregateInvoices(
      ctx.orgId,
      input.group_by ?? 'status',
      input.metric ?? 'count',
      {
        supplierId: input.supplier_id,
        dateFrom: input.date_from,
        dateTo: input.date_to,
      },
    );
    logger.info('agent.tool.aggregate_invoices', {
      orgId: ctx.orgId, input, resultCount: results.length, durationMs: Date.now() - start,
    });
    return results;
  },
};

// ─── Tool: compare_periods ────────────────────────────────────────────────────

const ComparePeriods = z.object({
  supplier_id: z.number().optional().describe('ID fournisseur (optionnel, tous sinon)'),
  period_a_from: z.string().describe('Début période A (YYYY-MM-DD)'),
  period_a_to: z.string().describe('Fin période A (YYYY-MM-DD)'),
  period_a_label: z.string().describe('Label période A, ex: "Q1 2024"'),
  period_b_from: z.string().describe('Début période B (YYYY-MM-DD)'),
  period_b_to: z.string().describe('Fin période B (YYYY-MM-DD)'),
  period_b_label: z.string().describe('Label période B, ex: "Q1 2025"'),
  metric: z.enum(['count', 'sum_total', 'avg_total']).describe('Métrique à comparer'),
});

type ComparePeriods = z.infer<typeof ComparePeriods>;

const comparePeriodsTool: ToolDefinition<ComparePeriods> = {
  name: 'compare_periods',
  description: `Compare une métrique entre deux périodes. Renvoie les valeurs et le delta absolu + %.
When to use: "factures EDF ont-elles augmenté vs l'an dernier ?", "évolution du nombre de factures Q1 vs Q2".`,
  parameters: zodToJsonSchema(ComparePeriods),
  async handler(rawInput: unknown, ctx: AgentContext) {
    const input = ComparePeriods.parse(rawInput);
    const result = await agentComparePeriods(
      ctx.orgId,
      input.supplier_id ?? null,
      { from: input.period_a_from, to: input.period_a_to, label: input.period_a_label },
      { from: input.period_b_from, to: input.period_b_to, label: input.period_b_label },
      input.metric,
    );
    logger.info('agent.tool.compare_periods', { orgId: ctx.orgId, input });
    return result;
  },
};

// ─── Tool: semantic_search_invoices ──────────────────────────────────────────

const SemanticSearchInput = z.object({
  query: z.string().describe('Description en langage naturel à rechercher dans les lignes de facture'),
  top_k: z.number().optional().describe('Nombre de résultats (défaut 10, max 20)'),
});

type SemanticSearchInput = z.infer<typeof SemanticSearchInput>;

const semanticSearchTool: ToolDefinition<SemanticSearchInput> = {
  name: 'semantic_search_invoices',
  description: `Recherche sémantique dans les descriptions de lignes de facture via pgvector.
When to use: quand la recherche textuelle exacte échoue — "cartouches d'impression", "matériel informatique", "frais de déplacement".
Fallback ILIKE si les embeddings ne sont pas encore calculés.`,
  parameters: zodToJsonSchema(SemanticSearchInput),
  async handler(rawInput: unknown, ctx: AgentContext) {
    const input = SemanticSearchInput.parse(rawInput);
    const topK = Math.min(input.top_k ?? 10, 20);

    let embedding: number[] | null = null;
    if (env.AI_PROVIDER === 'ollama') {
      try {
        embedding = await ollamaEmbed(input.query);
      } catch (e) {
        logger.warn('agent.tool.semantic_search.embed_failed', { error: String(e) });
      }
    }

    const results = await agentSemanticSearch(ctx.orgId, embedding, input.query, topK);
    logger.info('agent.tool.semantic_search', {
      orgId: ctx.orgId, query: input.query, resultCount: results.length,
      usingVector: embedding !== null,
    });
    return results;
  },
};

// ─── Export ───────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const AGENT_TOOLS: ToolDefinition<any, any>[] = [
  searchInvoicesTool,
  getInvoiceDetailsTool,
  aggregateInvoicesTool,
  comparePeriodsTool,
  semanticSearchTool,
];

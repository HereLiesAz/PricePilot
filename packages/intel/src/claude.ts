import Anthropic from "@anthropic-ai/sdk";
import { ExtractedProduct } from "@pricepilot/shared";

/** Default model for the intelligence layer — latest Sonnet (cost/latency balance). */
export const DEFAULT_MODEL = "claude-sonnet-4-6";

export interface ClaudeOptions {
  apiKey: string;
  model?: string;
}

/** Fallback extractor signature consumed by the scrapers' Claude adapter. */
export type ClaudeExtractor = (input: { html: string; url: string }) => Promise<ExtractedProduct | null>;

export interface MatchOption {
  id: string;
  title: string;
}
export interface MatchSubject {
  title: string;
  brand?: string | null;
  gtin?: string | null;
}
/** Tie-breaker signature: pick the matching product id, or null for "none". */
export type ClaudeMatcher = (subject: MatchSubject, options: MatchOption[]) => Promise<string | null>;

// Static system prompt → cache_control breakpoint keeps it cheap across calls.
const EXTRACT_SYSTEM =
  "You extract a single product offer from a web page's text. Return only the " +
  "fields you are confident about; use null when a field is absent. price is a " +
  "number in the page's currency with no symbols. currency is a 3-letter ISO code " +
  "(default USD). inStock is true/false/null. Never invent values.";

const MATCH_SYSTEM =
  "You decide whether a product matches one of several candidates. Two listings " +
  "match only if they are the same physical product (same model/variant), ignoring " +
  "vendor, condition, and listing wording. If none clearly match, return \"none\".";

function cleanHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 12_000);
}

function toolInput(message: Anthropic.Message, toolName: string): Record<string, unknown> | null {
  const block = message.content.find((b) => b.type === "tool_use" && b.name === toolName);
  return block && block.type === "tool_use" ? (block.input as Record<string, unknown>) : null;
}

/**
 * Build a Claude-backed extraction fallback. Sends cleaned page text and forces
 * a structured tool call; the result is validated against `ExtractedProduct`.
 * Returns null on low confidence or any API error (so callers degrade safely).
 */
export function makeClaudeExtractor(opts: ClaudeOptions): ClaudeExtractor {
  const client = new Anthropic({ apiKey: opts.apiKey });
  const model = opts.model ?? DEFAULT_MODEL;

  return async ({ html, url }) => {
    try {
      const message = await client.messages.create({
        model,
        max_tokens: 1024,
        thinking: { type: "disabled" },
        system: [{ type: "text", text: EXTRACT_SYSTEM, cache_control: { type: "ephemeral" } }],
        tools: [
          {
            name: "record_product",
            description: "Record the extracted product offer.",
            input_schema: {
              type: "object",
              properties: {
                title: { type: "string" },
                price: { type: ["number", "null"] },
                currency: { type: "string" },
                inStock: { type: ["boolean", "null"] },
                image: { type: ["string", "null"] },
                gtin: { type: ["string", "null"] },
                mpn: { type: ["string", "null"] },
                brand: { type: ["string", "null"] },
              },
              required: ["title"],
            },
          },
        ],
        tool_choice: { type: "tool", name: "record_product" },
        messages: [{ role: "user", content: `URL: ${url}\n\nPAGE TEXT:\n${cleanHtml(html)}` }],
      });

      const input = toolInput(message, "record_product");
      if (!input) return null;
      // currency is non-nullable with a "USD" default; drop a null/absent value
      // so the zod default applies instead of failing validation.
      if (input["currency"] === null || input["currency"] === undefined) {
        delete input["currency"];
      }
      const parsed = ExtractedProduct.safeParse({ ...input, source: "claude" });
      return parsed.success ? parsed.data : null;
    } catch {
      return null;
    }
  };
}

/** Build a Claude-backed cross-vendor match tie-breaker. Returns null on error. */
export function makeClaudeMatcher(opts: ClaudeOptions): ClaudeMatcher {
  const client = new Anthropic({ apiKey: opts.apiKey });
  const model = opts.model ?? DEFAULT_MODEL;

  return async (subject, options) => {
    if (options.length === 0) return null;
    try {
      const list = options.map((o) => `- ${o.id}: ${o.title}`).join("\n");
      const subjectText = [subject.title, subject.brand, subject.gtin].filter(Boolean).join(" · ");
      const message = await client.messages.create({
        model,
        max_tokens: 256,
        thinking: { type: "disabled" },
        system: [{ type: "text", text: MATCH_SYSTEM, cache_control: { type: "ephemeral" } }],
        tools: [
          {
            name: "choose_match",
            description: "Choose the matching product id, or \"none\".",
            input_schema: {
              type: "object",
              properties: { productId: { type: "string" } },
              required: ["productId"],
            },
          },
        ],
        tool_choice: { type: "tool", name: "choose_match" },
        messages: [
          { role: "user", content: `PRODUCT: ${subjectText}\n\nCANDIDATES:\n${list}` },
        ],
      });
      const input = toolInput(message, "choose_match");
      const id = input?.["productId"];
      if (typeof id !== "string" || id === "none") return null;
      return options.some((o) => o.id === id) ? id : null;
    } catch {
      return null;
    }
  };
}

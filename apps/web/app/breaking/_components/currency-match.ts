import type { BreakingHeadline, BreakingSource } from "@/lib/types";
import type { CurrencyFilter } from "./CurrencyFilter";

type Rule = {
  sources?: BreakingSource[];
  symbolMatch: RegExp;
  headlineMatch: RegExp;
};

const RULES: Record<Exclude<CurrencyFilter, "all">, Rule> = {
  USD: {
    sources: ["fed"],
    symbolMatch: /USD|DXY|SPX|NDX|US30|US500|ES_F|NQ_F|YM_F|RTY_F|SPY|QQQ|DIA|IWM|TLT|GLD|^US\b/i,
    headlineMatch: /\b(fed|fomc|powell|treasury|treasuries|u\.?s\.?|united states|america|dollar|greenback|cpi|ppi|pce|nfp|jobless|payroll|ism|jolts|fed funds)\b/i,
  },
  EUR: {
    sources: ["ecb"],
    symbolMatch: /EUR/i,
    headlineMatch: /\b(ecb|lagarde|euro(zone|pean union|pean)?|euro\b|germany|german|france|french|italy|italian|spain|spanish|bundesbank)\b/i,
  },
  GBP: {
    symbolMatch: /GBP/i,
    headlineMatch: /\b(boe|bank of england|bailey|uk\b|u\.k\.|britain|british|sterling|pound|gilts?)\b/i,
  },
  JPY: {
    symbolMatch: /JPY/i,
    headlineMatch: /\b(boj|bank of japan|ueda|kuroda|japan(ese)?|yen|nikkei)\b/i,
  },
  CHF: {
    symbolMatch: /CHF/i,
    headlineMatch: /\b(snb|swiss national bank|swiss|switzerland|franc)\b/i,
  },
  CAD: {
    symbolMatch: /CAD/i,
    headlineMatch: /\b(boc|bank of canada|macklem|canad(a|ian)?|loonie)\b/i,
  },
  AUD: {
    symbolMatch: /AUD/i,
    headlineMatch: /\b(rba|reserve bank of australia|australia(n)?|aussie)\b/i,
  },
};

export function matchesCurrency(row: BreakingHeadline, currency: CurrencyFilter): boolean {
  if (currency === "all") return true;
  const rule = RULES[currency];
  if (rule.sources?.includes(row.source_name)) return true;
  if (row.affected_symbols?.some(s => rule.symbolMatch.test(s))) return true;
  if (rule.headlineMatch.test(row.headline)) return true;
  return false;
}

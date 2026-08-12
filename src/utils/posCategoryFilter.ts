/** POS shelf categories — mirrors web pos-utils resolveCategory heuristics. */
const POS_CATEGORY_TERMS: Record<string, string[]> = {
  toys: ['toy', 'plush', 'bear', 'block'],
  figures: ['figure', 'hero', 'doll'],
  games: ['game', 'board'],
  vehicles: ['car', 'vehicle', 'rc', 'train'],
  puzzles: ['puzzle'],
  others: ['raw', 'pellet', 'dye', 'part'],
};

export function posCategoryMongoFilter(posCategory: string): Record<string, unknown> | null {
  const terms = POS_CATEGORY_TERMS[posCategory];
  if (!terms?.length) return null;

  const regexes = terms.map((term) => new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'));
  const orClauses = regexes.flatMap((regex) => ([
    { name: regex },
    { category: regex },
    { productType: regex },
  ]));

  return { $or: orClauses };
}

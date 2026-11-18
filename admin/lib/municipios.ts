/**
 * Municípios atendidos, na ordem do app. Espelho de `scripts/geo/municipios.json` do repositório
 * do app (Hiagomda/adota): ao incluir uma cidade lá, inclua aqui também. A API recusa código que
 * não conhece, então uma lista atrasada só esconde a cidade nova do filtro.
 */
export const municipios = [
  { code: '1501402', name: 'Belém' },
  { code: '1500800', name: 'Ananindeua' },
  { code: '1504422', name: 'Marituba' },
  { code: '1501501', name: 'Benevides' },
  { code: '1506351', name: 'Santa Bárbara do Pará' },
  { code: '1502400', name: 'Castanhal' },
  { code: '1501303', name: 'Barcarena' },
] as const;

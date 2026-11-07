/**
 * Calculation and comparison helpers for Major Fit and Overall Fit (Phù hợp tổng thể)
 */

export function computeEffectiveFits({
  fit,
  recommendation,
  recommendationConfig,
  radarMode = 'all',
  hasActiveSim = false,
}) {
  const activeFitPct = radarMode === 'all' ? (fit?.allFitPct ?? fit?.fitPct ?? null) : (fit?.fitPct ?? null)
  const effectiveHocLucFit = hasActiveSim || radarMode === 'all'
    ? (activeFitPct ?? recommendation?.hocLucFit ?? null)
    : (recommendation?.hocLucFit ?? (activeFitPct !== null ? activeFitPct : null))

  const effectiveTongHopFit = (effectiveHocLucFit !== null && recommendation?.tinhCachFit !== null && recommendation?.tinhCachFit !== undefined)
    ? Math.round(((recommendationConfig?.w_hoc_luc ?? 0.6) * effectiveHocLucFit + (recommendationConfig?.w_tinh_cach ?? 0.4) * recommendation.tinhCachFit) * 10) / 10
    : (recommendation?.tongHopFit ?? null)

  const hasTongHop = effectiveTongHopFit !== null && effectiveTongHopFit !== undefined
  const displayFitPct = hasTongHop ? effectiveTongHopFit : activeFitPct
  const displayFitLabel = hasTongHop ? 'Phù hợp tổng thể' : (radarMode === 'all' ? 'Phù hợp học lực (toàn diện)' : 'Phù hợp học lực')

  return {
    activeFitPct,
    effectiveHocLucFit,
    effectiveTongHopFit,
    hasTongHop,
    displayFitPct,
    displayFitLabel,
  }
}

export function compareMajorsByFit(a, b, context = {}) {
  const aRec = context.recommendations?.get
    ? context.recommendations.get(String(a.rubricId))
    : context.recommendations?.[String(a.rubricId)]

  const bRec = context.recommendations?.get
    ? context.recommendations.get(String(b.rubricId))
    : context.recommendations?.[String(b.rubricId)]

  const aEff = computeEffectiveFits({
    fit: a,
    recommendation: aRec,
    recommendationConfig: context.recommendationConfig,
    radarMode: context.radarMode,
    hasActiveSim: context.hasActiveSim,
  })
  const bEff = computeEffectiveFits({
    fit: b,
    recommendation: bRec,
    recommendationConfig: context.recommendationConfig,
    radarMode: context.radarMode,
    hasActiveSim: context.hasActiveSim,
  })

  const aFit = aEff.displayFitPct
  const bFit = bEff.displayFitPct

  if (aFit !== null && bFit === null) return -1
  if (aFit === null && bFit !== null) return 1
  if (aFit !== null && bFit !== null && bFit !== aFit) {
    return bFit - aFit
  }
  return (Number(b.entryScore) || 0) - (Number(a.entryScore) || 0) || String(a.majorName || '').localeCompare(String(b.majorName || ''), 'vi')
}

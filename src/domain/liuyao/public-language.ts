const INTERNAL_LIUYAO_LANGUAGE = /(?:事实键|liuyao\s*:|证据包|规则版本|ownerFactKeys|focusCandidates|counterEvidence|timingFacts|limitationFacts|grounding|candidate\s*:|schemaVersion|rulesetVersion)/iu;

const EVIDENCE_MARKER = /[\[［]\s*(?:事实键\s*[:：]\s*)?(?:本卦|伏神|liuyao)[^\]］\r\n]*[\]］]/giu;

export function containsInternalLiuyaoLanguage(text: string): boolean {
  return INTERNAL_LIUYAO_LANGUAGE.test(text.normalize('NFKC'));
}

export function stripEvidenceMarkers(text: string): string {
  return text
    .replace(EVIDENCE_MARKER, '')
    .replace(/[ \t]{2,}/gu, ' ')
    .replace(/\s+([，。；：！？])/gu, '$1')
    .trim();
}

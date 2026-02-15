import { Injectable } from '@angular/core';
import { buildWordOverlayTokens, collapseOverlayRuns, DisplayToken } from '../helpers/answer-diff';
import { normalizeForCheck } from '../helpers/normalize';

export interface AnswerCheckResult {
  isCorrect: boolean;
  displayTokens: DisplayToken[];
  bestExpectedVariant: string;
}

@Injectable({ providedIn: 'root' })
export class AnswerCheckService {
  /**
   * Checks the user's answer against the expected markup and returns
   * the result including correctness and display tokens for overlay.
   */
  checkAnswer(answerRaw: string, expectedMarkupRaw: string, fallbackPlain: string): AnswerCheckResult {
    const answer = (answerRaw ?? '').trim();
    const expectedMarkup = expectedMarkupRaw.trim();

    const expectedVariants = this.buildExpectedVariants(expectedMarkup, fallbackPlain);
    const bestExpectedVariant = this.pickBestExpectedVariant(expectedVariants, answer);

    const overlayTokens = buildWordOverlayTokens(bestExpectedVariant.trim(), answer);
    const displayTokens = collapseOverlayRuns(overlayTokens);

    const answerNormalized = normalizeForCheck(answer);

    const isCorrect = expectedVariants.some((expectedText) => {
      const expectedNormalized = normalizeForCheck(expectedText);
      return expectedNormalized === answerNormalized;
    });

    return {
      isCorrect,
      displayTokens,
      bestExpectedVariant,
    };
  }

  /**
   * Builds all expected answer variants from markup with [...] alternatives.
   */
  buildExpectedVariants(expectedMarkupRaw: string, fallbackPlain: string): string[] {
    if (!expectedMarkupRaw) {
      const trimmedFallback = fallbackPlain.trim();
      return trimmedFallback ? [trimmedFallback] : [''];
    }

    const maxVariants = 32;

    // 1) expand [...] alternatives
    const expandedWithAnnotations = expandBracketAlternatives(expectedMarkupRaw, maxVariants);

    // 2) strip {surface|#id} -> surface (and also {surface})
    const stripped = expandedWithAnnotations
      .map((variant) => stripAnnotationBraces(variant))
      .map((variant) => variant.trim())
      .filter((variant) => variant.length > 0);

    // Fallback if something went wrong
    if (stripped.length === 0) {
      const trimmedFallback = fallbackPlain.trim();
      if (trimmedFallback) {
        return [trimmedFallback];
      }
      return [stripAnnotationBraces(expectedMarkupRaw).trim()];
    }

    // Deduplicate while preserving order
    const seen = new Set<string>();
    const unique: string[] = [];

    for (const variant of stripped) {
      if (!seen.has(variant)) {
        seen.add(variant);
        unique.push(variant);
      }
    }

    return unique;
  }

  /**
   * Picks the expected variant that best matches the user's answer
   * (by longest common prefix) for optimal overlay display.
   */
  pickBestExpectedVariant(expectedVariants: string[], answerRaw: string): string {
    if (!expectedVariants.length) {
      return '';
    }

    const answerNormalized = normalizeForCheck(answerRaw);

    let bestVariant = expectedVariants[0];
    let bestScore = -1;

    for (const candidateVariant of expectedVariants) {
      const candidateNormalized = normalizeForCheck(candidateVariant);
      const score = commonPrefixLength(candidateNormalized, answerNormalized);

      if (score > bestScore) {
        bestScore = score;
        bestVariant = candidateVariant;
      }
    }

    return bestVariant;
  }
}

// =========================================================
// Helper functions for expanding [...] alternatives & stripping {surface|#id}
// =========================================================

function stripAnnotationBraces(text: string): string {
  // {surface|#123} -> surface
  // {surface}      -> surface
  return text.replace(/\{([^}|]+)(?:\|#[0-9]+)?}/g, '$1');
}

function expandBracketAlternatives(text: string, maxVariants: number): string[] {
  const chunks = buildChunksFromMarkup(text);
  let variants: string[] = [''];

  for (const chunk of chunks) {
    const options = Array.isArray(chunk) ? chunk : [chunk];
    const nextVariants: string[] = [];

    for (const prefix of variants) {
      for (const option of options) {
        nextVariants.push(prefix + option);

        if (nextVariants.length >= maxVariants) {
          break;
        }
      }

      if (nextVariants.length >= maxVariants) {
        break;
      }
    }

    variants = nextVariants;

    if (variants.length >= maxVariants) {
      break;
    }
  }

  return variants;
}

function buildChunksFromMarkup(text: string): Array<string | string[]> {
  const chunks: Array<string | string[]> = [];
  let cursor = 0;

  while (cursor < text.length) {
    const bracketStart = text.indexOf('[', cursor);

    if (bracketStart === -1) {
      chunks.push(text.slice(cursor));
      break;
    }

    if (bracketStart > cursor) {
      chunks.push(text.slice(cursor, bracketStart));
    }

    const bracketEnd = findMatchingBracket(text, bracketStart);
    if (bracketEnd === -1) {
      // unbalanced; treat rest as plain text
      chunks.push(text.slice(bracketStart));
      break;
    }

    const inner = text.slice(bracketStart + 1, bracketEnd);
    const options = splitTopLevelPipes(inner);

    chunks.push(options);

    cursor = bracketEnd + 1;
  }

  return chunks;
}

function findMatchingBracket(text: string, openIndex: number): number {
  let bracketDepth = 0;
  let curlyDepth = 0;

  for (let index = openIndex; index < text.length; index += 1) {
    const char = text[index];

    if (char === '{') {
      curlyDepth += 1;
    } else if (char === '}') {
      curlyDepth = Math.max(0, curlyDepth - 1);
    }

    if (curlyDepth > 0) {
      continue;
    }

    if (char === '[') {
      bracketDepth += 1;
      continue;
    }

    if (char === ']') {
      bracketDepth -= 1;
      if (bracketDepth === 0) {
        return index;
      }
    }
  }

  return -1;
}

function splitTopLevelPipes(text: string): string[] {
  const parts: string[] = [];

  let current = '';
  let curlyDepth = 0;
  let bracketDepth = 0;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];

    if (char === '{') {
      curlyDepth += 1;
      current += char;
      continue;
    }

    if (char === '}') {
      curlyDepth = Math.max(0, curlyDepth - 1);
      current += char;
      continue;
    }

    if (char === '[') {
      bracketDepth += 1;
      current += char;
      continue;
    }

    if (char === ']') {
      bracketDepth = Math.max(0, bracketDepth - 1);
      current += char;
      continue;
    }

    const isTopLevelPipe = char === '|' && curlyDepth === 0 && bracketDepth === 0;

    if (isTopLevelPipe) {
      parts.push(current);
      current = '';
      continue;
    }

    current += char;
  }

  parts.push(current);

  return parts;
}

function commonPrefixLength(left: string, right: string): number {
  const max = Math.min(left.length, right.length);
  let index = 0;

  while (index < max) {
    if (left[index] !== right[index]) {
      break;
    }
    index += 1;
  }

  return index;
}


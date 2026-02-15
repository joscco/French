import { AnswerCheckService } from './answer-check.service';

describe('AnswerCheckService', () => {
  let service: AnswerCheckService;

  beforeEach(() => {
    service = new AnswerCheckService();
  });

  // =========================================================
  // checkAnswer()
  // =========================================================

  describe('checkAnswer', () => {
    it('should mark exact match as correct', () => {
      const result = service.checkAnswer('Bonjour', 'Bonjour', 'Bonjour');

      expect(result.isCorrect).toBe(true);
    });

    it('should mark case-insensitive match as correct', () => {
      const result = service.checkAnswer('bonjour', 'Bonjour', 'Bonjour');

      expect(result.isCorrect).toBe(true);
    });

    it('should mark wrong answer as incorrect', () => {
      const result = service.checkAnswer('Salut', 'Bonjour', 'Bonjour');

      expect(result.isCorrect).toBe(false);
    });

    it('should strip annotation braces when checking', () => {
      const result = service.checkAnswer(
        'Je mange une pomme',
        '{Je|#1} {mange|#2} {une|#3} {pomme|#4}',
        'Je mange une pomme'
      );

      expect(result.isCorrect).toBe(true);
    });

    it('should accept any alternative in [...] markup', () => {
      const markup = "C'est [mon|ma] [ami|amie]";

      expect(service.checkAnswer("C'est mon ami", markup, '').isCorrect).toBe(true);
      expect(service.checkAnswer("C'est mon amie", markup, '').isCorrect).toBe(true);
      expect(service.checkAnswer("C'est ma ami", markup, '').isCorrect).toBe(true);
      expect(service.checkAnswer("C'est ma amie", markup, '').isCorrect).toBe(true);
    });

    it('should return display tokens for overlay', () => {
      const result = service.checkAnswer('Bonjoure', 'Bonjour', 'Bonjour');

      expect(result.displayTokens).toBeDefined();
      expect(result.displayTokens.length).toBeGreaterThan(0);
    });

    it('should return the best expected variant', () => {
      const result = service.checkAnswer('Bonjour', 'Bonjour', 'Bonjour');

      expect(result.bestExpectedVariant).toBe('Bonjour');
    });

    it('should use fallback when markup is empty', () => {
      const result = service.checkAnswer('Fallback', '', 'Fallback');

      expect(result.isCorrect).toBe(true);
    });

    it('should ignore leading/trailing whitespace in answer', () => {
      const result = service.checkAnswer('  Bonjour  ', 'Bonjour', 'Bonjour');

      expect(result.isCorrect).toBe(true);
    });
  });

  // =========================================================
  // buildExpectedVariants()
  // =========================================================

  describe('buildExpectedVariants', () => {
    it('should return single variant for plain text', () => {
      const variants = service.buildExpectedVariants('Bonjour', '');

      expect(variants).toEqual(['Bonjour']);
    });

    it('should expand single [...] alternatives', () => {
      const variants = service.buildExpectedVariants('[le|la] maison', '');

      expect(variants).toContain('le maison');
      expect(variants).toContain('la maison');
      expect(variants.length).toBe(2);
    });

    it('should expand multiple [...] alternatives (cartesian product)', () => {
      const variants = service.buildExpectedVariants('[le|la] [chat|chien]', '');

      expect(variants).toContain('le chat');
      expect(variants).toContain('le chien');
      expect(variants).toContain('la chat');
      expect(variants).toContain('la chien');
      expect(variants.length).toBe(4);
    });

    it('should strip {surface|#id} annotations', () => {
      const variants = service.buildExpectedVariants('{Je|#1} {mange|#2}', '');

      expect(variants).toEqual(['Je mange']);
    });

    it('should strip {surface} annotations without id', () => {
      const variants = service.buildExpectedVariants('{Bonjour}', '');

      expect(variants).toEqual(['Bonjour']);
    });

    it('should handle combined [...] and {surface|#id}', () => {
      const variants = service.buildExpectedVariants(
        '{Je|#1} [mange|bois] {du|#3} [café|thé]',
        ''
      );

      expect(variants).toContain('Je mange du café');
      expect(variants).toContain('Je mange du thé');
      expect(variants).toContain('Je bois du café');
      expect(variants).toContain('Je bois du thé');
      expect(variants.length).toBe(4);
    });

    it('should deduplicate identical variants', () => {
      const variants = service.buildExpectedVariants('[a|a] test', '');

      expect(variants).toEqual(['a test']);
    });

    it('should use fallback when markup is empty', () => {
      const variants = service.buildExpectedVariants('', 'Fallback text');

      expect(variants).toEqual(['Fallback text']);
    });

    it('should return empty string array when both are empty', () => {
      const variants = service.buildExpectedVariants('', '');

      expect(variants).toEqual(['']);
    });

    it('should limit variants to maxVariants (32)', () => {
      // 2^6 = 64 combinations, should be capped at 32
      const markup = '[a|b] [a|b] [a|b] [a|b] [a|b] [a|b]';
      const variants = service.buildExpectedVariants(markup, '');

      expect(variants.length).toBeLessThanOrEqual(32);
    });

    it('should handle nested brackets correctly', () => {
      // Nested alternatives are not supported, inner brackets treated as text
      const variants = service.buildExpectedVariants('[[a|b]|c]', '');

      expect(variants.length).toBeGreaterThan(0);
    });

    it('should handle empty alternatives', () => {
      const variants = service.buildExpectedVariants('test[|s]', '');

      expect(variants).toContain('test');
      expect(variants).toContain('tests');
    });
  });

  // =========================================================
  // pickBestExpectedVariant()
  // =========================================================

  describe('pickBestExpectedVariant', () => {
    it('should return first variant when answer is empty', () => {
      const variants = ['Bonjour', 'Salut'];
      const best = service.pickBestExpectedVariant(variants, '');

      expect(best).toBe('Bonjour');
    });

    it('should return empty string for empty variants array', () => {
      const best = service.pickBestExpectedVariant([], 'test');

      expect(best).toBe('');
    });

    it('should pick variant with longest common prefix', () => {
      const variants = ['le chat', 'la chatte', 'le chien'];
      const best = service.pickBestExpectedVariant(variants, 'la chat');

      expect(best).toBe('la chatte');
    });

    it('should pick exact match when available', () => {
      const variants = ['Bonjour', 'Bonsoir', 'Bonne nuit'];
      const best = service.pickBestExpectedVariant(variants, 'Bonsoir');

      expect(best).toBe('Bonsoir');
    });

    it('should be case-insensitive when comparing', () => {
      const variants = ['BONJOUR', 'Salut'];
      const best = service.pickBestExpectedVariant(variants, 'bonjour');

      expect(best).toBe('BONJOUR');
    });

    it('should return first variant when no prefix matches', () => {
      const variants = ['abc', 'def', 'ghi'];
      const best = service.pickBestExpectedVariant(variants, 'xyz');

      expect(best).toBe('abc');
    });
  });

  // =========================================================
  // Edge cases and complex scenarios
  // =========================================================

  describe('edge cases', () => {
    it('should handle French apostrophes correctly', () => {
      const result = service.checkAnswer(
        "C'est l'heure",
        "{C'est|#1} {l'heure|#2}",
        "C'est l'heure"
      );

      expect(result.isCorrect).toBe(true);
    });

    it('should handle accented characters', () => {
      const result = service.checkAnswer(
        'Je suis allé à la boulangerie',
        'Je suis allé à la boulangerie',
        ''
      );

      expect(result.isCorrect).toBe(true);
    });

    it('should handle punctuation in markup', () => {
      const result = service.checkAnswer(
        'Bonjour, comment allez-vous?',
        '{Bonjour|#1}, {comment|#2} {allez-vous|#3}?',
        ''
      );

      expect(result.isCorrect).toBe(true);
    });

    it('should handle pipes inside curly braces (term id separator)', () => {
      const variants = service.buildExpectedVariants(
        '{surface|#123} test',
        ''
      );

      expect(variants).toEqual(['surface test']);
    });

    it('should handle multiple words in alternatives', () => {
      const variants = service.buildExpectedVariants(
        "[Je suis|Nous sommes] contents",
        ''
      );

      expect(variants).toContain('Je suis contents');
      expect(variants).toContain('Nous sommes contents');
    });

    it('should handle unbalanced brackets gracefully', () => {
      const variants = service.buildExpectedVariants('[unbalanced', '');

      // Should not crash, treat as plain text
      expect(variants.length).toBeGreaterThan(0);
    });
  });
});


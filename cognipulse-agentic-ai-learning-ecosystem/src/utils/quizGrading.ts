/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { QuizQuestion, QuizOption, ErrorType } from '../types';

export interface QuizGradingResult {
  isCorrect: boolean;
  isValidKey: boolean;
  errorType: ErrorType | 'none' | 'invalid_key' | 'unanswered';
  diagnosis: string;
  counterExample?: string;
  remediationTip?: string;
  correctAnswer: string;
  correctOptionId?: string;
  explanation: string;
}

/**
 * Normalizes text for reliable answer comparison:
 * - Trims whitespace and collapses multiple whitespace/tabs/newlines to single space
 * - Lowercases strings
 * - Strips leading option labels (e.g. "A) ", "B. ", "(c) ", "D: ")
 * - Normalizes harmless punctuation like surrounding quotes or trailing periods
 * - Preserves semantic differences (e.g. "O(log N)" vs "O(N)", "True" vs "False")
 */
export function normalizeAnswer(text: string | null | undefined): string {
  if (text == null) return '';
  let str = String(text).trim();

  // Strip leading option prefix like "A)", "B.", "(C)", "[D]", "A: ", "a - "
  str = str.replace(/^[\(\[]?[A-Da-d][\)\]\.\:\-]\s*/, '');

  // Strip surrounding quotes
  str = str.replace(/^["'`]|["'`]$/g, '');

  // Strip trailing period if harmless
  str = str.replace(/\.$/, '');

  // Normalize unicode quotes and dashes
  str = str.replace(/[\u2018\u2019]/g, "'");
  str = str.replace(/[\u201C\u201D]/g, '"');
  str = str.replace(/[\u2013\u2014]/g, '-');

  // Collapse multiple whitespaces
  str = str.replace(/\s+/g, ' ').trim();

  return str.toLowerCase();
}

/**
 * Strips leading option prefix from display text while preserving original casing.
 */
export function stripOptionPrefix(text: string | null | undefined): string {
  if (!text) return '';
  return String(text)
    .trim()
    .replace(/^[\(\[]?[A-Da-d][\)\]\.\:\-]\s*/, '')
    .trim();
}

/**
 * Validates and normalizes a QuizQuestion object.
 * Guarantees consistent optionItems, options, correctAnswer, and correctOptionId.
 * Sets isValidKey = false if the answer key is missing or invalid.
 * NEVER silently guesses a missing answer key.
 */
export function validateAndNormalizeQuestion(rawQ: any, index: number = 0): QuizQuestion & { isValidKey: boolean } {
  const qType: 'mcq' | 'boolean' | 'short_answer' =
    rawQ.type === 'boolean' || rawQ.type === 'short_answer' ? rawQ.type : 'mcq';

  const prompt = String(rawQ.prompt || '').trim();
  const explanation = String(rawQ.explanation || 'Demonstrates accurate conceptual mastery.').trim();
  const commonMisconception = rawQ.commonMisconception ? String(rawQ.commonMisconception).trim() : undefined;
  const counterExample = rawQ.counterExample ? String(rawQ.counterExample).trim() : undefined;
  const remediationTip = rawQ.remediationTip ? String(rawQ.remediationTip).trim() : undefined;
  const bloomTaxonomy = rawQ.bloomTaxonomy ? String(rawQ.bloomTaxonomy).trim() : 'Apply';
  const id = rawQ.id ? String(rawQ.id) : `q_${index + 1}`;

  // 1. Short answer questions
  if (qType === 'short_answer') {
    const rawCorrect = rawQ.correctAnswer != null ? String(rawQ.correctAnswer).trim() : '';
    const isValidKey = rawCorrect.length > 0;
    return {
      id,
      type: 'short_answer',
      prompt,
      correctAnswer: rawCorrect,
      explanation,
      commonMisconception,
      counterExample,
      remediationTip,
      bloomTaxonomy,
      isValidKey,
    };
  }

  // 2. Boolean questions
  if (qType === 'boolean') {
    const rawCorrect = rawQ.correctAnswer != null ? String(rawQ.correctAnswer).trim() : '';
    const rawCorrectId = rawQ.correctOptionId != null ? String(rawQ.correctOptionId).trim().toLowerCase() : '';

    let resolvedId: 'true' | 'false' | null = null;
    let resolvedText: 'True' | 'False' | null = null;

    if (rawCorrectId === 'true' || rawCorrectId === 'false') {
      resolvedId = rawCorrectId;
      resolvedText = rawCorrectId === 'true' ? 'True' : 'False';
    } else if (rawCorrect.toLowerCase() === 'true' || rawCorrect.toLowerCase() === 't') {
      resolvedId = 'true';
      resolvedText = 'True';
    } else if (rawCorrect.toLowerCase() === 'false' || rawCorrect.toLowerCase() === 'f') {
      resolvedId = 'false';
      resolvedText = 'False';
    }

    const isValidKey = resolvedId !== null;

    const optionItems: QuizOption[] = [
      { id: 'true', text: 'True' },
      { id: 'false', text: 'False' },
    ];

    return {
      id,
      type: 'boolean',
      prompt,
      options: ['True', 'False'],
      optionItems,
      correctOptionId: resolvedId || undefined,
      correctAnswer: resolvedText || '',
      explanation,
      commonMisconception,
      counterExample,
      remediationTip,
      bloomTaxonomy,
      isValidKey,
    };
  }

  // 3. Multiple Choice Questions (mcq)
  // Build normalized optionItems
  let rawOptions: any[] = [];
  if (Array.isArray(rawQ.optionItems) && rawQ.optionItems.length >= 2) {
    rawOptions = rawQ.optionItems;
  } else if (Array.isArray(rawQ.options) && rawQ.options.length >= 2) {
    rawOptions = rawQ.options;
  }

  // If options array was omitted from a standalone evaluation request
  if (rawOptions.length === 0) {
    const rawCorrect = rawQ.correctAnswer != null ? String(rawQ.correctAnswer).trim() : '';
    const rawCorrectId = rawQ.correctOptionId != null ? String(rawQ.correctOptionId).trim() : '';
    const isValidKey = Boolean(rawCorrect || rawCorrectId);
    const cleanCorrect = stripOptionPrefix(rawCorrect);

    return {
      id,
      type: 'mcq',
      prompt,
      options: cleanCorrect ? [cleanCorrect] : [],
      optionItems: cleanCorrect ? [{ id: rawCorrectId || 'A', text: cleanCorrect }] : [],
      correctOptionId: rawCorrectId || undefined,
      correctAnswer: cleanCorrect,
      explanation,
      commonMisconception,
      counterExample,
      remediationTip,
      bloomTaxonomy,
      isValidKey,
    };
  }

  const letters = ['A', 'B', 'C', 'D', 'E', 'F'];
  const optionItems: QuizOption[] = [];

  for (let i = 0; i < rawOptions.length; i++) {
    const opt = rawOptions[i];
    let optId = '';
    let optText = '';

    if (typeof opt === 'object' && opt !== null) {
      optId = opt.id != null ? String(opt.id).trim() : letters[i] || `opt_${i + 1}`;
      optText = stripOptionPrefix(opt.text != null ? String(opt.text) : '');
    } else {
      optId = letters[i] || `opt_${i + 1}`;
      optText = stripOptionPrefix(String(opt));
    }

    optionItems.push({
      id: optId,
      text: optText,
    });
  }

  // Answer key validation
  const rawCorrect = rawQ.correctAnswer != null ? String(rawQ.correctAnswer).trim() : '';
  const rawCorrectId = rawQ.correctOptionId != null ? String(rawQ.correctOptionId).trim() : '';
  const normalizedCorrectAnswer = normalizeAnswer(rawCorrect);

  let matchedOption: QuizOption | null = null;

  // Check 1: Does rawCorrectId match an option's ID?
  if (rawCorrectId) {
    const foundById = optionItems.find(
      (o) => o.id.toLowerCase() === rawCorrectId.toLowerCase()
    );
    if (foundById) {
      matchedOption = foundById;
    }
  }

  // Check 2: Does rawCorrect match an option's normalized text?
  if (!matchedOption && normalizedCorrectAnswer) {
    const foundByText = optionItems.find(
      (o) => normalizeAnswer(o.text) === normalizedCorrectAnswer
    );
    if (foundByText) {
      matchedOption = foundByText;
    }
  }

  // Check 3: Does rawCorrect have an option prefix pointing to an ID (e.g. "A) ...")?
  if (!matchedOption && rawCorrect) {
    const letterPrefixMatch = rawCorrect.match(/^[\(\[]?([A-Da-d])[\)\]\.\:\-]/);
    if (letterPrefixMatch) {
      const letter = letterPrefixMatch[1].toUpperCase();
      const foundByLetter = optionItems.find((o) => o.id.toUpperCase() === letter);
      if (foundByLetter) {
        matchedOption = foundByLetter;
      }
    }
  }

  // Strict check: if no match found, do NOT guess. Mark isValidKey = false!
  const isValidKey = matchedOption !== null && optionItems.length >= 2;

  const finalCorrectOptionId = matchedOption ? matchedOption.id : undefined;
  const finalCorrectAnswer = matchedOption ? matchedOption.text : '';

  return {
    id,
    type: 'mcq',
    prompt,
    options: optionItems.map((o) => o.text),
    optionItems,
    correctOptionId: finalCorrectOptionId,
    correctAnswer: finalCorrectAnswer,
    explanation,
    commonMisconception,
    counterExample,
    remediationTip,
    bloomTaxonomy,
    isValidKey,
  };
}

/**
 * Pure evaluation function for a single question.
 * Evaluates studentAnswer & selectedOptionId against the validated question answer key.
 */
export function gradeQuizAnswer(
  question: QuizQuestion & { isValidKey?: boolean },
  studentAnswer: string | null | undefined,
  selectedOptionId?: string | null
): QuizGradingResult {
  const answer = studentAnswer != null ? String(studentAnswer).trim() : '';
  const optId = selectedOptionId != null ? String(selectedOptionId).trim() : undefined;

  // Rule 7 & Test requirement: Missing or invalid answer key → Never falsely mark an answer correct!
  if (question.isValidKey === false || !question.correctAnswer) {
    return {
      isCorrect: false,
      isValidKey: false,
      errorType: 'invalid_key',
      diagnosis: 'This question has an invalid or missing answer key and could not be scored.',
      correctAnswer: question.correctAnswer || '(Answer key unavailable)',
      correctOptionId: question.correctOptionId,
      explanation: question.explanation || '',
    };
  }

  // Unanswered check
  if (!answer && !optId) {
    return {
      isCorrect: false,
      isValidKey: true,
      errorType: 'unanswered',
      diagnosis: 'Question was unanswered.',
      correctAnswer: question.correctAnswer,
      correctOptionId: question.correctOptionId,
      explanation: question.explanation,
      remediationTip: question.remediationTip,
      counterExample: question.counterExample,
    };
  }

  // Objective evaluation (MCQ / Boolean)
  if (question.type === 'mcq' || question.type === 'boolean') {
    let isCorrect = false;

    // Priority 1: Match by stable option ID (immune to shuffling and display formatting)
    if (optId && question.correctOptionId) {
      if (optId.toLowerCase() === question.correctOptionId.toLowerCase()) {
        isCorrect = true;
      }
    }

    // Priority 2: Match by normalized option text
    if (!isCorrect && answer && question.correctAnswer) {
      const normStudent = normalizeAnswer(answer);
      const normCorrect = normalizeAnswer(question.correctAnswer);
      if (normStudent === normCorrect) {
        isCorrect = true;
      }
    }

    // Priority 3: Match if student answered with the option ID directly (e.g. "A" or "true")
    if (!isCorrect && answer && question.correctOptionId) {
      if (answer.toLowerCase() === question.correctOptionId.toLowerCase()) {
        isCorrect = true;
      }
    }

    if (isCorrect) {
      return {
        isCorrect: true,
        isValidKey: true,
        errorType: 'none',
        diagnosis: `Correct! ${question.explanation || 'You demonstrated accurate conceptual mastery.'}`,
        correctAnswer: question.correctAnswer,
        correctOptionId: question.correctOptionId,
        explanation: question.explanation,
        remediationTip: 'Keep up the strong retention!',
      };
    }

    // Incorrect objective answer
    return {
      isCorrect: false,
      isValidKey: true,
      errorType: 'deep_misconception',
      diagnosis: `You selected "${answer || optId}", but the correct answer is "${question.correctAnswer}". ${
        question.commonMisconception ? `Typical pitfall: ${question.commonMisconception}` : ''
      }`.trim(),
      correctAnswer: question.correctAnswer,
      correctOptionId: question.correctOptionId,
      explanation: question.explanation,
      counterExample: question.counterExample,
      remediationTip: question.remediationTip || question.explanation,
    };
  }

  // Text-based evaluation (short_answer)
  // Requirement 4 & 6: Appropriate normalization, no loose substring matching
  const normStudent = normalizeAnswer(answer);
  const normCorrect = normalizeAnswer(question.correctAnswer);

  const isExactNormalizedMatch = normStudent.length > 0 && normStudent === normCorrect;

  if (isExactNormalizedMatch) {
    return {
      isCorrect: true,
      isValidKey: true,
      errorType: 'none',
      diagnosis: `Correct! ${question.explanation || 'Accurate conceptual explanation.'}`,
      correctAnswer: question.correctAnswer,
      explanation: question.explanation,
    };
  }

  // If not exact normalized match, check if it's genuinely incorrect or requires semantic evaluation
  return {
    isCorrect: false,
    isValidKey: true,
    errorType: 'knowledge_gap',
    diagnosis: `Expected model response: "${question.correctAnswer}".`,
    correctAnswer: question.correctAnswer,
    explanation: question.explanation,
    counterExample: question.counterExample,
    remediationTip: question.remediationTip || question.explanation,
  };
}

/**
 * Calculates quiz score deterministically from the validated answer keys.
 * Ensures each question is scored once and only once.
 */
export function calculateQuizScore(
  questions: (QuizQuestion & { isValidKey?: boolean })[],
  submissions: Record<string, { studentAnswer: string; selectedOptionId?: string }>
): {
  score: number;
  total: number;
  percentage: number;
  results: Record<string, QuizGradingResult>;
} {
  const results: Record<string, QuizGradingResult> = {};
  let score = 0;

  for (const q of questions) {
    const submission = submissions[q.id];
    const studentAnswer = submission ? submission.studentAnswer : '';
    const selectedOptionId = submission ? submission.selectedOptionId : undefined;

    const result = gradeQuizAnswer(q, studentAnswer, selectedOptionId);
    results[q.id] = result;

    if (result.isCorrect) {
      score += 1;
    }
  }

  const total = questions.length;
  const percentage = total > 0 ? Math.round((score / total) * 100) : 0;

  return {
    score,
    total,
    percentage,
    results,
  };
}

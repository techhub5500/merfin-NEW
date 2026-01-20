/**
 * NOTE (memory-validator.js):
 * Purpose: Universal validation for all memory types ensuring safety and compliance.
 * Controls: Validates against hard rules (forbidden content), checks scope appropriateness,
 * enforces word budgets, validates minimum impact scores for LTM.
 * Integration notes: Called before storing any memory to ensure data safety and quality.
 */

const { containsForbiddenContent, isSuitableForLTM } = require('./hard-rules');
const { count, isNearLimit } = require('./word-counter');
const { MEMORY_SCOPES, MEMORY_BUDGETS, IMPACT_THRESHOLDS } = require('./memory-types');

/**
 * Validation result structure
 * @typedef {Object} ValidationResult
 * @property {boolean} valid - Whether validation passed
 * @property {string[]} errors - Array of error messages
 * @property {string[]} warnings - Array of warning messages
 */

/**
 * Check if memory contains forbidden content (sensitive data)
 * @param {*} memory - Memory content to validate
 * @returns {ValidationResult}
 */
function checkHardRules(memory) {
  const errors = [];
  const warnings = [];
  
  if (!memory) {
    errors.push('Memory content is null or undefined');
    return { valid: false, errors, warnings };
  }
  
  // Convert to string for pattern matching
  const contentStr = typeof memory === 'string' ? memory : JSON.stringify(memory);
  
  const forbidden = containsForbiddenContent(contentStr);
  if (forbidden.found) {
    errors.push(`Memory contains forbidden content: ${forbidden.type}`);
    return { valid: false, errors, warnings };
  }
  
  return { valid: true, errors, warnings };
}

/**
 * Validate if memory is appropriate for the intended scope
 * @param {*} memory - Memory content
 * @param {string} intendedScope - MEMORY_SCOPES value
 * @returns {ValidationResult}
 */
function checkScope(memory, intendedScope) {
  const errors = [];
  const warnings = [];
  
  if (!Object.values(MEMORY_SCOPES).includes(intendedScope)) {
    errors.push(`Invalid memory scope: ${intendedScope}`);
    return { valid: false, errors, warnings };
  }
  
  // Long-term memory has additional restrictions
  if (intendedScope === MEMORY_SCOPES.LONG_TERM) {
    const contentStr = typeof memory === 'string' ? memory : JSON.stringify(memory);
    
    if (!isSuitableForLTM(contentStr)) {
      errors.push('Content not suitable for long-term memory (too ephemeral or temporary)');
      return { valid: false, errors, warnings };
    }
  }
  
  return { valid: true, errors, warnings };
}

/**
 * Check if adding new content would exceed budget
 * @param {*} currentMemory - Current memory content
 * @param {*} newContent - New content to add
 * @param {number} limit - Word limit for this memory type
 * @returns {ValidationResult}
 */
function checkBudget(currentMemory, newContent, limit) {
  const errors = [];
  const warnings = [];
  
  if (limit === Infinity) {
    return { valid: true, errors, warnings };
  }
  
  const currentCount = count(currentMemory);
  const newCount = count(newContent);
  const totalCount = currentCount + newCount;
  
  if (totalCount > limit) {
    errors.push(`Memory budget exceeded: ${totalCount} words (limit: ${limit})`);
    return { valid: false, errors, warnings };
  }
  
  if (isNearLimit(totalCount, limit, IMPACT_THRESHOLDS.COMPRESSION_TRIGGER)) {
    warnings.push(`Memory approaching limit: ${totalCount}/${limit} words (${Math.round((totalCount/limit)*100)}%)`);
  }
  
  return { valid: true, errors, warnings };
}

/**
 * Validate minimum impact score for long-term memory
 * @param {object} memory - Memory object with impact_score
 * @param {number} minScore - Minimum required score (default: IMPACT_THRESHOLDS.MIN_FOR_LTM)
 * @returns {ValidationResult}
 */
function checkImpact(memory, minScore = IMPACT_THRESHOLDS.MIN_FOR_LTM) {
  const errors = [];
  const warnings = [];
  
  if (!memory || typeof memory !== 'object') {
    errors.push('Memory must be an object with impact_score property');
    return { valid: false, errors, warnings };
  }
  
  const score = memory.impact_score;
  
  if (typeof score !== 'number' || score < 0 || score > 1) {
    errors.push(`Invalid impact_score: ${score} (must be 0.0 to 1.0)`);
    return { valid: false, errors, warnings };
  }
  
  if (score < minScore) {
    errors.push(`Impact score too low: ${score} (minimum: ${minScore})`);
    return { valid: false, errors, warnings };
  }
  
  if (score < IMPACT_THRESHOLDS.MIN_TO_KEEP) {
    warnings.push(`Impact score is below general threshold: ${score}`);
  }
  
  return { valid: true, errors, warnings };
}

/**
 * Comprehensive validation for a memory before storage
 * @param {*} memory - Memory content
 * @param {object} options - Validation options
 * @param {string} options.scope - Memory scope (working, episodic, long_term)
 * @param {*} options.currentMemory - Existing memory content (for budget check)
 * @param {number} options.minImpact - Minimum impact score (for LTM)
 * @returns {ValidationResult}
 */
function validateMemory(memory, options = {}) {
  const { scope, currentMemory = null, minImpact } = options;
  
  const allErrors = [];
  const allWarnings = [];
  
  // Check hard rules (always)
  const hardRulesResult = checkHardRules(memory);
  allErrors.push(...hardRulesResult.errors);
  allWarnings.push(...hardRulesResult.warnings);
  
  if (!hardRulesResult.valid) {
    return { valid: false, errors: allErrors, warnings: allWarnings };
  }
  
  // Check scope if provided
  if (scope) {
    const scopeResult = checkScope(memory, scope);
    allErrors.push(...scopeResult.errors);
    allWarnings.push(...scopeResult.warnings);
    
    if (!scopeResult.valid) {
      return { valid: false, errors: allErrors, warnings: allWarnings };
    }
    
    // Check budget for the scope
    const limit = MEMORY_BUDGETS[scope.toUpperCase()] || Infinity;
    const budgetResult = checkBudget(currentMemory, memory, limit);
    allErrors.push(...budgetResult.errors);
    allWarnings.push(...budgetResult.warnings);
    
    if (!budgetResult.valid) {
      return { valid: false, errors: allErrors, warnings: allWarnings };
    }
  }
  
  // Check impact for long-term memory
  if (scope === MEMORY_SCOPES.LONG_TERM && minImpact !== undefined) {
    const impactResult = checkImpact(memory, minImpact);
    allErrors.push(...impactResult.errors);
    allWarnings.push(...impactResult.warnings);
    
    if (!impactResult.valid) {
      return { valid: false, errors: allErrors, warnings: allWarnings };
    }
  }
  
  return { valid: true, errors: allErrors, warnings: allWarnings };
}

module.exports = {
  checkHardRules,
  checkScope,
  checkBudget,
  checkImpact,
  validateMemory
};

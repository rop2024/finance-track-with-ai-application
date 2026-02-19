const mongoose = require('mongoose');
const User = require('../../models/User');
const NotificationService = require('./notification.service');

class ApprovalHandler {
  constructor() {
    this.notifier = NotificationService;
    this.approvalRules = {
      autoApproveThreshold: 50, // Auto-approve if impact < $50
      requireConfirmationThreshold: 500, // Require confirmation if impact > $500
      highRiskTypes: ['subscription_cancellation', 'goal_adjustment'],
      mfaRequiredTypes: ['subscription_cancellation'],
      cooldownPeriods: {
        budget_adjustment: 7, // days
        savings_increase: 14,
        subscription_cancellation: 30
      }
    };
  }

  /**
   * Process suggestion approval
   */
  async processApproval(suggestion, userId, options = {}, session = null) {
    const result = {
      requiresConfirmation: false,
      requiresMFA: false,
      warnings: [],
      nextSteps: []
    };

    // Check if auto-approvable
    if (this.canAutoApprove(suggestion)) {
      result.autoApproved = true;
      result.nextSteps.push('Will be applied automatically');
      return result;
    }

    // Check if requires confirmation
    if (this.requiresConfirmation(suggestion)) {
      result.requiresConfirmation = true;
      result.warnings.push('This suggestion requires your confirmation');
    }

    // Check if requires MFA
    if (await this.requiresMFA(suggestion, userId)) {
      result.requiresMFA = true;
      result.warnings.push('Multi-factor authentication required for this action');
    }

    // Check cooldown
    const cooldownCheck = await this.checkCooldown(suggestion, userId);
    if (!cooldownCheck.allowed) {
      throw new Error(`Cooldown period active. Try again in ${cooldownCheck.daysRemaining} days`);
    }

    // Check for similar pending suggestions
    const similarCheck = await this.checkSimilarPending(suggestion, userId);
    if (similarCheck.hasSimilar) {
      result.warnings.push(`Similar suggestion already pending: ${similarCheck.existing.title}`);
      result.nextSteps.push('Consider reviewing existing suggestion first');
    }

    // Validate impact
    const impactCheck = this.validateImpact(suggestion);
    if (!impactCheck.valid) {
      throw new Error(`Invalid impact: ${impactCheck.reason}`);
    }

    return result;
  }

  /**
   * Check if suggestion can be auto-approved
   */
  canAutoApprove(suggestion) {
    // Don't auto-approve high risk types
    if (this.approvalRules.highRiskTypes.includes(suggestion.type)) {
      return false;
    }

    // Check impact amount
    const impact = Math.abs(suggestion.estimatedImpact?.amount || 0);
    if (impact > this.approvalRules.autoApproveThreshold) {
      return false;
    }

    // Check confidence
    if ((suggestion.estimatedImpact?.confidence || 0) < 80) {
      return false;
    }

    // Check if prerequisites are met
    if (!suggestion.prerequisites.every(p => p.satisfied)) {
      return false;
    }

    return true;
  }

  /**
   * Check if suggestion requires confirmation
   */
  requiresConfirmation(suggestion) {
    const impact = Math.abs(suggestion.estimatedImpact?.amount || 0);
    
    // High impact requires confirmation
    if (impact > this.approvalRules.requireConfirmationThreshold) {
      return true;
    }

    // High risk types require confirmation
    if (this.approvalRules.highRiskTypes.includes(suggestion.type)) {
      return true;
    }

    // Low confidence requires confirmation
    if ((suggestion.estimatedImpact?.confidence || 0) < 70) {
      return true;
    }

    return false;
  }

  /**
   * Check if suggestion requires MFA
   */
  async requiresMFA(suggestion, userId) {
    // Check if type requires MFA
    if (!this.approvalRules.mfaRequiredTypes.includes(suggestion.type)) {
      return false;
    }

    // Check if user has MFA enabled
    const user = await User.findById(userId);
    if (!user?.preferences?.mfaEnabled) {
      return false;
    }

    // Check if MFA was recently verified
    // This would check session/cookie for MFA verification

    return true;
  }

  /**
   * Check cooldown period
   */
  async checkCooldown(suggestion, userId) {
    const cooldownDays = this.approvalRules.cooldownPeriods[suggestion.type];
    if (!cooldownDays) {
      return { allowed: true };
    }

    // Find last similar suggestion
    const PendingSuggestion = mongoose.model('PendingSuggestion');
    const lastSimilar = await PendingSuggestion.findOne({
      userId,
      type: suggestion.type,
      status: { $in: ['applied', 'rejected'] },
      createdAt: { $gte: new Date(Date.now() - cooldownDays * 24 * 60 * 60 * 1000) }
    }).sort({ createdAt: -1 });

    if (!lastSimilar) {
      return { allowed: true };
    }

    const daysSince = (Date.now() - lastSimilar.createdAt) / (1000 * 60 * 60 * 24);
    const daysRemaining = Math.max(0, cooldownDays - daysSince);

    return {
      allowed: daysRemaining === 0,
      daysRemaining: Math.ceil(daysRemaining),
      lastSuggestion: lastSimilar
    };
  }

  /**
   * Check for similar pending suggestions
   */
  async checkSimilarPending(suggestion, userId) {
    const PendingSuggestion = mongoose.model('PendingSuggestion');
    
    const similar = await PendingSuggestion.findOne({
      userId,
      type: suggestion.type,
      status: { $in: ['pending', 'approved'] },
      _id: { $ne: suggestion._id },
      'proposedChanges.categoryId': suggestion.proposedChanges?.categoryId
    });

    if (!similar) {
      return { hasSimilar: false };
    }

    return {
      hasSimilar: true,
      existing: similar
    };
  }

  /**
   * Validate impact of suggestion
   */
  validateImpact(suggestion) {
    const impact = suggestion.estimatedImpact;

    if (!impact) {
      return { valid: true }; // No impact to validate
    }

    if (impact.amount && Math.abs(impact.amount) > 1000000) {
      return {
        valid: false,
        reason: 'Impact amount exceeds reasonable limit'
      };
    }

    if (impact.percentage && Math.abs(impact.percentage) > 100) {
      return {
        valid: false,
        reason: 'Impact percentage exceeds 100%'
      };
    }

    if (impact.confidence && (impact.confidence < 0 || impact.confidence > 100)) {
      return {
        valid: false,
        reason: 'Confidence must be between 0 and 100'
      };
    }

    return { valid: true };
  }

  /**
   * Get approval requirements for suggestion type
   */
  getApprovalRequirements(type) {
    return {
      requiresConfirmation: this.approvalRules.highRiskTypes.includes(type),
      requiresMFA: this.approvalRules.mfaRequiredTypes.includes(type),
      cooldownDays: this.approvalRules.cooldownPeriods[type] || 0,
      autoApproveThreshold: this.approvalRules.autoApproveThreshold
    };
  }

  /**
   * Process batch approval
   */
  async processBatchApproval(suggestionIds, userId, options = {}) {
    const results = [];
    const errors = [];

    for (const id of suggestionIds) {
      try {
        const result = await this.processApproval(
          { _id: id },
          userId,
          options
        );
        results.push({ id, ...result });
      } catch (error) {
        errors.push({ id, error: error.message });
      }
    }

    return {
      success: errors.length === 0,
      results,
      errors
    };
  }

  /**
   * Generate approval summary
   */
  generateApprovalSummary(approvalResult) {
    const summary = [];

    if (approvalResult.autoApproved) {
      summary.push('✓ Auto-approved (low impact, high confidence)');
    }

    if (approvalResult.requiresConfirmation) {
      summary.push('⚠️ Requires your confirmation');
    }

    if (approvalResult.requiresMFA) {
      summary.push('🔐 MFA verification required');
    }

    if (approvalResult.warnings.length > 0) {
      summary.push('⚠️ Warnings:');
      approvalResult.warnings.forEach(w => summary.push(`  • ${w}`));
    }

    if (approvalResult.nextSteps.length > 0) {
      summary.push('📋 Next steps:');
      approvalResult.nextSteps.forEach(s => summary.push(`  • ${s}`));
    }

    return summary.join('\n');
  }
}

module.exports = new ApprovalHandler();
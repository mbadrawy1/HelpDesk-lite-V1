/**
 * SLA Configuration
 *
 * Defines the Service Level Agreement thresholds for each ticket priority.
 * When a ticket exceeds its SLA threshold without being resolved, it becomes
 * eligible for auto-escalation.
 */

import { Priority } from "@/generated/prisma/enums";

/**
 * SLA thresholds in minutes for each priority level.
 * These define how long a ticket can remain unresolved before triggering
 * an automatic escalation.
 */
export const SLA_THRESHOLDS: Record<string, number> = {
  [Priority.URGENT]: 30,     // 30 minutes
  [Priority.HIGH]: 120,      // 2 hours
  [Priority.MEDIUM]: 480,    // 8 hours (1 business day)
  [Priority.LOW]: 1440,      // 24 hours
};

/**
 * How often the background worker polls for breached tickets (in minutes).
 */
export const POLLING_INTERVAL_MINUTES = 5;

/**
 * The escalation channel identifier used for routing alerts.
 */
export const ESCALATION_CHANNEL = "escalation-alerts";

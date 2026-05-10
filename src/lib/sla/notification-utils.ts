/**
 * SLA Notification Utility
 *
 * Extracted helper functions for building and sending SLA-related
 * notifications. Keeps the main escalation handler clean and focused.
 */

import prisma from "@/lib/db/prisma";
import { Role } from "@/generated/prisma/enums";
import { createNotification } from "@/lib/services/notification.service";
import type { BreachedTicket } from "@/lib/sla/escalation-trigger";

/**
 * Builds a human-readable escalation message for a breached ticket.
 *
 * @param ticket - The breached ticket
 * @returns Formatted escalation message string
 */
export function buildEscalationMessage(ticket: BreachedTicket): string {
  const hours = Math.floor(ticket.breachedByMinutes / 60);
  const minutes = ticket.breachedByMinutes % 60;
  const timeStr =
    hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;

  return (
    `⚠️ SLA BREACH: Ticket "${ticket.title}" (Priority: ${ticket.priority}) ` +
    `has exceeded its SLA threshold by ${timeStr}. ` +
    `Status: ${ticket.status}. Immediate attention required.`
  );
}

/**
 * Builds the submitter-facing message for an SLA breach.
 *
 * @param ticket - The breached ticket
 * @returns Formatted message for the ticket submitter
 */
export function buildSubmitterMessage(ticket: BreachedTicket): string {
  return `Your ticket "${ticket.title}" has exceeded its SLA response time. It has been escalated to management.`;
}

/**
 * Sends SLA breach notifications to all relevant parties:
 * - The assigned agent (if any)
 * - The ticket submitter
 * - All managers in the system
 *
 * @param ticket - The breached ticket to notify about
 * @returns Number of notifications sent
 */
export async function sendEscalationNotifications(
  ticket: BreachedTicket
): Promise<number> {
  const escalationMessage = buildEscalationMessage(ticket);
  let notificationCount = 0;

  // Notify the assigned agent (if one exists)
  if (ticket.agentId) {
    await createNotification({
      userId: ticket.agentId,
      ticketId: ticket.id,
      type: "SLA_BREACH",
      message: escalationMessage,
    });
    notificationCount++;
  }

  // Notify the ticket submitter
  await createNotification({
    userId: ticket.submitterId,
    ticketId: ticket.id,
    type: "SLA_BREACH",
    message: buildSubmitterMessage(ticket),
  });
  notificationCount++;

  // Notify all managers in the system
  const managers = await prisma.user.findMany({
    where: { role: Role.MANAGER },
    select: { id: true },
  });

  for (const manager of managers) {
    await createNotification({
      userId: manager.id,
      ticketId: ticket.id,
      type: "SLA_ESCALATION",
      message: escalationMessage,
    });
    notificationCount++;
  }

  return notificationCount;
}

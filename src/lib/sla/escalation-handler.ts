/**
 * SLA Escalation Handler
 *
 * Processes breached tickets by updating their status, notifying the
 * assigned agent, submitter, and all managers through the existing
 * notification system.
 */

import prisma from "@/lib/db/prisma";
import { Role } from "@/generated/prisma/enums";
import { createNotification } from "@/lib/services/notification.service";
import { ESCALATION_CHANNEL } from "@/lib/sla/sla-config";
import type { BreachedTicket } from "@/lib/sla/escalation-trigger";

/**
 * Processes a single breached ticket:
 * 1. Updates the ticket status to flag it as escalated
 * 2. Notifies the assigned agent (if any)
 * 3. Notifies the ticket submitter
 * 4. Notifies all managers in the system
 *
 * @param ticket - The ticket that has breached its SLA
 */
export async function escalateTicket(ticket: BreachedTicket): Promise<void> {
  console.log(
    `[SLA] Escalating ticket "${ticket.title}" (${ticket.id}) — breached by ${ticket.breachedByMinutes} minutes`
  );

  // Update the ticket's updatedAt timestamp to record the escalation event
  await prisma.ticket.update({
    where: { id: ticket.id },
    data: { updatedAt: new Date() },
  });

  // Build the escalation message
  const escalationMessage = buildEscalationMessage(ticket);

  // Notify the assigned agent (if one exists)
  if (ticket.agentId) {
    await createNotification({
      userId: ticket.agentId,
      ticketId: ticket.id,
      type: "SLA_BREACH",
      message: escalationMessage,
    });
  }

  // Notify the ticket submitter
  await createNotification({
    userId: ticket.submitterId,
    ticketId: ticket.id,
    type: "SLA_BREACH",
    message: `Your ticket "${ticket.title}" has exceeded its SLA response time. It has been escalated to management.`,
  });

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
  }

  console.log(
    `[SLA] Escalation complete for ticket ${ticket.id} — notified ${managers.length} manager(s) via channel: ${ESCALATION_CHANNEL}`
  );
}

/**
 * Builds a human-readable escalation message for a breached ticket.
 */
function buildEscalationMessage(ticket: BreachedTicket): string {
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
 * Processes all breached tickets by escalating each one.
 *
 * @param tickets - Array of breached tickets to process
 * @returns Number of successfully escalated tickets
 */
export async function processBreachedTickets(
  tickets: BreachedTicket[]
): Promise<number> {
  let escalatedCount = 0;

  for (const ticket of tickets) {
    try {
      await escalateTicket(ticket);
      escalatedCount++;
    } catch (error) {
      console.error(
        `[SLA] Failed to escalate ticket ${ticket.id}:`,
        error
      );
    }
  }

  console.log(
    `[SLA] Escalation run complete: ${escalatedCount}/${tickets.length} tickets processed`
  );

  return escalatedCount;
}

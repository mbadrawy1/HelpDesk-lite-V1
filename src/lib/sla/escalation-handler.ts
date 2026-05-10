/**
 * SLA Escalation Handler
 *
 * Processes breached tickets by updating their status and delegating
 * notification delivery to the notification-utils helper.
 */

import prisma from "@/lib/db/prisma";
import { ESCALATION_CHANNEL } from "@/lib/sla/sla-config";
import { sendEscalationNotifications } from "@/lib/sla/notification-utils";
import type { BreachedTicket } from "@/lib/sla/escalation-trigger";

/**
 * Processes a single breached ticket:
 * 1. Verifies the ticket still exists (handles deletion race condition)
 * 2. Updates the ticket timestamp to record the escalation event
 * 3. Delegates notification delivery to the notification utility
 *
 * @param ticket - The ticket that has breached its SLA
 */
export async function escalateTicket(ticket: BreachedTicket): Promise<void> {
  console.log(
    `[SLA] Escalating ticket "${ticket.title}" (${ticket.id}) — breached by ${ticket.breachedByMinutes} minutes`
  );

  // Guard: verify the ticket still exists before attempting escalation.
  // A ticket could be deleted between the breach query and this handler running.
  const existingTicket = await prisma.ticket.findUnique({
    where: { id: ticket.id },
    select: { id: true },
  });

  if (!existingTicket) {
    console.warn(
      `[SLA] Ticket ${ticket.id} no longer exists — skipping escalation`
    );
    return;
  }

  // Update the ticket's updatedAt timestamp to record the escalation event
  await prisma.ticket.update({
    where: { id: ticket.id },
    data: { updatedAt: new Date() },
  });

  // Delegate all notification logic to the utility helper
  const notificationCount = await sendEscalationNotifications(ticket);

  console.log(
    `[SLA] Escalation complete for ticket ${ticket.id} — sent ${notificationCount} notification(s) via channel: ${ESCALATION_CHANNEL}`
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

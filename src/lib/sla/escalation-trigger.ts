/**
 * SLA Escalation Trigger
 *
 * Core logic for detecting tickets that have breached their SLA thresholds
 * and triggering the auto-escalation workflow.
 */

import prisma from "@/lib/db/prisma";
import { TicketStatus } from "@/generated/prisma/enums";
import { SLA_THRESHOLDS } from "@/lib/sla/sla-config";

/**
 * Represents a ticket that has breached its SLA.
 */
export interface BreachedTicket {
  id: string;
  title: string;
  priority: string;
  status: string;
  submitterId: string;
  agentId: string | null;
  createdAt: Date;
  breachedByMinutes: number;
}

/**
 * Finds all open/in-progress tickets that have exceeded their SLA threshold.
 *
 * For each priority level, calculates the cutoff time and queries for tickets
 * that were created before that cutoff and are still unresolved.
 *
 * @returns Array of tickets that have breached their SLA
 */
export async function findBreachedTickets(): Promise<BreachedTicket[]> {
  const now = new Date();
  const breachedTickets: BreachedTicket[] = [];

  for (const [priority, thresholdMinutes] of Object.entries(SLA_THRESHOLDS)) {
    const cutoff = new Date(now.getTime() - thresholdMinutes * 60 * 1000);

    const tickets = await prisma.ticket.findMany({
      where: {
        priority: priority as keyof typeof SLA_THRESHOLDS,
        status: {
          in: [TicketStatus.OPEN, TicketStatus.IN_PROGRESS],
        },
        createdAt: {
          lt: cutoff,
        },
      },
      select: {
        id: true,
        title: true,
        priority: true,
        status: true,
        submitterId: true,
        agentId: true,
        createdAt: true,
      },
    });

    for (const ticket of tickets) {
      const elapsedMinutes = Math.floor(
        (now.getTime() - ticket.createdAt.getTime()) / (60 * 1000)
      );

      breachedTickets.push({
        ...ticket,
        breachedByMinutes: elapsedMinutes - thresholdMinutes,
      });
    }
  }

  return breachedTickets;
}

/**
 * Main escalation trigger function.
 *
 * Polls the database for SLA-breached tickets and processes each one.
 * This is designed to be called by a background worker on a regular interval.
 *
 * @returns Summary of the escalation run
 */
export async function runEscalationCheck(): Promise<{
  checkedAt: Date;
  breachedCount: number;
  tickets: BreachedTicket[];
}> {
  const checkedAt = new Date();
  console.log(`[SLA] Escalation check started at ${checkedAt.toISOString()}`);

  const breachedTickets = await findBreachedTickets();

  console.log(
    `[SLA] Found ${breachedTickets.length} ticket(s) exceeding SLA thresholds`
  );

  return {
    checkedAt,
    breachedCount: breachedTickets.length,
    tickets: breachedTickets,
  };
}

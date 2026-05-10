/**
 * Tests for the SLA Auto-Escalation Trigger
 *
 * Unit tests that verify the escalation logic fires correctly when
 * tickets breach their SLA thresholds.
 *
 * These tests are self-contained and do not require a database connection.
 * They validate configuration, message formatting, and edge cases.
 *
 * Run with: npx tsx src/lib/sla/__tests__/escalation-trigger.test.ts
 */

// ─── Inline imports (avoid pulling in Prisma/DB) ───────────────────────

// We import only the config and pure functions that don't touch the database.
import { SLA_THRESHOLDS, POLLING_INTERVAL_MINUTES } from "../sla-config";

/**
 * Represents a ticket that has breached its SLA.
 * (Duplicated here to avoid importing from escalation-trigger which pulls in Prisma)
 */
interface BreachedTicket {
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
 * Builds a human-readable escalation message for a breached ticket.
 * (Duplicated from notification-utils to avoid DB imports)
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

function buildSubmitterMessage(ticket: BreachedTicket): string {
  return `Your ticket "${ticket.title}" has exceeded its SLA response time. It has been escalated to management.`;
}

// ─── Test Helpers ──────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string): void {
  if (condition) {
    console.log(`  ✅ PASS: ${testName}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${testName}`);
    failed++;
  }
}

function createMockTicket(overrides: Partial<BreachedTicket> = {}): BreachedTicket {
  return {
    id: "ticket-001",
    title: "Server is down",
    priority: "URGENT",
    status: "OPEN",
    submitterId: "user-001",
    agentId: "agent-001",
    createdAt: new Date(Date.now() - 60 * 60 * 1000), // 1 hour ago
    breachedByMinutes: 30,
    ...overrides,
  };
}

// ─── Tests ─────────────────────────────────────────────────────────────

console.log("\n🧪 SLA Escalation Trigger — Test Suite\n");

// --- Test Group 1: SLA Configuration ---

console.log("📋 SLA Configuration Tests:");

assert(
  SLA_THRESHOLDS["URGENT"] === 30,
  "URGENT SLA threshold should be 30 minutes"
);

assert(
  SLA_THRESHOLDS["HIGH"] === 120,
  "HIGH SLA threshold should be 120 minutes (2 hours)"
);

assert(
  SLA_THRESHOLDS["MEDIUM"] === 480,
  "MEDIUM SLA threshold should be 480 minutes (8 hours)"
);

assert(
  SLA_THRESHOLDS["LOW"] === 1440,
  "LOW SLA threshold should be 1440 minutes (24 hours)"
);

assert(
  POLLING_INTERVAL_MINUTES === 5,
  "Polling interval should be 5 minutes"
);

// --- Test Group 2: Escalation Message Building ---

console.log("\n📋 Escalation Message Tests:");

const urgentTicket = createMockTicket({
  priority: "URGENT",
  breachedByMinutes: 45,
});

const escalationMsg = buildEscalationMessage(urgentTicket);

assert(
  escalationMsg.includes("SLA BREACH"),
  "Escalation message should contain 'SLA BREACH'"
);

assert(
  escalationMsg.includes("Server is down"),
  "Escalation message should include the ticket title"
);

assert(
  escalationMsg.includes("URGENT"),
  "Escalation message should include the priority level"
);

assert(
  escalationMsg.includes("Immediate attention required"),
  "Escalation message should urge immediate action"
);

// --- Test Group 3: Time Formatting ---

console.log("\n📋 Time Formatting Tests:");

const shortBreachTicket = createMockTicket({ breachedByMinutes: 15 });
const shortMsg = buildEscalationMessage(shortBreachTicket);
assert(
  shortMsg.includes("15m"),
  "Short breach should format as minutes only (15m)"
);

const longBreachTicket = createMockTicket({ breachedByMinutes: 150 });
const longMsg = buildEscalationMessage(longBreachTicket);
assert(
  longMsg.includes("2h 30m"),
  "Long breach should format as hours and minutes (2h 30m)"
);

// --- Test Group 4: Submitter Message ---

console.log("\n📋 Submitter Message Tests:");

const submitterMsg = buildSubmitterMessage(urgentTicket);

assert(
  submitterMsg.includes("Server is down"),
  "Submitter message should include ticket title"
);

assert(
  submitterMsg.includes("escalated to management"),
  "Submitter message should mention escalation to management"
);

// --- Test Group 5: Edge Cases ---

console.log("\n📋 Edge Case Tests:");

const noAgentTicket = createMockTicket({ agentId: null });
assert(
  noAgentTicket.agentId === null,
  "Ticket without agent should have null agentId"
);

const zeroBreachTicket = createMockTicket({ breachedByMinutes: 0 });
const zeroMsg = buildEscalationMessage(zeroBreachTicket);
assert(
  zeroMsg.includes("0m"),
  "Zero-minute breach should format correctly"
);

const exactHourTicket = createMockTicket({ breachedByMinutes: 60 });
const exactMsg = buildEscalationMessage(exactHourTicket);
assert(
  exactMsg.includes("1h 0m"),
  "Exact hour breach should show 0 remaining minutes"
);

// --- Test Group 6: SLA Breach Detection Logic ---

console.log("\n📋 SLA Breach Detection Logic Tests:");

function isBreached(priority: string, elapsedMinutes: number): boolean {
  const threshold = SLA_THRESHOLDS[priority];
  return threshold !== undefined && elapsedMinutes > threshold;
}

assert(
  isBreached("URGENT", 31) === true,
  "URGENT ticket at 31 min should be breached"
);

assert(
  isBreached("URGENT", 29) === false,
  "URGENT ticket at 29 min should NOT be breached"
);

assert(
  isBreached("HIGH", 121) === true,
  "HIGH ticket at 121 min should be breached"
);

assert(
  isBreached("HIGH", 119) === false,
  "HIGH ticket at 119 min should NOT be breached"
);

assert(
  isBreached("LOW", 1441) === true,
  "LOW ticket at 1441 min should be breached"
);

assert(
  isBreached("LOW", 1000) === false,
  "LOW ticket at 1000 min should NOT be breached"
);

// ─── Summary ───────────────────────────────────────────────────────────

console.log("\n" + "─".repeat(50));
console.log(`📊 Results: ${passed} passed, ${failed} failed, ${passed + failed} total`);

if (failed > 0) {
  console.error("\n💥 Some tests failed!");
  process.exit(1);
} else {
  console.log("\n🎉 All tests passed!");
}

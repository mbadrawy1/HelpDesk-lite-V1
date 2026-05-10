/**
 * SLA Escalation API Route
 *
 * POST /api/sla/escalation-check
 *
 * This endpoint is designed to be called by a cron job or background worker
 * to trigger the SLA breach check and auto-escalation process.
 */

import { NextResponse } from "next/server";
import { runEscalationCheck } from "@/lib/sla/escalation-trigger";

export async function POST() {
  try {
    const result = await runEscalationCheck();

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("[SLA] Escalation check failed:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Escalation check failed",
      },
      { status: 500 }
    );
  }
}

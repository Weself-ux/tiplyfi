import sql from "@/app/api/utils/sql";

/// Behavioural facts Tiplyfi produces. The spine assigns weight and score —
/// this layer records only what happened, never how good or bad it was.
export const REPUTATION_EVENTS = {
  ACCOUNT_CREATED: "account_created",
  TIP_RECEIVED: "tip_received",
  TIP_SENT: "tip_sent",
  PLATFORM_SUPPORTED: "platform_supported",
  REPORT_FILED: "report_filed",
  PAGE_UNDER_REVIEW: "page_under_review",
  ESCROW_CLAIMED: "escrow_claimed",
};

/**
 * Record one event. Idempotent on (source, event_type, subject_id, ref),
 * so callers may retry freely.
 *
 * Never throws: reputation is observational, and a failure here must not
 * roll back the tip, report, or signup that produced it.
 */
export async function recordReputationEvent({
  eventType,
  subjectType,
  subjectId,
  counterparty = null,
  amountUsdc = null,
  ref,
}) {
  if (!eventType || !subjectType || !subjectId || !ref) return;
  try {
    await sql(
      `INSERT INTO reputation_events
         (event_type, subject_type, subject_id, counterparty, amount_usdc, ref)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (source, event_type, subject_id, ref) DO NOTHING`,
      [
        eventType,
        subjectType,
        String(subjectId).toLowerCase(),
        counterparty ? String(counterparty).toLowerCase() : null,
        amountUsdc,
        String(ref),
      ],
    );
  } catch (err) {
    console.error("[reputation] write failed", eventType, err);
  }
}

/// A confirmed tip produces two facts: one for the creator, one for the
/// tipper. Both key on the transaction hash.
export async function recordTipEvents({
  creatorUsername,
  tipperAddress,
  netUsdc,
  platformTipUsdc,
  txHash,
}) {
  await recordReputationEvent({
    eventType: REPUTATION_EVENTS.TIP_RECEIVED,
    subjectType: "username",
    subjectId: creatorUsername,
    counterparty: tipperAddress,
    amountUsdc: netUsdc,
    ref: txHash,
  });

  if (tipperAddress) {
    await recordReputationEvent({
      eventType: REPUTATION_EVENTS.TIP_SENT,
      subjectType: "wallet",
      subjectId: tipperAddress,
      counterparty: creatorUsername,
      amountUsdc: netUsdc,
      ref: txHash,
    });

    if (Number(platformTipUsdc) > 0) {
      await recordReputationEvent({
        eventType: REPUTATION_EVENTS.PLATFORM_SUPPORTED,
        subjectType: "wallet",
        subjectId: tipperAddress,
        amountUsdc: platformTipUsdc,
        ref: txHash,
      });
    }
  }
}

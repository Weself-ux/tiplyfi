const EXPLORER = "https://testnet.arcscan.app";
const USDC_CONTRACT = "0x3600000000000000000000000000000000000000";

/// Reads ERC-20 USDC transfers rather than external transactions.
/// Circle SCA wallets send through the ERC-4337 EntryPoint, so their
/// transfers are internal and never appear in txlist — verified against a
/// live withdrawal that returned "No transactions found" there while
/// tokentx had it.
export async function loader({ request }) {
  try {
    const url = new URL(request.url);
    const address = url.searchParams.get("address");
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = parseInt(url.searchParams.get("limit") || "20");

    if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
      return Response.json(
        { error: "Valid wallet address is required." },
        { status: 400 },
      );
    }

    const query =
      `${EXPLORER}/api?module=account&action=tokentx` +
      `&address=${address}&contractaddress=${USDC_CONTRACT}` +
      `&sort=desc&page=${page}&offset=${limit}`;

    const res = await fetch(query);
    if (!res.ok) throw new Error(`Explorer ${res.status}`);

    const data = await res.json();
    const rows = Array.isArray(data.result) ? data.result : [];
    const me = address.toLowerCase();

    const formatted = rows.map((tx) => {
      // tokentx reports the token's own decimals, which is 6 for Arc USDC —
      // not the 18-decimal native view.
      const decimals = Number(tx.tokenDecimal) || 6;
      const raw = BigInt(tx.value || "0");
      const divisor = 10n ** BigInt(decimals);
      const whole = raw / divisor;
      const frac = (raw % divisor)
        .toString()
        .padStart(decimals, "0")
        .slice(0, 2);

      return {
        hash: tx.hash,
        from: tx.from,
        to: tx.to,
        valueWei: tx.value,
        valueUsdc: `${whole}.${frac}`,
        timestamp: tx.timeStamp,
        isIncoming: (tx.to || "").toLowerCase() === me,
        blockNumber: tx.blockNumber,
        gasUsed: tx.gasUsed,
      };
    });

    return Response.json({ transactions: formatted });
  } catch (err) {
    console.error("Transactions fetch error:", err);
    return Response.json(
      { error: "Could not fetch transactions.", transactions: [] },
      { status: 500 },
    );
  }
}

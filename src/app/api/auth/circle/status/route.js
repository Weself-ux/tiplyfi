/// Temporary diagnostic: reports Circle's own view of the signed-in user,
/// including whether a PIN and security questions are set. Delete once the
/// recovery model is confirmed.
export async function action({ request }) {
  try {
    const { userToken } = await request.json();
    if (!userToken) {
      return Response.json({ error: "Missing token." }, { status: 400 });
    }

    const res = await fetch("https://api.circle.com/v1/w3s/user", {
      headers: {
        Authorization: `Bearer ${process.env.CIRCLE_API_KEY}`,
        "X-User-Token": userToken,
        Accept: "application/json",
      },
    });
    const data = await res.json();
    return Response.json({ status: res.status, body: data });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}

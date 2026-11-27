import { json } from "@/lib/account/http";
import { signedInClient } from "@/lib/cv-analysis/server";

export const dynamic = "force-dynamic";

/** GET /api/v1/admin/me: whether the signed-in person is an admin (for the menu only; admin pages check again). */
export async function GET() {
  try {
    const session = await signedInClient();
    if (!session) return json({ admin: false });
    const { data, error } = await session.client.rpc("careerforge_is_admin");
    return json({ admin: !error && data === true });
  } catch { return json({ admin: false }); }
}

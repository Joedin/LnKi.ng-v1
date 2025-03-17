import { DubApiError } from "@/lib/api/errors";
import { withWorkspace } from "@/lib/auth";
import { APP_DOMAIN } from "@dub/utils";
import { NextResponse } from "next/server";

export const POST = withWorkspace(async ({ req, workspace, session }) => {
  let { plan, period, baseUrl, onboarding } = await req.json();

  try {
    // Return the details needed to initiate Flutterwave checkout
    // The actual checkout will be handled client-side
    return NextResponse.json({
      userId: session.user.id,
      email: session.user.email,
      name: session.user.name,
      plan,
      period,
      flutterwavePublicKey: process.env.FLUTTERWAVE_PUBLIC_KEY,
      baseUrl: baseUrl || `${APP_DOMAIN}/${workspace.slug}`,
      onboarding: !!onboarding,
    });
  } catch (error) {
    throw new DubApiError({
      code: "bad_request",
      message: error.message || "Failed to initiate checkout",
    });
  }
});

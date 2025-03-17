import { DubApiError } from "@/lib/api/errors";
import { withWorkspace } from "@/lib/auth";
import { cancelSubscription } from "@/lib/flutterwave";
import { prisma } from "@dub/prisma";
import { NextResponse } from "next/server";

// POST /api/workspaces/[idOrSlug]/billing/cancel - cancel a Flutterwave subscription
export const POST = withWorkspace(async ({ workspace }) => {
  if (!workspace.flutterwaveSubscriptionId)
    return new Response("No Flutterwave subscription ID", { status: 400 });

  try {
    // Call Flutterwave API to cancel the subscription
    const response = await cancelSubscription(workspace.flutterwaveSubscriptionId);
    
    if (response.status === "success") {
      // Update workspace to free plan
      await prisma.project.update({
        where: { id: workspace.id },
        data: {
          plan: "free",
          usageLimit: 1000,
          linksLimit: 25,
          domainsLimit: 3,
          tagsLimit: 5,
          foldersLimit: 0,
          usersLimit: 1,
          aiLimit: 10,
          salesLimit: 0,
        },
      });
      
      return NextResponse.json({ success: true });
    } else {
      throw new Error(response.message || "Failed to cancel subscription");
    }
  } catch (error) {
    throw new DubApiError({
      code: "bad_request",
      message: error.message || "Failed to cancel subscription",
    });
  }
});

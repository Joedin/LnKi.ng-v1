import { validateWebhookSignature } from "@/lib/flutterwave";
import { createId } from "@/lib/api/create-id";
import { recordLead, recordSale } from "@/lib/tinybird";
import { redis } from "@/lib/upstash";
import { sendWorkspaceWebhook } from "@/lib/webhook/publish";
import { transformLeadEventData, transformSaleEventData } from "@/lib/webhook/transform";
import { prisma } from "@dub/prisma";
import { nanoid } from "@dub/utils";
import { waitUntil } from "@vercel/functions";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

interface WebhookPayload {
  event: string;
  data: {
    id: number;
    tx_ref: string;
    flw_ref: string;
    amount: number;
    currency: string;
    status: string;
    payment_type: string;
    customer: {
      id: number;
      name: string;
      email: string;
      phone_number: string;
    };
  };
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const signature = req.headers.get("verif-hash");

  // Validate webhook signature
  if (!signature || !validateWebhookSignature(signature)) {
    return new NextResponse("Invalid webhook signature", { status: 401 });
  }

  const { event, data } = body as WebhookPayload;

  try {
    // Handle different webhook events
    switch (event) {
      case "charge.completed":
        await handleChargeCompleted(data);
        break;

      case "subscription.created":
        await handleSubscriptionCreated(data);
        break;

      case "subscription.cancelled":
        await handleSubscriptionCancelled(data);
        break;

      case "subscription.disabled":
        await handleSubscriptionDisabled(data);
        break;

      default:
        console.log(`Unhandled webhook event: ${event}`);
    }

    return new NextResponse(JSON.stringify({ success: true }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    console.error(`Error handling webhook: ${error.message}`);
    return new NextResponse(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  }
}

/**
 * Handle charge.completed event
 */
async function handleChargeCompleted(data: WebhookPayload["data"]) {
  const { tx_ref, flw_ref, amount, currency, customer } = data;
  
  // Extract workspace and user IDs from tx_ref
  // Format: lnking_{userId}_{workspaceId}_{planName}_{interval}
  const txRefParts = tx_ref.split("_");
  
  if (txRefParts.length < 5 || txRefParts[0] !== "lnking") {
    console.log(`Invalid tx_ref format: ${tx_ref}`);
    return;
  }
  
  const [_, userId, workspaceId, planName, interval] = txRefParts;
  
  if (!userId || !workspaceId || !planName || !interval) {
    console.log(`Missing required data in tx_ref: ${tx_ref}`);
    return;
  }
  
  // Find the workspace
  const workspace = await prisma.project.findUnique({
    where: { id: workspaceId },
    select: {
      id: true,
      name: true,
      slug: true,
    },
  });
  
  if (!workspace) {
    console.log(`Workspace not found: ${workspaceId}`);
    return;
  }
  
  // Find or create customer
  let existingCustomer = await prisma.customer.findFirst({
    where: {
      projectId: workspace.id,
      OR: [
        { email: customer.email },
        { externalId: customer.email },
      ],
    },
  });
  
  const customerData = {
    name: customer.name,
    email: customer.email,
    externalId: customer.email,
    projectId: workspace.id,
  };
  
  const dbCustomer = existingCustomer
    ? await prisma.customer.update({
        where: { id: existingCustomer.id },
        data: customerData,
      })
    : await prisma.customer.create({
        data: {
          id: createId({ prefix: "cus_" }),
          ...customerData,
        },
      });
  
  // Update workspace plan
  const planMapping = {
    pro: {
      usageLimit: 50000,
      linksLimit: 1000,
      domainsLimit: 10,
      tagsLimit: 25,
      foldersLimit: 3,
      usersLimit: 5,
      aiLimit: 1000,
      salesLimit: 0,
    },
    business: {
      usageLimit: 150000,
      linksLimit: 5000,
      domainsLimit: 40,
      tagsLimit: Number.MAX_SAFE_INTEGER,
      foldersLimit: 10,
      usersLimit: 15,
      aiLimit: 1000,
      salesLimit: 500000,
    },
    businessPlus: {
      usageLimit: 400000,
      linksLimit: 15000,
      domainsLimit: 100,
      tagsLimit: Number.MAX_SAFE_INTEGER,
      foldersLimit: 25,
      usersLimit: 30,
      aiLimit: 1000,
      salesLimit: 1500000,
    },
    businessExtra: {
      usageLimit: 1000000,
      linksLimit: 40000,
      domainsLimit: 250,
      tagsLimit: Number.MAX_SAFE_INTEGER,
      foldersLimit: 50,
      usersLimit: 50,
      aiLimit: 1000,
      salesLimit: 4000000,
    },
    businessMax: {
      usageLimit: 2500000,
      linksLimit: 100000,
      domainsLimit: 500,
      tagsLimit: Number.MAX_SAFE_INTEGER,
      foldersLimit: 100,
      usersLimit: 100,
      aiLimit: 1000,
      salesLimit: 10000000,
    },
  };
  
  // Update the workspace with the new plan
  await prisma.project.update({
    where: { id: workspace.id },
    data: {
      plan: planName.toLowerCase(),
      flutterwaveSubscriptionId: flw_ref, // Store the Flutterwave reference
      billingCycleStart: new Date().getDate(),
      ...planMapping[planName],
    },
  });
  
  // Check if invoice has already been processed
  const ok = await redis.set(`lnking_sale_events:invoiceId:${flw_ref}`, 1, {
    ex: 60 * 60 * 24 * 7,
    nx: true,
  });
  
  if (!ok) {
    console.log(`Invoice with ID ${flw_ref} already processed, skipping...`);
    return;
  }
  
  // Record sale event for analytics
  const eventId = nanoid(16);
  
  const saleData = {
    event_id: eventId,
    event_name: interval === "yearly" ? "Yearly Subscription" : "Monthly Subscription",
    link_id: "",
    domain: "",
    timestamp: new Date().toISOString(),
    click_id: "",
    utm_source: "",
    utm_medium: "",
    utm_campaign: "",
    utm_term: "",
    utm_content: "",
    device: "",
    browser: "",
    browser_version: "",
    os: "",
    osVersion: "",
    country: "",
    city: "",
    language: "",
    referer: "",
    ip_address: "",
    customer_id: dbCustomer.id,
    payment_processor: "flutterwave",
    amount: amount,
    currency: currency,
    invoice_id: flw_ref,
    metadata: JSON.stringify({
      tx_ref,
      flw_ref,
      planName,
      interval,
    }),
  };
  
  // Record the sale in Tinybird
  await recordSale(saleData);
  
  // Create basic lead data if it was a new customer
  if (!existingCustomer) {
    const leadData = {
      ...saleData,
      event_id: nanoid(16),
      event_name: "Sign up",
    };
    
    await recordLead(leadData);
  }
  
  // Send webhooks
  waitUntil(
    (async () => {
      // Send webhook for completed sale
      await sendWorkspaceWebhook({
        trigger: "sale.created",
        workspace,
        data: transformSaleEventData({
          ...saleData,
          clickedAt: dbCustomer.clickedAt || dbCustomer.createdAt,
          customer: dbCustomer,
        }),
      });
      
      // Send webhook for lead if it was a new customer
      if (!existingCustomer) {
        await sendWorkspaceWebhook({
          trigger: "lead.created",
          workspace,
          data: transformLeadEventData({
            ...saleData,
            eventName: "Sign up",
            customer: dbCustomer,
          }),
        });
      }
    })(),
  );
}

/**
 * Handle subscription.created event
 */
async function handleSubscriptionCreated(data: WebhookPayload["data"]) {
  // Similar logic to handleChargeCompleted
  console.log("Subscription created", data);
}

/**
 * Handle subscription.cancelled event
 */
async function handleSubscriptionCancelled(data: WebhookPayload["data"]) {
  // Find workspace by Flutterwave subscription ID
  const workspace = await prisma.project.findFirst({
    where: { flutterwaveSubscriptionId: data.flw_ref },
  });
  
  if (!workspace) {
    console.log(`Workspace not found for subscription: ${data.flw_ref}`);
    return;
  }
  
  // Downgrade to free plan
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
}

/**
 * Handle subscription.disabled event
 */
async function handleSubscriptionDisabled(data: WebhookPayload["data"]) {
  // Similar to handleSubscriptionCancelled
  await handleSubscriptionCancelled(data);
} 
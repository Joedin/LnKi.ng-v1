"use client";

import FlutterwaveCheckout from "@/components/billing/flutterwave-checkout";
import useWorkspace from "@/lib/swr/use-workspace";
import { Button } from "@dub/ui";
import { APP_DOMAIN, capitalize, SELF_SERVE_PAID_PLANS } from "@dub/utils";
import { usePlausible } from "next-plausible";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import posthog from "posthog-js";
import { useState } from "react";

export function UpgradePlanButton({
  plan,
  period,
  text,
}: {
  plan: string;
  period: "monthly" | "yearly";
  text?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { slug: workspaceSlug, plan: currentPlan } = useWorkspace();

  const plausible = usePlausible();

  const selectedPlan =
    SELF_SERVE_PAID_PLANS.find(
      (p) => p.name.toLowerCase() === plan.toLowerCase(),
    ) ?? SELF_SERVE_PAID_PLANS[0];

  const [clicked, setClicked] = useState(false);
  const [checkoutData, setCheckoutData] = useState(null);

  const queryString = searchParams.toString();

  const isCurrentPlan = currentPlan === selectedPlan.name.toLowerCase();

  if (checkoutData) {
    return (
      <FlutterwaveCheckout
        userId={checkoutData.userId}
        email={checkoutData.email}
        name={checkoutData.name}
        plan={plan}
        period={period}
        baseUrl={checkoutData.baseUrl}
        onboarding={checkoutData.onboarding}
      />
    );
  }

  return (
    <Button
      text={
        isCurrentPlan
          ? "Your current plan"
          : currentPlan === "free"
            ? `Get started with ${selectedPlan.name} ${capitalize(period)}`
            : `Switch to ${selectedPlan.name} ${capitalize(period)}`
      }
      loading={clicked}
      disabled={!workspaceSlug || isCurrentPlan}
      onClick={() => {
        setClicked(true);
        fetch(`/api/workspaces/${workspaceSlug}/billing/upgrade`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            plan,
            period,
            baseUrl: `${APP_DOMAIN}${pathname}${queryString.length > 0 ? `?${queryString}` : ""}`,
            onboarding: searchParams.get("workspace"),
          }),
        })
          .then(async (res) => {
            plausible("Opened Checkout");
            posthog.capture("checkout_opened", {
              currentPlan: capitalize(plan),
              newPlan: selectedPlan.name,
            });
            
            const data = await res.json();
            setCheckoutData(data);
          })
          .catch((err) => {
            alert(err);
          })
          .finally(() => {
            setClicked(false);
          });
      }}
    />
  );
}

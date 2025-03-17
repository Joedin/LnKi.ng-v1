import { getDisplayCurrency, initiateSubscription } from "@/lib/flutterwave";
import { nanoid } from "@dub/utils";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { Button } from "../ui/button";

export const FlutterwaveCheckout = ({
  userId,
  email,
  name,
  plan,
  period,
  baseUrl,
  onboarding = false,
}: {
  userId: string;
  email: string;
  name: string;
  plan: string;
  period: "monthly" | "yearly";
  baseUrl: string;
  onboarding?: boolean;
}) => {
  const router = useRouter();
  const { slug } = useParams() as { slug: string };
  const [loading, setLoading] = useState(false);

  // Get plan pricing based on country (will be used for display)
  const planPrices = {
    pro: {
      monthly: {
        NGN: 10000,
        USD: 24,
      },
      yearly: {
        NGN: 96000,
        USD: 228,
      },
    },
    business: {
      monthly: {
        NGN: 24190,
        USD: 59,
      },
      yearly: {
        NGN: 241900,
        USD: 588,
      },
    },
    businessPlus: {
      monthly: {
        NGN: 48790,
        USD: 119,
      },
      yearly: {
        NGN: 487900,
        USD: 1188,
      },
    },
    businessExtra: {
      monthly: {
        NGN: 102090,
        USD: 249,
      },
      yearly: {
        NGN: 979200,
        USD: 2388,
      },
    },
    businessMax: {
      monthly: {
        NGN: 204590,
        USD: 499,
      },
      yearly: {
        NGN: 1963200,
        USD: 4788,
      },
    },
  };

  // Get payment plans configuration based on plan and country
  const getPlanConfig = useCallback(
    (currency: "NGN" | "USD") => {
      // Map plan names to planId prefix
      const planMapping = {
        pro: "pro",
        business: "business",
        "business plus": "businessPlus",
        "business extra": "businessExtra",
        "business max": "businessMax",
      };

      const mappedPlan = planMapping[plan.toLowerCase()] || "pro";
      
      // Format: plan_interval_currency
      const planId = `${mappedPlan}_${period}_${currency.toLowerCase()}`;
      
      return {
        planId,
        amount: planPrices[mappedPlan][period][currency],
        currency,
      };
    },
    [plan, period, planPrices]
  );

  const handleCheckout = async () => {
    setLoading(true);
    try {
      // Get user's country from API (for this example, we'll use Nigeria)
      const userCountry = "NG"; // In production, this would be determined from geolocation
      
      // Determine currency based on country
      const currency = getDisplayCurrency(userCountry);
      
      // Get plan configuration
      const planConfig = getPlanConfig(currency);
      
      // Generate a unique transaction reference
      // Format: lnking_{userId}_{workspaceSlug}_{planName}_{interval}
      const txRef = `lnking_${userId}_${slug}_${plan.replace(" ", "")}_${period}_${nanoid(8)}`;
      
      // Initiate the payment
      const response = await initiateSubscription({
        customer: {
          email,
          name,
        },
        plan_id: planConfig.planId,
        currency: planConfig.currency,
        amount: planConfig.amount,
        redirect_url: `${baseUrl}/${slug}?${onboarding ? "onboarded" : "upgraded"}=true&plan=${plan}&period=${period}`,
      });
      
      // Redirect to Flutterwave checkout page
      if (response.status === "success" && response.data.redirect_url) {
        window.location.href = response.data.redirect_url;
      } else {
        throw new Error(response.message || "Failed to initiate payment");
      }
    } catch (error) {
      console.error(error);
      toast.error("Failed to initiate payment. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      onClick={handleCheckout}
      loading={loading}
      className="mt-4 w-full"
      variant="brand"
    >
      {loading ? "Processing..." : `Upgrade to ${plan}`}
    </Button>
  );
};

export default FlutterwaveCheckout; 
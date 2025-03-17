"use client";

import useWorkspace from "@/lib/swr/use-workspace";
import { Button, ButtonProps } from "@dub/ui";
import { cn } from "@dub/utils";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

export default function ManageSubscriptionButton(props: ButtonProps) {
  const { id: workspaceId } = useWorkspace();
  const [clicked, setClicked] = useState(false);
  const router = useRouter();

  return (
    <Button
      {...props}
      text={props.text || "Manage Subscription"}
      variant={props.variant || "secondary"}
      className={cn(props.className, "h-9")}
      onClick={() => {
        setClicked(true);
        // Open a modal for Flutterwave subscription management
        // This is a simplified implementation - in production you would want a more robust UI
        if (confirm("Do you want to cancel your subscription?")) {
          fetch(`/api/workspaces/${workspaceId}/billing/cancel`, {
            method: "POST",
          }).then(async (res) => {
            if (res.ok) {
              toast.success("Subscription cancelled successfully");
              router.refresh();
            } else {
              const { error } = await res.json();
              toast.error(error.message || "Failed to cancel subscription");
            }
            setClicked(false);
          });
        } else {
          setClicked(false);
        }
      }}
      loading={clicked}
    />
  );
}

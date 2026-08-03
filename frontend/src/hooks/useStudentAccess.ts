import { useEffect, useState } from "react";
import { apiClient } from "@/api/client";
import type { StudentCurrentPlan } from "@/api/types";

export interface StudentAccess {
  loading: boolean;
  /** True while an institute or personal subscription is active or in grace. */
  hasActivePlan: boolean;
}

/**
 * Whether the signed-in student currently has a paid plan. Drives the demo
 * experience: without one, the portal is reduced to free sample tests plus a
 * way to purchase, and every other section is hidden.
 *
 * The server remains authoritative — this only decides what is worth showing.
 */
export function useStudentAccess(): StudentAccess {
  const [loading, setLoading] = useState(true);
  const [hasActivePlan, setHasActivePlan] = useState(false);

  useEffect(() => {
    let active = true;
    apiClient
      .get<StudentCurrentPlan>("/student/my-plan")
      .then(({ data }) => {
        if (!active) return;
        setHasActivePlan(data.state === "active" || data.state === "grace");
      })
      .catch(() => {
        if (active) setHasActivePlan(false);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return { loading, hasActivePlan };
}

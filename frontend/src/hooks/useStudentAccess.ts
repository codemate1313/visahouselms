import { useEffect, useState } from "react";
import { apiClient } from "@/api/client";
import type { StudentCurrentPlan } from "@/api/types";
import { useAuthStore } from "@/store/authStore";

export interface StudentAccess {
  loading: boolean;
  /** True while an institute or personal subscription is active or in grace. */
  hasActivePlan: boolean;
}

const ACCESS_CACHE_TTL_MS = 30_000;

interface StudentAccessCacheEntry {
  key: string;
  expiresAt: number;
  plan: StudentCurrentPlan;
}

let cachedAccess: StudentAccessCacheEntry | null = null;
let accessRequest: { key: string; promise: Promise<StudentCurrentPlan> } | null = null;

function isPlanActive(data: StudentCurrentPlan) {
  return data.state === "active" || data.state === "grace";
}

export function getCachedStudentCurrentPlan(key: string): Promise<StudentCurrentPlan> {
  const now = Date.now();
  if (cachedAccess?.key === key && cachedAccess.expiresAt > now) {
    return Promise.resolve(cachedAccess.plan);
  }
  if (accessRequest?.key === key) return accessRequest.promise;

  const promise = apiClient
    .get<StudentCurrentPlan>("/student/my-plan", { headers: { "X-Skip-Loader": "1" } })
    .then(({ data }) => {
      cachedAccess = {
        key,
        expiresAt: Date.now() + ACCESS_CACHE_TTL_MS,
        plan: data,
      };
      return data;
    })
    .finally(() => {
      if (accessRequest?.key === key) accessRequest = null;
    });

  accessRequest = { key, promise };
  return promise;
}

/**
 * Whether the signed-in student currently has a paid plan. Drives the demo
 * experience: without one, the portal is reduced to free sample tests plus a
 * way to purchase, and every other section is hidden.
 *
 * The server remains authoritative — this only decides what is worth showing.
 */
export function useStudentAccess(): StudentAccess {
  const accessToken = useAuthStore((state) => state.accessToken);
  const userId = useAuthStore((state) => state.user?.id);
  const cacheKey = accessToken && userId ? `${userId}:${accessToken}` : null;
  const initialCached = cacheKey && cachedAccess?.key === cacheKey && cachedAccess.expiresAt > Date.now()
    ? isPlanActive(cachedAccess.plan)
    : null;
  const [loading, setLoading] = useState(initialCached === null);
  const [hasActivePlan, setHasActivePlan] = useState(initialCached ?? false);

  useEffect(() => {
    if (!cacheKey) {
      setHasActivePlan(false);
      setLoading(false);
      return undefined;
    }

    let active = true;
    setLoading(true);
    getCachedStudentCurrentPlan(cacheKey)
      .then((plan) => {
        if (!active) return;
        setHasActivePlan(isPlanActive(plan));
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
  }, [cacheKey]);

  return { loading, hasActivePlan };
}

/**
 * Loads the Razorpay Checkout script on demand.
 *
 * Ad-blockers and Incognito frequently drop the primary CDN, so a second host
 * is tried before giving up. A tag that is already in the document is waited on
 * rather than duplicated - and removed if it never defined the global, which is
 * what a blocked request looks like from here.
 */
const CHECKOUT_URLS = [
  "https://checkout.razorpay.com/v1/checkout.js",
  "https://checkout-static.razorpay.com/v1/checkout.js",
];

function hasRazorpay(): boolean {
  return typeof window !== "undefined" && Boolean((window as unknown as { Razorpay?: unknown }).Razorpay);
}

export async function loadRazorpayScript(): Promise<boolean> {
  if (hasRazorpay()) return true;

  for (const url of CHECKOUT_URLS) {
    let scriptEl = document.querySelector(`script[src="${url}"]`) as HTMLScriptElement | null;

    if (scriptEl) {
      for (let i = 0; i < 15; i += 1) {
        if (hasRazorpay()) return true;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      scriptEl.remove();
      scriptEl = null;
    }

    const loaded = await new Promise<boolean>((resolve) => {
      const script = document.createElement("script");
      script.src = url;
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.head.appendChild(script);
    });

    if (loaded && hasRazorpay()) return true;
  }

  return hasRazorpay();
}

export interface RazorpayCheckoutResponse {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

interface OpenCheckoutOptions {
  keyId: string;
  orderId: string;
  amount: number;
  currency: string;
  description: string;
  prefillName?: string;
  prefillEmail?: string;
  onSuccess: (response: RazorpayCheckoutResponse) => void;
  onDismiss: () => void;
  onFailure: (message: string) => void;
}

/** Opens the hosted checkout for an order the server already created. */
export function openRazorpayCheckout(options: OpenCheckoutOptions): void {
  const config = {
    key: options.keyId,
    amount: options.amount,
    currency: options.currency,
    name: "Visa House IELTS LMS",
    description: options.description,
    image: "/brand/vh-mark-96.png",
    order_id: options.orderId,
    handler: options.onSuccess,
    modal: { ondismiss: options.onDismiss },
    prefill: { name: options.prefillName ?? "", email: options.prefillEmail ?? "" },
    theme: { color: "#dc2626" },
  };

  const RazorpayCtor = (window as unknown as {
    Razorpay: new (opts: typeof config) => { open: () => void; on: (evt: string, fn: (res: unknown) => void) => void };
  }).Razorpay;

  const checkout = new RazorpayCtor(config);
  checkout.on("payment.failed", (response: unknown) => {
    const err = response as { error?: { description?: string } };
    options.onFailure(err.error?.description || "Payment failed");
  });
  checkout.open();
}

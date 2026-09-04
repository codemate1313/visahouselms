interface PydanticValidationError {
  type?: string;
  loc?: (string | number)[];
  msg?: string;
  message?: string;
}

type ErrorDetail =
  | string
  | PydanticValidationError[]
  | { message?: string; errors?: string[]; detail?: string }
  | undefined;

export function extractErrorMessage(err: unknown, fallback: string): string {
  if (typeof err === "object" && err !== null) {
    // Check if error has response.data (Axios error shape)
    const res = "response" in err ? (err as { response?: { data?: unknown } }).response : undefined;
    const data = res?.data as { detail?: ErrorDetail; message?: string } | undefined;

    if (data) {
      const detail = data.detail;

      if (typeof detail === "string" && detail.trim().length > 0) {
        return detail;
      }

      // Handle FastAPI Pydantic field validation error array (422 status)
      if (Array.isArray(detail) && detail.length > 0) {
        const messages = detail
          .map((item) => {
            if (typeof item === "string") return item;
            if (typeof item === "object" && item !== null) {
              const msg = item.msg || item.message;
              if (typeof msg === "string" && msg.trim()) {
                return msg.replace(/^Value error, /, "");
              }
            }
            return "";
          })
          .filter(Boolean);

        if (messages.length > 0) {
          return messages.join(". ");
        }
      }

      if (typeof detail === "object" && detail !== null && !Array.isArray(detail)) {
        const msg = typeof detail.message === "string" && detail.message.trim() ? detail.message.trim() : "";
        const errList = Array.isArray(detail.errors) && detail.errors.length > 0
          ? detail.errors.filter((e) => typeof e === "string" && e.trim()).join(". ")
          : "";
        if (msg && errList) {
          return `${msg}: ${errList}`;
        }
        if (msg) return msg;
        if (errList) return errList;
        if (typeof detail.detail === "string" && detail.detail.trim()) {
          return detail.detail;
        }
      }

      if (typeof data.message === "string" && data.message.trim()) {
        return data.message;
      }
    }

    if ("message" in err && typeof (err as { message?: string }).message === "string") {
      const msg = (err as { message: string }).message;
      if (msg && !msg.includes("Request failed with status code")) {
        return msg;
      }
    }
  }

  return fallback;
}

interface PydanticValidationError {
  type: string;
  loc: (string | number)[];
  msg: string;
}

type ErrorDetail = string | PydanticValidationError[] | undefined;

export function extractErrorMessage(err: unknown, fallback: string): string {
  if (typeof err === "object" && err !== null && "response" in err) {
    const response = (err as { response?: { data?: { detail?: ErrorDetail } } }).response;
    const detail = response?.data?.detail;

    if (typeof detail === "string" && detail.length > 0) {
      return detail;
    }

    // FastAPI's automatic 422 shape for pydantic field_validator errors
    // (e.g. password strength rules) is a list of {type, loc, msg, ...}
    // rather than our own HTTPException's plain string detail.
    if (Array.isArray(detail) && detail.length > 0) {
      return detail
        .map((item) => item.msg.replace(/^Value error, /, ""))
        .join(" ");
    }
  }
  return fallback;
}

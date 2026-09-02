/**
 * Hands the candidate over to PayU.
 *
 * PayU has no JavaScript checkout: the signed fields have to arrive as a real
 * form POST from the browser, and the page navigates away. That is why this
 * builds a form and submits it rather than opening a modal - and why the
 * caller cannot await a result. PayU brings the candidate back to the return
 * URL, and the server settles the payment from what it sends.
 */
export function submitPayuCheckout(action: string, fields: Record<string, string>): void {
  const form = document.createElement("form");
  form.method = "POST";
  form.action = action;
  // Hidden, but appended: a detached form cannot be submitted.
  form.style.display = "none";

  Object.entries(fields).forEach(([name, value]) => {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = name;
    input.value = value ?? "";
    form.appendChild(input);
  });

  document.body.appendChild(form);
  form.submit();
}

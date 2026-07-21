import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiClient } from "../../api/client";

interface OnboardingRow { id: number; name: string; contact_email: string | null; onboarding_status: "draft" | "published"; agreed_amount: string; agreement_currency: string; payment: { amount_paid: string; status: string } | null; student_limit: number; staff_limit: number; course_count: number; member_count: number; created_at: string }

export function InstituteOnboardings() {
  const [rows, setRows] = useState<OnboardingRow[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { apiClient.get<OnboardingRow[]>("/super-admin/onboarding").then(({ data }) => setRows(data)).finally(() => setLoading(false)); }, []);
  return <div><div className="page-header"><div><h1>Institute Onboarding</h1><p className="page-subtitle">Manage physical agreements from first payment through portal publication.</p></div><Link className="button-link" to="/super-admin/onboarding/new">Onboard institute</Link></div>
    {loading ? <p>Loading...</p> : <table className="data-table"><thead><tr><th>Institute</th><th>Agreement</th><th>Payment</th><th>Allocation</th><th>Courses</th><th>Status</th><th /></tr></thead><tbody>{!rows.length ? <tr><td colSpan={7} className="empty-cell">No institute onboardings yet.</td></tr> : rows.map((row) => <tr key={row.id}><td><strong>{row.name}</strong><div className="hint">{row.contact_email || "No contact email"}</div></td><td>{row.agreement_currency} {Number(row.agreed_amount || 0).toLocaleString("en-IN")}</td><td>{row.payment ? `${row.agreement_currency} ${Number(row.payment.amount_paid).toLocaleString("en-IN")}` : "Not recorded"}<div className="hint">{row.payment?.status || "pending"}</div></td><td>{row.student_limit} students / {row.staff_limit} staff<div className="hint">{row.member_count} accounts issued</div></td><td>{row.course_count}</td><td><span className={`badge ${row.onboarding_status === "published" ? "badge-green" : "badge-amber"}`}>{row.onboarding_status}</span></td><td><Link to={`/super-admin/onboarding/${row.id}`}>{row.onboarding_status === "draft" ? "Continue" : "View"}</Link></td></tr>)}</tbody></table>}
  </div>;
}

import { type FormEvent, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { apiClient } from "../../api/client";
import { extractErrorMessage } from "../../api/errors";
import { PasswordInput } from "../../components/PasswordInput";
import { PasswordStrengthMeter } from "../../components/PasswordStrengthMeter";
import { evaluatePassword } from "../../utils/passwordStrength";

export function AccountForm() {
  const { id } = useParams();
  const isNew = id === "new" || id === undefined;
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isNew) return;
    apiClient
      .get(`/super-admin/accounts/${id}`)
      .then(({ data }) => {
        setEmail(data.email);
        setFirstName(data.first_name);
        setLastName(data.last_name);
      })
      .catch(() => setError("Failed to load account."))
      .finally(() => setLoading(false));
  }, [id, isNew]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSaving(true);
    try {
      if (isNew) {
        await apiClient.post("/super-admin/accounts", {
          email,
          password,
          first_name: firstName,
          last_name: lastName,
        });
      } else {
        await apiClient.patch(`/super-admin/accounts/${id}`, {
          email,
          first_name: firstName,
          last_name: lastName,
        });
      }
      navigate("/super-admin/accounts");
    } catch (err: unknown) {
      setError(extractErrorMessage(err, "Failed to save account."));
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p>Loading...</p>;

  return (
    <div>
      <h1>{isNew ? "New Super Admin" : "Edit Super Admin"}</h1>
      <form className="form-card" onSubmit={handleSubmit}>
        <label htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />

        {isNew && (
          <>
            <label htmlFor="password">Password</label>
            <PasswordInput
              id="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
            <PasswordStrengthMeter password={password} />
          </>
        )}

        <label htmlFor="first_name">First name</label>
        <input
          id="first_name"
          value={firstName}
          onChange={(event) => setFirstName(event.target.value)}
          required
        />

        <label htmlFor="last_name">Last name</label>
        <input
          id="last_name"
          value={lastName}
          onChange={(event) => setLastName(event.target.value)}
          required
        />

        {error && <p className="error-text">{error}</p>}

        <div className="form-actions">
          <button
            type="submit"
            disabled={saving || (isNew && !evaluatePassword(password).allMet)}
          >
            {saving ? "Saving..." : "Save"}
          </button>
          <button type="button" onClick={() => navigate("/super-admin/accounts")}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}


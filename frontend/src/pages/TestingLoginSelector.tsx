import { Link } from "react-router-dom";
import { Icon } from "../components/icons";

export function TestingLoginSelector() {
  return (
    <div className="testing-login-page">
      <section className="testing-login-panel" aria-labelledby="testing-login-title">
        <div className="testing-login-kicker">Testing access</div>
        <h1 id="testing-login-title">Choose account type</h1>
        <p>
          Select which portal you want to test. Each option opens the correct login screen for that role.
        </p>

        <div className="testing-login-actions">
          <Link className="testing-login-card testing-login-card-primary" to="/super-admin/login">
            <span className="testing-login-icon" aria-hidden="true">
              <Icon name="admin" />
            </span>
            <span>
              <strong>Super Admin</strong>
              <small>Platform owner dashboard, SaaS controls, accounts and revenue.</small>
            </span>
            <span className="testing-login-arrow" aria-hidden="true">→</span>
          </Link>

          <Link className="testing-login-card" to="/sa-instructor/login">
            <span className="testing-login-icon" aria-hidden="true">
              <Icon name="grading" />
            </span>
            <span>
              <strong>SA Instructor</strong>
              <small>Assessment authoring, modules, mock tests and grading queue.</small>
            </span>
            <span className="testing-login-arrow" aria-hidden="true">→</span>
          </Link>
        </div>

        <Link className="testing-login-secondary" to="/login">
          Continue to institute/student portal login
        </Link>
      </section>
    </div>
  );
}

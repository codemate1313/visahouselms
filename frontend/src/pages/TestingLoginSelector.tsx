import { Link } from "react-router-dom";
import { Icon } from "@/components/icons";
import { testingLoginSelectorStrings as strings } from "./TestingLoginSelector.strings";

export function TestingLoginSelector() {
  return (
    <div className="testing-login-page">
      <section className="testing-login-panel" aria-labelledby="testing-login-title">
        <div className="testing-login-kicker">{strings.kicker}</div>
        <h1 id="testing-login-title">{strings.title}</h1>
        <p>{strings.description}</p>

        <div className="testing-login-actions">
          <Link className="testing-login-card testing-login-card-primary" to="/super-admin/login">
            <span className="testing-login-icon" aria-hidden="true">
              <Icon name="admin" />
            </span>
            <span>
              <strong>{strings.superAdmin.title}</strong>
              <small>{strings.superAdmin.description}</small>
            </span>
            <Icon name="arrowRight" />
          </Link>

          <Link className="testing-login-card" to="/sa-instructor/login">
            <span className="testing-login-icon" aria-hidden="true">
              <Icon name="grading" />
            </span>
            <span>
              <strong>{strings.saInstructor.title}</strong>
              <small>{strings.saInstructor.description}</small>
            </span>
            <Icon name="arrowRight" />
          </Link>
        </div>

        <Link className="testing-login-secondary" to="/login">
          {strings.continueLabel}
        </Link>
      </section>
    </div>
  );
}

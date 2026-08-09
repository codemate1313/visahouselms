# Workspace Behavioral Rules

## Pre-Push Verification Directive
Before committing or pushing code to the remote repository (`git push`), ALWAYS execute the following automated verification checks:

1. **Frontend Build Check:**
   - Execute `npm run build` in `frontend/`.
   - Ensure 0 TypeScript linting or Vite compilation errors exist.

2. **Backend Compilation Check:**
   - Execute `.venv/bin/python -m compileall app` in `backend/`.
   - Ensure 0 Python syntax, schema, or import errors exist.

3. **CI/CD Workflow Validation:**
   - Whenever modifying `.github/workflows/deploy.yml` or any workflow file, validate YAML syntax using PyYAML (`python -c "import yaml; yaml.safe_load(open('...'))"`).

4. **Zero Unverified Pushes:**
   - Never push code to `origin main` unless all local verification commands complete with exit code 0.

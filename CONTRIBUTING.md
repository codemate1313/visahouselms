# Contributing to Visa House LMS

First off, thank you for considering contributing to Visa House LMS! It's people like you that make it a great platform.

## Code of Conduct

By participating in this project, you agree to abide by the [Code of Conduct](CODE_OF_CONDUCT.md).

## Development Setup

### Backend (FastAPI)
1. Navigate to the `backend/` directory.
2. Setup virtual environment: `python3 -m venv venv` and activate it.
3. Install dependencies: `pip install -r requirements.txt`.
4. Run server: `uvicorn app.main:app --reload`.

### Frontend (React/Vite)
1. Navigate to the `frontend/` directory.
2. Install dependencies: `npm install`.
3. Run development server: `npm run dev`.

## Pull Request Process

1. Create a new branch for your changes: `git checkout -b feature/your-feature-name`.
2. Write clean, readable, and commented code.
3. Ensure no lint or build errors:
   - Backend: run tests with `pytest`.
   - Frontend: verify with `npm run build`.
4. Commit your changes: `git commit -m "feat: add awesome feature"`.
5. Push to your branch and open a Pull Request.

## Coding Style guidelines

### Backend (Python/FastAPI)
- Follow PEP 8 guidelines.
- Use explicit type annotations for function parameters and return types.
- Ensure all services and routes are properly structured and documented.

### Frontend (TypeScript/React)
- Use functional components with hooks.
- Prefix custom hooks with `use`.
- Write clean and responsive styles using Vanilla CSS rules.
- Follow existing directory structure (e.g., `components`, `store`, `pages`).

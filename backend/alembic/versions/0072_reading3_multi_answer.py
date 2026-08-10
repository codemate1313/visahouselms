"""allow a Reading 3 question to accept more than one source text

Reading 3 matches statements to source texts A-D. A question normally takes one
text, and a text may answer several questions. This adds the option for a single
question to accept more than one text, which needs `mcq_multiple` in the part's
allowed question types plus a `multi_answer_allowed` flag the authoring UI reads.

Part constraints are copied out of the blueprint when a module is created, so
updating the blueprint only affects new modules. This migration brings existing
Reading 3 parts in line. It is additive: single-answer questions already stored
as `matching_reusable` keep working exactly as before, and nothing is removed.

Revision ID: 0072
Revises: 0071
Create Date: 2026-08-11

"""
import json

from alembic import op
import sqlalchemy as sa

revision = "0072"
down_revision = "0071"
branch_labels = None
depends_on = None


def _rewrite(add: bool) -> None:
    """Add or remove the multi-answer affordances on every Reading 3 part."""
    bind = op.get_bind()
    rows = bind.execute(
        sa.text(
            "SELECT id, answer_constraints FROM exam_module_parts WHERE part_code = 'reading_3'"
        )
    ).fetchall()

    for row in rows:
        raw = row[1]
        if raw is None:
            continue
        constraints = json.loads(raw) if isinstance(raw, (str, bytes)) else dict(raw)
        allowed = list(constraints.get("allowed_question_types") or ["matching_reusable"])

        if add:
            if "mcq_multiple" not in allowed:
                allowed.append("mcq_multiple")
            constraints["multi_answer_allowed"] = True
        else:
            allowed = [item for item in allowed if item != "mcq_multiple"]
            constraints.pop("multi_answer_allowed", None)

        constraints["allowed_question_types"] = allowed
        bind.execute(
            sa.text("UPDATE exam_module_parts SET answer_constraints = :c WHERE id = :i"),
            {"c": json.dumps(constraints), "i": row[0]},
        )


def upgrade() -> None:
    _rewrite(add=True)


def downgrade() -> None:
    # Questions saved as mcq_multiple would no longer be a permitted type for the
    # part after this runs; they are left in place rather than silently rewritten,
    # so the publishing check surfaces them for a human to resolve.
    _rewrite(add=False)

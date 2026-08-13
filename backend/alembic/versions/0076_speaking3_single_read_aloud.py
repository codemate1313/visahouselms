"""reduce Speaking 3 to a single read-aloud turn

Speaking 3 used to pair a read-aloud text with follow-up questions, so a part
needed at least two questions and drew every one of them. The part is now one
turn only: the candidate reads a single text aloud and nothing is asked after
it. `question_limit = 1` lets the pool keep several texts while a sitting draws
exactly one, and `follow_up` is no longer an allowed turn type.

Part constraints are copied out of the blueprint when a module is created, so
updating the blueprint only affects new modules. This migration brings existing
Speaking 3 parts in line. Follow-up questions already authored are left in the
pool rather than deleted: speaking parts preserve question order, so the
read-aloud text authored first is the one drawn, and the leftovers stay visible
in the editor for a human to remove.

Revision ID: 0076
Revises: 0075
Create Date: 2026-08-12

"""
import json

from alembic import op
import sqlalchemy as sa

revision = "0076"
down_revision = "0075"
branch_labels = None
depends_on = None


def _rewrite(*, question_limit, minimum_questions: int, turn_types: list[str]) -> None:
    """Point every Speaking 3 part at the given turn structure."""
    bind = op.get_bind()
    rows = bind.execute(
        sa.text(
            "SELECT id, answer_constraints FROM exam_module_parts WHERE part_code = 'speaking_3'"
        )
    ).fetchall()

    for row in rows:
        raw = row[1]
        constraints = {} if raw is None else (json.loads(raw) if isinstance(raw, (str, bytes)) else dict(raw))
        constraints["required_turn_types"] = list(turn_types)
        constraints["allowed_turn_types"] = list(turn_types)
        bind.execute(
            sa.text(
                "UPDATE exam_module_parts "
                "SET answer_constraints = :c, question_limit = :l, minimum_questions = :m "
                "WHERE id = :i"
            ),
            {
                "c": json.dumps(constraints),
                "l": question_limit,
                "m": minimum_questions,
                "i": row[0],
            },
        )


def upgrade() -> None:
    _rewrite(question_limit=1, minimum_questions=1, turn_types=["read_aloud"])


def downgrade() -> None:
    # A part left holding only the read-aloud text no longer meets the restored
    # two-question minimum; publishing reports it so the follow-up can be added
    # back deliberately instead of being invented here.
    _rewrite(question_limit=None, minimum_questions=2, turn_types=["read_aloud", "follow_up"])

"""let every speaking part carry a spoken heading, not Speaking 2 alone

0089 gave the heading to Speaking 2, where a role play is announced before it is
asked. The same announcement belongs to the other three: Part 1 opens a topic
before asking about it, Part 3 introduces the text before the candidate reads it
and Part 4 sets up the presentation. The heading and its pause are optional on
every prompt - a part with none is asked exactly as it was before.

Only part constraints change. Prompts already authored keep their wording, and
`default_heading_gap_seconds` is left as 0089 set it.

Revision ID: 0090
Revises: 0089
Create Date: 2026-08-19

"""
import json

from alembic import op
import sqlalchemy as sa

revision = "0090"
down_revision = "0089"
branch_labels = None
depends_on = None

_SPEAKING_PART_CODES = ("speaking_1", "speaking_2", "speaking_3", "speaking_4")


def _load(raw) -> dict:
    if raw is None:
        return {}
    if isinstance(raw, (str, bytes)):
        return json.loads(raw)
    return dict(raw)


def _apply(spoken_heading_for) -> None:
    bind = op.get_bind()
    for part_code in _SPEAKING_PART_CODES:
        rows = bind.execute(
            sa.text(
                "SELECT id, answer_constraints FROM exam_module_parts WHERE part_code = :p"
            ),
            {"p": part_code},
        ).fetchall()
        for part_id, raw in rows:
            constraints = _load(raw)
            constraints["spoken_heading"] = spoken_heading_for(part_code)
            bind.execute(
                sa.text(
                    "UPDATE exam_module_parts SET answer_constraints = :c WHERE id = :i"
                ),
                {"c": json.dumps(constraints), "i": part_id},
            )


def upgrade() -> None:
    _apply(lambda part_code: True)


def downgrade() -> None:
    # Headings authored on Parts 1, 3 and 4 stay on their prompts. Nothing
    # speaks them once the constraint is off, but deleting authored wording to
    # undo a constraint would lose work a re-upgrade would want back.
    _apply(lambda part_code: part_code == "speaking_2")

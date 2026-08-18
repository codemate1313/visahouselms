"""let Speaking 2 prompts carry a heading the examiner speaks before the question

A role play is announced before it is asked - "Situation 1: you are at a hotel
reception" - and the examiner pauses after the announcement so the candidate can
take the situation in before the question lands on top of it. That heading is
now a field of its own on the prompt (`interaction.heading`) with its own pause
(`interaction.heading_gap_seconds`), rather than the first sentence of the
question text, because the pause cannot exist inside a single spoken line.

Two constraints are added to every speaking part:

  `spoken_heading` - whether the part's prompts may carry one. True for
  Speaking 2 only; elsewhere the framing belongs in the question itself, and
  authoring refuses a heading rather than saving one nothing would speak.

  `default_heading_gap_seconds` - the pause used when a prompt has a heading but
  no pause of its own, so prompts authored before this revision still play with
  a deliberate gap rather than none.

No question rows are touched: prompts already authored have no heading, and
adding one is the author's edit to make.

Revision ID: 0089
Revises: 0088
Create Date: 2026-08-18

"""
import json

from alembic import op
import sqlalchemy as sa

revision = "0089"
down_revision = "0088"
branch_labels = None
depends_on = None

# Kept literal rather than imported from the blueprint: a migration describes
# the schema of its own moment in history.
_DEFAULT_HEADING_GAP_SECONDS = 3

_SPEAKING_PART_CODES = ("speaking_1", "speaking_2", "speaking_3", "speaking_4")


def _load(raw) -> dict:
    if raw is None:
        return {}
    if isinstance(raw, (str, bytes)):
        return json.loads(raw)
    return dict(raw)


def _apply(*, add: bool) -> None:
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
            if add:
                constraints["spoken_heading"] = part_code == "speaking_2"
                constraints["default_heading_gap_seconds"] = _DEFAULT_HEADING_GAP_SECONDS
            else:
                constraints.pop("spoken_heading", None)
                constraints.pop("default_heading_gap_seconds", None)
            bind.execute(
                sa.text(
                    "UPDATE exam_module_parts SET answer_constraints = :c WHERE id = :i"
                ),
                {"c": json.dumps(constraints), "i": part_id},
            )


def upgrade() -> None:
    _apply(add=True)


def downgrade() -> None:
    # Headings already authored stay on their prompts. Without `spoken_heading`
    # nothing speaks them, but deleting authored wording to undo a constraint
    # would lose work a re-upgrade would want back.
    _apply(add=False)

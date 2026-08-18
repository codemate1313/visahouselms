"""remove the question ceilings from every Speaking part

After 0087 a speaking part still carried a count cap: Speaking 1 a
`maximum_questions` of 6, Speaking 3 and 4 one of 4, and Speaking 2 a fixed
`question_limit` of 2 with both of its role-play turns marked singleton. An
examiner authoring a module decides how many prompts a part needs - the format
fixes no number of follow-ups, and the published "one or more as time allows"
is an instruction to the interlocutor, not a limit on the bank - so the caps are
gone and a part's length simply lengthens the derived duration, which is
already summed from each prompt's own preparation and response time.

What each part still fixes is its shape. `singleton_turn_types` keeps the
headline turn to one - one identity exchange, one read-aloud text, one
presentation stimulus - because a second would be a second task rather than
another question about the first. Speaking 2 is two role-play *directions*
rather than one headline turn plus a bank, so its singleton list is cleared and
either direction may now be authored more than once.

Part constraints are copied out of the blueprint when a module is created, so
updating the blueprint only affects new modules. This migration lifts the caps
on the parts that already exist. Minimum counts, turn types and per-turn
timings are left exactly as 0087 set them.

Revision ID: 0088
Revises: 0087
Create Date: 2026-08-18

"""
import json

from alembic import op
import sqlalchemy as sa

revision = "0088"
down_revision = "0087"
branch_labels = None
depends_on = None

# part_code -> (question_limit, maximum_questions, singleton_turn_types)
_UNCAPPED = {
    "speaking_1": (None, None, ["identity"]),
    "speaking_2": (None, None, []),
    "speaking_3": (None, None, ["read_aloud"]),
    "speaking_4": (None, None, ["presentation"]),
}

# What 0087 left behind, so downgrade puts it back exactly.
_PREVIOUS = {
    "speaking_1": (None, 6, ["identity"]),
    "speaking_2": (2, None, ["roleplay_response", "roleplay_initiate"]),
    "speaking_3": (None, 4, ["read_aloud"]),
    "speaking_4": (None, 4, ["presentation"]),
}


def _load(raw) -> dict:
    if raw is None:
        return {}
    if isinstance(raw, (str, bytes)):
        return json.loads(raw)
    return dict(raw)


def _apply(targets: dict) -> None:
    bind = op.get_bind()
    for part_code, (question_limit, maximum_questions, singleton) in targets.items():
        rows = bind.execute(
            sa.text(
                "SELECT id, answer_constraints FROM exam_module_parts WHERE part_code = :p"
            ),
            {"p": part_code},
        ).fetchall()

        for row in rows:
            constraints = _load(row[1])
            if maximum_questions is None:
                constraints.pop("maximum_questions", None)
            else:
                constraints["maximum_questions"] = maximum_questions
            constraints["singleton_turn_types"] = list(singleton)
            bind.execute(
                sa.text(
                    "UPDATE exam_module_parts "
                    "SET answer_constraints = :c, question_limit = :l "
                    "WHERE id = :i"
                ),
                {"c": json.dumps(constraints), "l": question_limit, "i": row[0]},
            )


def upgrade() -> None:
    _apply(_UNCAPPED)


def downgrade() -> None:
    # A part authored past the restored cap keeps its prompts: publishing
    # reports it as over the limit so a human decides which to drop, rather
    # than a migration deleting authored work.
    _apply(_PREVIOUS)

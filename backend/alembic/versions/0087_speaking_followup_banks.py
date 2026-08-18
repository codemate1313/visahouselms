"""restore Speaking 3 follow-ups and give every speaking turn its own clock

LANGUAGECERT Academic Speaking is four parts in approximately 14 minutes. Part 3
is a read-aloud text *and* the questions the examiner asks about it; Part 4 is a
presentation *and* its follow-ups. In both the published format fixes no number
of follow-ups - the interlocutor asks "one or more as time allows" - so a module
stores a bank and the examiner draws from it.

Revision 0076 had reduced Part 3 to a single read-aloud with no follow-ups. This
restores the pairing and widens Part 4's bank from two follow-ups to three, so
both parts hold one headline task plus up to three follow-ups.

Two constraints are added to every speaking part:

  `singleton_turn_types` - the turns that may appear only once. A ceiling alone
  cannot distinguish "one read-aloud plus three follow-ups" from "four
  read-alouds", and 0076 deliberately left extra read-aloud texts in the pool,
  so parts carrying more than one will now report it at publish time. Nothing is
  deleted here: which text to keep is the author's call, not a migration's.

  `turn_timings` - per-turn preparation/response defaults. A single per-part pair
  gave a Part 4 follow-up the presentation's 60s+120s, which put three
  follow-ups at nine minutes on their own.

Only part constraints are rewritten. Questions already authored keep their own
prompts, order and timings: `turn_timings` seeds the authoring form for *new*
prompts and never re-clocks an existing one.

Revision ID: 0087
Revises: 0086
Create Date: 2026-08-18

"""
import json

from alembic import op
import sqlalchemy as sa

revision = "0087"
down_revision = "0086"
branch_labels = None
depends_on = None


# Kept literal rather than imported from app.services.module_blueprint_service:
# a migration has to keep describing the schema of its own moment in history,
# and would otherwise silently change meaning when the blueprint is next edited.
_TURN_TIMINGS = {
    "identity": {"preparation_seconds": 0, "response_seconds": 30},
    "topic_question": {"preparation_seconds": 0, "response_seconds": 30},
    "roleplay_response": {"preparation_seconds": 0, "response_seconds": 60},
    "roleplay_initiate": {"preparation_seconds": 0, "response_seconds": 60},
    "read_aloud": {"preparation_seconds": 20, "response_seconds": 90},
    "presentation": {"preparation_seconds": 60, "response_seconds": 120},
    "follow_up": {"preparation_seconds": 0, "response_seconds": 40},
}

# part_code -> (question_limit, minimum_questions, maximum_questions,
#               required_turn_types, allowed_turn_types, singleton_turn_types)
_TARGET = {
    "speaking_1": (None, 2, 6, ["identity", "topic_question"],
                   ["identity", "topic_question", "follow_up"], ["identity"]),
    "speaking_2": (2, 2, None, ["roleplay_response", "roleplay_initiate"],
                   ["roleplay_response", "roleplay_initiate"],
                   ["roleplay_response", "roleplay_initiate"]),
    "speaking_3": (None, 2, 4, ["read_aloud", "follow_up"],
                   ["read_aloud", "follow_up"], ["read_aloud"]),
    "speaking_4": (None, 2, 4, ["presentation", "follow_up"],
                   ["presentation", "follow_up"], ["presentation"]),
}

# What 0086 left behind, so downgrade puts it back exactly.
_PREVIOUS = {
    "speaking_1": (None, 2, 6, ["identity", "topic_question"],
                   ["identity", "topic_question", "follow_up"]),
    "speaking_2": (2, 2, None, ["roleplay_response", "roleplay_initiate"],
                   ["roleplay_response", "roleplay_initiate"]),
    "speaking_3": (1, 1, None, ["read_aloud"], ["read_aloud"]),
    "speaking_4": (None, 2, 3, ["presentation", "follow_up"],
                   ["presentation", "follow_up"]),
}

_LEGACY_SUGGESTED = {
    "speaking_1": (0, 45),
    "speaking_2": (0, 60),
    "speaking_3": (20, 90),
    "speaking_4": (60, 120),
}


def _load(raw) -> dict:
    if raw is None:
        return {}
    if isinstance(raw, (str, bytes)):
        return json.loads(raw)
    return dict(raw)


def _apply(targets: dict, *, with_turn_timings: bool) -> None:
    bind = op.get_bind()
    for part_code, spec in targets.items():
        question_limit, minimum_questions, maximum_questions = spec[0], spec[1], spec[2]
        required, allowed = spec[3], spec[4]
        singleton = spec[5] if len(spec) > 5 else None

        rows = bind.execute(
            sa.text(
                "SELECT id, answer_constraints FROM exam_module_parts WHERE part_code = :p"
            ),
            {"p": part_code},
        ).fetchall()

        for row in rows:
            constraints = _load(row[1])
            constraints["required_turn_types"] = list(required)
            constraints["allowed_turn_types"] = list(allowed)
            if maximum_questions is None:
                constraints.pop("maximum_questions", None)
            else:
                constraints["maximum_questions"] = maximum_questions

            if with_turn_timings:
                constraints["turn_timings"] = {
                    turn: dict(_TURN_TIMINGS[turn]) for turn in allowed
                }
                constraints["singleton_turn_types"] = list(singleton or [])
                # The headline turn's pair, which is what pre-0087 clients read.
                primary = required[0]
                constraints["suggested_preparation_seconds"] = _TURN_TIMINGS[primary]["preparation_seconds"]
                constraints["suggested_response_seconds"] = _TURN_TIMINGS[primary]["response_seconds"]
            else:
                constraints.pop("turn_timings", None)
                constraints.pop("singleton_turn_types", None)
                preparation, response = _LEGACY_SUGGESTED[part_code]
                constraints["suggested_preparation_seconds"] = preparation
                constraints["suggested_response_seconds"] = response

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
    _apply(_TARGET, with_turn_timings=True)


def downgrade() -> None:
    # A Part 3 that gained a follow-up under this revision keeps it in the pool;
    # with `question_limit = 1` restored, a sitting draws the first prompt only,
    # which is the read-aloud because speaking parts preserve question order.
    _apply(_PREVIOUS, with_turn_timings=False)

"""Authoritative assessment structures used by module authoring.

The blueprint is deliberately data-driven: creating a module copies these
parts into the database, so every upload/question must be attached to an
explicit assessment part and publish validation can enforce the specification.
"""
from copy import deepcopy

from fastapi import HTTPException, status

from app.models.exam_module import MODULE_TYPES


WRITING_RUBRIC = [
    {
        "criterion": "Task Achievement",
        "max_marks": 8,
        "description": "How fully the response addresses the task and does what was asked.",
    },
    {
        "criterion": "Grammar",
        "max_marks": 8,
        "description": "Range, appropriacy and accuracy of grammar for the test level.",
    },
    {
        "criterion": "Vocabulary",
        "max_marks": 8,
        "description": "Range, accuracy and appropriacy of vocabulary and spelling for the test level.",
    },
    {
        "criterion": "Organisation",
        "max_marks": 8,
        "description": "Coherent linking of ideas and accurate punctuation.",
    },
]

# Each Speaking part carries a quarter of the 40-mark Speaking total, so the
# whole test is marked out of 40 - in line with Reading (30) and Listening
# (30). Previously every part carried the full 40, which made a Speaking
# module worth 160 and let it dominate a Full Mock Test's overall score.
SPEAKING_RUBRIC = [
    {
        "criterion": "Task Fulfilment and Communicative Effect",
        "max_marks": 2,
        "weight": 2,
        "description": "Ability to manage the task at the required level and link utterances into coherent speech.",
    },
    {
        "criterion": "Coherence",
        "max_marks": 2,
        "description": "Ability to give coherent responses, especially in extended speech, and link ideas and contributions.",
    },
    {
        "criterion": "Accuracy and Range of Grammar",
        "max_marks": 2,
        "description": "Ability to vary and control grammatical structures appropriate to the task.",
    },
    {
        "criterion": "Accuracy and Range of Vocabulary",
        "max_marks": 2,
        "description": "Ability to vary and control lexis and register appropriate to the task.",
    },
    {
        "criterion": "Pronunciation, Intonation and Fluency",
        "max_marks": 2,
        "description": "Understandable English sounds with appropriate stress and intonation while maintaining the flow of speech.",
    },
]


READING_PARTS = [
    {
        "part_code": "reading_1a",
        "section_type": "reading",
        "title": "Reading 1A",
        "skill_focus": "Understand vocabulary used in academic texts; identify synonyms and use vocabulary in context.",
        "instructions": "Read each sentence. Choose the word that can best replace the bold word without changing the meaning.",
        "question_limit": 6,
        "minimum_questions": 6,
        "max_marks": 6,
        "auto_marked": True,
        "answer_constraints": {
            "allowed_question_types": ["mcq_single"],
            "option_count": 4,
            "preserve_question_order": True,
            "preserve_option_order": True,
        },
    },
    {
        "part_code": "reading_1b",
        "section_type": "reading",
        "title": "Reading 1B",
        "skill_focus": "Understand vocabulary and lexico-grammatical features in academic texts.",
        "instructions": "Read the text and choose the correct word for each gap.",
        "question_limit": 5,
        "minimum_questions": 5,
        "max_marks": 5,
        "auto_marked": True,
        "answer_constraints": {
            "allowed_question_types": ["mcq_single"],
            "option_count": 3,
            "passage_required": True,
            "shared_passage": True,
            "layout": "shared_cloze",
            "preserve_question_order": True,
            "preserve_option_order": True,
        },
    },
    {
        "part_code": "reading_2",
        "section_type": "reading",
        "title": "Reading 2",
        "skill_focus": "Understand how meaning is built in discourse and recognise text organisation and discourse features.",
        "instructions": "Read the text. Six sentences have been removed. Choose the sentence that best fits each gap. One sentence is a distractor.",
        "question_limit": 6,
        "minimum_questions": 6,
        "max_marks": 6,
        "auto_marked": True,
        "answer_constraints": {
            "allowed_question_types": ["matching_unique"],
            "option_count": 8,
            "passage_required": True,
            "shared_passage": True,
            "shared_options": True,
            "unique_answers": True,
            "layout": "inline_matching_blanks",
            "preserve_question_order": True,
            "preserve_option_order": True,
        },
    },
    {
        "part_code": "reading_3",
        "section_type": "reading",
        "title": "Reading 3",
        "skill_focus": "Understand the purpose of different texts and scan and locate specific information.",
        "instructions": "Read texts A–D. For questions 18–24, decide which text answers the question.",
        "question_limit": 7,
        "minimum_questions": 7,
        "max_marks": 7,
        "auto_marked": True,
        "answer_constraints": {
            # A question normally takes one source text, and a text may answer
            # several questions (reusable). `mcq_multiple` is allowed alongside
            # it so a question can accept more than one text where the item
            # genuinely calls for it - note that a multi-answer item is marked
            # on an exact set match, with no partial credit.
            "allowed_question_types": ["matching_reusable", "mcq_multiple"],
            "option_count": 4,
            "passage_required": True,
            "shared_passage": True,
            "shared_options": True,
            "multi_answer_allowed": True,
            "layout": "source_text_matching",
            "preserve_question_order": True,
            "preserve_option_order": True,
        },
    },
    {
        "part_code": "reading_4",
        "section_type": "reading",
        "title": "Reading 4",
        "skill_focus": "Understand long complex texts including opinion, purpose, argumentation, exemplification, comparison and contrast, cause and effect, and locate specific information.",
        "instructions": "Read the text and choose the correct answer for each question.",
        "question_limit": 6,
        "minimum_questions": 6,
        "max_marks": 6,
        "auto_marked": True,
        "answer_constraints": {
            "allowed_question_types": ["mcq_single"],
            "option_count": 4,
            "passage_required": True,
            "shared_passage": True,
            "preserve_question_order": True,
            "preserve_option_order": True,
        },
    },
]

LISTENING_PARTS = [
    {
        "part_code": "listening_1",
        "section_type": "listening",
        "title": "Listening 1",
        "skill_focus": "Complete seven short unfinished dialogues by choosing the correct response.",
        "instructions": "Seven three-option multiple-choice questions. Play the audio twice.",
        "question_limit": 7,
        "minimum_questions": 7,
        "max_marks": 7,
        "auto_marked": True,
        "answer_constraints": {"allowed_question_types": ["mcq_single"], "option_count": 3, "audio_plays": 2, "audio_required": True, "preserve_question_order": True, "preserve_option_order": True},
    },
    {
        "part_code": "listening_2",
        "section_type": "listening",
        "title": "Listening 2",
        "skill_focus": "Understand five conversations set in an academic context.",
        "instructions": "Two three-option multiple-choice questions per conversation. Play the audio twice.",
        "question_limit": 10,
        "minimum_questions": 10,
        "max_marks": 10,
        "auto_marked": True,
        "answer_constraints": {"allowed_question_types": ["mcq_single"], "option_count": 3, "audio_plays": 2, "audio_required": True, "group_count": 5, "questions_per_group": 2, "group_label_required": True, "layout": "conversation_groups", "preserve_question_order": True, "preserve_option_order": True},
    },
    {
        "part_code": "listening_3",
        "section_type": "listening",
        "title": "Listening 3",
        "skill_focus": "Identify specific information from an academic lecture or podcast.",
        "instructions": "Seven gap answers of no more than three words. Play the audio twice.",
        "question_limit": 7,
        "minimum_questions": 7,
        "max_marks": 7,
        "auto_marked": True,
        "answer_constraints": {"allowed_question_types": ["fill_blank", "short_answer"], "max_answer_words": 3, "audio_plays": 2, "audio_required": True, "inline_marker_required": True, "layout": "notepad_gaps", "preserve_question_order": True},
    },
    {
        "part_code": "listening_4",
        "section_type": "listening",
        "title": "Listening 4",
        "skill_focus": "Understand a group discussion or debate in an academic context.",
        "instructions": "Six three-option multiple-choice questions. Play the audio twice.",
        "question_limit": 6,
        "minimum_questions": 6,
        "max_marks": 6,
        "auto_marked": True,
        "answer_constraints": {"allowed_question_types": ["mcq_single"], "option_count": 3, "audio_plays": 2, "audio_required": True, "preserve_question_order": True, "preserve_option_order": True},
    },
]

WRITING_PARTS = [
    {
        "part_code": "writing_1",
        "section_type": "writing",
        "title": "Writing 1",
        "skill_focus": "Respond appropriately to supplied information with a formal academic report or article for an intended public audience.",
        "instructions": "Write your response in 150–200 words.",
        "question_limit": 1,
        "minimum_questions": 1,
        "max_marks": 32,
        "auto_marked": False,
        "answer_constraints": {"allowed_question_types": ["essay"], "minimum_words": 150, "maximum_words": 200, "score_weight": 40, "preserve_question_order": True},
        "rubric": WRITING_RUBRIC,
    },
    {
        "part_code": "writing_2",
        "section_type": "writing",
        "title": "Writing 2",
        "skill_focus": "Produce a piece of discursive writing on an academic subject.",
        "instructions": "Write your response in 250 words.",
        "question_limit": 1,
        "minimum_questions": 1,
        "max_marks": 32,
        "auto_marked": False,
        "answer_constraints": {"allowed_question_types": ["essay"], "minimum_words": 250, "score_weight": 60, "preserve_question_order": True},
        "rubric": WRITING_RUBRIC,
    },
]

SPEAKING_PARTS = [
    {
        "part_code": "speaking_1",
        "section_type": "speaking",
        "title": "Speaking 1",
        "skill_focus": "Give personal information and answer up to five questions on familiar topics.",
        "instructions": "Ask the candidate's name and country, then up to five questions.",
    },
    {
        "part_code": "speaking_2",
        "section_type": "speaking",
        "title": "Speaking 2",
        "skill_focus": "Communicate appropriately in two role-play situations.",
        "instructions": "Two role plays: the examiner starts one and the candidate starts one.",
    },
    {
        "part_code": "speaking_3",
        "section_type": "speaking",
        "title": "Speaking 3",
        "skill_focus": "Read a text aloud, then discuss it.",
        "instructions": (
            "Allow 20 seconds of preparation and ask the candidate to read the text aloud, "
            "then ask one or more of the follow-up questions as time allows."
        ),
    },
    {
        "part_code": "speaking_4",
        "section_type": "speaking",
        "title": "Speaking 4",
        "skill_focus": "Plan and deliver an extended presentation and answer follow-up questions.",
        "instructions": (
            "Allow one minute to prepare and up to two minutes to present, "
            "then ask one or more of the follow-up questions as time allows."
        ),
    },
]

# LanguageCert Academic Speaking runs to approximately 14 minutes across four
# parts. Timing is a property of the *turn*, not of the part: Speaking 3 sets a
# 20-second-preparation read-aloud beside short follow-up questions, and
# Speaking 4 a two-minute presentation beside the same short follow-ups. One
# per-part default would hand every follow-up the headline task's clock - three
# follow-ups in Speaking 4 would cost nine minutes on their own - so each turn
# type carries its own (preparation, response) pair instead.
#
# Authored to the ceiling the structures below allow, the parts total:
#     Part 1   identity + 5 topic questions   =  180s  (~3 min)
#     Part 2   2 role plays                   =  120s  (~2 min)
#     Part 3   read aloud + 3 follow-ups      =  230s  (~4 min)
#     Part 4   presentation + 3 follow-ups    =  300s  (~5 min)
#                                       total =  830s  (13.8 min)
#
# These are the defaults an author starts from, not a cap: a part's real
# duration is always the sum of the times actually authored on its prompts.
SPEAKING_TURN_TIMINGS: dict[str, tuple[int, int]] = {
    "identity": (0, 30),
    "topic_question": (0, 30),
    "roleplay_response": (0, 60),
    "roleplay_initiate": (0, 60),
    "read_aloud": (20, 90),
    "presentation": (60, 120),
    "follow_up": (0, 40),
}

_SPEAKING_STRUCTURES = {
    "speaking_1": {
        # Identity turn plus "up to five questions" (see the part instructions),
        # so six prompts is the ceiling. Without a ceiling the derived duration
        # grows unbounded: every extra prompt adds its own response time.
        "maximum_questions": 6,
        "minimum_questions": 2,
        "required_turn_types": ["identity", "topic_question"],
        "allowed_turn_types": ["identity", "topic_question", "follow_up"],
        # The candidate is identified once. Everything after it is a topic
        # question, so only the identity turn is capped at one.
        "singleton_turn_types": ["identity"],
    },
    "speaking_2": {
        "question_limit": 2,
        "minimum_questions": 2,
        "required_turn_types": ["roleplay_response", "roleplay_initiate"],
        "allowed_turn_types": ["roleplay_response", "roleplay_initiate"],
        # Exactly two situations, one of each direction - the examiner opens
        # one and the candidate opens the other.
        "singleton_turn_types": ["roleplay_response", "roleplay_initiate"],
    },
    # One read-aloud text plus the follow-up questions the examiner asks about
    # it. The published format states that follow-up questions are asked but
    # fixes no number - the interlocutor asks "one or more as time allows" - so
    # the module stores a bank of up to three and at least one. The read-aloud
    # itself is capped at one: a second text would be a second task.
    "speaking_3": {
        "maximum_questions": 4,
        "minimum_questions": 2,
        "required_turn_types": ["read_aloud", "follow_up"],
        "allowed_turn_types": ["read_aloud", "follow_up"],
        "singleton_turn_types": ["read_aloud"],
    },
    # One presentation stimulus and its follow-up bank, on the same
    # "one or more as time allows" rule as Speaking 3.
    "speaking_4": {
        "maximum_questions": 4,
        "minimum_questions": 2,
        "required_turn_types": ["presentation", "follow_up"],
        "allowed_turn_types": ["presentation", "follow_up"],
        "singleton_turn_types": ["presentation"],
    },
}
for _part in SPEAKING_PARTS:
    _structure = _SPEAKING_STRUCTURES[_part["part_code"]]
    # The part's headline turn - the read-aloud, the presentation, the first
    # role play - is the one a legacy client's single timing pair described.
    _primary_turn = _structure["required_turn_types"][0]
    _preparation_seconds, _response_seconds = SPEAKING_TURN_TIMINGS[_primary_turn]
    _part.update(
        {
            "question_limit": _structure.get("question_limit"),
            "minimum_questions": _structure["minimum_questions"],
            "max_marks": None,
            "auto_marked": False,
            "answer_constraints": {
                "allowed_question_types": ["speaking_prompt"],
                "maximum_questions": _structure.get("maximum_questions"),
                # Timing belongs to the prompt, not the part: a two-minute
                # presentation and a short follow-up sit in the same part. The
                # part's duration is the sum of its prompts, never a figure of
                # its own. These are the per-turn defaults the authoring form
                # pre-fills; the author can change any of them.
                "turn_timings": {
                    _turn: {
                        "preparation_seconds": SPEAKING_TURN_TIMINGS[_turn][0],
                        "response_seconds": SPEAKING_TURN_TIMINGS[_turn][1],
                    }
                    for _turn in _structure["allowed_turn_types"]
                },
                # Retained for clients written before per-turn timings existed:
                # the headline turn's pair, which is what they already received.
                "suggested_preparation_seconds": _preparation_seconds,
                "suggested_response_seconds": _response_seconds,
                "notes_allowed": _part["part_code"] == "speaking_4",
                "interaction_mode": "ai_interlocutor",
                "required_turn_types": _structure["required_turn_types"],
                "allowed_turn_types": _structure["allowed_turn_types"],
                # Turns that may appear at most once in the part. The rest of
                # the allowed turns are banks and may repeat up to the ceiling.
                "singleton_turn_types": _structure["singleton_turn_types"],
                "preserve_question_order": True,
            },
            "rubric": SPEAKING_RUBRIC,
        }
    )


SECTION_BLUEPRINTS = {
    "reading": {
        "label": "Reading",
        "duration_minutes": 50,
        "parts": READING_PARTS,
        "assessment": {
            "method": "auto_marked",
            "raw_marks": 30,
            "score_bands": [
                {"level": "B1", "minimum": 10, "maximum": 14},
                {"level": "B2", "minimum": 15, "maximum": 20},
                {"level": "C1", "minimum": 21, "maximum": 26},
                {"level": "C2", "minimum": 27, "maximum": 30},
            ],
            "global_scale": [
                {"level": "B1 Achiever", "minimum": 40, "maximum": 59, "cefr": "B1"},
                {"level": "B2 Communicator", "minimum": 60, "maximum": 74, "cefr": "B2"},
                {"level": "C1 Expert", "minimum": 75, "maximum": 89, "cefr": "C1"},
                {"level": "C2 Mastery", "minimum": 90, "maximum": 100, "cefr": "C2"},
            ],
        },
    },
    "listening": {
        "label": "Listening",
        "duration_minutes": 40,
        "parts": LISTENING_PARTS,
        "assessment": {"method": "auto_marked", "raw_marks": 30, "audio_plays": 2},
    },
    "writing": {
        "label": "Writing",
        "duration_minutes": 50,
        "parts": WRITING_PARTS,
        "assessment": {"method": "examiner_marked", "raw_marks_per_task": 32, "criteria_marks": 8, "task_weights": [40, 60]},
    },
    "speaking": {
        "label": "Speaking",
        "duration_minutes": 14,
        "parts": SPEAKING_PARTS,
        "assessment": {"method": "examiner_marked", "criteria_marks": 8, "criteria_count": 5, "task_fulfilment_weight": 2, "parts_equal_weight": True},
    },
}


def _with_defaults(parts: list[dict]) -> list[dict]:
    result = deepcopy(parts)
    for index, part in enumerate(result):
        part.setdefault("instructions", None)
        part.setdefault("question_limit", None)
        part.setdefault("minimum_questions", 1)
        part.setdefault("max_marks", None)
        part.setdefault("duration_minutes", None)
        part.setdefault("auto_marked", False)
        part.setdefault("ai_evaluation_enabled", (not part["auto_marked"]) and part["section_type"] in {"writing", "speaking"})
        part.setdefault("answer_constraints", {})
        part.setdefault("rubric", [])
        part["sort_order"] = index
    return result


def get_blueprint(module_type: str) -> dict:
    if module_type not in MODULE_TYPES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unknown assessment module type")
    if module_type in SECTION_BLUEPRINTS:
        blueprint = deepcopy(SECTION_BLUEPRINTS[module_type])
        blueprint["module_type"] = module_type
        blueprint["parts"] = _with_defaults(blueprint["parts"])
        return blueprint

    parts: list[dict] = []
    assessment: dict[str, dict] = {}
    for section in ("listening", "reading", "writing", "speaking"):
        section_blueprint = SECTION_BLUEPRINTS[section]
        parts.extend(deepcopy(section_blueprint["parts"]))
        assessment[section] = deepcopy(section_blueprint["assessment"])
    return {
        "module_type": module_type,
        "label": "Full Mock Test" if module_type == "full_mock" else "Final Test",
        "duration_minutes": sum(SECTION_BLUEPRINTS[s]["duration_minutes"] for s in ("listening", "reading", "writing", "speaking")),
        "parts": _with_defaults(parts),
        "assessment": assessment,
    }


def list_blueprints() -> list[dict]:
    return [get_blueprint(module_type) for module_type in MODULE_TYPES]

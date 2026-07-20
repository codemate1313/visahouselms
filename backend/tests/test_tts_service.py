import unittest
from unittest.mock import patch

from fastapi import HTTPException

from app.services import tts_service


class ConversationParserTests(unittest.TestCase):
    def test_detects_unique_speakers_and_keeps_wrapped_text_with_the_turn(self) -> None:
        turns = tts_service.parse_conversation(
            """Interviewer: Welcome to the programme.
This sentence is still part of the interviewer's turn.
Student: Thank you for inviting me.
interviewer: Let us begin."""
        )

        self.assertEqual([turn.speaker for turn in turns], ["Interviewer", "Student", "interviewer"])
        self.assertEqual(turns[0].speaker_key, turns[2].speaker_key)
        self.assertIn("still part", turns[0].text)

        assignments = tts_service.assign_voices(turns)
        self.assertEqual(len(assignments), 2)
        self.assertEqual(assignments[0]["voice"], "en-GB-SoniaNeural")
        self.assertEqual(assignments[1]["voice"], "en-GB-RyanNeural")

    def test_plain_text_becomes_single_speaker_narration(self) -> None:
        turns = tts_service.parse_conversation("A lecture without explicit speaker labels.")
        self.assertEqual(len(turns), 1)
        self.assertEqual(turns[0].speaker, "Narrator")

    def test_rejects_more_speakers_than_distinct_supported_voices(self) -> None:
        turns = tts_service.parse_conversation(
            "\n".join(f"Speaker {index}: Line {index}." for index in range(1, 8))
        )
        with self.assertRaises(HTTPException) as raised:
            tts_service.assign_voices(turns)
        self.assertEqual(raised.exception.status_code, 400)
        self.assertIn("Detected 7 speakers", raised.exception.detail)


class ConversationSynthesisTests(unittest.IsolatedAsyncioTestCase):
    async def test_renders_each_turn_with_a_consistent_automatic_voice_in_source_order(self) -> None:
        async def fake_segment(text: str, voice: str, rate: str) -> bytes:
            return f"<{voice}|{rate}|{text}>".encode()

        with patch.object(
            tts_service, "_synthesize_segment", side_effect=fake_segment
        ):
            content, assignments = await tts_service.synthesize_conversation_mp3(
                "Speaker A: Hello.\nSpeaker B: Hi.\nSpeaker A: Welcome back.",
                rate="+15%",
            )

        self.assertEqual(
            content,
            (
                "<en-GB-SoniaNeural|+15%|Hello.>"
                "<en-GB-RyanNeural|+15%|Hi.>"
                "<en-GB-SoniaNeural|+15%|Welcome back.>"
            ).encode(),
        )
        self.assertEqual(
            [(item["speaker"], item["voice_name"]) for item in assignments],
            [("Speaker A", "Sonia"), ("Speaker B", "Ryan")],
        )
        self.assertEqual(
            tts_service.voice_assignment_summary(assignments),
            "Automatic (2): Speaker A=Sonia, Speaker B=Ryan",
        )


if __name__ == "__main__":
    unittest.main()

# Assessment module blueprints

The SA Instructor workspace is module-first. The instructor creates a Reading,
Speaking, Writing, Listening, Full Mock Test, or Final Test module; they do not
create a separate course, question bank, and test and then connect them.

Every module contains generated assessment parts. A manual question, PDF/CSV
import, MP3 upload, or generated MP3 always targets one concrete module part.
Drafts can be incomplete, but the backend rejects publication until every rule
below is satisfied.

## Reading

Duration: 50 minutes. All 30 questions/marks are auto-marked.

| Part | Questions / marks | Skill and focus |
| --- | ---: | --- |
| Reading 1A | 6 | Academic vocabulary, synonyms, and vocabulary in context |
| Reading 1B | 5 | Vocabulary and lexico-grammatical features in academic text |
| Reading 2 | 6 | Meaning in discourse, text organisation, and discourse features |
| Reading 3 | 7 | Purpose of texts and scanning for specific information |
| Reading 4 | 6 | Long complex text, opinion, purpose, argumentation, examples, comparison/contrast, cause/effect, and specific information |

Raw-score levels: B1 10–14, B2 15–20, C1 21–26, C2 27–30. The recorded
global-scale mappings are B1 Achiever 40–59, B2 Communicator 60–74, C1 Expert
75–89, and C2 Mastery 90–100.

## Listening

Duration: approximately 40 minutes. All 30 questions/marks are auto-marked and
each part's audio is played twice.

| Part | Questions / marks | Format |
| --- | ---: | --- |
| Listening 1 | 7 | Seven unfinished dialogues; three-option MCQ completion |
| Listening 2 | 10 | Five academic conversations; two three-option MCQs each |
| Listening 3 | 7 | Academic lecture/podcast; gaps answered with no more than three words |
| Listening 4 | 6 | Academic group discussion/debate; three-option MCQs |

Each of the four parts must own at least one MP3. It may be uploaded directly
or generated from a conversation transcript through text-to-speech.

## Writing

Duration: 50 minutes. Both tasks are examiner-marked.

- Writing 1: one 150–200 word formal academic report/article for an intended
  public audience; 32 marks.
- Writing 2: one discursive academic response of approximately 250 words; 32
  marks.

Each task is scored from 0–8 for each criterion, totaling 32:

- Task Achievement: how fully the candidate addressed and completed the task.
- Grammar: range, appropriacy, and accuracy for the test level.
- Vocabulary: range, accuracy, appropriacy, and spelling for the test level.
- Organisation: coherent links between ideas and accurate punctuation.

## Speaking

Duration: 14 minutes. The four parts have equal importance and performance is
mapped across CEFR B1–C2.

- Speaking 1: personal information and up to five familiar-topic questions.
- Speaking 2: two role plays, with the examiner and candidate each initiating
  one.
- Speaking 3: 30 seconds to prepare, read aloud, then answer follow-ups.
- Speaking 4: one minute to prepare, present for up to two minutes, then answer
  follow-ups.

The examiner scores 0–8 for each of five criteria:

- Task Fulfilment and Communicative Effect
- Coherence
- Accuracy and Range of Grammar
- Accuracy and Range of Vocabulary
- Pronunciation, Intonation and Fluency

## Full Mock Test and Final Test

Both generate all 15 parts above in Listening → Reading → Writing → Speaking
order. Their controlled total duration is 154 minutes (40 + 50 + 50 + 14).
The same section-specific question, mark, rubric, and audio rules apply.

## Import and lifecycle rules

- PDF/CSV preview and commit endpoints include both module ID and part ID.
- An import cannot exceed that part's question limit or use a question type not
  permitted by the blueprint.
- Source type and filename remain attached to every imported question.
- Listening accepts only real MP3 signatures, with a 50 MB maximum.
- Text-to-speech accepts curated English voices and retains the transcript.
- Only drafts can change. Publishing validates exact counts, marks, types, and
  required audio. A published module must return to draft before editing.

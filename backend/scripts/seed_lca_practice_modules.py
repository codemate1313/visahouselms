"""Seed a Super Admin Instructor (SA_INSTRUCTOR) with LanguageCert Academic
practice-test modules built from the official practice workbook extract
(LCA_Questions_with_Options.pdf) for local platform/QA testing.

The extract contains 160 multiple-choice items from Listening Parts 1, 2 & 4
and Reading Parts 1a, 1b & 4 across four practice tests. Listening Part 3,
Reading Part 2 and Reading Part 3 were *not* in the extract (the workbook
explicitly excludes gap-fill items without individual options and matching
tasks), so those parts are filled with clearly-labelled QA content matching
the LanguageCert interaction shape so every module still satisfies the
blueprint and can publish.

IMPORTANT: the source extract has no answer key. Every real question is
seeded with option "A" as a placeholder correct answer so the grading
pipeline is exercisable end-to-end; it does NOT reflect a verified correct
answer. Replace via the module authoring screen before using this content
for real assessment.

Safe to re-run: existing modules with the same titles (owned by this
instructor) are skipped.

Usage:
    python scripts/seed_lca_practice_modules.py
"""
from __future__ import annotations

import sys
from datetime import datetime
from decimal import Decimal
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.config import settings  # noqa: E402
from app.core.security import hash_password  # noqa: E402
from app.database import SessionLocal  # noqa: E402
from app.models.exam_module import ExamModule, ExamModuleAsset, ExamModulePart, ExamModuleQuestion  # noqa: E402
from app.models.instructor_profile import InstructorProfile  # noqa: E402
from app.models.role import SA_INSTRUCTOR, Role  # noqa: E402
from app.models.user import User  # noqa: E402
from app.services import module_authoring_service  # noqa: E402
from app.services.module_blueprint_service import get_blueprint  # noqa: E402


INSTRUCTOR_EMAIL = "lca.instructor@example.com"
INSTRUCTOR_PASSWORD = "Test@12345"
SOURCE_FILENAME = "seed_lca_practice_modules.py"
NO_ANSWER_KEY_NOTE = (
    "No answer key was included in the extracted source workbook. "
    "'A' is a placeholder correct answer for QA/testing purposes only — "
    "update it in the module authoring screen before real assessment use."
)
PLACEHOLDER_NOTE = (
    "Placeholder question: this part's content (gap-fill/matching without individual "
    "options) was excluded from the extracted LanguageCert Academic practice workbook. "
    "Replace with real content before using this module for real assessment."
)

READING_2_FILLERS = {
    1: {
        "passage": (
            "The turning point came during a period of intense pressure at work. "
            "{{blank:1}} Some of those decisions held up well under scrutiny; others, "
            "I later realised, had missed something important. What I wanted to understand "
            "was what separated the two. I began to notice that my best decisions shared "
            "certain qualities. They were rarely made alone. Before deciding, I would reach "
            "out to colleagues who were directly involved in the work. {{blank:2}} What "
            "they gave me was not agreement but clarity, which turned out to be far more "
            "valuable. I also learnt to resist addressing only what was immediately visible. "
            "{{blank:3}} That became one of the most reliable habits I developed. Another "
            "thing I came to accept was the importance of owning my decisions. {{blank:4}} "
            "Once I stopped doing that, I noticed a shift in how my team related to me. I "
            "also grew more disciplined about thinking through the wider consequences of "
            "each choice. {{blank:5}} Doing this saved me from several costly mistakes. "
            "The final lesson was the most straightforward. Once a decision was made, others "
            "needed enough context to carry it out confidently. {{blank:6}}"
        ),
        "options": [
            ("A", "These were not the most senior people, but they knew exactly what was happening on the ground."),
            ("B", "So I made a habit of thinking through likely consequences before reaching a conclusion, even under time pressure."),
            ("C", "I realised that consulting fewer people meant reaching a conclusion more quickly, which suited the pace of events."),
            ("D", "I learnt that a clear explanation of my reasoning, communicated promptly, made the difference between smooth implementation and unnecessary confusion."),
            ("E", "In each case, I had little time and was acutely aware that getting it wrong could be serious."),
            ("F", "I gradually understood that lasting solutions required me to identify the root cause."),
            ("G", "But I eventually recognised that sharing responsibility weakened the decision and damaged trust in my leadership."),
            ("H", "I also learnt to seek feedback after each decision and use it to improve my approach."),
        ],
        "answers": ["E", "A", "F", "G", "B", "D"],
    },
}


def _reading_2_filler(test_number: int) -> dict:
    base = READING_2_FILLERS[1]
    return {
        "passage": base["passage"].replace("intense pressure at work", f"intense pressure during project {test_number}"),
        "options": base["options"],
        "answers": base["answers"],
    }


READING_3_FILLERS = {
    1: {
        "options": [
            (
                "A",
                "Of all the senses, smell is one of the most directly connected to emotion and memory. "
                "A single scent can bring back a moment with force, yet individual responses differ widely. "
                "Research suggests that claims about fragrance producing the same feeling in everyone are "
                "more marketing than evidence.",
            ),
            (
                "B",
                "At an exhibition recreating old city smells, visitors met smoke, damp wool and drains rather "
                "than nostalgia. One visitor laughed nervously, another covered their nose and left. The event "
                "showed how smell can make the past feel immediate and uncomfortable.",
            ),
            (
                "C",
                "In Victorian Britain, fragrance became part of everyday respectability. Scented gloves, lavender "
                "water and perfumed handkerchiefs marked a household as orderly and socially refined, so fragrance "
                "came to signal status as much as personal taste.",
            ),
            (
                "D",
                "Perfume was long dismissed as too subjective for serious study, partly because it was associated "
                "with fashion and commerce. Modern chemistry changed that view by making new synthetic compounds "
                "available, giving scent-makers far greater creative range.",
            ),
        ],
        "prompts": [
            "explain how fragrance came to function as a marker of social status?",
            "challenge the idea that reactions to fragrance are merely subjective?",
            "suggest that cultural assumptions have made perfume seem unworthy of serious study?",
            "describe an outburst prompted by an unpleasant recreation of the past?",
            "trace how a technological change enabled greater creativity in scent-making?",
            "argue that a commercial claim about scent has been driven by marketing rather than evidence?",
            "demonstrate how sensory exposure can make the past feel less safely remote?",
        ],
        "answers": ["C", "A", "D", "B", "D", "A", "B"],
    },
}


def _reading_3_filler(test_number: int) -> dict:
    base = READING_3_FILLERS[1]
    return {
        "options": [
            (key, text.replace("old city smells", f"old city smells in archive {test_number}"))
            for key, text in base["options"]
        ],
        "prompts": base["prompts"],
        "answers": base["answers"],
    }


def _sample_mp3_bytes() -> bytes:
    return b"ID3\x03\x00\x00\x00\x00\x00\x0fTIT2\x00\x00\x00\x05\x00\x00\x03Test\x00"


# ---------------------------------------------------------------------------
# Extracted question bank (4 practice tests x 40 items = 160 items)
# ---------------------------------------------------------------------------

def L1(page: int, *conversations: list[str]) -> list[dict]:
    """Listening Part 1: 'Choose the correct answer to complete conversation N.'"""
    return [
        {"prompt": f"Choose the correct answer to complete conversation {i}.", "options": opts, "page": page}
        for i, opts in enumerate(conversations, start=1)
    ]


def stems(page: int, *items: tuple[str, list[str]]) -> list[dict]:
    return [{"prompt": stem, "options": opts, "page": page} for stem, opts in items]


def gaps(page: int, *option_sets: list[str]) -> list[dict]:
    return [
        {"prompt": f"Choose the best option for gap {i}.", "options": opts, "page": page}
        for i, opts in enumerate(option_sets, start=7)
    ]


def synonyms(page: int, *items: tuple[str, str, list[str]]) -> list[dict]:
    return [
        {
            "prompt": (
                f"Which option can best replace the word in bold, ‘{bold}’, "
                "so that the meaning of the sentence stays the same?"
            ),
            "passage": sentence,
            "options": opts,
            "page": page,
        }
        for sentence, bold, opts in items
    ]


PRACTICE_TESTS = {
    1: {
        "listening_1": L1(
            10,
            ["The information is correct.", "You should go to bed earlier.", "I'm tired of going to lectures."],
            ["Do you mean adding facts and data and that kind of thing?", "But, I'm not sure that's true.", "They are all my own original ideas."],
            ["There's a good income to be made as a lawyer.", "True, I always look at both sides to every story now.", "You shouldn't make this situation more complicated than it is."],
            ["I'll help you as soon as I can.", "You can't blame me for trying, can you?", "I'm not the only one who does stuff like that."],
            ["You just need to break it down into manageable pieces.", "You are way too relaxed about your studies.", "It is good to start from scratch."],
            ["I'll try to bring as much as I can.", "I'll leave that up to you to arrange.", "I don't have anything of value anyway."],
            ["That's a bit far-fetched, isn't it?", "I'd sooner be living closer to my department.", "You're welcome to come over, you know."],
        ),
        "listening_2": stems(
            11,
            ("When Bella explains that she's been using a high-definition camera,", ["Simon sounds like he no longer likes her photos.", "Simon admits to being impressed.", "Simon claims no camera can have these features."]),
            ("What does Bella imply about the high-definition images?", ["Advanced applications might need to be used.", "You can only work on them from your laptop.", "They are more difficult to work with."]),
            ("The tutor is worried because Kelvin", ["often hands in his projects late.", "can't decide on a suitable topic for his project.", "didn't start his project the right way."]),
            ("What does the tutor point out about Kelvin's last assignment?", ["Some of it was not appropriate.", "It was full of mistakes.", "The text was too long."]),
            ("Guy reacts to Rebecca's comments by", ["bringing her attention to how well the last presentation went.", "suggesting they consider their topic again.", "offering to take over managing the presentation."]),
            ("The main point they want to make in their presentation on climate change is that", ["certain governments should lead the way.", "each individual has a responsibility towards the planet.", "the future of the planet is in the hands of the youth of today."]),
            ("What is Gemma's main hesitation about moving into the house?", ["She won't have a good social life.", "She won't get on with her housemates.", "She might be distracted from her studies."]),
            ("How does Nick address Gemma's main concern?", ["He informs her of an agreement within the house.", "He promises to set up a study group in the house.", "He reassures her that guests are always welcome."]),
            ("The student has reservations about her ability to", ["secure a part-time job.", "find a suitable bank account.", "cover her living costs."]),
            ("The student was previously aware that she would", ["need a letter of proof from her university.", "only have to start repaying her loan once she graduated.", "be required to pay interest from the date she received the loan."]),
        ),
        "listening_4": stems(
            14,
            ("When discussing the importance of marketing for businesses to be competitive, Anna and Ian agree that", ["poor marketing is better than no marketing at all.", "it is impossible to sell a product without strong marketing.", "there is the risk that marketing could have a negative impact."]),
            ("On the issue of marketing needing to be current, Ian makes the point that", ["businesses can benefit greatly by hiring marketing experts.", "advertisements are often rushed, which detracts from their quality.", "marketers are sometimes too forward-thinking for the consumer."]),
            ("Regarding the influencer marketing trend, Anna", ["is unconvinced about its value in certain markets.", "comments that celebrities should also have expertise in the product.", "believes its full potential has not yet been reached."]),
            ("What does Ian say about the use of influencers?", ["The selection of the right influencer is vital.", "The influencers mix in social circles that can profit the advertiser.", "Most influencers are careful about which products they associate themselves with."]),
            ("Why does Anna introduce the topic of micro-influencers?", ["To illustrate that there is an influencer marketing option to suit most companies.", "To explain how the best-known influencers started out in marketing.", "To stress the need for influencers to be honest and open."]),
            ("What concerns both Anna and Ian about influencer marketing?", ["The influencer may not consistently reflect the values of the company and its products.", "The relationship with the influencer tends to be short lived.", "The realm within which influencer marketing operates is largely unregulated."]),
        ),
        "reading_1a": synonyms(
            16,
            ("Although most people know that they ought to eat healthy food, many of them still eat junk food several times a week.", "ought to", ["could", "should", "must", "might"]),
            ("In an experiment, precision is very important when taking measurements, in order to get reliable results.", "precision", ["truth", "detail", "accuracy", "reality"]),
            ("The college cafeteria is only for the use of administrative personnel.", "personnel", ["staff", "people", "crew", "team"]),
            ("As a result of global warming, many areas of the world are experiencing abnormal weather patterns, either in terms of temperature or rainfall.", "abnormal", ["rare", "unusual", "special", "isolated"]),
            ("Despite the seemingly impossible deadline, the research team managed to finalise their proposal for a sustainable alternative energy solution by the due date.", "seemingly", ["apparently", "clearly", "evidently", "supposedly"]),
            ("After analysing all the findings of the excavation, the archaeologists were able to deduce the date of the statue.", "deduce", ["conclude", "assess", "determine", "calculate"]),
        ),
        "reading_1b": gaps(
            17,
            ["turn", "reality", "order"],
            ["raise", "promote", "advance"],
            ["dismissal", "retirement", "redundancy"],
            ["relevant", "required", "significant"],
            ["taking", "getting", "working"],
        ),
        "reading_4": stems(
            23,
            ("In the first paragraph, the writer makes it clear that the purpose of the article is to", ["explore particular superstitions that cut across several cultures.", "determine how superstitions have developed over time.", "analyse the extent to which science is undermining superstition.", "establish why superstitions continue to exist around the world."]),
            ("In the example in paragraph two, why might the interviewee do well, according to the writer?", ["because they were lucky", "because they were superstitious", "because they were the right person", "because some chance events were lucky"]),
            ("In the third paragraph, the writer uses the example of the exam", ["to show that luck can be transferred between situations.", "to highlight how selective proof for a superstition can be.", "to demonstrate the limits of luck.", "to point out that people only resort to superstitions for important events."]),
            ("Paragraph four illustrates", ["how superstitions are kept alive in modern society.", "the role of coincidence in the creation of superstition.", "the chance that superstitions can affect the outcome of events.", "how the media attempts to undermine superstitions."]),
            ("The writer uses the Mark Twain quotation in paragraph five to emphasise his observation that", ["there are beneficial aspects of superstition.", "superstitions are foolish.", "pessimism is often not justified.", "superstition can sometimes relieve troubles."]),
            ("In the final paragraph, the writer implies that", ["even non-superstitious people pass superstitions on.", "he and his wife are quite superstitious.", "superstition is an essential part of any culture.", "he has persuaded his children not to believe in superstitions."]),
        ),
    },
    2: {
        "listening_1": L1(
            40,
            ["Yes, they were very quick actually.", "Yes, I'll answer the whole question next time.", "I really hope I can do as well as you."],
            ["Ok, but don't tell the other students.", "I'm afraid I'm not available.", "That's much later than I was hoping."],
            ["That's right, I don't want to be late again.", "Exactly, that last part wasn't really necessary.", "The truth is, he was completely right to do that."],
            ["That would be brilliant if you've got any helpful tips.", "I didn't get any assistance from anyone.", "That's the plan I like."],
            ["It's hard to focus when we are so tired.", "I honestly have no clue how we just did that.", "So why don't you research the data and I'll gather the images?"],
            ["You could put it that way, I suppose", "I can't really see why I'm doing it now.", "It's my top priority for Monday morning."],
            ["You've got to put the work in to make the grade.", "I wouldn't bother if I were you.", "Well, it's back to the drawing board for you then."],
        ),
        "listening_2": stems(
            41,
            ("The student the girl spoke to while she was researching the project", ["works in the library.", "was able to help her.", "was researching the same topic."]),
            ("Both speakers agree that Dr James", ["is too serious when he gives lectures.", "is very strict with students who don't meet deadlines.", "doesn't often hand out high grades."]),
            ("How does Mandy feel about the meeting?", ["She is looking forward to talking about her assignment.", "She thinks it's unnecessary.", "She wishes she could postpone it."]),
            ("Mandy accepts her tutor's offer to give her", ["some useful references.", "more time to complete the assignment.", "an example of how to present the additional data."]),
            ("Why did they choose this topic for their presentation?", ["It was something they both knew a lot about.", "They thought it was an original idea.", "Their tutor had strongly recommended it."]),
            ("What aspect of the presentation were they disappointed with?", ["The number of students there.", "Their tutor's response.", "The audience's reaction."]),
            ("Why is Darren hesitating to join the Drama Club?", ["He's worried he might get nervous on stage.", "He doesn't want to over-commit himself.", "He dislikes certain types of performances."]),
            ("How does Nina persuade Darren to join the club?", ["She points out a less obvious benefit.", "She claims it will boost his confidence.", "She says it's stressful but also challenging."]),
            ("What does the tutor want to achieve by speaking to Neil?", ["To reassure Neil about something.", "To make Neil aware of his many spelling mistakes.", "To ask Neil to be more enthusiastic about his project."]),
            ("Neil acknowledges that", ["he should double-check his work before he hands it in.", "he may not use the most reliable sources when researching the topic.", "he spends too much time on less relevant details."]),
        ),
        "listening_4": stems(
            44,
            ("In response to the presenter's suggestion that true crime documentaries are a form of entertainment, Dave", ["doubts if this applies to all crime programmes and documentaries.", "states that while this may be the case, producers generally wouldn't admit it.", "shows his disapproval of producers who create such programmes."]),
            ("Dave refers to the UK TV programme, Crimewatch, to show", ["the way true crime reporting has changed over the years.", "that viewers have a valid contribution to make in solving crime.", "how audiences were better at solving crimes in the past."]),
            ("Why does Tilly think women make up the majority of the true crime audience?", ["They are fascinated by solving complex crimes stories.", "They find crime stories very exciting and captivating to watch.", "They strongly identify with those who are the victims of crime."]),
            ("When discussing modern true crime shows, what do Dave and Tilly say about the victims portrayed?", ["They are not given the respect they deserve.", "They are happy to co-operate with producers.", "They are unaware of how they come across on TV."]),
            ("When presenting facts within true crime shows, Dave agrees with Tilly that producers", ["have to do extensive research for each programme.", "may be highly subjective in their approach.", "can focus too much on unimportant details."]),
            ("When referring to media coverage of criminal trials, Tilly", ["is highly critical of the way most newspapers cover trials.", "thinks that the laws protecting jury members are not adequately enforced.", "questions how influential unofficial reporting is on those involved in a trial."]),
        ),
        "reading_1a": synonyms(
            46,
            ("The scientists were criticised in several newspaper articles for not explaining the dangers of the experiment in enough detail.", "criticised", ["blamed", "complained", "punished", "hurt"]),
            ("We cannot proceed with the project until we receive the final approval from the university chancellor, as her permission is required in advance.", "approval", ["agreement", "recommendation", "suggestion", "licence"]),
            ("He was absent from the lecture today, presumably due to illness, as he had mentioned feeling unwell yesterday and left early.", "presumably", ["supposedly", "probably", "apparently", "necessarily"]),
            ("From a historical viewpoint, the events of that day can be seen to have had an impact on the lives of many people over the 20 years that followed.", "viewpoint", ["opinion", "attitude", "perspective", "aspect"]),
            ("The university team's series of wins have restored confidence both within the team and amongst the wider university community.", "restored", ["rescued", "renewed", "recovered", "replaced"]),
            ("Despite the time constraint, she managed to complete the project ahead of schedule and within the budget which she had been allowed.", "constraint", ["inhibition", "pressure", "hold", "control"]),
        ),
        "reading_1b": gaps(
            47,
            ["witnessed", "noted", "attended"],
            ["rearranged", "transformed", "converted"],
            ["rise", "proceed", "emerge"],
            ["break down", "cut down", "come down"],
            ["permit", "allow", "accept"],
        ),
        "reading_4": stems(
            53,
            ("What does the writer do in the first paragraph?", ["argues that storytelling has become increasingly important over time", "states that the origin of storytelling is not currently known", "lays out the order in which perspectives on storytelling will be assessed", "prepares the reader for a discussion on the possible roles for narratives"]),
            ("In the second paragraph, the writer says that, for her, narratives", ["stimulate imagination.", "develop empathy for others.", "explain the motivation of others.", "provide escape from the real world."]),
            ("What did the outcome of the The War of the Ghosts experiment prove to Bartlett?", ["People are poor at remembering complex stories.", "Narratives have different structures in different cultures.", "People prefer stories from their own culture.", "Remembering stories involves more than simple repetition."]),
            ("The writer believes that the main purpose of fairy stories and folk tales is", ["to develop listening and reading skills.", "to capture the imagination of the child.", "to show children how to behave properly.", "to teach children to confront fear."]),
            ("In the fifth paragraph, what does the writer discern as a recent trend in narratives for children?", ["They deal with a wider range of themes.", "They encourage children to think about diversity.", "They no longer try to impose cultural norms.", "They help children to understand their own heritage."]),
            ("What is the writer's main point about storytelling in the final paragraph?", ["It does not matter how a person receives a story.", "Reading will continue to decline, with unfortunate results.", "New purposes for storytelling appear every few years.", "Stories now are increasingly heard and seen rather than read."]),
        ),
    },
    3: {
        "listening_1": L1(
            70,
            ["Well, I think that's right.", "Yes, but thanks for the offer.", "No, it's not really."],
            ["I just found this one particularly difficult.", "I wasn't expecting to see it.", "It's not something I normally ask for."],
            ["But that's what I'm trying to tell you!", "How about going back to the beginning?", "I can't figure out why you said this bit isn't relevant."],
            ["OK. Let's see if we can find somewhere suitable.", "How much did you say that came to?", "Yes, I really love doing that."],
            ["I'd rather fix it ourselves, if it's possible.", "I can't do that next week, I'm sorry to say.", "You've made your position clear already, haven't you?"],
            ["That won't be necessary.", "Thanks for your understanding.", "But what are you going to do?"],
            ["I don't want to talk about them anymore.", "We'll try to do it in the next few days.", "That's not necessarily a bad thing though, is it?"],
        ),
        "listening_2": stems(
            71,
            ("The speakers agree that", ["they have both missed important information.", "they lost concentration during the lecture.", "the lecturer speaks too quickly."]),
            ("What does the female student advise the male student to do?", ["join her study group", "record lectures on his phone", "read around the subject before each lecture"]),
            ("Why does the woman object to the man's presentation idea?", ["It is too old-fashioned.", "It will cost a lot of money.", "it doesn't give people enough time to absorb the information."]),
            ("The woman accepts the man's idea when she realises", ["posters are not visually appealing.", "slides can encourage more student involvement.", "the difficulties of making content for a poster."]),
            ("How does the tutor react to the student's decision?", ["She accepts that it is the best option.", "She argues that there are alternatives.", "She doesn't understand his reasoning."]),
            ("The tutor and her student agree that", ["he should switch to a different version of his current course.", "he should choose a course on a different subject", "he has no need to make any change at all."]),
            ("According to the woman, what's the primary reason for offering campus accommodation to all first-year students?", ["It is easier for them to meet other students socially.", "It removes any concerns about independent living.", "It means they are close to all university facilities."]),
            ("The student decides on campus accommodation because", ["the rooms are usually quiet.", "there is a sense of community with other students.", "he doesn't want the distractions of everyday life."]),
            ("What are the students doing?", ["querying some of the data", "expressing surprise at their research results", "criticising the experiment which they reproduced"]),
            ("The main conclusion the students come to is that", ["the majority of people do what a group expects.", "results will vary greatly with different participants.", "conformity is a relatively new feature of modern life."]),
        ),
        "listening_4": stems(
            74,
            ("Alice explains that in Coming of Age in Samoa, Margaret Mead argued that", ["Samoan adolescents moved into adulthood at a very young age.", "there was no concept of adolescence in Samoan society.", "the differences between adolescent experiences in Samoa and the West were notable."]),
            ("Alice and Robert agree that Mead's work", ["challenged prevailing ideas in some areas of study.", "provided a comprehensive understanding of cultural influences.", "reinforced the idea that some social experiences were universal."]),
            ("When Robert talks about ‘binary notions’, he is referring to", ["the differences between men and women.", "the transformation from child to adult.", "Western cultures and other cultures."]),
            ("The two doctors agree that", ["the main problem with Mead's study was the small sample size.", "Mead should not have generalised her findings so much.", "we must take a wide view of complex social issues."]),
            ("Why does Robert give the example of asking about drug-taking?", ["to highlight the difficulties of asking about controversial issues", "to demonstrate that people under the influence of drugs are not always reliable", "to show that people may exaggerate to enhance their reputation"]),
            ("What does Alice conclude about Coming of Age in Samoa?", ["It is rather outdated because later research has disproved the findings.", "The book is still an influential addition to modern sociology.", "It reminds us that we must use the correct approach to data gathering."]),
        ),
        "reading_1a": synonyms(
            76,
            ("I realised that the email from my tutor contained several urgent requests for information, so I responded to it immediately.", "responded", ["spoke", "wrote", "replied", "answered"]),
            ("After the recent problems with dangerous chemicals in the water supply, the local council has declared that it is now safe to drink again.", "declared", ["explained", "announced", "claimed", "insured"]),
            ("The customer couldn't get her money back because she didn't have any proof to show the assistant that she had purchased the item in that shop.", "proof", ["support", "evidence", "confirmation", "case"]),
            ("The new smartphone boasts a large number of advanced capabilities, including a high-resolution camera and a powerful processing speed.", "capabilities", ["capacities", "elements", "potentials", "features"]),
            ("The funding for biomedical research and innovation has increased substantially this year, thanks to the Medical Research Council and other national funding bodies.", "substantially", ["extensively", "largely", "greatly", "broadly"]),
            ("If you do not raise any objections to the proposals contained in this document before 30th June, you will be deemed to have accepted them.", "deemed", ["estimated", "presumed", "supposed", "suspected"]),
        ),
        "reading_1b": gaps(
            77,
            ["acceptance", "adoption", "approval"],
            ["countless", "limitless", "endless"],
            ["expected", "dependable", "consistent"],
            ["fatally", "deadly", "incurably"],
            ["certainty", "honesty", "reliability"],
        ),
        "reading_4": stems(
            83,
            ("In the first paragraph, we learn that Berne's 1964 book", ["grew out of his experiences in San Francisco.", "was about the mental health problems of soldiers.", "built on Berne's previous work in psychiatry.", "dealt with the mental health issues of ordinary people."]),
            ("In the second paragraph, the writer", ["contrasts two theories.", "shows how mental health issues might be influenced by childhood.", "demonstrates support for Berne's theory.", "criticises one of Freud's theories."]),
            ("The writer implies in the third paragraph that", ["Berne's theory was controversial at first.", "Berne was interested in three kinds of relationship.", "Berne felt that people enjoyed the transactional games.", "Berne's games only happened in close relationships."]),
            ("What is the writer doing with regard to Berne's theory in the fourth paragraph?", ["reinforcing", "justifying", "defining", "questioning"]),
            ("In the fifth paragraph, the writer uses an example", ["to indicate that Berne's ideas can be most readily applied to couples' therapy.", "to show how Berne's theory can be used to understand certain behaviours.", "to demonstrate how people can reduce the number of poor transactions.", "to point out some limitations of Berne's theory."]),
            ("What personal opinion does the writer express at the end of this article?", ["There is no limit to the situations to which Berne's theory can be applied.", "You need to consider your role in any transaction.", "It is impossible to always be able to take the role of Adult in a relationship.", "It will always be difficult to find a good response to certain behaviours."]),
        ),
    },
    4: {
        "listening_1": L1(
            100,
            ["That's your job!", "Yes, I remember that well.", "Sorry. I forgot."],
            ["I'll be there soon.", "I'd really appreciate that.", "I'm afraid I can't make it then."],
            ["It's nice of you to say so.", "Well, you can't win them all.", "That's what I would do."],
            ["Yes, that's the most likely thing to happen.", "OK. Let me know if you think of anything.", "I guess I should turn off my phone more often."],
            ["I'm on campus in Block B at present.", "OK. I just thought I'd ask.", "I don't think that's good enough, really."],
            ["I work part-time at the bookshop, not at the library.", "Good thinking. Two heads are better than one.", "I'm sorry you can't make it."],
            ["I was afraid you might say that.", "But is it affordable?", "OK. Better luck next time."],
        ),
        "listening_2": stems(
            101,
            ("What is the woman's main advice for someone starting university?", ["to avoid dangerous situations.", "to create a schedule of activity.", "to not focus on university work only."]),
            ("Why is the man happier at the end of the conversation?", ["He discovers that can get help with academic writing.", "He learns that he will have the same tutor the woman had.", "He is no longer worried about the amount of reading expected of him."]),
            ("The first thing the woman is going to do is", ["collect data on the web.", "interview people.", "set up the required spreadsheets."]),
            ("The woman suggests writing the report together", ["in order to divide up the work equally.", "to ensure that they meet the deadline.", "so both their points of view are included."]),
            ("What does the woman say about studying environmental science or ecology?", ["Those courses have extremely interesting curricula.", "There is a lot of experimental work on those subjects.", "Job prospects are high for professionals in those fields."]),
            ("The woman recommends that the student consider", ["the quality of student accommodation at the university.", "what people say about the university.", "the location of the university."]),
            ("Why does the woman initially believe that the Creative Minds society isn't suitable for her?", ["She doesn't think photography is covered by the society.", "She isn't interested in a group which doesn't take photography seriously.", "She hasn't got all her photography equipment with her at the university."]),
            ("The woman is persuaded to go to the meeting because", ["she's keen to learn more about photographic theory.", "she wants more input from professionals in photography.", "she won't have to face unpleasant comments about her work."]),
            ("At the start of the conversation, the two students do not have the same view of", ["the convenience and size of the flat.", "the state of some of the fixtures and fittings.", "the monthly cost."]),
            ("By the end of the conversation, they have agreed", ["to take the flat because otherwise they might lose it.", "to try to ensure that their concerns will be dealt with.", "to make a table of the advantages and disadvantages of the flat."]),
        ),
        "listening_4": stems(
            104,
            ("Alex begins the discussion by explaining that", ["he could not relate to the main character.", "he lost interest in the main character towards the end of the novel.", "the main character did not seem to be believable."]),
            ("When Judith talks about Alex's ‘basic premise’, she means that Alex requires", ["the main character to start the action.", "the main character of a novel to be likable.", "novels to have a strong main character."]),
            ("Which journey does Judith find interesting?", ["Emma's movement around her community", "the different paths Emma and Mr Knightley take", "the development of Emma's personal qualities"]),
            ("Judith believes the marriage of Emma and Mr Knightley was", ["a convenient way to conclude the novel.", "the result of deep admiration between them.", "the traditional way to end a love story."]),
            ("When discussing class and society, the two students agree that Austen", ["made social class an important element of the novel.", "challenged the societal values of her day.", "showed acceptance of the prevailing class relationships."]),
            ("The two students disagree about", ["the writing in the descriptive passages.", "the command of language.", "the value of the dialogues."]),
        ),
        "reading_1a": synonyms(
            106,
            ("As a result of his hard work, he was promoted to a new position in the Science Department, which pleased him greatly.", "position", ["business", "work", "appointment", "employment"]),
            ("It will be necessary to get a team of qualified engineers to fit the new equipment in the chemistry laboratory or we may face problems.", "fit", ["fix", "place", "install", "replace"]),
            ("The new research paper comprises a comprehensive analysis of the data, outlining the main findings and presenting them in a clear and concise manner.", "comprises", ["composes", "contains", "consists", "complements"]),
            ("It is clear that we have to find alternatives to fossil fuels as the world will have exhausted these sources of energy by 2100.", "exhausted", ["cleaned up", "done away with", "got through to", "run out of"]),
            ("No matter how carefully we plan, delays and unexpected obstacles unavoidably arise, requiring us to adapt our strategies and find alternative solutions.", "unavoidably", ["constantly", "inevitably", "incidentally", "subsequently"]),
            ("The discovery of water on Mars has resulted in renewed interest in space exploration and has profound implications for its future direction.", "profound", ["formidable", "serious", "devastating", "utter"]),
        ),
        "reading_1b": gaps(
            107,
            ["response", "reply", "answer"],
            ["excellent", "remarkable", "marvellous"],
            ["consists", "conveys", "comprises"],
            ["undertake", "commit", "endeavour"],
            ["Impossibly", "Incredibly", "Indefinitely"],
        ),
        "reading_4": stems(
            113,
            ("The writer makes it clear in paragraph one that", ["the same narrative conventions occur throughout all types of fiction.", "people gradually learn the separate conventions of novels and films.", "the underlying rules of constructing stories are relatively simple.", "the narrative code is the same in all known languages."]),
            ("In paragraph two the writer", ["contrasts Aristotle's ideas with the ideas of others.", "gives examples of one central convention.", "distinguishes one type of fiction in English from others.", "questions a commonly held belief about narratives."]),
            ("The writer says that Booker's ‘Man against Monster’ plot", ["is not as popular today as in the past.", "can take many forms.", "is unlikely to remain so popular in the future.", "always has a hero."]),
            ("According to the information in paragraph four,", ["Todorov says the main character ends up back, more or less, where he or she started.", "Todorov believes that narrative conventions are universal.", "Todorov suggests narratives have three stages.", "Todorov's analysis of narrative is accepted by the writer."]),
            ("According to the writer, Propp believes that", ["conflict does not have to be involved in narrative.", "writers now devise new roles for their characters.", "the behaviour of various characters is fixed by convention.", "the false hero is often really a villain."]),
            ("The writer is saying in the final paragraph that", ["there is a relationship between the real world and fiction.", "controversy exists about Bartlett's theory.", "schema probably cross cultures.", "only a few people have studied the conventions of narrative fiction."]),
        ),
    },
}

TITLES = {
    "listening": "LCA Practice Test {n} - Listening",
    "reading": "LCA Practice Test {n} - Reading",
}


def _get_or_create_instructor(db) -> User:
    role = db.query(Role).filter(Role.name == SA_INSTRUCTOR).first()
    if role is None:
        print("SA_INSTRUCTOR role not found - run 'alembic upgrade head' first.")
        sys.exit(1)

    existing = db.query(User).filter(User.email == INSTRUCTOR_EMAIL).first()
    if existing is not None:
        return existing

    user = User(
        email=INSTRUCTOR_EMAIL,
        password_hash=hash_password(INSTRUCTOR_PASSWORD),
        role_id=role.id,
        institute_id=None,
        first_name="LCA",
        last_name="Instructor",
        is_active=True,
        force_password_reset=False,
    )
    db.add(user)
    db.flush()
    db.add(
        InstructorProfile(
            user_id=user.id,
            title="LanguageCert Academic Instructor",
            bio=(
                "Super Admin Instructor seeded from the official LanguageCert Academic "
                "practice-test question bank (160 multiple-choice items across four "
                "practice tests) for platform QA/testing."
            ),
        )
    )
    db.flush()
    return user


def _real_question(part: ExamModulePart, actor: User, order: int, item: dict, test_number: int) -> ExamModuleQuestion:
    options = [{"key": chr(65 + i), "text": text} for i, text in enumerate(item["options"])]
    constraints = part.answer_constraints or {}
    interaction: dict[str, str] = {}
    if constraints.get("group_label_required"):
        questions_per_group = int(constraints.get("questions_per_group") or 1)
        interaction["group_label"] = f"Conversation {(order // questions_per_group) + 1}"
    passage = item.get("passage")
    if constraints.get("passage_required") and not passage:
        passage = (
            f"Practice Test {test_number} shared source placeholder for {part.title}. "
            "Replace this source text before using the seeded module for assessment."
        )
    return ExamModuleQuestion(
        part_id=part.id,
        question_type="mcq_single",
        prompt=item["prompt"],
        instructions=part.instructions,
        passage=passage,
        options=options,
        correct_answers=["A"],
        interaction=interaction,
        explanation=(
            f"Source: LanguageCert Academic practice workbook, Practice Test {test_number}, "
            f"page {item['page']}. {NO_ANSWER_KEY_NOTE}"
        ),
        points=Decimal("1"),
        difficulty="medium",
        source_type="import",
        source_filename=SOURCE_FILENAME,
        sort_order=order,
        created_by_id=actor.id,
    )


def _filler_question(part: ExamModulePart, actor: User, order: int, test_number: int) -> ExamModuleQuestion:
    number = order + 1
    constraints = part.answer_constraints or {}
    allowed = constraints.get("allowed_question_types", ["short_answer"])
    question_type = allowed[0]
    options: list[dict] = []
    correct_answers = [f"placeholder answer {number}"]
    interaction: dict[str, str] = {}
    passage = None
    if part.part_code == "reading_2":
        reading_2 = _reading_2_filler(test_number)
        options = [{"key": key, "text": text} for key, text in reading_2["options"]]
        correct_answers = [reading_2["answers"][order]]
        passage = reading_2["passage"]
        interaction["blank_index"] = str(number)
    elif part.part_code == "reading_3":
        reading_3 = _reading_3_filler(test_number)
        options = [{"key": key, "text": text} for key, text in reading_3["options"]]
        correct_answers = [reading_3["answers"][order]]
        passage = "Read the four texts below. Which text gives you the answer to each question?"
    if constraints.get("group_label_required"):
        questions_per_group = int(constraints.get("questions_per_group") or 1)
        interaction["group_label"] = f"Conversation {(order // questions_per_group) + 1}"
    if question_type == "true_false_not_given":
        options = [{"key": key, "text": text} for key, text in (("A", "True"), ("B", "False"), ("C", "Not Given"))]
        correct_answers = ["A"]
    elif not options and question_type in {"mcq_single", "mcq_multiple", "matching_unique", "matching_reusable"}:
        option_count = constraints.get("option_count", 3)
        options = [
            {"key": chr(65 + index), "text": f"Shared placeholder option {chr(65 + index)}"}
            for index in range(option_count)
        ]
        correct_answers = ["A"]
        if constraints.get("unique_answers"):
            correct_answers = [chr(65 + order)]

    prompt = f"{part.title} placeholder item {number} (Practice Test {test_number})."
    if part.part_code == "reading_3":
        prompt = _reading_3_filler(test_number)["prompts"][order]
    if constraints.get("inline_marker_required"):
        prompt = (
            f"{part.title} notepad item {number}: The presentation mentions "
            f"{{{{blank}}}} as key detail {number}."
        )
    if part.part_code == "reading_4" and order == 0:
        prompt = "What does the writer imply in the first paragraph?"
    if constraints.get("passage_required") and passage is None:
        passage = (
            f"Practice Test {test_number} shared source placeholder for {part.title}. "
            "Replace this source text before using the seeded module for assessment."
        )

    return ExamModuleQuestion(
        part_id=part.id,
        question_type=question_type,
        prompt=prompt,
        instructions=part.instructions,
        passage=passage,
        options=options,
        correct_answers=correct_answers,
        interaction=interaction,
        explanation=PLACEHOLDER_NOTE,
        points=Decimal("1"),
        difficulty="medium",
        source_type="seed",
        source_filename=SOURCE_FILENAME,
        sort_order=order,
        created_by_id=actor.id,
    )


def _create_module(db, actor: User, module_type: str, test_number: int) -> bool:
    title = TITLES[module_type].format(n=test_number)
    if db.query(ExamModule).filter(ExamModule.title == title, ExamModule.created_by_id == actor.id).first():
        print(f"Skipping existing module: {title}")
        return False

    blueprint = get_blueprint(module_type)
    real_content = PRACTICE_TESTS[test_number]
    module = ExamModule(
        module_type=module_type,
        title=title,
        description=(
            f"LanguageCert Academic Practice Test {test_number} ({module_type.title()}), rebuilt from the "
            "official practice workbook extract for platform QA/testing."
        ),
        instructions=(
            "Use this module to QA the authoring, delivery, audio playback, and auto-marking screens. "
            "Parts sourced from the practice workbook carry real question text and options; parts absent "
            "from the extract contain clearly-labelled placeholder items."
        ),
        status="published",
        duration_minutes=blueprint["duration_minutes"],
        source_module_ids=[],
        created_by_id=actor.id,
        published_at=datetime.utcnow(),
    )
    db.add(module)
    db.flush()

    parts: list[ExamModulePart] = []
    for part_data in blueprint["parts"]:
        part = ExamModulePart(
            module_id=module.id,
            section_type=part_data["section_type"],
            part_code=part_data["part_code"],
            title=part_data["title"],
            skill_focus=part_data["skill_focus"],
            instructions=part_data["instructions"],
            question_limit=part_data["question_limit"],
            minimum_questions=part_data["minimum_questions"],
            max_marks=part_data["max_marks"],
            duration_minutes=part_data["duration_minutes"],
            auto_marked=part_data["auto_marked"],
            answer_constraints=part_data["answer_constraints"],
            rubric=part_data["rubric"],
            sort_order=part_data["sort_order"],
        )
        db.add(part)
        parts.append(part)
    db.flush()

    for part in parts:
        real_items = real_content.get(part.part_code)
        if real_items:
            for order, item in enumerate(real_items):
                db.add(_real_question(part, actor, order, item, test_number))
        else:
            count = part.question_limit or part.minimum_questions
            for order in range(count):
                db.add(_filler_question(part, actor, order, test_number))

        if (part.answer_constraints or {}).get("audio_required"):
            relative = Path("exam-modules") / "lca-seed" / f"test{test_number}-{part.part_code}.mp3"
            destination = settings.storage_path / relative
            destination.parent.mkdir(parents=True, exist_ok=True)
            content = _sample_mp3_bytes()
            destination.write_bytes(content)
            has_real = bool(real_content.get(part.part_code))
            transcript = (
                f"Placeholder audio stub for QA playback. {part.title} question text and options come from "
                f"the LanguageCert Academic Practice Test {test_number} workbook extract; the original audio "
                "recording was not part of that extract."
                if has_real
                else f"Placeholder audio stub for QA playback. {PLACEHOLDER_NOTE}"
            )
            db.add(
                ExamModuleAsset(
                    module_id=module.id,
                    part_id=part.id,
                    asset_type="mp3",
                    title=f"{part.title} audio (Practice Test {test_number})",
                    original_filename=f"{part.part_code}.mp3",
                    file_path=relative.as_posix(),
                    mime_type="audio/mpeg",
                    file_size=len(content),
                    transcript=transcript,
                    tts_voice=None,
                    uploaded_by_id=actor.id,
                )
            )

    db.flush()
    errors = module_authoring_service.validation_errors(module)
    if errors:
        raise RuntimeError(f"Seeded module '{title}' is invalid: {'; '.join(errors)}")
    print(f"Created module: {title}")
    return True


def main() -> None:
    db = SessionLocal()
    try:
        instructor = _get_or_create_instructor(db)
        created = 0
        for test_number in sorted(PRACTICE_TESTS):
            for module_type in ("listening", "reading"):
                if _create_module(db, instructor, module_type, test_number):
                    created += 1
        db.commit()
        print(f"LCA practice content ready for {instructor.email}.")
        print(f"Login password: {INSTRUCTOR_PASSWORD}")
        print(f"Created {created} new module(s).")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()

import unittest
from unittest.mock import patch, MagicMock
from app.services import exam_news_service


MOCK_XML = """<?xml version="1.0" encoding="utf-8"?>
<rss version="2.0">
  <channel>
    <title>Google News</title>
    <item>
      <title>Latest Canada Immigration Express Entry Draw Update - IRCC News</title>
      <link>https://news.google.com/articles/123</link>
      <pubDate>Thu, 06 Aug 2026 12:00:00 GMT</pubDate>
      <description>&lt;a href="https://news.google.com/articles/123"&gt;Latest Canada Immigration Express Entry Draw Update&lt;/a&gt;</description>
      <source url="https://canada.ca">IRCC News</source>
    </item>
  </channel>
</rss>
"""


class ExamNewsServiceTests(unittest.TestCase):
    def setUp(self) -> None:
        exam_news_service.clear_news_cache()

    def tearDown(self) -> None:
        exam_news_service.clear_news_cache()

    @patch("urllib.request.urlopen")
    def test_fetch_real_time_news_success(self, mock_urlopen) -> None:
        mock_response = MagicMock()
        mock_response.read.return_value = MOCK_XML.encode("utf-8")
        mock_response.__enter__.return_value = mock_response
        mock_urlopen.return_value = mock_response

        news = exam_news_service.list_exam_news()

        # The mock news should be successfully fetched and prepended/sorted first due to 2026-08-06 date
        self.assertGreater(len(news), len(exam_news_service.EXAM_NEWS))
        self.assertEqual(news[0]["country"], "Canada")
        self.assertEqual(news[0]["flag"], "🇨🇦")
        self.assertEqual(news[0]["category"], "immigration")
        self.assertEqual(news[0]["title"], "Latest Canada Immigration Express Entry Draw Update")
        self.assertEqual(news[0]["source_name"], "IRCC News")
        self.assertEqual(news[0]["published_at"], "2026-08-06")

    @patch("urllib.request.urlopen")
    def test_fetch_real_time_news_failure_falls_back_to_curated(self, mock_urlopen) -> None:
        mock_urlopen.side_effect = Exception("network down")

        news = exam_news_service.list_exam_news()

        # Should fall back to static list gracefully
        self.assertEqual(len(news), len(exam_news_service.EXAM_NEWS))
        self.assertEqual(news[0]["country"], "General")  # One Skill Retake is 2026-07-21


if __name__ == "__main__":
    unittest.main()

import unittest
from unittest.mock import patch

import httpx
from fastapi import HTTPException

from app.services import english_discovery_service


FACTS = [
    {
        "page_id": 101,
        "title": "English language",
        "fact": "A sufficiently detailed fact about the English language.",
        "image_url": "https://upload.wikimedia.org/english.jpg",
        "source_url": "https://en.wikipedia.org/wiki/English_language",
        "source_name": "Wikipedia",
    },
    {
        "page_id": 202,
        "title": "English phonology",
        "fact": "A sufficiently detailed fact about English phonology.",
        "image_url": "https://upload.wikimedia.org/phonology.jpg",
        "source_url": "https://en.wikipedia.org/wiki/English_phonology",
        "source_name": "Wikipedia",
    },
]


class EnglishDiscoveryServiceTests(unittest.TestCase):
    def setUp(self) -> None:
        english_discovery_service.clear_fact_cache()

    def tearDown(self) -> None:
        english_discovery_service.clear_fact_cache()

    @patch.object(english_discovery_service, "_fetch_pool_from_wikipedia")
    def test_returns_an_unexcluded_fact_without_database_storage(self, fetch_pool) -> None:
        fetch_pool.return_value = FACTS

        result = english_discovery_service.get_random_english_fact({101})

        self.assertEqual(result["page_id"], 202)
        self.assertEqual(result["source_name"], "Wikipedia")
        fetch_pool.assert_called_once_with()

    @patch.object(english_discovery_service, "_fetch_pool_from_wikipedia")
    def test_reuses_the_short_lived_memory_pool(self, fetch_pool) -> None:
        fetch_pool.return_value = FACTS

        english_discovery_service.get_random_english_fact()
        english_discovery_service.get_random_english_fact()

        fetch_pool.assert_called_once_with()

    @patch.object(english_discovery_service, "_fetch_pool_from_wikipedia")
    def test_external_failure_returns_service_unavailable(self, fetch_pool) -> None:
        fetch_pool.side_effect = httpx.ConnectError("offline")

        with self.assertRaises(HTTPException) as context:
            english_discovery_service.get_random_english_fact()

        self.assertEqual(context.exception.status_code, 503)


if __name__ == "__main__":
    unittest.main()

"""Geo-IP country detection helper for multi-currency routing."""

import urllib.request
import json
import logging
from typing import Optional
from fastapi import Request

logger = logging.getLogger(__name__)

# Memory cache for IP to country lookups during backend runtime
_IP_CACHE: dict[str, str] = {}


def get_client_ip(request: Request) -> str:
    """Extract real client IP address from request headers."""
    x_forwarded_for = request.headers.get("X-Forwarded-For")
    if x_forwarded_for:
        # First IP in X-Forwarded-For list is the client IP
        return x_forwarded_for.split(",")[0].strip()
    return request.client.host if request.client else "127.0.0.1"


def detect_country_code(request: Request) -> str:
    """Returns 2-letter ISO country code (e.g. 'IN', 'US', 'CA', 'GB').
    
    Order of preference:
    1. Cloudflare header `CF-IPCountry`
    2. Proxy header `X-Country-Code` or `X-GeoIP-Country`
    3. Query parameter `country` (if provided)
    4. IP lookup cache / free Geo-IP service fallback
    5. Default to 'IN' for local development or unresolvable IPs.
    """
    # 1. Check Cloudflare / CDN headers
    cf_country = request.headers.get("CF-IPCountry")
    if cf_country and len(cf_country) == 2 and cf_country != "XX":
        return cf_country.upper()

    # 2. Check X-Country-Code header
    x_country = request.headers.get("X-Country-Code") or request.headers.get("X-GeoIP-Country")
    if x_country and len(x_country) == 2:
        return x_country.upper()

    # 3. Check query parameters if explicit override
    query_country = request.query_params.get("country")
    if query_country and len(query_country) == 2:
        return query_country.upper()

    client_ip = get_client_ip(request)

    # Return default 'IN' for localhost or private LAN IPs
    if client_ip in ("127.0.0.1", "localhost", "::1") or client_ip.startswith(("192.168.", "10.", "172.16.", "172.31.")):
        return "IN"

    if client_ip in _IP_CACHE:
        return _IP_CACHE[client_ip]

    # 4. Optional free Geo-IP lookup for public IPs
    try:
        url = f"http://ip-api.com/json/{client_ip}?fields=countryCode,status"
        req = urllib.request.Request(url, headers={"User-Agent": "VisaHouseLMS/1.0"})
        with urllib.request.urlopen(req, timeout=1.5) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            if data.get("status") == "success" and data.get("countryCode"):
                code = data["countryCode"].upper()
                _IP_CACHE[client_ip] = code
                return code
    except Exception as e:
        logger.debug(f"GeoIP resolution failed for {client_ip}: {e}")

    return "IN"

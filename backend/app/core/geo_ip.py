"""Geo-IP country detection helper for multi-currency routing."""

import urllib.request
import json
import logging
import ipaddress
from typing import Optional
from fastapi import Request

logger = logging.getLogger(__name__)

# Memory cache for IP to country lookups during backend runtime
_IP_CACHE: dict[str, str] = {}


def get_client_ip(request: Request) -> str:
    """Extract, clean, and validate real client IP address from headers or client connection."""
    for header in ("CF-Connecting-IP", "X-Original-Forwarded-For", "X-Forwarded-For"):
        value = request.headers.get(header)
        if value:
            # First IP in the list is the client IP
            ip_candidate = value.split(",")[0].strip()
            
            # Strip ports from IPv6 enclosed in brackets: [2001:db8::1]:8080 -> 2001:db8::1
            if ip_candidate.startswith("[") and "]" in ip_candidate:
                ip_candidate = ip_candidate.split("]")[0][1:]
            # Strip ports from IPv4: 1.2.3.4:8080 -> 1.2.3.4
            elif ":" in ip_candidate and ip_candidate.count(":") == 1:
                ip_candidate = ip_candidate.split(":")[0]
            
            # Validate format before returning
            try:
                ipaddress.ip_address(ip_candidate)
                return ip_candidate
            except ValueError:
                continue

    fallback = request.client.host if request.client else "127.0.0.1"
    if fallback.startswith("[") and "]" in fallback:
        fallback = fallback.split("]")[0][1:]
    elif ":" in fallback and fallback.count(":") == 1:
        fallback = fallback.split(":")[0]
    return fallback


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

    # Return default 'IN' for localhost, loopback, private, or link-local IPs
    try:
        ip_obj = ipaddress.ip_address(client_ip)
        if ip_obj.is_private or ip_obj.is_loopback or ip_obj.is_link_local:
            return "IN"
    except ValueError:
        # Fallback if client_ip is a hostname (like 'localhost')
        if client_ip in ("localhost", "::1", ""):
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

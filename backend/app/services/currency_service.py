import httpx
from functools import lru_cache
from app.config import get_settings

settings = get_settings()

_rate_cache: dict[str, dict] = {}


async def get_exchange_rates(base_currency: str) -> dict[str, float]:
    """Fetch rates from exchangerate-api.com; simple in-memory cache."""
    if base_currency in _rate_cache:
        return _rate_cache[base_currency]

    url = f"{settings.EXCHANGE_RATE_BASE_URL}/{base_currency}"
    async with httpx.AsyncClient(timeout=10) as client:
        response = await client.get(url)
        response.raise_for_status()
        data = response.json()
        rates = data.get("rates", {})
        _rate_cache[base_currency] = rates
        return rates


async def convert_amount(
    amount: float,
    from_currency: str,
    to_currency: str,
) -> tuple[float, float]:
    """Returns (converted_amount, exchange_rate)."""
    if from_currency == to_currency:
        return amount, 1.0

    rates = await get_exchange_rates(from_currency)
    rate = rates.get(to_currency)
    if not rate:
        raise ValueError(f"Cannot convert {from_currency} → {to_currency}")
    return round(amount * rate, 2), rate


FALLBACK_COUNTRIES = [
    {
        "name": {"common": "United States"},
        "currencies": {"USD": {"name": "United States dollar", "symbol": "$"}},
    },
    {
        "name": {"common": "Canada"},
        "currencies": {"CAD": {"name": "Canadian dollar", "symbol": "$"}},
    },
    {
        "name": {"common": "United Kingdom"},
        "currencies": {"GBP": {"name": "Pound sterling", "symbol": "£"}},
    },
    {
        "name": {"common": "Australia"},
        "currencies": {"AUD": {"name": "Australian dollar", "symbol": "$"}},
    },
    {
        "name": {"common": "India"},
        "currencies": {"INR": {"name": "Indian rupee", "symbol": "₹"}},
    },
]


async def get_countries_currencies() -> list[dict]:
    """Fetch country + currency list for frontend dropdowns."""
    async with httpx.AsyncClient(timeout=10) as client:
        try:
            response = await client.get(settings.COUNTRIES_API_URL)
            response.raise_for_status()
            return response.json()
        except httpx.HTTPError:
            return FALLBACK_COUNTRIES

"""Oracle exclusion set from CONVERSIONS_FINAL (lending_split.ipynb)."""

from __future__ import annotations

import logging
import time
from typing import Any

from app.shared_services.oracle_db import OracleConnection, oracle_configured
from app.xsell_helpers.exclusion_utils import exclusion_msisdns_from_lists
from app.shared_services.db import get_xsell_connection as _get_conn

logger = logging.getLogger(__name__)

# Same logic as lending_split.ipynb Helper - exclusions cell.
# Optional filter on CONVERSIONS_FINAL."Product Name" (campaign / product).
EXCLUSION_SQL_BASE = """
    SELECT DISTINCT
        '254' || SUBSTR(REGEXP_REPLACE("MOBILE_NUMBER", '[^0-9]', ''), -9) AS MSISDN
    FROM CONVERSIONS_FINAL
    WHERE "Date" >= TRUNC(SYSDATE) - :lookback_days
      AND "MOBILE_NUMBER" IS NOT NULL
      AND (
          "Disposition (Outcome)" IS NOT NULL
          OR "Outcome comment" IS NOT NULL
          OR "Connection" = 'Connected'
      )
"""

CAMPAIGNS_SQL = """
    SELECT DISTINCT "Product Name"
    FROM CONVERSIONS_FINAL
    WHERE "Date" >= TRUNC(SYSDATE) - :lookback_days
      AND "Product Name" IS NOT NULL
    ORDER BY 1
"""

# Preview-only cache (schedule wizard). Generation always passes use_cache=False.
_CACHE: dict[tuple[int, tuple[str, ...]], tuple[float, set[str]]] = {}
_CAMPAIGNS_CACHE: dict[int, tuple[float, list[str]]] = {}
_CACHE_TTL_SECONDS = 300


def _normalize_product_names(product_names: list[str] | None) -> tuple[str, ...]:
    if not product_names:
        return ()
    return tuple(sorted({str(name).strip() for name in product_names if str(name).strip()}))


def _cache_key(lookback_days: int, product_names: tuple[str, ...]) -> tuple[int, tuple[str, ...]]:
    return lookback_days, product_names


def _campaign_filter_sql(product_names: tuple[str, ...]) -> tuple[str, dict[str, str]]:
    if not product_names:
        return "", {}
    placeholders = ", ".join(f":p{i}" for i in range(len(product_names)))
    clause = f'\n      AND "Product Name" IN ({placeholders})'
    binds = {f"p{i}": name for i, name in enumerate(product_names)}
    return clause, binds


def load_conversions_exclusions(
    lookback_days: int,
    *,
    product_names: list[str] | None = None,
    use_cache: bool = True,
) -> set[str]:
    """MSISDNs already contacted in CONVERSIONS_FINAL within lookback window."""
    if lookback_days < 1:
        raise ValueError("lookback_days must be at least 1")
    if not oracle_configured():
        raise ValueError(
            "Oracle is not configured. Set ORACLE_USER, ORACLE_PASSWORD, "
            "ORACLE_HOST, and ORACLE_SERVICE in backend/.env"
        )

    normalized = _normalize_product_names(product_names)
    key = _cache_key(lookback_days, normalized)
    now = time.time()

    if use_cache:
        cached = _CACHE.get(key)
        if cached and now - cached[0] < _CACHE_TTL_SECONDS:
            return set(cached[1])

    campaign_clause, campaign_binds = _campaign_filter_sql(normalized)
    sql = EXCLUSION_SQL_BASE + campaign_clause
    binds: dict[str, Any] = {"lookback_days": lookback_days, **campaign_binds}

    msisdns: set[str] = set()
    with OracleConnection() as conn:
        cur = conn.cursor()
        cur.execute(sql, binds)
        for (msisdn,) in cur:
            cleaned = str(msisdn or "").strip()
            if cleaned:
                msisdns.add(cleaned)

    if use_cache:
        _CACHE[key] = (now, msisdns)

    scope = (
        f"all campaigns, lookback {lookback_days}d"
        if not normalized
        else f"{len(normalized)} campaign(s), lookback {lookback_days}d"
    )
    logger.info(
        "Loaded %s Oracle exclusions (%s, cache=%s)",
        f"{len(msisdns):,}",
        scope,
        use_cache,
    )
    return msisdns


def list_exclusion_campaigns(
    lookback_days: int,
    *,
    use_cache: bool = True,
) -> list[str]:
    """Distinct CONVERSIONS_FINAL product names within the lookback window."""
    if lookback_days < 1:
        raise ValueError("lookback_days must be at least 1")
    if not oracle_configured():
        raise ValueError(
            "Oracle is not configured. Set ORACLE_USER, ORACLE_PASSWORD, "
            "ORACLE_HOST, and ORACLE_SERVICE in backend/.env"
        )

    now = time.time()
    if use_cache:
        cached = _CAMPAIGNS_CACHE.get(lookback_days)
        if cached and now - cached[0] < _CACHE_TTL_SECONDS:
            return list(cached[1])

    names: list[str] = []
    with OracleConnection() as conn:
        cur = conn.cursor()
        cur.execute(CAMPAIGNS_SQL, lookback_days=lookback_days)
        for (name,) in cur:
            cleaned = str(name or "").strip()
            if cleaned:
                names.append(cleaned)

    if use_cache:
        _CAMPAIGNS_CACHE[lookback_days] = (now, names)
    return names


def build_excluded_msisdns(
    *,
    exclusions_enabled: bool,
    lookback_days: int,
    exclusion_list_ids: list[str],
    exclusion_product_names: list[str] | None = None,
    use_cache: bool = False,
) -> set[str]:
    """Union of Oracle lookback + uploaded exclusion lists.

    use_cache defaults to False so generation always queries Oracle fresh.
    """
    if not exclusions_enabled:
        return set()

    excluded: set[str] = set()
    excluded |= load_conversions_exclusions(
        lookback_days,
        product_names=exclusion_product_names,
        use_cache=use_cache,
    )
    if exclusion_list_ids:
        excluded |= exclusion_msisdns_from_lists(exclusion_list_ids)
    return excluded


def preview_exclusions(
    *,
    list_id: str,
    exclusions_enabled: bool,
    lookback_days: int,
    exclusion_list_ids: list[str],
    exclusion_product_names: list[str] | None = None,
) -> dict[str, Any]:
    """Estimate pool size while building the schedule (uses short-lived cache)."""
    lead_set = _lead_msisdns(list_id)
    lead_count = len(lead_set)
    normalized_products = list(_normalize_product_names(exclusion_product_names))

    result: dict[str, Any] = {
        "list_id": list_id,
        "lead_row_count": lead_count,
        "exclusions_enabled": exclusions_enabled,
        "lookback_days": lookback_days,
        "exclusion_list_ids": exclusion_list_ids,
        "exclusion_product_names": normalized_products,
        "oracle_available": oracle_configured(),
        "oracle_error": None,
        "oracle_exclusion_total": 0,
        "oracle_overlap": 0,
        "list_overlap": 0,
        "excluded_count": 0,
        "pool_size": lead_count,
    }

    if not exclusions_enabled or not lead_count:
        return result

    oracle_set: set[str] = set()
    if oracle_configured():
        try:
            oracle_set = load_conversions_exclusions(
                lookback_days,
                product_names=normalized_products,
                use_cache=True,
            )
            result["oracle_exclusion_total"] = len(oracle_set)
            result["oracle_overlap"] = len(lead_set & oracle_set)
        except Exception as exc:
            result["oracle_error"] = str(exc)
            logger.exception("Oracle exclusion preview failed")
    else:
        result["oracle_error"] = (
            "Oracle is not configured. Set ORACLE_* variables in backend/.env"
        )

    list_set: set[str] = set()
    if exclusion_list_ids:
        list_set = exclusion_msisdns_from_lists(exclusion_list_ids)
        result["list_overlap"] = len(lead_set & list_set)

    excluded_union = oracle_set | list_set
    excluded_count = len(lead_set & excluded_union)
    result["excluded_count"] = excluded_count
    result["pool_size"] = max(0, lead_count - excluded_count)
    return result


def _lead_msisdns(list_id: str) -> set[str]:
    conn = _get_conn()
    try:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT DISTINCT msisdn_clean
            FROM list_rows
            WHERE list_id = %s
              AND is_valid = TRUE
              AND decision = 'keep'
              AND msisdn_clean != ''
            """,
            (list_id,),
        )
        rows = cur.fetchall()
        return {str(r["msisdn_clean"]) for r in rows}
    finally:
        conn.close()

# Fixture for py-no-insecure-token-compare. Excluded from real scans via .semgrepignore.
import hmac


def bad(token: str, expected: str, secret: str, other: str) -> bool:
    # ruleid: py-no-insecure-token-compare
    if token == expected:
        return True
    # ruleid: py-no-insecure-token-compare
    if secret != other:
        return False
    return False


def good(token: str, expected: str) -> bool:
    # ok: py-no-insecure-token-compare
    if hmac.compare_digest(token, expected):
        return True
    # ok: py-no-insecure-token-compare
    if token is None:
        return False
    return False

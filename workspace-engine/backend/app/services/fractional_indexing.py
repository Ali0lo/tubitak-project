"""Fractional indexing implementation for O(1) drag-and-drop reordering.

Enables inserting items before, between, or after existing items without
updating the sort order of any other records in the database.
Uses a Base-62 character set: 0-9, A-Z, a-z.
"""
from typing import List, Optional

BASE62 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"
BASE_LEN = len(BASE62)
CHAR_TO_INT = {c: i for i, c in enumerate(BASE62)}
MID_CHAR = BASE62[BASE_LEN // 2]  # 'V'
MIN_CHAR = BASE62[0]             # '0'
MAX_CHAR = BASE62[-1]            # 'z'


def generate_fractional_index(
    before: Optional[str] = None,
    after: Optional[str] = None,
) -> str:
    """Generate a sort_order string strictly between `before` and `after` in lexicographical order.

    - If before is None and after is None: returns default initial key 'a0'.
    - If before is None and after is 'a0': returns a key lexicographically smaller than 'a0'.
    - If before is 'a0' and after is None: returns a key lexicographically larger than 'a0'.
    - If before < after: returns a key strictly between before and after.
    """
    if before is None and after is None:
        return "a0"

    # Prepend before lowest item
    if before is None:
        assert after is not None
        return _decrement_key(after)

    # Append after highest item
    if after is None:
        return _increment_key(before)

    # Insert between before and after
    if before >= after:
        raise ValueError(f"Constraint violated: before ({before}) must be < after ({after})")

    return _midpoint(before, after)


def _midpoint(a: str, b: str) -> str:
    """Find a string strictly between a and b lexicographically."""
    common_len = 0
    min_len = min(len(a), len(b))

    while common_len < min_len and a[common_len] == b[common_len]:
        common_len += 1

    prefix = a[:common_len]
    char_a = a[common_len] if common_len < len(a) else MIN_CHAR
    char_b = b[common_len] if common_len < len(b) else None

    val_a = CHAR_TO_INT[char_a]
    val_b = CHAR_TO_INT[char_b] if char_b is not None else BASE_LEN

    if val_b - val_a > 1:
        # Easy case: there is a character strictly between val_a and val_b
        mid_val = (val_a + val_b) // 2
        return prefix + BASE62[mid_val]

    # Adjacent characters: need to extend with a suffix
    # e.g., between 'a0' and 'a1', common prefix 'a', char_a='0', char_b='1'
    if common_len < len(a):
        # We have remaining characters in a. Find a midpoint between remaining 'a' and virtual max.
        remainder_a = a[common_len + 1 :]
        suffix = _increment_key(remainder_a) if remainder_a else MID_CHAR
        return a[: common_len + 1] + suffix

    # a is a prefix of b
    return a + MID_CHAR


def _increment_key(key: str) -> str:
    """Return a string lexicographically strictly greater than `key`."""
    if not key:
        return "a0"

    chars = list(key)
    # Try incrementing the last character if not at max
    last_val = CHAR_TO_INT[chars[-1]]
    if last_val < BASE_LEN - 1:
        chars[-1] = BASE62[last_val + 1]
        return "".join(chars)

    # If already at max character, append a middle character
    return key + MID_CHAR


def _decrement_key(key: str) -> str:
    """Return a string lexicographically strictly less than `key`."""
    if not key:
        return "0"

    chars = list(key)
    # Check if first character can be decremented
    first_val = CHAR_TO_INT[chars[0]]
    if first_val > 0:
        chars[0] = BASE62[first_val - 1]
        return "".join(chars)

    # If first is at minimum '0', prepend '0' with intermediate
    return "0" + MID_CHAR + key


def rebalance_indices(count: int, prefix: str = "a") -> List[str]:
    """Generate `count` evenly spaced fractional indices.

    Useful for initializing or rebalancing a list when string lengths grow excessively.
    """
    if count <= 0:
        return []

    indices = []
    step = max(1, (BASE_LEN - 1) // max(1, count))
    for i in range(count):
        idx = min(i * step, BASE_LEN - 1)
        indices.append(f"{prefix}{BASE62[idx]}")

    # If duplicates occurred due to high count, append secondary digits
    seen = set()
    result = []
    for i, item in enumerate(indices):
        current = item
        counter = 0
        while current in seen:
            counter += 1
            current = f"{item}{BASE62[counter % BASE_LEN]}"
        seen.add(current)
        result.append(current)

    result.sort()
    return result

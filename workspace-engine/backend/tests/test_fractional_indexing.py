"""Unit tests for the fractional indexing algorithm."""
import pytest
from app.services.fractional_indexing import (
    generate_fractional_index,
    rebalance_indices,
)


def test_initial_index_generation():
    """Generating without bounds returns initial index 'a0'."""
    idx = generate_fractional_index(None, None)
    assert idx == "a0"


def test_prepend_before_item():
    """Generating before an existing item produces a lexicographically smaller key."""
    first = "a0"
    prepended = generate_fractional_index(before=None, after=first)
    assert prepended < first

    # Prepend again before the new item
    prepended_twice = generate_fractional_index(before=None, after=prepended)
    assert prepended_twice < prepended


def test_append_after_item():
    """Generating after an existing item produces a lexicographically larger key."""
    base = "a0"
    appended = generate_fractional_index(before=base, after=None)
    assert appended > base

    appended_twice = generate_fractional_index(before=appended, after=None)
    assert appended_twice > appended


def test_insert_between_items():
    """Inserting between two items produces a key strictly in between."""
    a = "a0"
    b = "a5"
    mid = generate_fractional_index(before=a, after=b)
    assert a < mid < b


def test_insert_between_adjacent_items():
    """Inserting between adjacent items extends length to fit midpoint."""
    a = "a0"
    b = "a1"
    mid = generate_fractional_index(before=a, after=b)
    assert a < mid < b

    # Insert between a and mid
    mid2 = generate_fractional_index(before=a, after=mid)
    assert a < mid2 < mid < b


def test_sequential_middle_insertions():
    """Repeatedly inserting between items maintains strict sorted order."""
    items = ["a0", "z9"]
    for _ in range(50):
        # Pick middle of current items
        mid_idx = len(items) // 2
        new_key = generate_fractional_index(items[mid_idx - 1], items[mid_idx])
        items.insert(mid_idx, new_key)

    # Verify array is strictly sorted with no duplicates
    assert items == sorted(items)
    assert len(items) == len(set(items))


def test_invalid_bounds_raises_value_error():
    """Passing before >= after violates invariant and must raise ValueError."""
    with pytest.raises(ValueError):
        generate_fractional_index(before="b0", after="a0")

    with pytest.raises(ValueError):
        generate_fractional_index(before="a0", after="a0")


def test_rebalance_indices():
    """Rebalancing generates evenly spaced and strictly ordered indices."""
    count = 10
    indices = rebalance_indices(count)
    assert len(indices) == count
    assert indices == sorted(indices)
    assert len(indices) == len(set(indices))

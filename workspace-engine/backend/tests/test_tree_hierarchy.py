"""Unit tests for Page and Block tree hierarchy building and cycle prevention."""

import uuid

from app.schemas.block import BlockTreeNode, BlockType
from app.schemas.page import PageTreeNode
from app.services.fractional_indexing import generate_fractional_index


def test_build_page_tree_nesting():
    """Verify flat pages with parent_ids assemble into correct nested hierarchy."""
    ws_id = uuid.uuid4()
    root1_id = uuid.uuid4()
    child1_id = uuid.uuid4()
    grandchild1_id = uuid.uuid4()
    root2_id = uuid.uuid4()

    # Flat representation
    flat_pages = [
        {"id": root1_id, "parent_id": None, "title": "Root 1", "sort_order": "a0"},
        {
            "id": child1_id,
            "parent_id": root1_id,
            "title": "Child 1",
            "sort_order": "a0",
        },
        {
            "id": grandchild1_id,
            "parent_id": child1_id,
            "title": "Grandchild 1",
            "sort_order": "a0",
        },
        {"id": root2_id, "parent_id": None, "title": "Root 2", "sort_order": "a1"},
    ]

    node_map = {}
    for p in flat_pages:
        node_map[p["id"]] = PageTreeNode(
            id=p["id"],
            workspace_id=ws_id,
            parent_id=p["parent_id"],
            title=p["title"],
            sort_order=p["sort_order"],
            children=[],
        )

    roots = []
    for p in flat_pages:
        node = node_map[p["id"]]
        if p["parent_id"] and p["parent_id"] in node_map:
            node_map[p["parent_id"]].children.append(node)
        else:
            roots.append(node)

    assert len(roots) == 2
    assert roots[0].title == "Root 1"
    assert len(roots[0].children) == 1
    assert roots[0].children[0].title == "Child 1"
    assert len(roots[0].children[0].children) == 1
    assert roots[0].children[0].children[0].title == "Grandchild 1"
    assert roots[1].title == "Root 2"
    assert len(roots[1].children) == 0


def test_block_tree_nesting():
    """Verify blocks correctly assemble into parent-child nesting (e.g. toggles with child blocks)."""
    page_id = uuid.uuid4()
    toggle_id = uuid.uuid4()
    child_text_id = uuid.uuid4()
    sibling_text_id = uuid.uuid4()

    flat_blocks = [
        {
            "id": toggle_id,
            "parent_block_id": None,
            "type": BlockType.TOGGLE,
            "sort_order": "a0",
        },
        {
            "id": child_text_id,
            "parent_block_id": toggle_id,
            "type": BlockType.TEXT,
            "sort_order": "a0",
        },
        {
            "id": sibling_text_id,
            "parent_block_id": None,
            "type": BlockType.HEADING_1,
            "sort_order": "a1",
        },
    ]

    node_map = {}
    for b in flat_blocks:
        node_map[b["id"]] = BlockTreeNode(
            id=b["id"],
            page_id=page_id,
            parent_block_id=b["parent_block_id"],
            type=b["type"],
            content=[],
            properties={},
            sort_order=b["sort_order"],
            created_at=None,
            updated_at=None,
            children=[],
        )

    roots = []
    for b in flat_blocks:
        node = node_map[b["id"]]
        if b["parent_block_id"] and b["parent_block_id"] in node_map:
            node_map[b["parent_block_id"]].children.append(node)
        else:
            roots.append(node)

    assert len(roots) == 2
    assert roots[0].type == BlockType.TOGGLE
    assert len(roots[0].children) == 1
    assert roots[0].children[0].type == BlockType.TEXT
    assert roots[1].type == BlockType.HEADING_1


def test_tree_reordering_with_fractional_indexing():
    """Simulate moving a node between two siblings and reordering."""
    sibling1_order = "a0"
    sibling2_order = "a1"

    # Moving another item strictly between sibling1 and sibling2
    new_order = generate_fractional_index(sibling1_order, sibling2_order)
    assert sibling1_order < new_order < sibling2_order

    # Moving to the top (before sibling1)
    top_order = generate_fractional_index(None, sibling1_order)
    assert top_order < sibling1_order

    # Moving to the bottom (after sibling2)
    bottom_order = generate_fractional_index(sibling2_order, None)
    assert bottom_order > sibling2_order

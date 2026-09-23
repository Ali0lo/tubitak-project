import { describe, it, expect } from "vitest";
import { generateFractionalIndex } from "../lib/fractional-indexing";
import { PageTreeNode } from "../types/page";

describe("Tree Reordering and Hierarchy Operations", () => {
  it("should assemble flat pages into nested tree with correct order", () => {
    const rootPage: PageTreeNode = {
      id: "root-1",
      workspace_id: "ws-1",
      parent_id: null,
      title: "Projects",
      icon: "📁",
      is_favorite: false,
      is_archived: false,
      sort_order: "a0",
      children: [],
    };

    const childPage1: PageTreeNode = {
      id: "child-1",
      workspace_id: "ws-1",
      parent_id: "root-1",
      title: "WorkspaceEngine",
      icon: "🚀",
      is_favorite: true,
      is_archived: false,
      sort_order: "a0",
      children: [],
    };

    const childPage2: PageTreeNode = {
      id: "child-2",
      workspace_id: "ws-1",
      parent_id: "root-1",
      title: "Roadmap",
      icon: "🗺️",
      is_favorite: false,
      is_archived: false,
      sort_order: "a1",
      children: [],
    };

    rootPage.children = [childPage1, childPage2];

    expect(rootPage.children.length).toBe(2);
    expect(rootPage.children[0].title).toBe("WorkspaceEngine");
    expect(rootPage.children[1].title).toBe("Roadmap");

    // Insert a new child between childPage1 and childPage2
    const midSortOrder = generateFractionalIndex(
      childPage1.sort_order,
      childPage2.sort_order
    );
    expect(childPage1.sort_order < midSortOrder).toBe(true);
    expect(midSortOrder < childPage2.sort_order).toBe(true);

    const insertedChild: PageTreeNode = {
      id: "child-inserted",
      workspace_id: "ws-1",
      parent_id: "root-1",
      title: "Architecture Specs",
      icon: "📐",
      is_favorite: false,
      is_archived: false,
      sort_order: midSortOrder,
      children: [],
    };

    rootPage.children.push(insertedChild);
    rootPage.children.sort((a, b) => a.sort_order.localeCompare(b.sort_order));

    expect(rootPage.children[1].title).toBe("Architecture Specs");
  });

  it("should prevent cyclic parent assignment in tree hierarchy", () => {
    // A node cannot be assigned a descendant as its parent
    const pageMap = new Map<string, string | null>([
      ["root", null],
      ["sub1", "root"],
      ["sub2", "sub1"],
      ["target", "sub2"],
    ]);

    function hasCycle(movingId: string, targetParentId: string | null): boolean {
      if (!targetParentId) return false;
      if (movingId === targetParentId) return true;

      let current: string | null = targetParentId;
      const visited = new Set<string>([movingId]);

      while (current !== null) {
        if (visited.has(current)) {
          return true;
        }
        visited.add(current);
        current = pageMap.get(current) ?? null;
      }
      return false;
    }

    // Moving sub2 into root is fine
    expect(hasCycle("sub2", "root")).toBe(false);

    // Moving root into sub2 would cause a cycle
    expect(hasCycle("root", "sub2")).toBe(true);

    // Moving sub1 into its descendant target would cause a cycle
    expect(hasCycle("sub1", "target")).toBe(true);
  });
});

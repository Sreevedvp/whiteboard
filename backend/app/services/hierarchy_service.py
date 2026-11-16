import hashlib
from typing import Optional
from app.schemas.element import ElementCreate


class HierarchyService:
    @staticmethod
    def generate_manager_hash(manager_id: str, board_id: str) -> str:
        """
        Generates a deterministic hash for the outermost bounding polygon manager.
        """
        payload = f"{board_id}:{manager_id}".encode("utf-8")
        return hashlib.sha256(payload).hexdigest()[:32]

    @staticmethod
    def validate_parent_cycles(elements: list[ElementCreate]) -> None:
        """
        Ensures there are no cyclic references in parentclass pointers (A -> B -> A).
        Self-references (elem.id == elem.parentclass) are permitted when the element is the manager.
        """
        parent_map = {
            elem.id: elem.parentclass
            for elem in elements
            if elem.parentclass and elem.parentclass != elem.id
        }
        for start_id in parent_map:
            visited = set()
            curr = start_id
            while curr in parent_map:
                if curr in visited:
                    raise ValueError(f"Cyclic parentclass relationship detected involving element {curr}")
                visited.add(curr)
                curr = parent_map[curr]

    @staticmethod
    def check_bounding_containment(parent: ElementCreate, child: ElementCreate, threshold: float = 0.45) -> bool:
        """
        AABB geometric containment check: child is bounded by parent.
        Supports proportional enclosure (tolerates child sticking out up to 55%) as long as
        parent is strictly larger than child.
        """
        parent_right = parent.x + parent.width
        parent_bottom = parent.y + parent.height
        child_right = child.x + child.width
        child_bottom = child.y + child.height

        # Strict containment
        if (
            parent.x <= child.x and
            parent.y <= child.y and
            parent_right >= child_right and
            parent_bottom >= child_bottom
        ):
            return True

        # Proportional enclosure with sticking out threshold
        overlap_w = max(0.0, min(parent_right, child_right) - max(parent.x, child.x))
        overlap_h = max(0.0, min(parent_bottom, child_bottom) - max(parent.y, child.y))
        intersection_area = overlap_w * overlap_h

        child_area = abs(child.width * child.height)
        parent_area = abs(parent.width * parent.height)

        if child_area <= 0 or parent_area <= child_area:
            return False

        ratio = intersection_area / child_area
        return ratio >= threshold

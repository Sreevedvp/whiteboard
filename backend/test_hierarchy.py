import pytest
from app.services.hierarchy_service import HierarchyService
from app.schemas.element import ElementCreate


def test_manager_hash_deterministic():
    hash1 = HierarchyService.generate_manager_hash("elem_1", "board_1")
    hash2 = HierarchyService.generate_manager_hash("elem_1", "board_1")
    hash3 = HierarchyService.generate_manager_hash("elem_2", "board_1")
    assert hash1 == hash2
    assert hash1 != hash3


def test_bounding_containment_with_sticking_out():
    # Big parent box: 400x300 at (100, 100)
    parent = ElementCreate(
        id="box1", board_id="b1", type="rectangle",
        x=100, y=100, width=400, height=300
    )

    # Fully inside
    child_inside = ElementCreate(
        id="box2", board_id="b1", type="rectangle",
        x=150, y=150, width=100, height=80
    )
    assert HierarchyService.check_bounding_containment(parent, child_inside) is True

    # Sticking out slightly: width 100 at x=450 (parent maxX is 500, so 50px inside, 50px sticking out = 50% overlap)
    child_sticking_out = ElementCreate(
        id="box3", board_id="b1", type="rectangle",
        x=450, y=150, width=100, height=80
    )
    assert HierarchyService.check_bounding_containment(parent, child_sticking_out) is True

    # Sticking out mostly: width 100 at x=480 (only 20px inside = 20% overlap < 45%)
    child_mostly_outside = ElementCreate(
        id="box4", board_id="b1", type="rectangle",
        x=480, y=150, width=100, height=80
    )
    assert HierarchyService.check_bounding_containment(parent, child_mostly_outside) is False


def test_parent_cycle_detection():
    # Self-parenting manager is valid
    manager_self_parent = [
        ElementCreate(id="M", board_id="b1", type="rectangle", parentclass="M"),
        ElementCreate(id="C", board_id="b1", type="rectangle", parentclass="M")
    ]
    HierarchyService.validate_parent_cycles(manager_self_parent)

    # A -> B -> A cycle is rejected
    cycle_elements = [
        ElementCreate(id="A", board_id="b1", type="rectangle", parentclass="B"),
        ElementCreate(id="B", board_id="b1", type="rectangle", parentclass="A")
    ]
    with pytest.raises(ValueError, match="Cyclic parentclass relationship detected"):
        HierarchyService.validate_parent_cycles(cycle_elements)

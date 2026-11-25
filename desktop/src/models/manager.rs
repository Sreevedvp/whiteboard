use crate::models::element::{CommonObject, ShapeKind};
use crate::models::geometry::Rect2D;
use crate::models::id::ElementId;
use std::collections::{HashMap, HashSet, VecDeque};

#[derive(Debug, Clone)]
pub struct HierarchyNode {
    pub id: ElementId,
    pub type_name: &'static str,
    pub is_manager: bool,
    pub is_root: bool,
    pub children: Vec<HierarchyNode>,
}

pub struct ManagerClass;

impl ManagerClass {
    /// Recalculates all parent-child relationships and manager hashes across all elements.
    pub fn recalculate_all_hierarchies(elements: &mut [CommonObject]) {
        // Clear existing parent and manager relationships
        for el in elements.iter_mut() {
            el.parent_id = None;
            el.manager_hash = None;
        }

        let n = elements.len();
        if n <= 1 {
            Self::ensure_hierarchy_order(elements);
            return;
        }

        // Identify containers (surfaces that can hold child shapes)
        // Candidate parents must be Rectangle, Polygon, or Ellipse
        let mut candidates: Vec<(usize, Rect2D, f32)> = Vec::new();
        for (i, el) in elements.iter().enumerate() {
            match el.kind {
                ShapeKind::Rectangle { .. }
                | ShapeKind::Polygon { .. }
                | ShapeKind::Ellipse { .. } => {
                    let b = el.bounds;
                    candidates.push((i, b, b.area()));
                }
                _ => {}
            }
        }

        // For each element, find the best immediate enclosing parent (tightest container)
        for i in 0..n {
            let child_box = elements[i].bounds;
            let child_area = child_box.area().max(1.0);
            let child_center = child_box.center();

            let mut best_parent_idx: Option<usize> = None;
            let mut smallest_parent_area = f32::MAX;

            for &(p_idx, parent_box, parent_area) in &candidates {
                if p_idx == i {
                    continue;
                }
                // Parent must have strictly larger area
                if parent_area <= child_area {
                    continue;
                }

                // Strict containment OR proportional enclosure (tolerates sticking out up to 55%)
                let strictly_inside = parent_box.contains_rect(&child_box);
                let center_inside = parent_box.contains_point(child_center);

                let overlap_area = parent_box
                    .intersection(&child_box)
                    .map(|r| r.area())
                    .unwrap_or(0.0);
                let overlap_ratio = overlap_area / child_area;

                if strictly_inside
                    || (center_inside && overlap_ratio >= 0.45)
                    || overlap_ratio >= 0.50
                {
                    if parent_area < smallest_parent_area {
                        smallest_parent_area = parent_area;
                        best_parent_idx = Some(p_idx);
                    }
                }
            }

            if let Some(p_idx) = best_parent_idx {
                elements[i].parent_id = Some(elements[p_idx].id.clone());
            }
        }

        // Build parent -> children indices mapping
        let mut children_indices: HashMap<ElementId, Vec<usize>> = HashMap::new();
        for (idx, el) in elements.iter().enumerate() {
            if let Some(pid) = &el.parent_id {
                children_indices.entry(pid.clone()).or_default().push(idx);
            }
        }

        // Helper: does an element's subtree contain at least one child polygon/container?
        fn subtree_has_child_polygon(
            el_id: &ElementId,
            elements: &[CommonObject],
            children_map: &HashMap<ElementId, Vec<usize>>,
        ) -> bool {
            if let Some(children) = children_map.get(el_id) {
                for &c_idx in children {
                    let child = &elements[c_idx];
                    match child.kind {
                        ShapeKind::Rectangle { .. }
                        | ShapeKind::Polygon { .. }
                        | ShapeKind::Ellipse { .. } => return true,
                        _ => {
                            if subtree_has_child_polygon(&child.id, elements, children_map) {
                                return true;
                            }
                        }
                    }
                }
            }
            false
        }

        // Outermost Manager Rule:
        // A root element is designated as ManagerClass ONLY IF:
        // 1. It is a container (Rectangle, Polygon, or Ellipse).
        // 2. Its subtree contains at least one child polygon (Text/Arrow alone do NOT trigger manager status).
        let mut manager_hashes: HashMap<ElementId, String> = HashMap::new();
        for el in elements.iter() {
            if el.parent_id.is_none() {
                let is_container = matches!(
                    el.kind,
                    ShapeKind::Rectangle { .. }
                        | ShapeKind::Polygon { .. }
                        | ShapeKind::Ellipse { .. }
                );
                if is_container && subtree_has_child_polygon(&el.id, elements, &children_indices) {
                    let id_str = el.id.as_str();
                    let prefix = if id_str.len() >= 10 {
                        &id_str[..10]
                    } else {
                        id_str
                    };
                    manager_hashes.insert(el.id.clone(), format!("mgr_{}", prefix));
                }
            }
        }

        // Propagate manager hash to the manager itself AND all its descendants
        for (mgr_id, hash) in &manager_hashes {
            if let Some(mgr_el) = elements.iter_mut().find(|e| &e.id == mgr_id) {
                mgr_el.manager_hash = Some(hash.clone());
            }

            fn apply_hash_to_descendants(
                parent_id: &ElementId,
                hash: &str,
                elements: &mut [CommonObject],
                children_map: &HashMap<ElementId, Vec<usize>>,
            ) {
                if let Some(children) = children_map.get(parent_id) {
                    for &c_idx in children {
                        let child_id = elements[c_idx].id.clone();
                        elements[c_idx].manager_hash = Some(hash.to_string());
                        apply_hash_to_descendants(&child_id, hash, elements, children_map);
                    }
                }
            }
            apply_hash_to_descendants(mgr_id, hash, elements, &children_indices);
        }

        // Finally, topologically sort so parents are always rendered behind their children
        Self::ensure_hierarchy_order(elements);
    }

    /// Guarantees that parents are ordered before their children in the slice,
    /// and assigns monotonic z_index (0, 1, 2, ...).
    pub fn ensure_hierarchy_order(elements: &mut [CommonObject]) {
        let n = elements.len();
        if n <= 1 {
            for (idx, el) in elements.iter_mut().enumerate() {
                el.z_index = idx as i32;
            }
            return;
        }

        let id_to_idx: HashMap<ElementId, usize> = elements
            .iter()
            .enumerate()
            .map(|(i, el)| (el.id.clone(), i))
            .collect();

        // Build directed adjacency: parent -> children
        let mut adj: HashMap<usize, Vec<usize>> = HashMap::new();
        let mut in_degree: Vec<usize> = vec![0; n];

        for (i, el) in elements.iter().enumerate() {
            if let Some(pid) = &el.parent_id {
                if let Some(&p_idx) = id_to_idx.get(pid) {
                    adj.entry(p_idx).or_default().push(i);
                    in_degree[i] += 1;
                }
            }
        }

        // Kahn's algorithm for topological sorting
        let mut queue: VecDeque<usize> = VecDeque::new();
        for (i, &deg) in in_degree.iter().enumerate() {
            if deg == 0 {
                queue.push_back(i);
            }
        }

        let mut sorted_indices: Vec<usize> = Vec::with_capacity(n);
        while let Some(curr) = queue.pop_front() {
            sorted_indices.push(curr);
            if let Some(children) = adj.get(&curr) {
                for &child in children {
                    in_degree[child] -= 1;
                    if in_degree[child] == 0 {
                        queue.push_back(child);
                    }
                }
            }
        }

        // If cycles occurred or disconnected items remain, append them
        if sorted_indices.len() < n {
            let visited: HashSet<usize> = sorted_indices.iter().copied().collect();
            for i in 0..n {
                if !visited.contains(&i) {
                    sorted_indices.push(i);
                }
            }
        }

        // Reorder elements slice in-place
        let mut reordered: Vec<CommonObject> = Vec::with_capacity(n);
        for &orig_idx in &sorted_indices {
            reordered.push(elements[orig_idx].clone());
        }

        for (new_z, el) in reordered.iter_mut().enumerate() {
            el.z_index = new_z as i32;
        }

        elements.clone_from_slice(&reordered);
    }

    /// Build hierarchy tree model for the right-side tree visualization
    pub fn build_hierarchy_tree(elements: &[CommonObject]) -> Vec<HierarchyNode> {
        let mut children_map: HashMap<Option<ElementId>, Vec<&CommonObject>> = HashMap::new();
        for el in elements {
            children_map
                .entry(el.parent_id.clone())
                .or_default()
                .push(el);
        }

        fn build_subtree(
            el: &CommonObject,
            children_map: &HashMap<Option<ElementId>, Vec<&CommonObject>>,
            is_root: bool,
        ) -> HierarchyNode {
            let is_manager = is_root && el.manager_hash.is_some();
            let mut node = HierarchyNode {
                id: el.id.clone(),
                type_name: el.type_name(),
                is_manager,
                is_root,
                children: Vec::new(),
            };

            if let Some(children) = children_map.get(&Some(el.id.clone())) {
                for child in children {
                    node.children
                        .push(build_subtree(child, children_map, false));
                }
            }

            node
        }

        let mut tree = Vec::new();
        if let Some(roots) = children_map.get(&None) {
            for root in roots {
                tree.push(build_subtree(root, &children_map, true));
            }
        }

        tree
    }
}

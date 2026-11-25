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

                // Center containment check
                let center_inside = parent_box.contains_point(child_center);

                // Overlap ratio check
                let overlap_area = parent_box
                    .intersection(&child_box)
                    .map(|r| r.area())
                    .unwrap_or(0.0);
                let overlap_ratio = overlap_area / child_area;

                // Threshold: If center is inside and >= 65% overlap, it is inside the container
                // If small box is sticking out significantly (< 50% overlap), it's outside
                if center_inside && overlap_ratio >= 0.65 {
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

        // Compute manager hashes (outermost ancestor container)
        // Map child_id -> parent_id
        let id_to_parent: HashMap<ElementId, ElementId> = elements
            .iter()
            .filter_map(|e| e.parent_id.as_ref().map(|p| (e.id.clone(), p.clone())))
            .collect();

        for el in elements.iter_mut() {
            if let Some(mut current_parent) = el.parent_id.clone() {
                let mut visited = HashSet::new();
                visited.insert(el.id.clone());

                let mut outermost = current_parent.clone();
                while let Some(next_parent) = id_to_parent.get(&current_parent) {
                    if !visited.insert(next_parent.clone()) {
                        break; // Prevent cycle
                    }
                    outermost = next_parent.clone();
                    current_parent = next_parent.clone();
                }
                let hash_prefix = if outermost.as_str().len() >= 10 {
                    &outermost.as_str()[..10]
                } else {
                    outermost.as_str()
                };
                el.manager_hash = Some(format!("mgr_{}", hash_prefix));
            }
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
        let parent_set: HashSet<ElementId> = elements
            .iter()
            .filter_map(|e| e.parent_id.clone())
            .collect();

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
            parent_set: &HashSet<ElementId>,
            is_root: bool,
        ) -> HierarchyNode {
            let is_manager = parent_set.contains(&el.id);
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
                        .push(build_subtree(child, children_map, parent_set, false));
                }
            }

            node
        }

        let mut tree = Vec::new();
        if let Some(roots) = children_map.get(&None) {
            for root in roots {
                tree.push(build_subtree(root, &children_map, &parent_set, true));
            }
        }

        tree
    }
}

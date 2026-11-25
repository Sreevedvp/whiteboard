use serde::{Deserialize, Serialize};
use std::fmt;

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct ElementId(pub String);

impl ElementId {
    pub fn new(prefix: &str) -> Self {
        let uid = uuid::Uuid::new_v4().simple().to_string();
        Self(format!("{}_{}", prefix, &uid[..7]))
    }

    pub fn from_str(id: impl Into<String>) -> Self {
        Self(id.into())
    }

    pub fn as_str(&self) -> &str {
        &self.0
    }
}

impl fmt::Display for ElementId {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.0)
    }
}

impl From<&str> for ElementId {
    fn from(s: &str) -> Self {
        Self(s.to_string())
    }
}

impl From<String> for ElementId {
    fn from(s: String) -> Self {
        Self(s)
    }
}

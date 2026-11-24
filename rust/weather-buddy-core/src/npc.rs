use rand::Rng;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum NpcActionId {
    ReadingBook,
    PettingCat,
    PettingPuppy,
    ScrollingPhone,
    ListeningMusic,
}

impl NpcActionId {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::ReadingBook => "reading_book",
            Self::PettingCat => "petting_cat",
            Self::PettingPuppy => "petting_puppy",
            Self::ScrollingPhone => "scrolling_phone",
            Self::ListeningMusic => "listening_music",
        }
    }

    pub fn label_vi(&self) -> &'static str {
        match self {
            Self::ReadingBook => "Đọc sách",
            Self::PettingCat => "Chơi với mèo",
            Self::PettingPuppy => "Chơi với cún",
            Self::ScrollingPhone => "Xem điện thoại",
            Self::ListeningMusic => "Nghe nhạc",
        }
    }
}

pub const ALL_NPC_ACTIONS: [NpcActionId; 5] = [
    NpcActionId::ReadingBook,
    NpcActionId::PettingCat,
    NpcActionId::PettingPuppy,
    NpcActionId::ScrollingPhone,
    NpcActionId::ListeningMusic,
];

pub const NPC_ROTATION_INTERVAL_MS: u64 = 5 * 60 * 1000;
pub const NPC_STAND_DURATION_MS: u64 = 8_500;

/// Picks the next cozy seated NPC activity, guaranteeing zero consecutive duplicates.
pub fn pick_next_random_npc_action(
    current: Option<NpcActionId>,
    deterministic_sample: Option<f64>,
) -> NpcActionId {
    let candidates: Vec<NpcActionId> = match current {
        Some(curr) => ALL_NPC_ACTIONS
            .into_iter()
            .filter(|a| *a != curr)
            .collect(),
        None => ALL_NPC_ACTIONS.to_vec(),
    };

    let raw = deterministic_sample.unwrap_or_else(|| rand::thread_rng().gen::<f64>());
    let clamped = if raw.is_finite() {
        raw.clamp(0.0, 0.999_999_999)
    } else {
        0.0
    };
    let idx = (clamped * (candidates.len() as f64)).floor() as usize;
    candidates
        .get(idx)
        .copied()
        .unwrap_or(ALL_NPC_ACTIONS[0])
}

pub mod npc;
pub mod rule_engine;
pub mod types;

pub use npc::{
    pick_next_random_npc_action, NpcActionId, ALL_NPC_ACTIONS, NPC_ROTATION_INTERVAL_MS,
    NPC_STAND_DURATION_MS,
};
pub use rule_engine::{
    evaluate_character_decision, resolve_location_local_hour, resolve_sky_theme,
};
pub use types::{
    find_nearest_preset_city, infer_city_name, CharacterDecision, CharacterPrefs,
    CharacterSceneId, Gender, HourlyForecastPoint, PresetCity, SkyTheme, ThermalSensitivity,
    WeatherProviderType, WeatherSnapshot, WeatherVerificationMeta, AUTO_REFRESH_INTERVAL_MINUTES,
    AUTO_REFRESH_INTERVAL_MS, PRESET_CITIES,
};

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_snapshot() -> WeatherSnapshot {
        WeatherSnapshot {
            provider: "open_meteo".to_string(),
            location_name: "TP. Hồ Chí Minh".to_string(),
            latitude: 10.8231,
            longitude: 106.6297,
            updated_at_iso: "2026-05-15T10:30:00+07:00".to_string(),
            utc_offset_seconds: Some(7 * 3600),
            temperature_c: 29.0,
            feels_like_c: 30.0,
            humidity_pct: 68,
            wind_speed_kmh: 12.0,
            wind_gust_kmh: 18.0,
            uv_index: 5.0,
            precip_mm_per_hr: 0.0,
            precip_prob_pct: 10,
            condition_text: "Trời nắng quang đãng".to_string(),
            is_day: true,
            aqi: Some(45),
            hourly: vec![
                HourlyForecastPoint {
                    time_iso: "2026-05-15T11:00:00+07:00".to_string(),
                    temperature_c: 30.0,
                    precip_prob_pct: 10,
                    precip_mm: 0.0,
                    condition_code: "CLEAR".to_string(),
                },
                HourlyForecastPoint {
                    time_iso: "2026-05-15T12:00:00+07:00".to_string(),
                    temperature_c: 31.0,
                    precip_prob_pct: 15,
                    precip_mm: 0.0,
                    condition_code: "PARTLY_CLOUDY".to_string(),
                },
            ],
            verification: None,
        }
    }

    #[test]
    fn test_nighttime_hcmc_never_shows_hot_sunny() {
        let mut snap = sample_snapshot();
        snap.is_day = false;
        snap.updated_at_iso = "2026-05-15T22:15:00+07:00".to_string();
        snap.temperature_c = 31.0;
        snap.feels_like_c = 35.0; // Hot muggy HCMC night
        snap.uv_index = 0.0;

        let decision = evaluate_character_decision(
            &snap,
            CharacterPrefs {
                gender: Gender::Female,
                sensitivity: ThermalSensitivity::Normal,
            },
        );

        assert_eq!(decision.scene_id, CharacterSceneId::ClearNight);
        assert_eq!(decision.sky_theme, SkyTheme::Night);
        assert_eq!(decision.badge_vi, "🌙 Đêm oi bức");
    }

    #[test]
    fn test_daytime_rain_always_uses_non_dark_day_rain_sky() {
        let mut snap = sample_snapshot();
        snap.is_day = true;
        snap.precip_mm_per_hr = 1.8;
        snap.precip_prob_pct = 80;

        let light_decision = evaluate_character_decision(&snap, CharacterPrefs::default());
        assert_eq!(light_decision.scene_id, CharacterSceneId::LightRainUmbrella);
        assert_eq!(light_decision.sky_theme, SkyTheme::DayRain);
        assert!(!light_decision.sky_theme.is_dark());

        snap.precip_mm_per_hr = 7.5;
        snap.wind_gust_kmh = 45.0;
        let storm_decision = evaluate_character_decision(&snap, CharacterPrefs::default());
        assert_eq!(storm_decision.scene_id, CharacterSceneId::StormRaincoat);
        assert_eq!(storm_decision.sky_theme, SkyTheme::DayRain);
        assert!(!storm_decision.sky_theme.is_dark());
    }

    #[test]
    fn test_rain_ahead_6h_lookahead_and_aqi_mask() {
        let mut snap = sample_snapshot();
        snap.aqi = Some(165);
        snap.hourly.push(HourlyForecastPoint {
            time_iso: "2026-05-15T13:00:00+07:00".to_string(),
            temperature_c: 28.0,
            precip_prob_pct: 82,
            precip_mm: 2.5,
            condition_code: "RAIN".to_string(),
        });

        let decision = evaluate_character_decision(&snap, CharacterPrefs::default());
        assert_eq!(decision.scene_id, CharacterSceneId::PleasantSunny);
        assert!(decision.has_rain_ahead_prop);
        assert_eq!(decision.rain_ahead_hours, Some(3));
        assert!(decision.has_aqi_mask);
        assert_eq!(decision.sky_theme, SkyTheme::DayCloudy);
        assert_eq!(
            decision.outfit_advice_vi,
            "Mang sẵn ô, mưa sau 3h · Đeo khẩu trang"
        );
    }

    #[test]
    fn test_local_hour_resolution_across_priorities() {
        let mut snap = sample_snapshot();
        snap.updated_at_iso = "2026-05-15T06:15:00+07:00".to_string();
        snap.utc_offset_seconds = Some(7 * 3600);
        let hour = resolve_location_local_hour(&snap);
        assert!((hour - 6.25).abs() < 1e-6);

        let decision = evaluate_character_decision(&snap, CharacterPrefs::default());
        assert_eq!(decision.sky_theme, SkyTheme::Dawn);

        // Priority B without utc_offset_seconds
        snap.utc_offset_seconds = None;
        snap.updated_at_iso = "2026-05-15T17:30:00+07:00".to_string();
        let hour_b = resolve_location_local_hour(&snap);
        assert!((hour_b - 17.5).abs() < 1e-6);
        let sunset_decision = evaluate_character_decision(&snap, CharacterPrefs::default());
        assert_eq!(sunset_decision.sky_theme, SkyTheme::Sunset);

        // Short or non-ASCII malformed ISO must never panic
        snap.updated_at_iso = "ngày hôm".to_string();
        let fallback_hour = resolve_location_local_hour(&snap);
        assert!((0.0..24.0).contains(&fallback_hour));
    }

    #[test]
    fn test_npc_rotation_never_repeats_current_action() {
        for current in ALL_NPC_ACTIONS {
            for step in 0..10 {
                let sample = (step as f64) / 10.0;
                let next = pick_next_random_npc_action(Some(current), Some(sample));
                assert_ne!(next, current, "NPC rotation must never pick current action");
            }
        }
    }

    #[test]
    fn test_camel_case_json_serialization_matches_typescript_contract() {
        let snap = sample_snapshot();
        let decision = evaluate_character_decision(&snap, CharacterPrefs::default());
        let json = serde_json::to_value(&decision).expect("serialize decision");
        assert_eq!(json["sceneId"], "pleasant_sunny");
        assert_eq!(json["gender"], "female");
        assert_eq!(json["skyTheme"], "day_sunny");
        assert!(json.get("headlineVi").is_some());
        assert!(json.get("outfitAdviceVi").is_some());
        assert!(json.get("badgeVi").is_some());
    }
}

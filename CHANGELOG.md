# Changelog

## [1.3.0] - 2026-11-02

### Added

- The `darkTheme` and `lightTheme` config fields select custom themes. A custom theme that fails to load falls back to the built-in one.

## [1.2.2] - 2026-10-01

### Changed

- Supports Pi 1.x.

## [1.2.0] - 2026-09-21

### Breaking Changes

- Requires Pi 0.86 or newer.

## [1.1.3] - 2026-06-06

### Changed

- A polling failure caused by a stale session is reported in a notification.

## [1.1.2] - 2026-06-06

### Fixed

- Themes switch only in TUI sessions, and polling stops when the session becomes stale.

## [1.1.1] - 2026-06-06

### Fixed

- Theme polling no longer crashes after the session is replaced or reloaded.

## [1.0.1] - 2026-05-15

### Added

- Initial release. Switches between the dark and light themes based on `PI_AGENT_THEME`, `THEME_MODE`, or the time of day.

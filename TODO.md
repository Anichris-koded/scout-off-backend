- [x] Create migration `db/002_player_profile_history.sql` for `player_profile_history`

- [x] Add DB helpers in `src/db/index.ts`: insert history row + fetch history list

- [x] Update `src/controllers/playerController.ts` to insert history row after successful `updateProfile` in `updatePlayer`

- [x] Add authorization-guarded controller for GET history and wire route in `src/routes/player.ts`

- [x] Add new test file `tests/routes/playerHistory.test.ts` that uses real DB (no db mocking) and verifies history accumulation across multiple PUT updates

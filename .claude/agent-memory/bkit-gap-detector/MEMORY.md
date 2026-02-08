# Gap Detector Agent Memory - odok-app

## Last Analysis: 2026-02-08
- **Match Rate**: 88% (weighted)
- **Report**: `docs/03-analysis/odok-app.analysis.md`

## Critical Gaps Found
1. `translateStoryAI` - Firebase Function missing from `functions/index.js`, client calls it in `useStoryReader.js:133`
2. `analyzeReportAI` - Firebase Function missing from `functions/index.js`, client calls it in `useStoryReader.js:131`
3. Book document writes missing `genre`, `keywords`, `selectedMood`, `endingStyle` fields (design schema has them)

## Project Structure Notes
- **Components**: 10 in `src/components/`, all match design. 1 extra: `FirebaseErrorBoundary.jsx`
- **Hooks**: 7 in `src/hooks/`, all match design exactly
- **Utils**: 7 in `src/utils/`, all match design exactly
- **Functions**: 5 designed, only 3 implemented + 1 legacy wrapper
- **Routing**: 12 view states, all implemented in App.jsx via `useState`
- **Firestore rules**: `/artifacts/{appId}/` prefix pattern, notices at root `/notices/`

## Level System
- `levelUtils.js` has `isKeywordRefreshFree` at level >= 10 but design says Lv11+ (Best tier)
- All other tier thresholds match: Sprout 1-5, Writer 6-10, Best 11-20, Master 21+

## Data Model Extras (in code but not design)
- `points` field (parallel to ink system)
- `dateKey` on books (for slot queries)
- `lastNicknameChangeDate` (30-day cooldown)
- `dailyFreeReadUsed`, `dailyGenerationCount` (legacy story system fields)

## Design Document Location
- Design: `docs/02-design/features/odok-app.design.md`
- Plan: `docs/01-plan/features/odok-app.plan.md`
- Rules: `firestore.rules`

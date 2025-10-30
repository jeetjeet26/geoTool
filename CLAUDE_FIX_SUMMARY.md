# Claude Connector Fix - Default Score Issue

## Problem
Claude runs were returning default scores while OpenAI queries were working correctly.

## Root Cause
The `coerceToAnswerBlock` function in the Claude connector was too strict in parsing responses:
- It only looked for `ordered_entities` in the exact expected schema format
- The OpenAI connector had more flexible fallback logic supporting alternative structures (`results`, `providers`)
- When Claude returned data in a slightly different format, the parser failed silently
- Failed parsing resulted in empty `ordered_entities` array
- Empty entities led to null ranks, which produced default/zero scores

## Changes Made

### 1. Enhanced Claude Connector (`packages/core/src/connectors/claude.ts`)

**Updated `coerceToAnswerBlock` function:**
- Added fallback support for alternative entity array names: `ordered_entities`, `results`, or `providers`
- Added support for nested entity structures (e.g., `item.provider.name`)
- Enhanced citation extraction to support both:
  - Top-level citations array
  - Citations nested within entity objects (like OpenAI format)
- Improved TypeScript type safety

**Key Code Changes:**
```typescript
// Before: Only checked for ordered_entities
if (Array.isArray(objectCandidate.ordered_entities)) { ... }

// After: Checks multiple possible structures
const entitiesSource = Array.isArray(objectCandidate.ordered_entities)
  ? objectCandidate.ordered_entities
  : Array.isArray(objectCandidate.results)
  ? objectCandidate.results
  : Array.isArray(objectCandidate.providers)
  ? objectCandidate.providers
  : null;
```

### 2. Fixed OpenAI Connector TypeScript Errors (`packages/core/src/connectors/openai.ts`)

**Fixed type narrowing issue:**
- Moved the `if (!('choices' in completion))` check earlier
- This helps TypeScript understand the union type and eliminate Stream type from the union
- Resolved 10 TypeScript compilation errors

## Testing

To test the fix with Claude:

1. **Run a Claude query:**
```bash
cd packages/db
npx tsx scripts/run-client-once.ts <clientId>
```

2. **Modify the script to use Claude:**
Edit `packages/db/scripts/run-client-once.ts` and change:
```typescript
surfaces: ['claude'],  // instead of ['openai']
```

3. **Check the results:**
```bash
npx tsx scripts/show-latest-run.ts
```

Look for:
- `presence: true` if brand is mentioned
- `llmRank: <number>` if brand appears in entities (not null)
- `linkRank: <number>` if brand domain appears in citations (not null)
- Non-zero scores

## Expected Behavior After Fix

With the enhanced parsing:
- Claude responses in various formats will be correctly parsed
- Entity extraction will succeed even with alternative JSON structures
- Citations will be extracted from both top-level and nested locations
- Proper scores will be calculated based on brand presence and rankings
- Fallback to default score only when genuinely no data is available

## Verification

All packages build successfully:
- ✅ `packages/core` - Core connector logic
- ✅ `packages/db` - Database operations
- ✅ `apps/worker` - Worker processes

No TypeScript compilation errors remain.




# RUBRIC_CHANGELOG — M-0 normalization

> Scope: `backend/src/data/edumind_rubrics.json` (145 rubrics) and the shared admission-block map
> `backend/src/career/subjects.js`. Approved by **D13** (fix L2/L3/L5; exclude L4).
> Date: 2026-10-31. The admission DB (`learnpath.db`) was not touched.

## Baseline audit (before)

Command: `cd backend && node scripts/audit-rubrics.js`

| Class | Count | Meaning |
|---|---|---|
| L2 | 98 | subject not in the rubric's admission block (including 2 rubrics of the newly defined rare blocks) |
| L3 | 90 | `|Σthreshold − entryScore| > 0.01` |
| L4 | 2 | `entryScore` outside `(0, 30]` |
| L5 | 1 | 4 subjects (the same rubric as one L4 case) |

Legacy `fitPct` saturation at 7.0 per subject: median **94.4**, 71/145 rubrics ≥ 95 %.

## Changes applied

1. **Six rare blocks added** to `ADMISSION_SUBJECTS` in `backend/src/career/subjects.js`:
   `H00`, `M00`, `M10`, `N00`, `V00`, `B03`. Their subject sets come from the rubrics that
   declared those blocks; the two inconsistent rubrics were fixed in step 2.
2. **96 rubrics had subjects replaced** so that `subjects ⊂ BLOCK[admissionBlock]`.
   Existing weights and thresholds were sorted descending and re-assigned to the canonical
   block subjects; weights were re-normalized to 1.000. Examples:
   - `ĐHBK Hà Nội · Kỹ thuật Điều khiển - Tự động hoá · A00`: Toán/Lý/Anh → Toán/Lý/Hóa.
   - `ĐH Công nghệ - ĐHQGHN · Kỹ thuật Phần mềm · D01`: Toán/Lý/Anh → Toán/Văn/Anh.
   - `ĐH Sư phạm Hà Nội · Sư phạm Toán học · A00`: Toán/Lý/Văn → Toán/Lý/Hóa.
   - `ĐH Kiến trúc Hà Nội · Kiến trúc Cảnh quan · V00`: Sinh → Vật lý (V00 = Toán/Văn/Lý).
   - `ĐH Mỹ thuật Công nghiệp · Thiết kế Nội thất · H00`: Lý → Tiếng Anh (H00 = Toán/Văn/Anh).
3. **112 rubrics had thresholds re-scaled** so that `Σthreshold = entryScore` (±0.01). This is
   a proportional rescale of the existing values, not a new threshold guess. After scaling,
   **16 rubrics had one or more thresholds capped at 10** and the excess redistributed to the
   other subjects, so every threshold stays on the 0–10 per-subject scale while the sum remains
   `entryScore`. `threshold` is deprecated for the new `hocLucFit` (§17.5), but it remains
   consistent for `legacyFitPct` and the admin screen.
4. **2 rubrics marked `isValid: false`** and excluded from `hocLucFit`:
   - `ĐH Hà Nội · Ngôn ngữ Trung Quốc · D01`: `entryScore = 34.35`.
   - `ĐH Khoa học Tự nhiên - ĐHQGHN · Khoa học Tự nhiên · D01`: `entryScore = 31.5`,
     and it also has 4 subjects. Values were **not guessed**.
5. Every rubric now carries an explicit `isValid` boolean (missing = treated as valid for
   backwards compatibility, but the seeded file is explicit).

## Audit after

| Class | Count on valid rubrics | Note |
|---|---|---|
| L2 | 0 | the 2 remaining are the invalid rubrics |
| L3 | 0 | the 1 remaining is the invalid 34.35 rubric |
| L5 | 0 | the 4-subject rubric is invalid |
| Max threshold | 10.00 | all thresholds stay on the 0–10 per-subject scale |
| Valid rubrics | 143 | 145 − 2 invalid |

Legacy `fitPct` saturation at 7.0 per subject: median **87.5**, 39/145 rubrics ≥ 95 %.
The new percentile-based `hocLucFit` is the one that removes the mid-range saturation; see
`plans/KE_HOACH_NANG_CAP_LEARNPATH.md` §17.5 and the M18 test.

## Rollback

- The original file is recoverable from git (`git restore backend/src/data/edumind_rubrics.json`)
  or from the local backup taken before the write
  (`edumind_rubrics.json.before-m0-<timestamp>`; the backup was kept outside the repo during
  the session).
- The auth DB is re-seeded only through `backend/scripts/reseed-rubrics.js`, which creates
  `auth.db.pre-m0-<timestamp>` before writing and supports `--dry-run`.
- Applied on 2026-10-31 to `backend/database/auth.db`: pre-migration backup
  `auth.db.v6-backup-20261031130214132`, pre-reseed backup
  `auth.db.pre-m0-20261031130214177`. The DB is now v7 with 145 rubrics and 108 interest items.
- `learnpath.db` is not part of this change.

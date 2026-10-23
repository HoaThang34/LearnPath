/**
 * Shared query-string validation for paginated API routes.
 * Returns { limit, offset } or { error }.
 */
function parsePagination(query, { defaultLimit = 100, maxLimit = 1000 } = {}) {
  const rawLimit = query.limit;
  const rawOffset = query.offset;

  const limit = rawLimit === undefined ? defaultLimit : Number(rawLimit);
  const offset = rawOffset === undefined ? 0 : Number(rawOffset);

  if (!Number.isInteger(limit) || limit < 1 || limit > maxLimit) {
    return { error: `limit must be an integer between 1 and ${maxLimit}` };
  }
  if (!Number.isInteger(offset) || offset < 0) {
    return { error: 'offset must be a non-negative integer' };
  }

  return { limit, offset };
}

module.exports = { parsePagination };

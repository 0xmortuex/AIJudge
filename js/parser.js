const VALID_VERDICTS = ['party_a', 'party_b', 'both_wrong', 'both_right', 'its_complicated'];
const VALID_SEVERITIES = ['petty', 'minor', 'moderate', 'serious', 'catastrophic'];

export function parseRuling(raw) {
  let text = raw.trim();

  // Strip markdown code fences if present
  if (text.startsWith('```')) {
    text = text.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
  }

  let data;
  try {
    data = JSON.parse(text);
  } catch {
    // Try to extract JSON from surrounding text
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        data = JSON.parse(match[0]);
      } catch {
        throw new Error('The court\'s response was malformed. Please try again.');
      }
    } else {
      throw new Error('Could not parse ruling');
    }
  }

  // Validate required fields
  const required = ['caseTitle', 'verdict', 'verdictText', 'partyA', 'partyB', 'reasoning'];
  for (const field of required) {
    if (!data[field]) throw new Error(`Missing field: ${field}`);
  }

  // Normalize verdict
  if (!VALID_VERDICTS.includes(data.verdict)) {
    data.verdict = 'its_complicated';
  }

  // Normalize severity
  if (!VALID_SEVERITIES.includes(data.severityLevel)) {
    data.severityLevel = 'moderate';
  }

  // Default case number
  if (!data.caseNumber) {
    const r = () => String(Math.floor(1000 + Math.random() * 9000));
    data.caseNumber = `AJ-${r()}-${r()}`;
  }

  // Clamp numeric values
  data.confidenceLevel = Math.max(1, Math.min(100, data.confidenceLevel || 75));
  if (data.partyA) data.partyA.strengthOfCase = Math.max(1, Math.min(10, data.partyA.strengthOfCase || 5));
  if (data.partyB) data.partyB.strengthOfCase = Math.max(1, Math.min(10, data.partyB.strengthOfCase || 5));

  // Ensure arrays
  if (data.partyA) {
    data.partyA.validPoints = data.partyA.validPoints || [];
    data.partyA.weaknesses = data.partyA.weaknesses || [];
  }
  if (data.partyB) {
    data.partyB.validPoints = data.partyB.validPoints || [];
    data.partyB.weaknesses = data.partyB.weaknesses || [];
  }

  // Default optional fields
  data.roast = data.roast || '';
  data.precedent = data.precedent || '';
  data.advice = data.advice || '';
  data.keyEvidence = data.keyEvidence || '';
  data.category = data.category || 'other';
  data.clarifyingQuestion = data.clarifyingQuestion || '';

  // Timestamp
  data.timestamp = Date.now();

  return data;
}

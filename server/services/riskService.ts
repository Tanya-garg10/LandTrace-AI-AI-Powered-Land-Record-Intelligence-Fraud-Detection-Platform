import type Database from 'better-sqlite3';

export type RiskCategory = 'Low' | 'Medium' | 'High' | 'Critical';

export interface RiskIndicator {
  code: string;
  label: string;
  severity: RiskCategory;
  weight: number;
  triggered: boolean;
}

export interface RiskEvidence {
  indicator: string;
  detail: string;
}

export interface RiskEvaluationResult {
  parcel_id: string;
  property_id: number;
  risk_score: number;
  risk_category: RiskCategory;
  indicators: RiskIndicator[];
  evidence: RiskEvidence[];
  recommended_action: string;
  ai_summary: string;
}

export function scoreToCategory(score: number): RiskCategory {
  if (score >= 80) return 'Critical';
  if (score >= 60) return 'High';
  if (score >= 30) return 'Medium';
  return 'Low';
}

function parseAreaSqM(areaStr: string | undefined | null): number | null {
  if (!areaStr) return null;
  const cleaned = areaStr.replace(/,/g, '').toLowerCase();
  const match = cleaned.match(/([\d.]+)/);
  if (!match) return null;
  const num = parseFloat(match[1]);
  if (Number.isNaN(num)) return null;
  if (cleaned.includes('acre')) return num * 4046.86;
  if (cleaned.includes('hectare') || cleaned.includes('ha')) return num * 10000;
  if (cleaned.includes('sq.ft') || cleaned.includes('sqft')) return num * 0.092903;
  return num;
}

export interface DocumentComparisonContext {
  extractedOwnerName?: string;
  extractedPreviousOwner?: string;
  extractedSurveyNumber?: string;
  extractedLandArea?: string;
  missingFields?: string[];
  aiExplanation?: string;
}

export function evaluatePropertyRisk(
  db: Database.Database,
  parcelId: string,
  docContext?: DocumentComparisonContext,
  evaluatedBy: string = 'Deterministic Risk Engine'
): RiskEvaluationResult {
  const property = db
    .prepare('SELECT * FROM properties WHERE parcel_id = ?')
    .get(parcelId) as
    | {
        id: number;
        parcel_id: string;
        survey_number: string;
        district_name: string;
        land_area_sq_m: number;
        land_area_display: string;
        current_owner: string;
        previous_owner: string;
        verification_status: string;
      }
    | undefined;

  if (!property) {
    throw new Error(`Property ${parcelId} not found`);
  }

  const indicators: RiskIndicator[] = [];
  const evidence: RiskEvidence[] = [];
  let totalScore = 8; // Base baseline verification overhead

  // 1. Owner name mismatch (from document comparison or latest report)
  let ownerMismatch = false;
  let ownerMismatchDetail = '';
  if (docContext?.extractedOwnerName) {
    const dbOwner = property.current_owner.trim().toLowerCase();
    const docOwner = docContext.extractedOwnerName.trim().toLowerCase();
    const docPrev = (docContext.extractedPreviousOwner || '').trim().toLowerCase();
    // In a mutation deed, either current registered owner matches doc's seller/previous_owner OR matches current owner.
    // If neither matches, or if claimed current owner differs completely from registered owner:
    if (docOwner !== dbOwner && docPrev !== dbOwner) {
      ownerMismatch = true;
      ownerMismatchDetail = `Document names "${docContext.extractedOwnerName}" (previous: "${docContext.extractedPreviousOwner || 'Unspecified'}"), conflicting with registered owner "${property.current_owner}".`;
    } else if (docOwner !== dbOwner && docPrev === dbOwner) {
      // Mutation transfer claimed against registered owner without approved mutation
      ownerMismatch = true;
      ownerMismatchDetail = `Document asserts transfer to "${docContext.extractedOwnerName}" while registry still lists "${property.current_owner}" as active holder without completed mutation approval.`;
    }
  } else {
    const latestReport = db
      .prepare('SELECT inconsistencies_json FROM verification_reports WHERE parcel_id = ? ORDER BY id DESC LIMIT 1')
      .get(parcelId) as { inconsistencies_json: string } | undefined;
    if (latestReport) {
      const inc = JSON.parse(latestReport.inconsistencies_json || '[]') as Array<{ field?: string; detail?: string }>;
      const found = inc.find((i) => i.field === 'owner_name');
      if (found) {
        ownerMismatch = true;
        ownerMismatchDetail = found.detail || 'Prior verification report flagged an owner name discrepancy.';
      }
    }
  }

  if (ownerMismatch) {
    totalScore += 38;
    indicators.push({
      code: 'OWNER_MISMATCH',
      label: 'Owner Name Mismatch',
      severity: 'High',
      weight: 38,
      triggered: true,
    });
    evidence.push({ indicator: 'Owner Name Mismatch', detail: ownerMismatchDetail });
  }

  // 2. Duplicate survey numbers in the same district
  const dupSurvey = db
    .prepare(
      'SELECT COUNT(*) as cnt, GROUP_CONCAT(parcel_id) as parcels FROM properties WHERE survey_number = ? AND district_name = ?'
    )
    .get(property.survey_number, property.district_name) as { cnt: number; parcels: string };
  if (dupSurvey.cnt > 1) {
    totalScore += 25;
    indicators.push({
      code: 'DUPLICATE_SURVEY_NUMBER',
      label: 'Duplicate Survey Number in District',
      severity: 'High',
      weight: 25,
      triggered: true,
    });
    evidence.push({
      indicator: 'Duplicate Survey Number',
      detail: `Survey number "${property.survey_number}" in ${property.district_name} appears across multiple parcels (${dupSurvey.parcels}).`,
    });
  }

  // 3. Inconsistent land area
  if (docContext?.extractedLandArea) {
    const extractedSqM = parseAreaSqM(docContext.extractedLandArea);
    if (extractedSqM !== null && property.land_area_sq_m > 0) {
      const pctDiff = Math.abs(extractedSqM - property.land_area_sq_m) / property.land_area_sq_m;
      if (pctDiff > 0.05) {
        totalScore += 22;
        indicators.push({
          code: 'AREA_DISCREPANCY',
          label: 'Inconsistent Land Area',
          severity: 'Medium',
          weight: 22,
          triggered: true,
        });
        evidence.push({
          indicator: 'Inconsistent Land Area',
          detail: `Document specifies "${docContext.extractedLandArea}" (~${Math.round(extractedSqM)} sq.m), differing by ${(pctDiff * 100).toFixed(1)}% from registered area (${property.land_area_display}).`,
        });
      }
    }
  }

  // 4. Missing supporting documents or missing fields
  const docCount = (
    db.prepare('SELECT COUNT(*) as cnt FROM documents WHERE parcel_id = ?').get(parcelId) as { cnt: number }
  ).cnt;
  const missingFields = docContext?.missingFields ?? [];
  if (docCount === 0 || missingFields.length >= 2) {
    totalScore += 15;
    indicators.push({
      code: 'MISSING_DOCUMENT_FIELDS',
      label: docCount === 0 ? 'Missing Supporting Documents' : 'Incomplete Document Fields',
      severity: 'Medium',
      weight: 15,
      triggered: true,
    });
    evidence.push({
      indicator: 'Document Completeness',
      detail:
        docCount === 0
          ? 'No verified supporting deed or mutation document is linked to this parcel.'
          : `Uploaded document is missing ${missingFields.length} required fields: ${missingFields.join(', ')}.`,
    });
  }

  // 5. Conflicting or flagged mutation records
  const mutations = db
    .prepare('SELECT mutation_ref, status, is_suspicious FROM mutation_requests WHERE parcel_id = ?')
    .all(parcelId) as Array<{ mutation_ref: string; status: string; is_suspicious: number }>;

  const activeMutations = mutations.filter((m) => !['Approved', 'Rejected'].includes(m.status));
  const flaggedMutations = mutations.filter((m) => m.status === 'Flagged for Investigation' || m.is_suspicious === 1);

  if (flaggedMutations.length > 0 || activeMutations.length > 1) {
    totalScore += 22;
    indicators.push({
      code: 'CONFLICTING_MUTATIONS',
      label: 'Conflicting / Flagged Mutation Requests',
      severity: 'High',
      weight: 22,
      triggered: true,
    });
    evidence.push({
      indicator: 'Conflicting Mutation Records',
      detail: `${flaggedMutations.length} flagged and ${activeMutations.length} concurrent active mutation request(s) found (${mutations.map((m) => m.mutation_ref).join(', ')}).`,
    });
  }

  // 6. Rapid ownership churn (>=2 events in 180 days)
  const historyRows = db
    .prepare('SELECT submitted_date, change_type FROM ownership_history WHERE parcel_id = ? ORDER BY submitted_date DESC')
    .all(parcelId) as Array<{ submitted_date: string; change_type: string }>;

  if (historyRows.length >= 2) {
    const latest = new Date(historyRows[0].submitted_date).getTime();
    const second = new Date(historyRows[1].submitted_date).getTime();
    const daysBetween = Math.abs(latest - second) / (1000 * 60 * 60 * 24);
    if (!Number.isNaN(daysBetween) && daysBetween <= 180) {
      totalScore += 18;
      indicators.push({
        code: 'RAPID_OWNERSHIP_CHURN',
        label: 'Repeated Ownership Changes in Short Period',
        severity: 'Medium',
        weight: 18,
        triggered: true,
      });
      evidence.push({
        indicator: 'Rapid Ownership Changes',
        detail: `${historyRows.length} recorded transfers with ${Math.round(daysBetween)} days between recent events (${historyRows[1].submitted_date} and ${historyRows[0].submitted_date}).`,
      });
    }
  }

  const finalScore = Math.min(100, Math.max(0, totalScore));
  const riskCategory = scoreToCategory(finalScore);

  let recommendedAction = 'Routine periodic monitoring; record matches current deterministic checks.';
  if (riskCategory === 'Critical') {
    recommendedAction =
      'Immediate officer freeze & physical sub-registrar deed verification required before any mutation approval.';
  } else if (riskCategory === 'High') {
    recommendedAction =
      'Hold pending mutation, summon certified original title deed, and verify chain-of-title identity documents.';
  } else if (riskCategory === 'Medium') {
    recommendedAction =
      'Schedule Verification Officer review to reconcile survey measurements or missing deed metadata.';
  }

  const aiSummary =
    docContext?.aiExplanation ||
    (evidence.length > 0
      ? `Evaluated ${indicators.length} active risk indicator(s) totaling ${finalScore}/100 (${riskCategory}). Primary driver: ${evidence[0].detail}`
      : `All deterministic integrity checks passed with minimal baseline risk (${finalScore}/100 · Low).`);

  // Persist RiskAssessment & update Property risk score
  db.prepare(
    `INSERT INTO risk_assessments (
      property_id, parcel_id, risk_score, risk_category, indicators_json, evidence_json, recommended_action, ai_summary, evaluated_by, is_demo
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`
  ).run(
    property.id,
    parcelId,
    finalScore,
    riskCategory,
    JSON.stringify(indicators),
    JSON.stringify(evidence),
    recommendedAction,
    aiSummary,
    evaluatedBy
  );

  const nextStatus =
    finalScore >= 60 ? 'Flagged' : property.verification_status === 'Flagged' && finalScore < 30 ? 'Verified' : property.verification_status;

  db.prepare(
    `UPDATE properties SET risk_score = ?, risk_category = ?, verification_status = ?, updated_at = datetime('now') WHERE id = ?`
  ).run(finalScore, riskCategory, nextStatus, property.id);

  return {
    parcel_id: parcelId,
    property_id: property.id,
    risk_score: finalScore,
    risk_category: riskCategory,
    indicators,
    evidence,
    recommended_action: recommendedAction,
    ai_summary: aiSummary,
  };
}

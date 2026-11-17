import { GoogleGenAI, Type } from '@google/genai';
import type Database from 'better-sqlite3';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { appendAuditEntry } from './auditService.ts';
import { evaluatePropertyRisk } from './riskService.ts';

const require = createRequire(import.meta.url);

export interface ExtractedDocumentFields {
  owner_name: string;
  previous_owner: string;
  parcel_id: string;
  survey_number: string;
  registration_date: string;
  land_area: string;
  document_reference: string;
  document_type: string;
  missing_fields: string[];
  observations: string[];
  explanation: string;
  confidence_level: 'High' | 'Medium' | 'Low';
}

export interface FieldComparisonItem {
  field: string;
  label: string;
  database_value: string;
  extracted_value: string;
  status: 'Matched' | 'Mismatched' | 'Missing';
  note: string;
}

export interface DocumentAnalysisResponse {
  document_id: number;
  doc_ref: string;
  report_id: number;
  report_ref: string;
  parcel_id: string;
  ocr_method: string;
  ai_provider: string;
  extracted_text: string;
  extracted_fields: ExtractedDocumentFields;
  comparisons: FieldComparisonItem[];
  matched_fields: string[];
  mismatched_fields: Array<{ field: string; detail: string }>;
  missing_fields: string[];
  risk_assessment: {
    risk_score: number;
    risk_category: string;
    indicators: Array<{ code: string; label: string; severity: string; weight: number }>;
    evidence: Array<{ indicator: string; detail: string }>;
    recommended_action: string;
  };
  flagged_mutation_ref: string | null;
  audit_event_id: string;
  recommended_steps: string[];
  disclaimer: string;
}

async function extractPdfTextSafe(buffer: Buffer): Promise<string> {
  try {
    const pdfParse = require('pdf-parse/lib/pdf-parse.js');
    const result = await pdfParse(buffer);
    return (result?.text || '').trim();
  } catch {
    return '';
  }
}

export function deterministicExtractFromText(rawText: string, filename: string): ExtractedDocumentFields {
  const getMatch = (patterns: RegExp[]): string => {
    for (const re of patterns) {
      const m = rawText.match(re);
      if (m && m[1]) return m[1].trim();
    }
    return '';
  };

  const ownerName = getMatch([
    /(?:Current\s*Owner|Proposed\s*Owner|Transferee|Buyer|Claimant|Owner\s*Name)(?:\s*\([^)]+\))?\s*[:\-]\s*([^\n\r]+)/i,
    /executed\s+in\s+favour\s+of\s+([A-Z][a-zA-Z\s.]{2,40})/i,
  ]);
  const previousOwner = getMatch([
    /(?:Previous\s*Owner|Transferor|Seller|Vendor)(?:\s*\([^)]+\))?\s*[:\-]\s*([^\n\r]+)/i,
  ]);
  const parcelId = getMatch([
    /(?:Parcel\s*ID|Parcel\s*No\.?|Record\s*ID)\s*[:\-]\s*([A-Z0-9-]+)/i,
    /(LT-PAR-\d{4})/i,
  ]);
  const surveyNumber = getMatch([
    /(?:Survey\s*Number|Survey\s*No\.?)\s*[:\-]\s*([A-Z0-9\/-]+)/i,
  ]);
  const registrationDate = getMatch([
    /(?:Registration\s*Date|Date\s*of\s*Execution|Dated)\s*[:\-]\s*([0-9]{4}-[0-9]{2}-[0-9]{2}|[0-9]{1,2}\s+[A-Za-z]+\s+[0-9]{4})/i,
  ]);
  const landArea = getMatch([
    /(?:Land\s*Area|Total\s*Area|Extent)\s*[:\-]\s*([^\n\r]+)/i,
  ]);
  const documentReference = getMatch([
    /(?:Document\s*Ref(?:erence)?|Deed\s*No\.?|Reg\.?\s*No\.?)\s*[:\-]\s*([A-Z0-9\/-]+)/i,
  ]);
  const documentType = getMatch([
    /(?:Document\s*Type|Instrument\s*Type)\s*[:\-]\s*([^\n\r]+)/i,
  ]) || (filename.toLowerCase().includes('mutation') ? 'Mutation Application Deed' : 'Property Conveyance Deed');

  const missing: string[] = [];
  if (!ownerName) missing.push('owner_name');
  if (!previousOwner) missing.push('previous_owner');
  if (!parcelId) missing.push('parcel_id');
  if (!surveyNumber) missing.push('survey_number');
  if (!registrationDate) missing.push('registration_date');
  if (!landArea) missing.push('land_area');
  if (!documentReference) missing.push('document_reference');

  const observations: string[] = [];
  if (rawText.length < 40) {
    observations.push('Limited machine-readable text detected; image/scan verification recommended.');
  } else {
    observations.push('Structured fields parsed using deterministic pattern extractor.');
  }
  if (missing.length > 0) {
    observations.push(`Missing fields requiring manual officer check: ${missing.join(', ')}.`);
  }

  return {
    owner_name: ownerName,
    previous_owner: previousOwner,
    parcel_id: parcelId,
    survey_number: surveyNumber,
    registration_date: registrationDate,
    land_area: landArea,
    document_reference: documentReference,
    document_type: documentType,
    missing_fields: missing,
    observations,
    explanation:
      'Extracted using deterministic local parser fallback. Review all fields against certified sub-registrar records before taking administrative action.',
    confidence_level: missing.length <= 1 ? 'Medium' : 'Low',
  };
}

async function extractWithGemini(params: {
  buffer: Buffer;
  mimeType: string;
  extractedText: string;
  filename: string;
}): Promise<{ fields: ExtractedDocumentFields; rawText: string; aiProvider: string; ocrMethod: string }> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    const fallbackText =
      params.extractedText ||
      `Filename: ${params.filename}. Binary upload (${params.mimeType}) analyzed via deterministic fallback without active Gemini API key.`;
    return {
      fields: deterministicExtractFromText(fallbackText, params.filename),
      rawText: fallbackText,
      aiProvider: 'Deterministic Local Fallback',
      ocrMethod: params.extractedText ? 'PyPDF/Text Extraction + Local Rules' : 'Local Metadata Fallback',
    };
  }

  try {
    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];

    const isVisualOrPdf =
      params.mimeType === 'application/pdf' ||
      params.mimeType === 'image/jpeg' ||
      params.mimeType === 'image/png' ||
      params.mimeType === 'image/jpg';

    if (isVisualOrPdf && params.buffer.length <= 12 * 1024 * 1024) {
      parts.push({
        inlineData: {
          mimeType: params.mimeType === 'image/jpg' ? 'image/jpeg' : params.mimeType,
          data: params.buffer.toString('base64'),
        },
      });
    }

    const promptText = [
      'You are an expert land record document verification analyst for LandTrace AI.',
      'Analyze the provided property deed, mutation record, or land document carefully.',
      'Extract ONLY information explicitly present in the document. NEVER invent or fabricate missing fields — return an empty string "" for absent fields and list them in missing_fields.',
      'Provide clear, evidence-based observations and an objective explanation. Never claim legal proof of ownership.',
      params.extractedText ? `\nExtracted Document Text:\n"""\n${params.extractedText.slice(0, 12000)}\n"""` : '',
    ]
      .filter(Boolean)
      .join('\n');

    parts.push({ text: promptText });

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: { parts },
      config: {
        systemInstruction:
          'Return strictly structured JSON matching the schema. Do not hallucinate missing values; leave absent fields as empty strings and include their field names in missing_fields.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            owner_name: { type: Type.STRING, description: 'Current or proposed owner/transferee name on document, or empty string if absent.' },
            previous_owner: { type: Type.STRING, description: 'Previous owner/seller/transferor name on document, or empty string if absent.' },
            parcel_id: { type: Type.STRING, description: 'Parcel identifier (e.g. LT-PAR-1004) if present, else empty string.' },
            survey_number: { type: Type.STRING, description: 'Survey number if present, else empty string.' },
            registration_date: { type: Type.STRING, description: 'Registration or execution date, else empty string.' },
            land_area: { type: Type.STRING, description: 'Land area/extent with units, else empty string.' },
            document_reference: { type: Type.STRING, description: 'Deed or registration reference number, else empty string.' },
            document_type: { type: Type.STRING, description: 'Instrument type (Sale Deed, Mutation Application, Gift Deed, etc.).' },
            missing_fields: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'List of expected key fields missing or illegible in the document.',
            },
            observations: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'Factual observations about stamps, signatures, dates, or ambiguities.',
            },
            explanation: {
              type: Type.STRING,
              description: 'Evidence-based summary explaining what was extracted and what requires human verification.',
            },
            confidence_level: {
              type: Type.STRING,
              description: 'One of High, Medium, or Low based on legibility and field completeness.',
            },
            ocr_transcript: {
              type: Type.STRING,
              description: 'Concise verbatim transcription of key text read from the document.',
            },
          },
          required: [
            'owner_name',
            'previous_owner',
            'parcel_id',
            'survey_number',
            'registration_date',
            'land_area',
            'document_reference',
            'document_type',
            'missing_fields',
            'observations',
            'explanation',
            'confidence_level',
          ],
        },
      },
    });

    const parsed = JSON.parse((response.text ?? '{}').trim()) as ExtractedDocumentFields & { ocr_transcript?: string };
    const normalizedConfidence: 'High' | 'Medium' | 'Low' =
      parsed.confidence_level === 'High' || parsed.confidence_level === 'Low' ? parsed.confidence_level : 'Medium';

    return {
      fields: {
        owner_name: parsed.owner_name || '',
        previous_owner: parsed.previous_owner || '',
        parcel_id: parsed.parcel_id || '',
        survey_number: parsed.survey_number || '',
        registration_date: parsed.registration_date || '',
        land_area: parsed.land_area || '',
        document_reference: parsed.document_reference || '',
        document_type: parsed.document_type || 'Property Document',
        missing_fields: Array.isArray(parsed.missing_fields) ? parsed.missing_fields : [],
        observations: Array.isArray(parsed.observations) ? parsed.observations : [],
        explanation: parsed.explanation || 'Structured extraction completed by Gemini 4 Hydrogen.',
        confidence_level: normalizedConfidence,
      },
      rawText: params.extractedText || parsed.ocr_transcript || 'Processed via Gemini multimodal document inspection.',
      aiProvider: 'Gemini 4 Hydrogen',
      ocrMethod: params.mimeType.startsWith('image/') ? 'Gemini Multimodal OCR' : 'PDF Text + Gemini Extraction',
    };
  } catch (err) {
    console.warn('Gemini extraction fallback triggered:', err instanceof Error ? err.message : String(err));
    const fallbackText =
      params.extractedText ||
      `Filename: ${params.filename}. Deterministic fallback executed after Gemini API unavailability.`;
    return {
      fields: deterministicExtractFromText(fallbackText, params.filename),
      rawText: fallbackText,
      aiProvider: 'Deterministic Local Fallback',
      ocrMethod: params.extractedText ? 'PDF Text Extraction + Local Rules' : 'Local Fallback Parser',
    };
  }
}

function normalizeStr(v: string): string {
  return v.trim().toLowerCase().replace(/\s+/g, ' ');
}

function compareNumericArea(dbSqM: number, extractedArea: string): boolean {
  const m = extractedArea.replace(/,/g, '').match(/([\d.]+)/);
  if (!m) return false;
  const val = parseFloat(m[1]);
  if (Number.isNaN(val)) return false;
  let sqM = val;
  const low = extractedArea.toLowerCase();
  if (low.includes('acre')) sqM = val * 4046.86;
  else if (low.includes('hectare') || low.includes('ha')) sqM = val * 10000;
  else if (low.includes('sqft') || low.includes('sq.ft')) sqM = val * 0.092903;
  return Math.abs(sqM - dbSqM) / Math.max(1, dbSqM) <= 0.05;
}

export async function analyzeAndVerifyDocument(params: {
  db: Database.Database;
  parcelId: string;
  filename: string;
  mimeType: string;
  buffer: Buffer;
  storagePath: string;
  actor: { id: number; name: string; role: string };
}): Promise<DocumentAnalysisResponse> {
  const property = params.db
    .prepare('SELECT * FROM properties WHERE parcel_id = ?')
    .get(params.parcelId) as
    | {
        id: number;
        parcel_id: string;
        survey_number: string;
        district_name: string;
        village: string;
        tehsil: string;
        land_area_sq_m: number;
        land_area_display: string;
        current_owner: string;
        previous_owner: string;
        registration_date: string;
        verification_status: string;
      }
    | undefined;

  if (!property) {
    throw new Error(`Target property ${params.parcelId} not found.`);
  }

  // Step 2: Extract text
  let rawText = '';
  if (params.mimeType === 'application/pdf') {
    rawText = await extractPdfTextSafe(params.buffer);
  } else if (params.mimeType.startsWith('text/')) {
    rawText = params.buffer.toString('utf8');
  }

  // Step 3-5: Gemini AI structured extraction (with deterministic fallback)
  const { fields, rawText: finalText, aiProvider, ocrMethod } = await extractWithGemini({
    buffer: params.buffer,
    mimeType: params.mimeType,
    extractedText: rawText,
    filename: params.filename,
  });

  // Step 6: Compare extracted fields against DB record
  const comparisons: FieldComparisonItem[] = [];
  const matchedFields: string[] = [];
  const mismatchedFields: Array<{ field: string; detail: string }> = [];
  const missingSet = new Set<string>(fields.missing_fields || []);

  // Owner comparison
  if (!fields.owner_name) {
    missingSet.add('owner_name');
    comparisons.push({
      field: 'owner_name',
      label: 'Registered / Claimed Owner',
      database_value: property.current_owner,
      extracted_value: 'Not detected',
      status: 'Missing',
      note: 'Owner name was not legible or absent in uploaded document.',
    });
  } else if (normalizeStr(fields.owner_name) === normalizeStr(property.current_owner)) {
    matchedFields.push('owner_name');
    comparisons.push({
      field: 'owner_name',
      label: 'Registered / Claimed Owner',
      database_value: property.current_owner,
      extracted_value: fields.owner_name,
      status: 'Matched',
      note: 'Extracted owner matches current registered titleholder.',
    });
  } else {
    const detail = `Document owner "${fields.owner_name}" differs from registered DB owner "${property.current_owner}".`;
    mismatchedFields.push({ field: 'owner_name', detail });
    comparisons.push({
      field: 'owner_name',
      label: 'Registered / Claimed Owner',
      database_value: property.current_owner,
      extracted_value: fields.owner_name,
      status: 'Mismatched',
      note: detail,
    });
  }

  // Parcel ID comparison
  if (!fields.parcel_id) {
    missingSet.add('parcel_id');
    comparisons.push({
      field: 'parcel_id',
      label: 'Parcel Identifier',
      database_value: property.parcel_id,
      extracted_value: 'Not detected',
      status: 'Missing',
      note: 'Parcel ID not explicitly printed on instrument.',
    });
  } else if (normalizeStr(fields.parcel_id) === normalizeStr(property.parcel_id)) {
    matchedFields.push('parcel_id');
    comparisons.push({
      field: 'parcel_id',
      label: 'Parcel Identifier',
      database_value: property.parcel_id,
      extracted_value: fields.parcel_id,
      status: 'Matched',
      note: 'Parcel identifier aligns with registry index.',
    });
  } else {
    const detail = `Document parcel ID "${fields.parcel_id}" does not match selected parcel "${property.parcel_id}".`;
    mismatchedFields.push({ field: 'parcel_id', detail });
    comparisons.push({
      field: 'parcel_id',
      label: 'Parcel Identifier',
      database_value: property.parcel_id,
      extracted_value: fields.parcel_id,
      status: 'Mismatched',
      note: detail,
    });
  }

  // Survey Number comparison
  if (!fields.survey_number) {
    missingSet.add('survey_number');
    comparisons.push({
      field: 'survey_number',
      label: 'Survey Number',
      database_value: property.survey_number,
      extracted_value: 'Not detected',
      status: 'Missing',
      note: 'Survey number absent in extracted text.',
    });
  } else if (normalizeStr(fields.survey_number) === normalizeStr(property.survey_number)) {
    matchedFields.push('survey_number');
    comparisons.push({
      field: 'survey_number',
      label: 'Survey Number',
      database_value: property.survey_number,
      extracted_value: fields.survey_number,
      status: 'Matched',
      note: 'Survey designation confirmed.',
    });
  } else {
    const detail = `Survey number "${fields.survey_number}" conflicts with registered "${property.survey_number}".`;
    mismatchedFields.push({ field: 'survey_number', detail });
    comparisons.push({
      field: 'survey_number',
      label: 'Survey Number',
      database_value: property.survey_number,
      extracted_value: fields.survey_number,
      status: 'Mismatched',
      note: detail,
    });
  }

  // Land area comparison
  if (!fields.land_area) {
    missingSet.add('land_area');
    comparisons.push({
      field: 'land_area',
      label: 'Land Area',
      database_value: property.land_area_display,
      extracted_value: 'Not detected',
      status: 'Missing',
      note: 'Area measurement missing from instrument.',
    });
  } else if (compareNumericArea(property.land_area_sq_m, fields.land_area)) {
    matchedFields.push('land_area');
    comparisons.push({
      field: 'land_area',
      label: 'Land Area',
      database_value: property.land_area_display,
      extracted_value: fields.land_area,
      status: 'Matched',
      note: 'Extracted area is within ±5% tolerance of registered extent.',
    });
  } else {
    const detail = `Document area "${fields.land_area}" diverges from registered extent "${property.land_area_display}".`;
    mismatchedFields.push({ field: 'land_area', detail });
    comparisons.push({
      field: 'land_area',
      label: 'Land Area',
      database_value: property.land_area_display,
      extracted_value: fields.land_area,
      status: 'Mismatched',
      note: detail,
    });
  }

  // Registration date comparison
  if (!fields.registration_date) {
    missingSet.add('registration_date');
    comparisons.push({
      field: 'registration_date',
      label: 'Registration Date',
      database_value: property.registration_date,
      extracted_value: 'Not detected',
      status: 'Missing',
      note: 'Execution or registration date not specified.',
    });
  } else if (normalizeStr(fields.registration_date) === normalizeStr(property.registration_date)) {
    matchedFields.push('registration_date');
    comparisons.push({
      field: 'registration_date',
      label: 'Registration Date',
      database_value: property.registration_date,
      extracted_value: fields.registration_date,
      status: 'Matched',
      note: 'Registration date matches registry entry.',
    });
  } else {
    comparisons.push({
      field: 'registration_date',
      label: 'Registration Date',
      database_value: property.registration_date,
      extracted_value: fields.registration_date,
      status: 'Mismatched',
      note: `Document date "${fields.registration_date}" differs from historical registry date "${property.registration_date}" (expected if filing a new transfer).`,
    });
  }

  const missingFields = Array.from(missingSet);

  // Persist Document record
  const docRef = `DOC-${new Date().getFullYear()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
  const docInsert = params.db
    .prepare(
      `INSERT INTO documents (
        doc_ref, property_id, parcel_id, filename, mime_type, file_size, storage_path,
        extracted_text, ocr_method, ai_provider, extracted_json, analysis_status, uploaded_by, is_demo
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Completed', ?, 1)`
    )
    .run(
      docRef,
      property.id,
      property.parcel_id,
      params.filename,
      params.mimeType,
      params.buffer.length,
      params.storagePath,
      finalText,
      ocrMethod,
      aiProvider,
      JSON.stringify(fields),
      params.actor.id
    );
  const documentId = Number(docInsert.lastInsertRowid);

  // If critical mismatch detected (especially owner mismatch), flag or create a flagged mutation for review
  let flaggedMutationRef: string | null = null;
  if (mismatchedFields.some((m) => m.field === 'owner_name' || m.field === 'survey_number' || m.field === 'land_area')) {
    const existingOpen = params.db
      .prepare(
        `SELECT id, mutation_ref, status_history_json FROM mutation_requests WHERE parcel_id = ? AND status NOT IN ('Approved', 'Rejected') ORDER BY id DESC LIMIT 1`
      )
      .get(property.parcel_id) as { id: number; mutation_ref: string; status_history_json: string } | undefined;

    const noteText = `Auto-flagged by Document Intelligence (${docRef}): ${mismatchedFields.map((m) => m.detail).join(' ')}`;

    if (existingOpen) {
      const history = JSON.parse(existingOpen.status_history_json || '[]') as Array<Record<string, unknown>>;
      history.push({
        status: 'Flagged for Investigation',
        changed_by: params.actor.name,
        note: noteText,
        timestamp: new Date().toISOString(),
      });
      params.db
        .prepare(
          `UPDATE mutation_requests SET status = 'Flagged for Investigation', is_suspicious = 1, supporting_document_id = ?, supporting_doc_ref = ?, admin_notes = ?, status_history_json = ?, updated_at = datetime('now') WHERE id = ?`
        )
        .run(documentId, docRef, noteText, JSON.stringify(history), existingOpen.id);
      flaggedMutationRef = existingOpen.mutation_ref;
    } else {
      const mutRef = `MUT-${new Date().getFullYear()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
      const history = [
        {
          status: 'Flagged for Investigation',
          changed_by: params.actor.name,
          note: noteText,
          timestamp: new Date().toISOString(),
        },
      ];
      params.db
        .prepare(
          `INSERT INTO mutation_requests (
            mutation_ref, property_id, parcel_id, applicant_name, proposed_owner, current_owner_snapshot,
            change_type, status, assigned_officer_name, supporting_document_id, supporting_doc_ref,
            admin_notes, status_history_json, is_suspicious, is_demo
          ) VALUES (?, ?, ?, ?, ?, ?, ?, 'Flagged for Investigation', 'Claire Vance', ?, ?, ?, ?, 1, 1)`
        )
        .run(
          mutRef,
          property.id,
          property.parcel_id,
          fields.owner_name || params.actor.name,
          fields.owner_name || 'Unverified Claimant',
          property.current_owner,
          fields.document_type || 'Mutation Transfer',
          documentId,
          docRef,
          noteText,
          JSON.stringify(history)
        );
      flaggedMutationRef = mutRef;
    }
  }

  // Step 7: Evaluate Risk Intelligence Engine
  const riskEval = evaluatePropertyRisk(
    params.db,
    property.parcel_id,
    {
      extractedOwnerName: fields.owner_name,
      extractedPreviousOwner: fields.previous_owner,
      extractedSurveyNumber: fields.survey_number,
      extractedLandArea: fields.land_area,
      missingFields,
      aiExplanation: fields.explanation,
    },
    `${aiProvider} + Risk Engine`
  );

  // Build recommended next steps
  const recommendedSteps: string[] = [];
  if (mismatchedFields.some((m) => m.field === 'owner_name')) {
    recommendedSteps.push('Summon original registered owner and claimant with government-issued photo ID for in-person verification.');
    recommendedSteps.push('Cross-check Sub-Registrar Book-I index for certified encumbrance certificate.');
  }
  if (mismatchedFields.some((m) => m.field === 'land_area')) {
    recommendedSteps.push('Order licensed Tehsil surveyor boundary re-measurement before mutation clearance.');
  }
  if (missingFields.length > 0) {
    recommendedSteps.push(`Request authenticated addendum covering missing fields: ${missingFields.join(', ')}.`);
  }
  if (recommendedSteps.length === 0) {
    recommendedSteps.push('All primary fields match registry records; proceed to standard Verification Officer sign-off.');
  }

  // Write tamper-evident audit ledger entry
  const auditRow = appendAuditEntry(params.db, {
    parcelId: property.parcel_id,
    entityType: 'DocumentAnalysis',
    entityId: docRef,
    action:
      mismatchedFields.length > 0
        ? `DOCUMENT_VERIFICATION_FLAGGED (${docRef}: ${mismatchedFields.map((m) => m.field).join(', ')})`
        : `DOCUMENT_VERIFICATION_PASSED (${docRef})`,
    previousRecord: {
      parcel_id: property.parcel_id,
      current_owner: property.current_owner,
      verification_status: property.verification_status,
    },
    newRecord: {
      doc_ref: docRef,
      extracted_owner: fields.owner_name,
      risk_score: riskEval.risk_score,
      mismatches: mismatchedFields.length,
      flagged_mutation: flaggedMutationRef,
    },
    actorId: params.actor.id,
    actorName: params.actor.name,
    actorRole: params.actor.role,
  });

  // Persist VerificationReport
  const reportRef = `RPT-${new Date().getFullYear()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
  const riskAssessmentRow = params.db
    .prepare('SELECT id FROM risk_assessments WHERE parcel_id = ? ORDER BY id DESC LIMIT 1')
    .get(property.parcel_id) as { id: number } | undefined;

  const rptInsert = params.db
    .prepare(
      `INSERT INTO verification_reports (
        report_ref, property_id, parcel_id, document_id, risk_assessment_id,
        extracted_fields_json, comparison_json, missing_fields_json, inconsistencies_json,
        risk_score, risk_category, ai_explanation, recommended_steps_json, audit_entry_id, generated_by, is_demo
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`
    )
    .run(
      reportRef,
      property.id,
      property.parcel_id,
      documentId,
      riskAssessmentRow?.id ?? null,
      JSON.stringify(fields),
      JSON.stringify(comparisons),
      JSON.stringify(missingFields),
      JSON.stringify(mismatchedFields),
      riskEval.risk_score,
      riskEval.risk_category,
      fields.explanation,
      JSON.stringify(recommendedSteps),
      auditRow.event_id,
      params.actor.name
    );

  // Create notification if mismatch or high risk
  if (mismatchedFields.length > 0 || riskEval.risk_score >= 60) {
    params.db
      .prepare(
        `INSERT INTO notifications (user_id, parcel_id, title, message, severity) VALUES (?, ?, ?, ?, ?)`
      )
      .run(
        params.actor.id,
        property.parcel_id,
        `Verification Alert: ${property.parcel_id}`,
        `${mismatchedFields.length} discrepancy detected in ${docRef}. Risk score updated to ${riskEval.risk_score}/100 (${riskEval.risk_category}).`,
        riskEval.risk_score >= 80 ? 'critical' : 'warning'
      );
  }

  return {
    document_id: documentId,
    doc_ref: docRef,
    report_id: Number(rptInsert.lastInsertRowid),
    report_ref: reportRef,
    parcel_id: property.parcel_id,
    ocr_method: ocrMethod,
    ai_provider: aiProvider,
    extracted_text: finalText,
    extracted_fields: fields,
    comparisons,
    matched_fields: matchedFields,
    mismatched_fields: mismatchedFields,
    missing_fields: missingFields,
    risk_assessment: {
      risk_score: riskEval.risk_score,
      risk_category: riskEval.risk_category,
      indicators: riskEval.indicators,
      evidence: riskEval.evidence,
      recommended_action: riskEval.recommended_action,
    },
    flagged_mutation_ref: flaggedMutationRef,
    audit_event_id: auditRow.event_id,
    recommended_steps: recommendedSteps,
    disclaimer:
      'Advisory intelligence only: AI document extraction and deterministic comparison assist verification officers and do not constitute legal proof of ownership or official registry certification.',
  };
}

export function ensureSampleUploadsDir(): string {
  const dir = pathResolveSafe();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

function pathResolveSafe(): string {
  return `${process.cwd()}/uploads`;
}

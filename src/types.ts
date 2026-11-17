export type UserRole =
  | 'Citizen / Landowner'
  | 'Revenue Officer'
  | 'Document Verification Officer'
  | 'System Administrator';

export interface User {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  department: string;
  avatar_url: string;
}

export interface District {
  id: number;
  name: string;
  state: string;
  code: string;
  center_lat: number;
  center_lng: number;
  total_villages: number;
}

export type VerificationStatus = 'Verified' | 'Pending Review' | 'Flagged' | 'Under Investigation';
export type RiskCategory = 'Low' | 'Medium' | 'High' | 'Critical';

export interface Property {
  id: number;
  parcel_id: string;
  survey_number: string;
  district_id: number;
  district_name: string;
  village: string;
  tehsil: string;
  land_area_sq_m: number;
  land_area_display: string;
  land_type: string;
  current_owner: string;
  previous_owner: string;
  registration_date: string;
  verification_status: VerificationStatus;
  risk_score: number;
  risk_category: RiskCategory;
  latitude: number;
  longitude: number;
  boundary_geojson: string;
  owner_user_id?: number | null;
  assigned_officer_id?: number | null;
  is_demo: number;
  created_at: string;
  updated_at: string;
}

export interface OwnershipEvent {
  id: number;
  property_id: number;
  parcel_id: string;
  previous_owner: string;
  new_owner: string;
  change_type: string;
  mutation_reference: string;
  submitted_date: string;
  approval_status: string;
  supporting_document: string;
  verification_officer: string;
  notes: string;
  created_at: string;
}

export type MutationStatus =
  | 'Submitted'
  | 'Under Review'
  | 'Documents Required'
  | 'Approved'
  | 'Rejected'
  | 'Flagged for Investigation';

export interface MutationRequest {
  id: number;
  mutation_ref: string;
  property_id: number;
  parcel_id: string;
  applicant_name: string;
  proposed_owner: string;
  current_owner_snapshot: string;
  change_type: string;
  status: MutationStatus;
  assigned_officer_id: number | null;
  assigned_officer_name: string;
  supporting_document_id: number | null;
  supporting_doc_ref: string;
  admin_notes: string;
  status_history_json: string;
  is_suspicious: number;
  district_name?: string;
  village?: string;
  survey_number?: string;
  risk_score?: number;
  risk_category?: RiskCategory;
  created_at: string;
  updated_at: string;
}

export interface DocumentRecord {
  id: number;
  doc_ref: string;
  property_id: number;
  parcel_id: string;
  filename: string;
  mime_type: string;
  file_size: number;
  extracted_text: string;
  ocr_method: string;
  ai_provider: string;
  extracted_json: string;
  analysis_status: string;
  current_owner?: string;
  district_name?: string;
  survey_number?: string;
  created_at: string;
}

export interface FieldComparison {
  field: string;
  label: string;
  database_value: string;
  extracted_value: string;
  status: 'Matched' | 'Mismatched' | 'Missing';
  note: string;
}

export interface VerificationReport {
  id: number;
  report_ref: string;
  property_id: number;
  parcel_id: string;
  document_id: number | null;
  risk_assessment_id: number | null;
  extracted_fields_json: string;
  comparison_json: string;
  missing_fields_json: string;
  inconsistencies_json: string;
  risk_score: number;
  risk_category: RiskCategory;
  ai_explanation: string;
  recommended_steps_json: string;
  audit_entry_id: string;
  generated_by: string;
  human_decision?: string;
  decision_notes?: string;
  decided_by?: string;
  decided_at?: string;
  survey_number?: string;
  district_name?: string;
  village?: string;
  tehsil?: string;
  land_area_display?: string;
  current_owner?: string;
  previous_owner?: string;
  registration_date?: string;
  verification_status?: string;
  filename?: string;
  doc_ref?: string;
  ai_provider?: string;
  ocr_method?: string;
  created_at: string;
}

export interface RiskAssessment {
  id: number;
  property_id: number;
  parcel_id: string;
  risk_score: number;
  risk_category: RiskCategory;
  indicators_json: string;
  evidence_json: string;
  recommended_action: string;
  ai_summary: string;
  evaluated_by: string;
  current_owner?: string;
  district_name?: string;
  village?: string;
  survey_number?: string;
  verification_status?: string;
  created_at: string;
}

export interface AuditLogEntry {
  id: number;
  event_id: string;
  parcel_id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  previous_record_hash: string;
  new_record_hash: string;
  previous_ledger_hash: string;
  current_ledger_hash: string;
  payload_snapshot_json: string;
  actor_id: number;
  actor_name: string;
  actor_role: string;
  created_at: string;
}

export interface LedgerVerificationReport {
  status: 'VERIFIED' | 'TAMPER_DETECTED';
  total_entries: number;
  verified_entries: number;
  broken_links: number;
  genesis_hash: string;
  latest_hash: string;
  checked_at: string;
  issues: Array<{
    entry_id: number;
    event_id: string;
    parcel_id: string;
    issue_type: string;
    expected_hash: string;
    actual_hash: string;
    message: string;
  }>;
  disclaimer: string;
}

export interface NotificationItem {
  id: number;
  user_id: number;
  parcel_id: string;
  title: string;
  message: string;
  severity: 'info' | 'warning' | 'critical';
  is_read: number;
  created_at: string;
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
  extracted_fields: {
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
  };
  comparisons: FieldComparison[];
  matched_fields: string[];
  mismatched_fields: Array<{ field: string; detail: string }>;
  missing_fields: string[];
  risk_assessment: {
    risk_score: number;
    risk_category: RiskCategory;
    indicators: Array<{ code: string; label: string; severity: string; weight: number }>;
    evidence: Array<{ indicator: string; detail: string }>;
    recommended_action: string;
  };
  flagged_mutation_ref: string | null;
  audit_event_id: string;
  recommended_steps: string[];
  disclaimer: string;
}

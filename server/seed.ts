import bcrypt from 'bcryptjs';
import type Database from 'better-sqlite3';
import { appendAuditEntry } from './services/auditService.ts';

function buildPolygonGeoJson(lat: number, lng: number, sizeDeg: number = 0.0022, skew: number = 0.0005): string {
  const coords = [
    [lng - sizeDeg, lat - sizeDeg * 0.75],
    [lng + sizeDeg + skew, lat - sizeDeg * 0.65],
    [lng + sizeDeg * 0.9, lat + sizeDeg * 0.85],
    [lng - sizeDeg * 1.1, lat + sizeDeg * 0.7],
    [lng - sizeDeg, lat - sizeDeg * 0.75],
  ];
  return JSON.stringify({
    type: 'Polygon',
    coordinates: [coords],
  });
}

export function seedDatabase(db: Database.Database): void {
  const userCount = (db.prepare('SELECT COUNT(*) as cnt FROM users').get() as { cnt: number }).cnt;
  if (userCount > 0) return;

  // 1. Seed 4 Demo Role Users
  const citizenHash = bcrypt.hashSync('Citizen@123', 10);
  const revenueHash = bcrypt.hashSync('Revenue@123', 10);
  const officerHash = bcrypt.hashSync('Officer@123', 10);
  const adminHash = bcrypt.hashSync('Admin@123', 10);

  const insertUser = db.prepare(
    `INSERT INTO users (name, email, password_hash, role, department, avatar_url) VALUES (?, ?, ?, ?, ?, ?)`
  );

  const citizenId = Number(
    insertUser.run(
      'Anand Narayan Gokhale',
      'citizen@landtrace.demo',
      citizenHash,
      'Citizen / Landowner',
      'Registered Property Holder · Sahyadri Valley',
      '/src/assets/images/avatar_citizen_landowner_1794898755585.jpg'
    ).lastInsertRowid
  );

  const revenueId = Number(
    insertUser.run(
      'Rajeshwar Verma',
      'revenue@landtrace.demo',
      revenueHash,
      'Revenue Officer',
      'Tehsil Land Operations & Mutation Circle',
      '/src/assets/images/avatar_revenue_officer_1794898756576.jpg'
    ).lastInsertRowid
  );

  const officerId = Number(
    insertUser.run(
      'Claire Vance',
      'officer@landtrace.demo',
      officerHash,
      'Document Verification Officer',
      'AI Document Scrutiny & Compliance Desk',
      '/src/assets/images/avatar_verification_officer_1794895344663.jpg'
    ).lastInsertRowid
  );

  const adminId = Number(
    insertUser.run(
      'Dr. Meera Deshmukh',
      'admin@landtrace.demo',
      adminHash,
      'System Administrator',
      'Directorate of Land Records & Compliance',
      '/src/assets/images/avatar_admin_director_1794895343634.jpg'
    ).lastInsertRowid
  );

  // 2. Seed 5 Synthetic Districts
  const districtsData = [
    { name: 'Sahyadri Valley', state: 'Demo State West', code: 'SV-01', lat: 18.5204, lng: 73.8567, villages: 18 },
    { name: 'Kaveri Basin', state: 'Demo State South', code: 'KB-02', lat: 12.9716, lng: 77.5946, villages: 24 },
    { name: 'Vindhya Ridge', state: 'Demo State Central', code: 'VR-03', lat: 23.2599, lng: 77.4126, villages: 15 },
    { name: 'Narmada Plains', state: 'Demo State Central', code: 'NP-04', lat: 22.7196, lng: 75.8577, villages: 21 },
    { name: 'Deccan Plateau', state: 'Demo State South', code: 'DP-05', lat: 17.385, lng: 78.4867, villages: 19 },
  ];

  const districtIds: Record<string, number> = {};
  const insertDistrict = db.prepare(
    `INSERT INTO districts (name, state, code, center_lat, center_lng, total_villages) VALUES (?, ?, ?, ?, ?, ?)`
  );
  for (const d of districtsData) {
    districtIds[d.name] = Number(insertDistrict.run(d.name, d.state, d.code, d.lat, d.lng, d.villages).lastInsertRowid);
  }

  // 3. Seed 25 Synthetic Properties (with citizen owner links and revenue officer assignments)
  const citizenOwnedParcels = new Set(['LT-PAR-1001', 'LT-PAR-1002', 'LT-PAR-1004', 'LT-PAR-1007']);
  const revenueAssignedParcels = new Set([
    'LT-PAR-1003',
    'LT-PAR-1004',
    'LT-PAR-1005',
    'LT-PAR-1006',
    'LT-PAR-1008',
    'LT-PAR-1010',
    'LT-PAR-1013',
    'LT-PAR-1015',
    'LT-PAR-1024',
  ]);

  const propertiesSeed = [
    {
      parcel_id: 'LT-PAR-1001',
      survey_number: 'SY-101/A',
      district: 'Sahyadri Valley',
      village: 'Paudwadi',
      tehsil: 'Mulshi',
      sq_m: 3200,
      area: '3,200 sq.m',
      type: 'Agricultural',
      owner: 'Anand Narayan Gokhale',
      prev: 'Narayan V. Gokhale',
      reg: '2021-04-12',
      status: 'Verified',
      score: 12,
      cat: 'Low',
      lat: 18.5284,
      lng: 73.8482,
    },
    {
      parcel_id: 'LT-PAR-1002',
      survey_number: 'SY-204/C',
      district: 'Sahyadri Valley',
      village: 'Bavdhan Khurd',
      tehsil: 'Haveli',
      sq_m: 1450,
      area: '1,450 sq.m',
      type: 'Residential',
      owner: 'Anand Narayan Gokhale',
      prev: 'Prabhakar Joshi',
      reg: '2022-08-19',
      status: 'Verified',
      score: 14,
      cat: 'Low',
      lat: 18.5162,
      lng: 73.8124,
    },
    {
      parcel_id: 'LT-PAR-1003',
      survey_number: 'SY-315/B',
      district: 'Sahyadri Valley',
      village: 'Khedgaon',
      tehsil: 'Haveli',
      sq_m: 4100,
      area: '4,100 sq.m',
      type: 'Mixed Commercial',
      owner: 'Vikramaditya Rao Patil',
      prev: 'Devendra Patil',
      reg: '2023-01-25',
      status: 'Pending Review',
      score: 38,
      cat: 'Medium',
      lat: 18.5378,
      lng: 73.8791,
    },
    {
      // FLAGSHIP DEMO SCENARIO PROPERTY
      parcel_id: 'LT-PAR-1004',
      survey_number: 'SY-408/B',
      district: 'Sahyadri Valley',
      village: 'Khedgaon',
      tehsil: 'Haveli',
      sq_m: 2450,
      area: '2,450 sq.m',
      type: 'Residential Plot',
      owner: 'Rajeshwari Kulkarni',
      prev: 'Madhavrao Kulkarni',
      reg: '2020-11-09',
      status: 'Pending Review',
      score: 42,
      cat: 'Medium',
      lat: 18.5432,
      lng: 73.8615,
    },
    {
      parcel_id: 'LT-PAR-1005',
      survey_number: 'SY-512/A',
      district: 'Sahyadri Valley',
      village: 'Hinjawadi East',
      tehsil: 'Mulshi',
      sq_m: 6800,
      area: '6,800 sq.m',
      type: 'Commercial',
      owner: 'Sahyadri Agro-Tech Cooperative',
      prev: 'Kishore Bhosale',
      reg: '2024-02-14',
      status: 'Flagged',
      score: 84,
      cat: 'Critical',
      lat: 18.5515,
      lng: 73.8342,
    },
    {
      parcel_id: 'LT-PAR-1006',
      survey_number: 'SY-512/A',
      district: 'Sahyadri Valley',
      village: 'Hinjawadi East',
      tehsil: 'Mulshi',
      sq_m: 6750,
      area: '6,750 sq.m',
      type: 'Commercial',
      owner: 'Horizon Realty Holdings',
      prev: 'Kishore Bhosale',
      reg: '2024-09-03',
      status: 'Under Investigation',
      score: 88,
      cat: 'Critical',
      lat: 18.5542,
      lng: 73.8398,
    },
    {
      parcel_id: 'LT-PAR-1007',
      survey_number: 'KB-118/D',
      district: 'Kaveri Basin',
      village: 'Yelahanka North',
      tehsil: 'Bengaluru North',
      sq_m: 1850,
      area: '1,850 sq.m',
      type: 'Residential',
      owner: 'Anand Narayan Gokhale',
      prev: 'S. Krishnamurthy',
      reg: '2021-06-30',
      status: 'Verified',
      score: 10,
      cat: 'Low',
      lat: 12.9891,
      lng: 77.5844,
    },
    {
      parcel_id: 'LT-PAR-1008',
      survey_number: 'KB-224/A',
      district: 'Kaveri Basin',
      village: 'Hebbal Tank',
      tehsil: 'Bengaluru North',
      sq_m: 5400,
      area: '5,400 sq.m',
      type: 'Industrial',
      owner: 'Kaveri Precision Castings Pvt Ltd',
      prev: 'Raghavendra Rao',
      reg: '2023-03-17',
      status: 'Flagged',
      score: 68,
      cat: 'High',
      lat: 12.9785,
      lng: 77.6112,
    },
    {
      parcel_id: 'LT-PAR-1009',
      survey_number: 'KB-309/B',
      district: 'Kaveri Basin',
      village: 'Devanahalli South',
      tehsil: 'Devanahalli',
      sq_m: 12000,
      area: '12,000 sq.m',
      type: 'Agricultural',
      owner: 'Manjunath Gowda',
      prev: 'Basavaraj Gowda',
      reg: '2019-12-05',
      status: 'Verified',
      score: 16,
      cat: 'Low',
      lat: 12.9612,
      lng: 77.6245,
    },
    {
      parcel_id: 'LT-PAR-1010',
      survey_number: 'KB-411/E',
      district: 'Kaveri Basin',
      village: 'Whitefield Annex',
      tehsil: 'Bengaluru East',
      sq_m: 2100,
      area: '2,100 sq.m',
      type: 'Residential',
      owner: 'Priya Subramanian',
      prev: 'Lakshmi Narayanan',
      reg: '2024-05-22',
      status: 'Pending Review',
      score: 34,
      cat: 'Medium',
      lat: 12.9584,
      lng: 77.5718,
    },
    {
      parcel_id: 'LT-PAR-1011',
      survey_number: 'KB-502/C',
      district: 'Kaveri Basin',
      village: 'Kengeri Lake',
      tehsil: 'Bengaluru South',
      sq_m: 3600,
      area: '3,600 sq.m',
      type: 'Mixed Residential',
      owner: 'Arvind Venkataraman',
      prev: 'Gopalakrishna Iyengar',
      reg: '2022-10-14',
      status: 'Verified',
      score: 11,
      cat: 'Low',
      lat: 12.9489,
      lng: 77.5991,
    },
    {
      parcel_id: 'LT-PAR-1012',
      survey_number: 'VR-089/A',
      district: 'Vindhya Ridge',
      village: 'Bairagarh Kalan',
      tehsil: 'Huzur',
      sq_m: 8500,
      area: '8,500 sq.m',
      type: 'Agricultural',
      owner: 'Harishankar Tiwari',
      prev: 'Rameshwar Tiwari',
      reg: '2020-02-28',
      status: 'Verified',
      score: 15,
      cat: 'Low',
      lat: 23.2684,
      lng: 77.3922,
    },
    {
      parcel_id: 'LT-PAR-1013',
      survey_number: 'VR-142/B',
      district: 'Vindhya Ridge',
      village: 'Kolar Road',
      tehsil: 'Huzur',
      sq_m: 1950,
      area: '1,950 sq.m',
      type: 'Residential',
      owner: 'Neha Saxena',
      prev: 'Alok Saxena',
      reg: '2024-07-11',
      status: 'Flagged',
      score: 74,
      cat: 'High',
      lat: 23.2412,
      lng: 77.4295,
    },
    {
      parcel_id: 'LT-PAR-1014',
      survey_number: 'VR-205/D',
      district: 'Vindhya Ridge',
      village: 'Misrod',
      tehsil: 'Huzur',
      sq_m: 4400,
      area: '4,400 sq.m',
      type: 'Commercial',
      owner: 'Central Logistics Trust',
      prev: 'Bhopal Warehousing Co.',
      reg: '2023-06-09',
      status: 'Verified',
      score: 18,
      cat: 'Low',
      lat: 23.2519,
      lng: 77.4482,
    },
    {
      parcel_id: 'LT-PAR-1015',
      survey_number: 'VR-319/A',
      district: 'Vindhya Ridge',
      village: 'Ayodhya Nagar',
      tehsil: 'Huzur',
      sq_m: 1200,
      area: '1,200 sq.m',
      type: 'Residential',
      owner: 'Deepak Verma',
      prev: 'Suresh Verma',
      reg: '2021-09-18',
      status: 'Pending Review',
      score: 46,
      cat: 'Medium',
      lat: 23.2775,
      lng: 77.4198,
    },
    {
      parcel_id: 'LT-PAR-1016',
      survey_number: 'NP-104/B',
      district: 'Narmada Plains',
      village: 'Rau Sector II',
      tehsil: 'Indore Rural',
      sq_m: 5100,
      area: '5,100 sq.m',
      type: 'Agricultural',
      owner: 'Balram Patidar',
      prev: 'Mohanlal Patidar',
      reg: '2018-05-11',
      status: 'Verified',
      score: 9,
      cat: 'Low',
      lat: 22.7082,
      lng: 75.8391,
    },
    {
      parcel_id: 'LT-PAR-1017',
      survey_number: 'NP-217/C',
      district: 'Narmada Plains',
      village: 'Bicholi Mardana',
      tehsil: 'Indore Urban',
      sq_m: 2800,
      area: '2,800 sq.m',
      type: 'Residential',
      owner: 'Anjali Holkar',
      prev: 'Yashwant Rao',
      reg: '2024-01-30',
      status: 'Under Investigation',
      score: 82,
      cat: 'Critical',
      lat: 22.7289,
      lng: 75.8784,
    },
    {
      parcel_id: 'LT-PAR-1018',
      survey_number: 'NP-330/A',
      district: 'Narmada Plains',
      village: 'Sanwer Road',
      tehsil: 'Sanwer',
      sq_m: 7400,
      area: '7,400 sq.m',
      type: 'Industrial',
      owner: 'Malwa Textiles LLP',
      prev: 'Kiran Jain',
      reg: '2022-11-21',
      status: 'Verified',
      score: 19,
      cat: 'Low',
      lat: 22.7395,
      lng: 75.8452,
    },
    {
      parcel_id: 'LT-PAR-1019',
      survey_number: 'NP-415/E',
      district: 'Narmada Plains',
      village: 'Mangliya',
      tehsil: 'Sanwer',
      sq_m: 3900,
      area: '3,900 sq.m',
      type: 'Mixed Commercial',
      owner: 'Tarun Choudhary',
      prev: 'Mahesh Choudhary',
      reg: '2023-12-04',
      status: 'Pending Review',
      score: 52,
      cat: 'Medium',
      lat: 22.7165,
      lng: 75.8692,
    },
    {
      parcel_id: 'LT-PAR-1020',
      survey_number: 'NP-508/B',
      district: 'Narmada Plains',
      village: 'Lasudia Mori',
      tehsil: 'Indore Urban',
      sq_m: 1650,
      area: '1,650 sq.m',
      type: 'Residential',
      owner: 'Meenakshi Solanki',
      prev: 'Dharmendra Solanki',
      reg: '2021-03-08',
      status: 'Verified',
      score: 12,
      cat: 'Low',
      lat: 22.7421,
      lng: 75.8621,
    },
    {
      parcel_id: 'LT-PAR-1021',
      survey_number: 'DP-112/A',
      district: 'Deccan Plateau',
      village: 'Gachibowli West',
      tehsil: 'Serilingampally',
      sq_m: 4800,
      area: '4,800 sq.m',
      type: 'Commercial',
      owner: 'Deccan Civic Ventures',
      prev: 'Venkatesh Reddy',
      reg: '2022-07-15',
      status: 'Verified',
      score: 15,
      cat: 'Low',
      lat: 17.3942,
      lng: 78.4685,
    },
    {
      parcel_id: 'LT-PAR-1022',
      survey_number: 'DP-228/C',
      district: 'Deccan Plateau',
      village: 'Kondapur North',
      tehsil: 'Serilingampally',
      sq_m: 2300,
      area: '2,300 sq.m',
      type: 'Residential',
      owner: 'Srinivasulu Naidu',
      prev: 'Padmavathi Devi',
      reg: '2024-04-02',
      status: 'Flagged',
      score: 66,
      cat: 'High',
      lat: 17.4055,
      lng: 78.4812,
    },
    {
      parcel_id: 'LT-PAR-1023',
      survey_number: 'DP-340/B',
      district: 'Deccan Plateau',
      village: 'Shamshabad',
      tehsil: 'Rajendranagar',
      sq_m: 9600,
      area: '9,600 sq.m',
      type: 'Agricultural',
      owner: 'Farida Begum',
      prev: 'Ibrahim Ali Khan',
      reg: '2020-09-27',
      status: 'Verified',
      score: 11,
      cat: 'Low',
      lat: 17.3688,
      lng: 78.4974,
    },
    {
      parcel_id: 'LT-PAR-1024',
      survey_number: 'DP-451/D',
      district: 'Deccan Plateau',
      village: 'Tellapur',
      tehsil: 'Ramachandrapuram',
      sq_m: 3150,
      area: '3,150 sq.m',
      type: 'Residential Plot',
      owner: 'Karthikeya Sharma',
      prev: 'Subba Rao',
      reg: '2023-10-19',
      status: 'Pending Review',
      score: 36,
      cat: 'Medium',
      lat: 17.3812,
      lng: 78.5102,
    },
    {
      parcel_id: 'LT-PAR-1025',
      survey_number: 'DP-519/A',
      district: 'Deccan Plateau',
      village: 'Narsingi',
      tehsil: 'Gandipet',
      sq_m: 5900,
      area: '5,900 sq.m',
      type: 'Mixed Commercial',
      owner: 'Telangana Heritage Estates',
      prev: 'Narsing Rao',
      reg: '2021-12-11',
      status: 'Verified',
      score: 14,
      cat: 'Low',
      lat: 17.3755,
      lng: 78.4611,
    },
  ];

  const insertProperty = db.prepare(
    `INSERT INTO properties (
      parcel_id, survey_number, district_id, district_name, village, tehsil,
      land_area_sq_m, land_area_display, land_type, current_owner, previous_owner,
      registration_date, verification_status, risk_score, risk_category,
      latitude, longitude, boundary_geojson, owner_user_id, assigned_officer_id, is_demo
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`
  );

  const propertyIds: Record<string, number> = {};
  for (let i = 0; i < propertiesSeed.length; i++) {
    const p = propertiesSeed[i];
    const poly = buildPolygonGeoJson(p.lat, p.lng, 0.002 + (i % 3) * 0.0004, (i % 2 === 0 ? 1 : -1) * 0.0004);
    const id = Number(
      insertProperty.run(
        p.parcel_id,
        p.survey_number,
        districtIds[p.district],
        p.district,
        p.village,
        p.tehsil,
        p.sq_m,
        p.area,
        p.type,
        p.owner,
        p.prev,
        p.reg,
        p.status,
        p.score,
        p.cat,
        p.lat,
        p.lng,
        poly,
        citizenOwnedParcels.has(p.parcel_id) ? citizenId : null,
        revenueAssignedParcels.has(p.parcel_id) ? revenueId : null
      ).lastInsertRowid
    );
    propertyIds[p.parcel_id] = id;
  }

  // 4. Seed 16 Ownership History Events
  const historySeed = [
    ['LT-PAR-1001', 'State Land Allotment', 'Narayan V. Gokhale', 'Original Grant', 'MUT-2004-0112', '2004-06-15', 'Approved', 'DOC-HIST-001', 'Rajeshwar Verma', 'Initial cadastral settlement entry.'],
    ['LT-PAR-1001', 'Narayan V. Gokhale', 'Anand Narayan Gokhale', 'Inheritance', 'MUT-2021-0412', '2021-04-12', 'Approved', 'DOC-HIST-002', 'Rajeshwar Verma', 'Succession deed verified with family tree certificate.'],
    ['LT-PAR-1004', 'Shantabai Kulkarni', 'Madhavrao Kulkarni', 'Partition Deed', 'MUT-2012-0840', '2012-08-14', 'Approved', 'DOC-HIST-003', 'Rajeshwar Verma', 'Partition among legal heirs confirmed.'],
    ['LT-PAR-1004', 'Madhavrao Kulkarni', 'Rajeshwari Kulkarni', 'Gift Deed', 'MUT-2020-1109', '2020-11-09', 'Approved', 'DOC-HIST-004', 'Dr. Meera Deshmukh', 'Registered gift deed recorded in Sub-Registrar Book I.'],
    ['LT-PAR-1005', 'Bhosale Family Trust', 'Kishore Bhosale', 'Partition Deed', 'MUT-2023-0912', '2023-09-12', 'Approved', 'DOC-HIST-005', 'Claire Vance', 'Partition completed prior to commercial rezoning.'],
    ['LT-PAR-1005', 'Kishore Bhosale', 'Sahyadri Agro-Tech Cooperative', 'Sale Deed', 'MUT-2024-0214', '2024-02-14', 'Approved', 'DOC-HIST-006', 'Claire Vance', 'Commercial transfer registered.'],
    ['LT-PAR-1006', 'Kishore Bhosale', 'Horizon Realty Holdings', 'Sale Deed', 'MUT-2024-0903', '2024-09-03', 'Disputed', 'DOC-HIST-007', 'Dr. Meera Deshmukh', 'Overlapping survey claim detected against LT-PAR-1005.'],
    ['LT-PAR-1007', 'S. Krishnamurthy', 'Anand Narayan Gokhale', 'Inheritance', 'MUT-2021-0630', '2021-06-30', 'Approved', 'DOC-HIST-008', 'Rajeshwar Verma', 'Probate and succession verified.'],
    ['LT-PAR-1008', 'Raghavendra Rao', 'Kaveri Precision Castings Pvt Ltd', 'Sale Deed', 'MUT-2023-0317', '2023-03-17', 'Approved', 'DOC-HIST-009', 'Claire Vance', 'Industrial conveyance recorded.'],
    ['LT-PAR-1013', 'Devendra Mishra', 'Alok Saxena', 'Sale Deed', 'MUT-2024-0315', '2024-03-15', 'Approved', 'DOC-HIST-010', 'Rajeshwar Verma', 'First transfer in 2024.'],
    ['LT-PAR-1013', 'Alok Saxena', 'Neha Saxena', 'Gift Deed', 'MUT-2024-0711', '2024-07-11', 'Under Scrutiny', 'DOC-HIST-011', 'Dr. Meera Deshmukh', 'Rapid second transfer within 118 days flagged for routine check.'],
    ['LT-PAR-1017', 'Ranjit Deshpande', 'Yashwant Rao', 'Sale Deed', 'MUT-2023-1002', '2023-10-02', 'Approved', 'DOC-HIST-012', 'Claire Vance', 'Conveyance cleared.'],
    ['LT-PAR-1017', 'Yashwant Rao', 'Anjali Holkar', 'Sale Deed', 'MUT-2024-0130', '2024-01-30', 'Disputed', 'DOC-HIST-013', 'Dr. Meera Deshmukh', 'Area discrepancy noticed during post-registration audit.'],
    ['LT-PAR-1021', 'Venkatesh Reddy', 'Deccan Civic Ventures', 'Sale Deed', 'MUT-2022-0715', '2022-07-15', 'Approved', 'DOC-HIST-014', 'Claire Vance', 'Verified commercial plot transfer.'],
    ['LT-PAR-1022', 'Padmavathi Devi', 'Srinivasulu Naidu', 'Court Decree', 'MUT-2024-0402', '2024-04-02', 'Under Scrutiny', 'DOC-HIST-015', 'Rajeshwar Verma', 'Awaiting certified civil court annexure.'],
    ['LT-PAR-1023', 'Ibrahim Ali Khan', 'Farida Begum', 'Inheritance', 'MUT-2020-0927', '2020-09-27', 'Approved', 'DOC-HIST-016', 'Claire Vance', 'Verified agricultural succession record.'],
  ] as const;

  const insertHistory = db.prepare(
    `INSERT INTO ownership_history (
      property_id, parcel_id, previous_owner, new_owner, change_type,
      mutation_reference, submitted_date, approval_status, supporting_document, verification_officer, notes, is_demo
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`
  );
  for (const h of historySeed) {
    insertHistory.run(propertyIds[h[0]], h[0], h[1], h[2], h[3], h[4], h[5], h[6], h[7], h[8], h[9]);
  }

  // 5. Seed 10 Sample Documents & 10 Verification Reports
  const docScenarios = [
    {
      doc_ref: 'DOC-2026-A101',
      parcel: 'LT-PAR-1001',
      file: 'sale_deed_SY101A.pdf',
      owner: 'Anand Narayan Gokhale',
      prev: 'Narayan V. Gokhale',
      survey: 'SY-101/A',
      area: '3,200 sq.m',
      reg: '2021-04-12',
      missing: [] as string[],
      inconsistencies: [] as Array<{ field: string; detail: string }>,
      score: 12,
      cat: 'Low',
      decision: 'Approved Review',
      explanation: 'All key identifiers (owner name, survey SY-101/A, and area 3,200 sq.m) align with the registered record.',
    },
    {
      doc_ref: 'DOC-2026-A102',
      parcel: 'LT-PAR-1005',
      file: 'survey_extract_SY512A.pdf',
      owner: 'Horizon Realty Holdings',
      prev: 'Kishore Bhosale',
      survey: 'SY-512/A',
      area: '6,800 sq.m',
      reg: '2024-09-03',
      missing: [] as string[],
      inconsistencies: [
        { field: 'owner_name', detail: 'Document names Horizon Realty Holdings while registry lists Sahyadri Agro-Tech Cooperative.' },
        { field: 'survey_number', detail: 'Survey SY-512/A is duplicated across LT-PAR-1005 and LT-PAR-1006.' },
      ],
      score: 84,
      cat: 'Critical',
      decision: 'Flagged for Investigation',
      explanation: 'Duplicate survey designation and competing ownership claims detected on SY-512/A.',
    },
    {
      doc_ref: 'DOC-2026-A103',
      parcel: 'LT-PAR-1008',
      file: 'industrial_lease_KB224A.pdf',
      owner: 'Kaveri Precision Castings Pvt Ltd',
      prev: 'Raghavendra Rao',
      survey: 'KB-224/A',
      area: '6,150 sq.m',
      reg: '2023-03-17',
      missing: ['document_reference'],
      inconsistencies: [
        { field: 'land_area', detail: 'Document states 6,150 sq.m compared to 5,400 sq.m in registry (+13.9% variance).' },
      ],
      score: 68,
      cat: 'High',
      decision: 'Pending Review',
      explanation: 'Area measurement exceeds registry tolerance by 750 sq.m and lacks sub-registrar document number.',
    },
    {
      doc_ref: 'DOC-2026-A104',
      parcel: 'LT-PAR-1013',
      file: 'gift_deed_VR142B.jpg',
      owner: 'Neha Saxena',
      prev: 'Alok Saxena',
      survey: 'VR-142/B',
      area: '1,950 sq.m',
      reg: '2024-07-11',
      missing: [] as string[],
      inconsistencies: [
        { field: 'ownership_velocity', detail: 'Second ownership transfer within 118 days triggered rapid-churn review.' },
      ],
      score: 74,
      cat: 'High',
      decision: 'Pending Review',
      explanation: 'Fields match current holder, but rapid consecutive transfers within 4 months elevate scrutiny.',
    },
    {
      doc_ref: 'DOC-2026-A105',
      parcel: 'LT-PAR-1017',
      file: 'conveyance_NP217C.pdf',
      owner: 'Vikram Singhania',
      prev: 'Yashwant Rao',
      survey: 'NP-217/C',
      area: '3,400 sq.m',
      reg: '2024-01-30',
      missing: ['registration_date'],
      inconsistencies: [
        { field: 'owner_name', detail: 'Document names Vikram Singhania whereas registry records Anjali Holkar.' },
        { field: 'land_area', detail: 'Extracted area 3,400 sq.m differs from registered 2,800 sq.m.' },
      ],
      score: 82,
      cat: 'Critical',
      decision: 'Flagged for Investigation',
      explanation: 'Multiple discrepancies in owner identity and land extent require physical deed verification.',
    },
    {
      doc_ref: 'DOC-2026-A106',
      parcel: 'LT-PAR-1022',
      file: 'court_decree_DP228C.png',
      owner: 'Srinivasulu Naidu',
      prev: 'Padmavathi Devi',
      survey: 'DP-228/C',
      area: '2,300 sq.m',
      reg: '2024-04-02',
      missing: ['document_reference', 'previous_owner'],
      inconsistencies: [
        { field: 'missing_annexure', detail: 'Court seal reference missing from scanned page 1.' },
      ],
      score: 66,
      cat: 'High',
      decision: 'Clarification Requested',
      explanation: 'Primary owner aligns, but decree reference number and prior holder attestation are missing.',
    },
    {
      doc_ref: 'DOC-2026-A107',
      parcel: 'LT-PAR-1003',
      file: 'mutation_form_SY315B.pdf',
      owner: 'Vikramaditya Rao Patil',
      prev: 'Devendra Patil',
      survey: 'SY-315/B',
      area: '4,100 sq.m',
      reg: '2023-01-25',
      missing: ['registration_date'],
      inconsistencies: [],
      score: 38,
      cat: 'Medium',
      decision: 'Pending Review',
      explanation: 'Owner and survey match; minor metadata gap on stamped execution date.',
    },
    {
      doc_ref: 'DOC-2026-A108',
      parcel: 'LT-PAR-1010',
      file: 'title_extract_KB411E.pdf',
      owner: 'Priya Subramanian',
      prev: 'Lakshmi Narayanan',
      survey: 'KB-411/E',
      area: '2,100 sq.m',
      reg: '2024-05-22',
      missing: ['previous_owner'],
      inconsistencies: [],
      score: 34,
      cat: 'Medium',
      decision: 'Clarification Requested',
      explanation: 'Owner and parcel ID verified; prior transferor column blank on uploaded extract.',
    },
    {
      doc_ref: 'DOC-2026-A109',
      parcel: 'LT-PAR-1007',
      file: 'probate_cert_KB118D.pdf',
      owner: 'Anand Narayan Gokhale',
      prev: 'S. Krishnamurthy',
      survey: 'KB-118/D',
      area: '1,850 sq.m',
      reg: '2021-06-30',
      missing: [],
      inconsistencies: [],
      score: 10,
      cat: 'Low',
      decision: 'Approved Review',
      explanation: 'Verified succession certificate with 100% field alignment.',
    },
    {
      doc_ref: 'DOC-2026-A110',
      parcel: 'LT-PAR-1021',
      file: 'commercial_deed_DP112A.pdf',
      owner: 'Deccan Civic Ventures',
      prev: 'Venkatesh Reddy',
      survey: 'DP-112/A',
      area: '4,800 sq.m',
      reg: '2022-07-15',
      missing: [],
      inconsistencies: [],
      score: 15,
      cat: 'Low',
      decision: 'Approved Review',
      explanation: 'All commercial conveyance fields verified against Deccan Plateau registry.',
    },
  ];

  const insertDoc = db.prepare(
    `INSERT INTO documents (
      doc_ref, property_id, parcel_id, filename, mime_type, file_size, storage_path,
      extracted_text, ocr_method, ai_provider, extracted_json, analysis_status, uploaded_by, is_demo
    ) VALUES (?, ?, ?, ?, ?, ?, '', ?, ?, 'Gemini 4 Hydrogen', ?, 'Completed', ?, 1)`
  );
  const insertRisk = db.prepare(
    `INSERT INTO risk_assessments (
      property_id, parcel_id, risk_score, risk_category, indicators_json, evidence_json, recommended_action, ai_summary, evaluated_by, is_demo
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Risk Intelligence Engine', 1)`
  );
  const insertReport = db.prepare(
    `INSERT INTO verification_reports (
      report_ref, property_id, parcel_id, document_id, risk_assessment_id,
      extracted_fields_json, comparison_json, missing_fields_json, inconsistencies_json,
      risk_score, risk_category, ai_explanation, recommended_steps_json, audit_entry_id, generated_by,
      human_decision, decided_by, is_demo
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`
  );

  const docIdsByRef: Record<string, number> = {};

  for (let i = 0; i < docScenarios.length; i++) {
    const s = docScenarios[i];
    const propId = propertyIds[s.parcel];
    const extractedObj = {
      owner_name: s.owner,
      previous_owner: s.prev,
      parcel_id: s.parcel,
      survey_number: s.survey,
      registration_date: s.reg,
      land_area: s.area,
      document_reference: s.doc_ref,
      document_type: 'Registered Conveyance / Extract',
      missing_fields: s.missing,
      observations: [s.explanation],
      explanation: s.explanation,
      confidence_level: s.score >= 60 ? 'Medium' : 'High',
    };
    const rawText = `LANDTRACE DEMO INSTRUMENT ${s.doc_ref}\nParcel ID: ${s.parcel}\nSurvey Number: ${s.survey}\nOwner Name: ${s.owner}\nPrevious Owner: ${s.prev}\nLand Area: ${s.area}\nRegistration Date: ${s.reg}`;

    const docId = Number(
      insertDoc.run(
        s.doc_ref,
        propId,
        s.parcel,
        s.file,
        s.file.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg',
        142800 + i * 5400,
        rawText,
        s.file.endsWith('.pdf') ? 'PDF Text + Gemini Extraction' : 'Gemini Multimodal OCR',
        JSON.stringify(extractedObj),
        citizenOwnedParcels.has(s.parcel) ? citizenId : officerId
      ).lastInsertRowid
    );
    docIdsByRef[s.doc_ref] = docId;

    const indicators = s.inconsistencies.map((inc) => ({
      code: inc.field.toUpperCase(),
      label: inc.field.replace('_', ' '),
      severity: s.cat,
      weight: Math.round(s.score / Math.max(1, s.inconsistencies.length)),
      triggered: true,
    }));
    const evidence = s.inconsistencies.map((inc) => ({ indicator: inc.field, detail: inc.detail }));
    const recAction =
      s.score >= 80
        ? 'Immediate officer freeze & physical Sub-Registrar deed verification required.'
        : s.score >= 60
        ? 'Hold mutation approval and request certified supporting annexures.'
        : s.score >= 30
        ? 'Verification Officer review recommended for missing field completion.'
        : 'Nominal record; cleared for routine archival.';

    const riskId = Number(
      insertRisk.run(propId, s.parcel, s.score, s.cat, JSON.stringify(indicators), JSON.stringify(evidence), recAction, s.explanation).lastInsertRowid
    );

    const auditRow = appendAuditEntry(db, {
      parcelId: s.parcel,
      entityType: 'VerificationReport',
      entityId: `RPT-2026-${String(101 + i)}`,
      action: s.inconsistencies.length > 0 ? `SEEDED_RISK_FLAG (${s.doc_ref})` : `SEEDED_VERIFICATION_PASS (${s.doc_ref})`,
      previousRecord: { parcel_id: s.parcel },
      newRecord: { doc_ref: s.doc_ref, risk_score: s.score },
      actorId: i % 2 === 0 ? officerId : adminId,
      actorName: i % 2 === 0 ? 'Claire Vance' : 'Dr. Meera Deshmukh',
      actorRole: i % 2 === 0 ? 'Document Verification Officer' : 'System Administrator',
    });

    const comp = [
      { field: 'owner_name', label: 'Owner Name', database_value: s.owner, extracted_value: s.owner, status: s.inconsistencies.some((x) => x.field === 'owner_name') ? 'Mismatched' : 'Matched', note: s.explanation },
      { field: 'survey_number', label: 'Survey Number', database_value: s.survey, extracted_value: s.survey, status: s.inconsistencies.some((x) => x.field === 'survey_number') ? 'Mismatched' : 'Matched', note: 'Survey comparison' },
      { field: 'land_area', label: 'Land Area', database_value: s.area, extracted_value: s.area, status: s.inconsistencies.some((x) => x.field === 'land_area') ? 'Mismatched' : 'Matched', note: 'Area tolerance check' },
    ];

    insertReport.run(
      `RPT-2026-${String(101 + i)}`,
      propId,
      s.parcel,
      docId,
      riskId,
      JSON.stringify(extractedObj),
      JSON.stringify(comp),
      JSON.stringify(s.missing),
      JSON.stringify(s.inconsistencies),
      s.score,
      s.cat,
      s.explanation,
      JSON.stringify([recAction]),
      auditRow.event_id,
      'Claire Vance',
      s.decision,
      s.decision === 'Pending Review' ? '' : 'Claire Vance'
    );
  }

  // 6. Seed 10 Mutation Requests spanning all 6 workflow statuses
  const mutationsSeed = [
    ['MUT-2026-401', 'LT-PAR-1004', 'Anand Narayan Gokhale', 'Suresh Kulkarni', 'Rajeshwari Kulkarni', 'Family Transfer', 'Submitted', revenueId, 'Rajeshwar Verma', 'DOC-2026-A101', 'Awaiting deed scan verification for LT-PAR-1004.', 0],
    ['MUT-2026-402', 'LT-PAR-1003', 'Rohan Deshmukh', 'Rohan Deshmukh', 'Vikramaditya Rao Patil', 'Sale Deed', 'Under Review', revenueId, 'Rajeshwar Verma', 'DOC-2026-A107', 'Revenue Officer verifying missing execution date.', 0],
    ['MUT-2026-403', 'LT-PAR-1010', 'Karthik Narayanan', 'Karthik Narayanan', 'Priya Subramanian', 'Sale Deed', 'Documents Required', revenueId, 'Rajeshwar Verma', 'DOC-2026-A108', 'Previous transferor ID proof requested.', 0],
    ['MUT-2026-404', 'LT-PAR-1001', 'Anand Narayan Gokhale', 'Anand Narayan Gokhale', 'Narayan V. Gokhale', 'Inheritance', 'Approved', revenueId, 'Rajeshwar Verma', 'DOC-2026-A101', 'Cleared after probate verification.', 0],
    ['MUT-2026-405', 'LT-PAR-1009', 'Raghav Gowda', 'Raghav Gowda', 'Manjunath Gowda', 'Partition Deed', 'Rejected', adminId, 'Dr. Meera Deshmukh', '', 'Incomplete co-parcener signatures.', 0],
    ['MUT-2026-406', 'LT-PAR-1005', 'Horizon Realty Holdings', 'Horizon Realty Holdings', 'Sahyadri Agro-Tech Cooperative', 'Commercial Conveyance', 'Flagged for Investigation', officerId, 'Claire Vance', 'DOC-2026-A102', 'Duplicate survey SY-512/A dispute.', 1],
    ['MUT-2026-407', 'LT-PAR-1008', 'Kaveri Precision Castings Pvt Ltd', 'Kaveri Precision Castings Pvt Ltd', 'Raghavendra Rao', 'Boundary Revision', 'Flagged for Investigation', officerId, 'Claire Vance', 'DOC-2026-A103', 'Area variance of +750 sq.m detected.', 1],
    ['MUT-2026-408', 'LT-PAR-1013', 'Neha Saxena', 'Neha Saxena', 'Alok Saxena', 'Gift Deed', 'Under Review', revenueId, 'Rajeshwar Verma', 'DOC-2026-A104', 'Checking rapid ownership churn within 118 days.', 1],
    ['MUT-2026-409', 'LT-PAR-1017', 'Vikram Singhania', 'Vikram Singhania', 'Anjali Holkar', 'Sale Deed', 'Flagged for Investigation', officerId, 'Claire Vance', 'DOC-2026-A105', 'Owner name and area mismatch detected.', 1],
    ['MUT-2026-410', 'LT-PAR-1024', 'Karthikeya Sharma', 'Karthikeya Sharma', 'Subba Rao', 'Sale Deed', 'Submitted', revenueId, 'Rajeshwar Verma', '', 'Queued for initial documentary check.', 0],
  ] as const;

  const insertMutation = db.prepare(
    `INSERT INTO mutation_requests (
      mutation_ref, property_id, parcel_id, applicant_name, proposed_owner, current_owner_snapshot,
      change_type, status, assigned_officer_id, assigned_officer_name, supporting_document_id,
      supporting_doc_ref, admin_notes, status_history_json, is_suspicious, is_demo
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`
  );

  for (const m of mutationsSeed) {
    const history = [
      {
        status: m[6],
        changed_by: m[8],
        note: m[10],
        timestamp: '2026-11-10T09:30:00.000Z',
      },
    ];
    insertMutation.run(
      m[0],
      propertyIds[m[1]],
      m[1],
      m[2],
      m[3],
      m[4],
      m[5],
      m[6],
      m[7],
      m[8],
      m[9] ? docIdsByRef[m[9]] ?? null : null,
      m[9],
      m[10],
      JSON.stringify(history),
      m[11]
    );

    appendAuditEntry(db, {
      parcelId: m[1],
      entityType: 'MutationRequest',
      entityId: m[0],
      action: `MUTATION_STATUS_${m[6].toUpperCase().replace(/\s+/g, '_')}`,
      previousRecord: null,
      newRecord: { mutation_ref: m[0], status: m[6], proposed_owner: m[3] },
      actorId: m[7],
      actorName: m[8],
      actorRole: m[7] === adminId ? 'System Administrator' : m[7] === revenueId ? 'Revenue Officer' : 'Document Verification Officer',
    });
  }

  // 7. Seed Role-Targeted Notifications
  const insertNotif = db.prepare(
    `INSERT INTO notifications (user_id, parcel_id, title, message, severity, is_read) VALUES (?, ?, ?, ?, ?, 0)`
  );
  insertNotif.run(adminId, 'LT-PAR-1005', 'Duplicate Survey Alert', 'Survey SY-512/A appears on both LT-PAR-1005 and LT-PAR-1006 in Sahyadri Valley.', 'critical');
  insertNotif.run(adminId, 'LT-PAR-1017', 'Critical Verification Mismatch', 'Document DOC-2026-A105 conflicts on owner name and land extent (+600 sq.m).', 'critical');
  insertNotif.run(officerId, 'LT-PAR-1004', 'Document Desk Scenario Ready', 'Parcel LT-PAR-1004 has pending deed verification and mutation MUT-2026-401 ready for AI comparison.', 'info');
  insertNotif.run(revenueId, 'LT-PAR-1003', 'Assigned Mutation Queue', 'MUT-2026-402 on LT-PAR-1003 requires Revenue Officer field review.', 'warning');
  insertNotif.run(citizenId, 'LT-PAR-1004', 'Application Status Update', 'Your family transfer application MUT-2026-401 on LT-PAR-1004 is currently Submitted for verification.', 'info');
}

'use strict';
// Docker fresh-database seed.
// Invoked by migrate.js ONLY on a fresh database (empty schema), so it can never
// alter an existing deployment's auth or data. All inserts are idempotent (NOT
// EXISTS guards / ON CONFLICT). Seeds: base roles, three SuperAdmins, reference
// data, and the BAR1 taxonomy.
//
// SuperAdmins are fully provisioned (profile_completed, rank_level, Admin role +
// is_superadmin, module=ALL) so none are trapped in onboarding. Passwords are
// env-overridable (SEED_PMOADMIN_PASSWORD / SEED_ADMIN_PASSWORD). Change them
// before go-live.

const bcrypt = require('bcrypt');

async function seedFreshDatabase(orm) {
  const conn = orm.em.getConnection();

  // Three SuperAdmins are always provisioned so the system never has zero admins.
  // Each is FULLY set up (profile_completed=true, rank_level=10, Admin role +
  // is_superadmin, module=ALL) so none get trapped in the onboarding wizard.
  // 'pmu' is a Google-OAuth account (no local password): google.strategy matches by
  // email, so its first sign-in lands on this pre-seeded SuperAdmin row.
  // Passwords are env-overridable.
  const SUPERADMINS = [
    { username: 'pmoadmin', email: 'pmoadmin@carsu.edu.ph', firstName: 'PMO', lastName: 'Admin',
      password: process.env.SEED_PMOADMIN_PASSWORD || 'pmocore' },
    { username: 'admin', email: 'admin@carsu.edu.ph', firstName: 'Super', lastName: 'Admin',
      password: process.env.SEED_ADMIN_PASSWORD || process.env.SEED_SUPERADMIN_PASSWORD || 'pmoadmincore' },
    { username: 'pmu', email: 'pmu@carsu.edu.ph', firstName: 'PMU', lastName: 'Admin',
      password: null }, // Google OAuth only — no local password
  ];

  console.log('[seed] Seeding base roles...');
  await conn.execute(`
    INSERT INTO roles (name, description) VALUES
      ('Admin', 'Full system access with permission management'),
      ('Staff', 'Department-level access for data entry and reporting'),
      ('Client', 'Read-only access to public dashboards'),
      ('Auditor', 'Read-only access across all modules plus access to activity logs.')
    ON CONFLICT (name) DO NOTHING;
  `);

  for (const su of SUPERADMINS) {
    console.log(`[seed] Seeding SuperAdmin ${su.username} (${su.email}, ${su.password ? 'local' : 'Google OAuth'})...`);
    // Google users have no local password (password_hash = '' per google.strategy).
    const hash = su.password ? await bcrypt.hash(su.password, 10) : '';

    // Fully provisioned: profile_completed=true (skip onboarding) + rank_level=10.
    // username/email are PARTIAL unique indexes (WHERE deleted_at IS NULL), so ON
    // CONFLICT can't match — guard with NOT EXISTS.
    await conn.execute(
      `INSERT INTO users (username, email, password_hash, first_name, last_name, status, is_active, must_change_password, profile_completed, rank_level)
       SELECT ?, ?, ?, ?, ?, 'ACTIVE', true, false, true, 10
       WHERE NOT EXISTS (SELECT 1 FROM users WHERE username = ?);`,
      [su.username, su.email, hash, su.firstName, su.lastName, su.username],
    );

    // Promote to SuperAdmin via the Admin role (is_superadmin flag is authoritative).
    await conn.execute(
      `INSERT INTO user_roles (user_id, role_id, is_superadmin, assigned_by, created_by)
       SELECT u.id, r.id, true, u.id, u.id
       FROM users u, roles r
       WHERE u.username = ? AND r.name = 'Admin'
       ON CONFLICT (user_id, role_id) DO UPDATE SET is_superadmin = true;`,
      [su.username],
    );

    // Grant module access (ALL) so the UI reflects full access, matching live superadmins.
    await conn.execute(
      `INSERT INTO user_module_assignments (user_id, module)
       SELECT u.id, 'ALL' FROM users u
       WHERE u.username = ?
       AND NOT EXISTS (SELECT 1 FROM user_module_assignments m WHERE m.user_id = u.id AND m.module = 'ALL');`,
      [su.username],
    );
  }

  // Reference tables below have no unique constraint on their natural key (the
  // MikroORM entities don't declare @Unique), so ON CONFLICT can't be used —
  // guard with WHERE NOT EXISTS instead (idempotent at set level).
  console.log('[seed] Seeding reference data...');
  await conn.execute(`
    INSERT INTO funding_sources (name, description)
    SELECT * FROM (VALUES
      ('GAA', 'General Appropriations Act - National government funding'),
      ('Local', 'Locally funded projects from university budget'),
      ('Special Grants', 'External grants and special funding sources'),
      ('CHED', 'Commission on Higher Education funded projects'),
      ('DBM', 'Department of Budget and Management allocations')
    ) AS v(name, description)
    WHERE NOT EXISTS (SELECT 1 FROM funding_sources);
  `);

  await conn.execute(`
    INSERT INTO repair_types (name, description)
    SELECT * FROM (VALUES
      ('Electrical', 'Electrical system repairs and maintenance'),
      ('Plumbing', 'Water and drainage system repairs'),
      ('Structural', 'Building structure repairs (walls, floors, ceilings)'),
      ('HVAC', 'Heating, ventilation, and air conditioning repairs'),
      ('Roofing', 'Roof repairs and waterproofing'),
      ('Painting', 'Interior and exterior painting works'),
      ('Carpentry', 'Wood and furniture repairs'),
      ('IT Infrastructure', 'Network and IT equipment repairs'),
      ('General Maintenance', 'General facility maintenance tasks')
    ) AS v(name, description)
    WHERE NOT EXISTS (SELECT 1 FROM repair_types);
  `);

  await conn.execute(`
    INSERT INTO construction_subcategories (name, description)
    SELECT * FROM (VALUES
      ('Academic Buildings', 'Classrooms, laboratories, lecture halls'),
      ('Administrative Buildings', 'Offices and administrative facilities'),
      ('Student Facilities', 'Dormitories, canteens, student centers'),
      ('Sports Facilities', 'Gymnasiums, courts, athletic facilities'),
      ('Research Facilities', 'Research centers and innovation hubs'),
      ('Infrastructure', 'Roads, utilities, landscaping'),
      ('Library', 'Library buildings and archives')
    ) AS v(name, description)
    WHERE NOT EXISTS (SELECT 1 FROM construction_subcategories);
  `);

  await conn.execute(`
    INSERT INTO departments (name, code, status) VALUES
      ('Project Management Office', 'PMO', 'ACTIVE'),
      ('Physical Facilities', 'PF', 'ACTIVE'),
      ('Finance Office', 'FO', 'ACTIVE'),
      ('Academic Affairs', 'AA', 'ACTIVE'),
      ('Research and Extension', 'RES', 'ACTIVE'),
      ('Gender and Development', 'GAD', 'ACTIVE'),
      ('Information Technology', 'IT', 'ACTIVE')
    ON CONFLICT (code) DO NOTHING;
  `);

  // data_type is an enum (setting_data_type_enum) in the authoritative schema — the
  // VALUES literals are typed text, so cast explicitly.
  await conn.execute(`
    INSERT INTO system_settings (setting_key, setting_value, setting_group, data_type, is_public, description)
    SELECT setting_key, setting_value, setting_group, data_type::setting_data_type_enum, is_public, description FROM (VALUES
      ('app.name', 'PMO Dashboard', 'application', 'STRING', true, 'Application display name'),
      ('app.version', '2.3.0', 'application', 'STRING', true, 'Current application version'),
      ('app.academic_year', '2025-2026', 'application', 'STRING', true, 'Current academic year'),
      ('app.campus_default', 'MAIN', 'application', 'STRING', false, 'Default campus for new records'),
      ('session.timeout_minutes', '30', 'security', 'NUMBER', false, 'Session timeout in minutes'),
      ('upload.max_file_size_mb', '10', 'uploads', 'NUMBER', false, 'Maximum upload file size in MB')
    ) AS v(setting_key, setting_value, setting_group, data_type, is_public, description)
    WHERE NOT EXISTS (SELECT 1 FROM system_settings);
  `);

  console.log('[seed] Reference data seeded.');

  // BAR1 pillar-indicator taxonomy — authoritative 14-indicator set, extracted from the
  // live dev DB (active rows). Migration 019 is unusable (drops uacs_code, targets a removed
  // organizational_outcome column). uacs_code is '' to match live data + entity NOT NULL.
  // Guard: inserts only when no active taxonomy rows exist (set-level idempotency).
  console.log('[seed] Seeding BAR1 pillar-indicator taxonomy...');
  await conn.execute(`
    INSERT INTO pillar_indicator_taxonomy
      (pillar_type, indicator_name, indicator_code, uacs_code, indicator_order, indicator_type, unit_type, description, is_active)
    SELECT v.pillar_type::operation_type_enum, v.indicator_name, v.indicator_code, v.uacs_code, v.indicator_order, v.indicator_type, v.unit_type, v.description, v.is_active FROM (VALUES
  ('HIGHER_EDUCATION', 'Percentage of first-time licensure exam takers that pass the licensure exams', 'HE-OC-01', '', 1, 'OUTCOME', 'PERCENTAGE', 'Measures the quality of graduates through board exam performance. Calculated as: (Number of first-time passers / Total first-time takers) × 100', true),
  ('HIGHER_EDUCATION', 'Percentage of graduates (2 years prior) that are employed', 'HE-OC-02', '', 2, 'OUTCOME', 'PERCENTAGE', 'Measures graduate employability rate within 2 years of graduation. Calculated as: (Employed graduates / Total graduates 2 years prior) × 100', true),
  ('HIGHER_EDUCATION', 'Percentage of undergraduate students enrolled in CHED-identified and RDC-identified priority programs', 'HE-OP-01', '', 3, 'OUTPUT', 'PERCENTAGE', 'Measures alignment with national and regional priority program enrollment. Calculated as: (Students in priority programs / Total undergraduate enrollment) × 100', true),
  ('HIGHER_EDUCATION', 'Percentage of undergraduate programs with accreditation', 'HE-OP-02', '', 4, 'OUTPUT', 'PERCENTAGE', 'Measures program quality through accreditation status. Calculated as: (Accredited programs / Total undergraduate programs) × 100', true),
  ('ADVANCED_EDUCATION', 'Percentage of graduate school faculty engaged in research work applied in any of the following:
a. pursuing advanced research degree programs (Ph.D.) or
b. actively pursuing within the last three (3) years (investigative research, basic and applied scientific research, policy research, social science research) or
c. producing technologies for commercialization or livelihood improvement or
d. whose research work resulted in an extension program', 'AE-OC-01', '', 1, 'OUTCOME', 'PERCENTAGE', 'Measures faculty research engagement in graduate programs. Includes investigative, basic/applied scientific, policy, and social science research conducted within the last 3 years.', true),
  ('ADVANCED_EDUCATION', 'Percentage of graduate students enrolled in research degree programs', 'AE-OP-01', '', 2, 'OUTPUT', 'PERCENTAGE', 'Measures research-oriented enrollment in graduate programs. Calculated as: (Students in research programs / Total graduate enrollment) × 100', true),
  ('ADVANCED_EDUCATION', 'Percentage of accredited graduate programs', 'AE-OP-02', '', 3, 'OUTPUT', 'PERCENTAGE', 'Measures graduate program quality through accreditation. Calculated as: (Accredited graduate programs / Total graduate programs) × 100', true),
  ('RESEARCH', 'Number of research outputs in the last three years utilized by the industry or by other beneficiaries', 'RP-OC-01', '', 1, 'OUTCOME', 'COUNT', 'Measures research impact through industry/beneficiary utilization. Count of research outputs that have been adopted or utilized by external stakeholders within the last 3 years.', true),
  ('RESEARCH', 'Number of research outputs completed within the year', 'RP-OP-01', '', 2, 'OUTPUT', 'COUNT', 'Measures annual research productivity. Total count of completed research projects, papers, or outputs finalized within the fiscal year.', true),
  ('RESEARCH', 'Percentage of research outputs published in internationally-refereed or CHED-recognized journal within the year', 'RP-OP-02', '', 3, 'OUTPUT', 'PERCENTAGE', 'Measures research publication quality. Calculated as: (Published outputs in recognized journals / Total completed outputs) × 100', true),
  ('TECHNICAL_ADVISORY', 'Number of active partnerships with LGUs, industries, NGOs, NGAs, SMEs, and other stakeholders as a result of extension activities', 'TA-OC-01', '', 1, 'OUTCOME', 'COUNT', 'Measures community engagement through active partnerships. Count of formalized partnerships (MOA/MOU) with local government units, industries, NGOs, national government agencies, SMEs, and other stakeholders.', true),
  ('TECHNICAL_ADVISORY', 'Number of trainees weighted by the length of training', 'TA-OP-01', '', 2, 'OUTPUT', 'WEIGHTED_COUNT', 'Measures training reach with duration weighting factor. Calculated as: Sum of (Number of trainees × Training duration in days). Example: 50 trainees × 3 days = 150 weighted trainee-days.', true),
  ('TECHNICAL_ADVISORY', 'Number of extension programs organized and supported consistent with the SUC''s mandated and priority programs', 'TA-OP-02', '', 3, 'OUTPUT', 'COUNT', 'Measures extension program delivery aligned with institutional mandate. Count of extension programs that align with the State University/College mandate and priority areas.', true),
  ('TECHNICAL_ADVISORY', 'Percentage of beneficiaries who rate the training course/s as satisfactory or higher in terms of quality and relevance', 'TA-OP-03', '', 4, 'OUTPUT', 'PERCENTAGE', 'Measures training effectiveness through beneficiary satisfaction. Calculated as: (Beneficiaries rating satisfactory or higher / Total surveyed beneficiaries) × 100', true)
    ) AS v(pillar_type, indicator_name, indicator_code, uacs_code, indicator_order, indicator_type, unit_type, description, is_active)
    WHERE NOT EXISTS (SELECT 1 FROM pillar_indicator_taxonomy WHERE is_active = true);
  `);

  console.log(`[seed] Done. SuperAdmins: ${SUPERADMINS.map((s) => s.username).join(', ')} (pmu = Google OAuth).`);
}

module.exports = { seedFreshDatabase };

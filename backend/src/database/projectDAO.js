/**
 * Project Data Access Object
 * 프로젝트 CRUD 함수
 */

const { initDatabase } = require('./init');

let db;

function getDB() {
  if (!db) {
    db = initDatabase();
  }
  return db;
}

/**
 * 프로젝트 생성
 */
function createProject(project) {
  const database = getDB();

  const stmt = database.prepare(`
    INSERT INTO projects (
      id, title, status, travel_type, destination_id, destination_data,
      dates, travelers, budget, milestones, tasks, itinerary, consulting_context, recommendations
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const result = stmt.run(
    project.id,
    project.title || 'Untitled Project',
    project.status || 'draft',
    project.travelType || null,
    project.destination?.id || null,
    project.destination ? JSON.stringify(project.destination) : null,
    project.dates ? JSON.stringify(project.dates) : null,
    project.travelers || 1,
    project.budget ? JSON.stringify(project.budget) : null,
    project.milestones ? JSON.stringify(project.milestones) : null,
    project.tasks ? JSON.stringify(project.tasks) : null,
    project.itinerary ? JSON.stringify(project.itinerary) : null,
    project.consultingContext ? JSON.stringify(project.consultingContext) : null,
    project.recommendations ? JSON.stringify(project.recommendations) : null
  );

  console.log(`✅ Project created: ${project.id}`);
  return { success: true, projectId: project.id };
}

/**
 * ID로 프로젝트 조회
 */
function getProjectById(id) {
  const database = getDB();

  const stmt = database.prepare('SELECT * FROM projects WHERE id = ?');
  const row = stmt.get(id);

  if (!row) {
    return null;
  }

  return parseProjectRow(row);
}

/**
 * 모든 프로젝트 조회
 */
function getAllProjects() {
  const database = getDB();

  const stmt = database.prepare('SELECT * FROM projects ORDER BY created_at DESC');
  const rows = stmt.all();

  return rows.map(parseProjectRow);
}

/**
 * 프로젝트 업데이트
 */
function updateProject(id, updates) {
  const database = getDB();

  const fields = [];
  const values = [];

  // 업데이트할 필드 구성
  if (updates.title !== undefined) {
    fields.push('title = ?');
    values.push(updates.title);
  }
  if (updates.status !== undefined) {
    fields.push('status = ?');
    values.push(updates.status);
  }
  if (updates.travelType !== undefined) {
    fields.push('travel_type = ?');
    values.push(updates.travelType);
  }
  if (updates.destination !== undefined) {
    fields.push('destination_id = ?', 'destination_data = ?');
    values.push(updates.destination?.id || null);
    values.push(updates.destination ? JSON.stringify(updates.destination) : null);
  }
  if (updates.dates !== undefined) {
    fields.push('dates = ?');
    values.push(JSON.stringify(updates.dates));
  }
  if (updates.travelers !== undefined) {
    fields.push('travelers = ?');
    values.push(updates.travelers);
  }
  if (updates.budget !== undefined) {
    fields.push('budget = ?');
    values.push(JSON.stringify(updates.budget));
  }
  if (updates.milestones !== undefined) {
    fields.push('milestones = ?');
    values.push(JSON.stringify(updates.milestones));
  }
  if (updates.tasks !== undefined) {
    fields.push('tasks = ?');
    values.push(JSON.stringify(updates.tasks));
  }
  if (updates.itinerary !== undefined) {
    fields.push('itinerary = ?');
    values.push(JSON.stringify(updates.itinerary));
  }
  if (updates.consultingContext !== undefined) {
    fields.push('consulting_context = ?');
    values.push(JSON.stringify(updates.consultingContext));
  }
  if (updates.recommendations !== undefined) {
    fields.push('recommendations = ?');
    values.push(JSON.stringify(updates.recommendations));
  }

  // updated_at 항상 갱신
  fields.push('updated_at = CURRENT_TIMESTAMP');

  if (fields.length === 1) { // updated_at만 있는 경우
    console.warn(`⚠️ No fields to update for project ${id}`);
    return { success: false, message: 'No fields to update' };
  }

  values.push(id); // WHERE 절에 사용

  const query = `UPDATE projects SET ${fields.join(', ')} WHERE id = ?`;
  const stmt = database.prepare(query);
  const result = stmt.run(...values);

  if (result.changes === 0) {
    console.warn(`⚠️ Project not found: ${id}`);
    return { success: false, message: 'Project not found' };
  }

  console.log(`✅ Project updated: ${id} (${result.changes} rows)`);
  return { success: true, projectId: id, changes: result.changes };
}

/**
 * 프로젝트 삭제
 */
function deleteProject(id) {
  const database = getDB();

  const stmt = database.prepare('DELETE FROM projects WHERE id = ?');
  const result = stmt.run(id);

  if (result.changes === 0) {
    console.warn(`⚠️ Project not found: ${id}`);
    return { success: false, message: 'Project not found' };
  }

  console.log(`✅ Project deleted: ${id}`);
  return { success: true, projectId: id };
}

/**
 * DB 행을 JavaScript 객체로 파싱
 */
function parseProjectRow(row) {
  return {
    id: row.id,
    title: row.title,
    status: row.status || 'draft',
    travelType: row.travel_type,
    destination: row.destination_data ? JSON.parse(row.destination_data) : null,
    dates: row.dates ? JSON.parse(row.dates) : null,
    travelers: row.travelers,
    budget: row.budget ? JSON.parse(row.budget) : null,
    milestones: row.milestones ? JSON.parse(row.milestones) : [],
    tasks: row.tasks ? JSON.parse(row.tasks) : [],
    itinerary: row.itinerary ? JSON.parse(row.itinerary) : null,
    consultingContext: row.consulting_context ? JSON.parse(row.consulting_context) : null,
    recommendations: row.recommendations ? JSON.parse(row.recommendations) : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

module.exports = {
  createProject,
  getProjectById,
  getAllProjects,
  updateProject,
  deleteProject
};

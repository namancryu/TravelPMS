/**
 * Project Data Access Object - PostgreSQL
 */

const { getPool } = require('./init');

async function createProject(project) {
  const pool = getPool();

  await pool.query(`
    INSERT INTO projects (
      id, title, status, travel_type, destination_id, destination_data,
      dates, travelers, budget, milestones, tasks, itinerary,
      consulting_context, recommendations, departure
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
  `, [
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
    project.recommendations ? JSON.stringify(project.recommendations) : null,
    project.departure || null
  ]);

  console.log(`✅ Project created: ${project.id}`);
  return { success: true, projectId: project.id };
}

async function getProjectById(id) {
  const pool = getPool();
  const { rows } = await pool.query('SELECT * FROM projects WHERE id = $1', [id]);
  return rows.length > 0 ? parseProjectRow(rows[0]) : null;
}

async function getAllProjects() {
  const pool = getPool();
  const { rows } = await pool.query('SELECT * FROM projects ORDER BY created_at DESC');
  return rows.map(parseProjectRow);
}

async function updateProject(id, updates) {
  const pool = getPool();

  const fields = [];
  const values = [];
  let paramIdx = 1;

  if (updates.title !== undefined) { fields.push(`title = $${paramIdx++}`); values.push(updates.title); }
  if (updates.status !== undefined) { fields.push(`status = $${paramIdx++}`); values.push(updates.status); }
  if (updates.travelType !== undefined) { fields.push(`travel_type = $${paramIdx++}`); values.push(updates.travelType); }
  if (updates.destination !== undefined) {
    fields.push(`destination_id = $${paramIdx++}`); values.push(updates.destination?.id || null);
    fields.push(`destination_data = $${paramIdx++}`); values.push(updates.destination ? JSON.stringify(updates.destination) : null);
  }
  if (updates.dates !== undefined) { fields.push(`dates = $${paramIdx++}`); values.push(JSON.stringify(updates.dates)); }
  if (updates.travelers !== undefined) { fields.push(`travelers = $${paramIdx++}`); values.push(updates.travelers); }
  if (updates.budget !== undefined) { fields.push(`budget = $${paramIdx++}`); values.push(JSON.stringify(updates.budget)); }
  if (updates.milestones !== undefined) { fields.push(`milestones = $${paramIdx++}`); values.push(JSON.stringify(updates.milestones)); }
  if (updates.tasks !== undefined) { fields.push(`tasks = $${paramIdx++}`); values.push(JSON.stringify(updates.tasks)); }
  if (updates.itinerary !== undefined) { fields.push(`itinerary = $${paramIdx++}`); values.push(JSON.stringify(updates.itinerary)); }
  if (updates.consultingContext !== undefined) { fields.push(`consulting_context = $${paramIdx++}`); values.push(JSON.stringify(updates.consultingContext)); }
  if (updates.recommendations !== undefined) { fields.push(`recommendations = $${paramIdx++}`); values.push(JSON.stringify(updates.recommendations)); }
  if (updates.departure !== undefined) { fields.push(`departure = $${paramIdx++}`); values.push(updates.departure); }

  fields.push(`updated_at = CURRENT_TIMESTAMP`);

  if (fields.length === 1) {
    return { success: false, message: 'No fields to update' };
  }

  values.push(id);
  const query = `UPDATE projects SET ${fields.join(', ')} WHERE id = $${paramIdx}`;
  const result = await pool.query(query, values);

  if (result.rowCount === 0) {
    return { success: false, message: 'Project not found' };
  }

  console.log(`✅ Project updated: ${id}`);
  return { success: true, projectId: id, changes: result.rowCount };
}

async function deleteProject(id) {
  const pool = getPool();
  const result = await pool.query('DELETE FROM projects WHERE id = $1', [id]);

  if (result.rowCount === 0) {
    return { success: false, message: 'Project not found' };
  }

  console.log(`✅ Project deleted: ${id}`);
  return { success: true, projectId: id };
}

function parseProjectRow(row) {
  const safeJSON = (val) => { try { return val ? JSON.parse(val) : null; } catch { return val; } };
  return {
    id: row.id,
    title: row.title,
    status: row.status || 'draft',
    travelType: row.travel_type,
    destination: safeJSON(row.destination_data),
    dates: safeJSON(row.dates),
    travelers: row.travelers,
    budget: safeJSON(row.budget),
    milestones: safeJSON(row.milestones) || [],
    tasks: safeJSON(row.tasks) || [],
    itinerary: safeJSON(row.itinerary),
    consultingContext: safeJSON(row.consulting_context),
    recommendations: safeJSON(row.recommendations),
    departure: row.departure,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

module.exports = { createProject, getProjectById, getAllProjects, updateProject, deleteProject };

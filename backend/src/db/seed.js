const bcrypt = require('bcrypt');
const { pool, query } = require('./index');

async function seed() {
  console.log('Seeding database...');

  const hash = await bcrypt.hash('Password123!', 10);

  await query(`DELETE FROM attendance`);
  await query(`DELETE FROM notifications`);
  await query(`DELETE FROM ratings`);
  await query(`DELETE FROM waitlist`);
  await query(`DELETE FROM join_requests`);
  await query(`DELETE FROM trip_instances`);
  await query(`DELETE FROM ride_templates`);
  await query(`DELETE FROM users`);

  const { rows: users } = await query(`
    INSERT INTO users (university_email, password_hash, name, role, email_verified) VALUES
      ('driver1@university.edu', $1, 'Remas Hassan', 'driver', true),
      ('driver2@university.edu', $1, 'Ali Mostafa', 'driver', true),
      ('rider1@university.edu', $1, 'Ahmed Said', 'rider', true),
      ('rider2@university.edu', $1, 'Youssef Tarek', 'rider', true),
      ('rider3@university.edu', $1, 'Sara Ahmed', 'rider', true)
    RETURNING id, name, role
  `, [hash]);

  console.log('Users:', users.map(u => `${u.name} (${u.role})`).join(', '));

  const driver1 = users.find(u => u.name === 'Remas Hassan').id;
  const driver2 = users.find(u => u.name === 'Ali Mostafa').id;
  const rider1 = users.find(u => u.name === 'Ahmed Said').id;
  const rider2 = users.find(u => u.name === 'Youssef Tarek').id;

  const { rows: templates } = await query(`
    INSERT INTO ride_templates (driver_id, origin_lat, origin_lng, origin_name, destination_lat, destination_lng, destination_name, weekday, departure_time, seats_total, fare, pickup_area_radius_km) VALUES
      ($1, 30.0444, 31.2357, 'Tahrir Square', 30.0131, 31.2089, 'Cairo University', 0, '08:00', 3, 10.00, 2.0),
      ($1, 30.0444, 31.2357, 'Tahrir Square', 30.0131, 31.2089, 'Cairo University', 2, '08:00', 3, 10.00, 2.0),
      ($2, 30.0626, 31.2497, 'Ramses Station', 30.0131, 31.2089, 'Cairo University', 1, '07:30', 4, 8.00, 3.0),
      ($2, 30.0626, 31.2497, 'Ramses Station', 30.0131, 31.2089, 'Cairo University', 3, '09:00', 4, 8.00, 3.0)
    RETURNING id
  `, [driver1, driver2]);

  console.log(`Created ${templates.length} ride templates`);

  const today = new Date();
  const nextMonday = new Date(today);
  nextMonday.setDate(today.getDate() + ((1 + 7 - today.getDay()) % 7 || 7));
  const mondayStr = nextMonday.toISOString().split('T')[0];

  const nextTuesday = new Date(nextMonday);
  nextTuesday.setDate(nextMonday.getDate() + 1);
  const tuesdayStr = nextTuesday.toISOString().split('T')[0];

  const { rows: trips } = await query(`
    INSERT INTO trip_instances (ride_template_id, trip_date, departure_at, seats_remaining, status) VALUES
      ($1, $3, $3::date + '08:00'::time, 3, 'scheduled'),
      ($2, $4, $4::date + '07:30'::time, 4, 'scheduled'),
      ($1, ($3::date - 7), ($3::date - 7) + '08:00'::time, 1, 'completed')
    RETURNING id, status
  `, [templates[0].id, templates[2].id, mondayStr, tuesdayStr]);

  console.log(`Created ${trips.length} trip instances`);

  const completedTrip = trips.find(t => t.status === 'completed').id;
  const scheduledTrip = trips[0].id;

  await query(`
    INSERT INTO join_requests (trip_id, rider_id, status, decided_at) VALUES
      ($1, $3, 'approved', NOW()),
      ($1, $4, 'approved', NOW()),
      ($2, $3, 'pending', NULL)
  `, [scheduledTrip, completedTrip, rider1, rider2]);

  await query(`
    INSERT INTO ratings (trip_id, author_id, subject_id, direction, score, comment) VALUES
      ($1, $2, $3, 'rider_to_driver', 5, 'Great driver, very punctual!'),
      ($1, $3, $2, 'driver_to_rider', 4, 'Good passenger')
  `, [completedTrip, rider1, driver1]);

  await query(`
    INSERT INTO attendance (trip_id, user_id, showed_up) VALUES
      ($1, $2, true),
      ($1, $3, true)
  `, [completedTrip, rider1, driver1]);

  console.log('Seed data inserted successfully.');
  await pool.end();
}

seed().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});

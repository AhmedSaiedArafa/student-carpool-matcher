const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const app = require('../src/app');

const BASE = 'http://localhost:3001/api';
let server;
let driverToken, riderToken, rider2Token;
let driverId, riderId, rider2Id;
let templateId, tripId, requestId;

async function req(method, path, body = null, token = null) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (token) opts.headers['Authorization'] = `Bearer ${token}`;
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE}${path}`, opts);
  const data = res.status === 204 ? null : await res.json();
  return { status: res.status, data };
}

describe('Integration Tests', () => {
  before(async () => {
    server = app.listen(3001);
  });

  after(() => {
    server.close();
  });

  describe('Auth', () => {
    it('registers a driver', async () => {
      const { status, data } = await req('POST', '/auth/register', {
        university_email: 'testdriver@test.edu',
        password: 'TestPass123!',
        name: 'Test Driver',
        role: 'driver',
      });
      assert.strictEqual(status, 201);
      assert.ok(data.data.id);
      driverId = data.data.id;
    });

    it('registers a rider', async () => {
      const { status, data } = await req('POST', '/auth/register', {
        university_email: 'testrider@test.edu',
        password: 'TestPass123!',
        name: 'Test Rider',
        role: 'rider',
      });
      assert.strictEqual(status, 201);
      riderId = data.data.id;
    });

    it('registers a second rider', async () => {
      const { status, data } = await req('POST', '/auth/register', {
        university_email: 'testrider2@test.edu',
        password: 'TestPass123!',
        name: 'Test Rider 2',
        role: 'rider',
      });
      assert.strictEqual(status, 201);
      rider2Id = data.data.id;
    });

    it('rejects duplicate email', async () => {
      const { status } = await req('POST', '/auth/register', {
        university_email: 'testdriver@test.edu',
        password: 'TestPass123!',
        name: 'Dup',
        role: 'driver',
      });
      assert.strictEqual(status, 409);
    });

    it('logs in driver', async () => {
      const { status, data } = await req('POST', '/auth/login', {
        university_email: 'testdriver@test.edu',
        password: 'TestPass123!',
      });
      assert.strictEqual(status, 200);
      assert.ok(data.data.token);
      driverToken = data.data.token;
    });

    it('logs in rider', async () => {
      const { data } = await req('POST', '/auth/login', {
        university_email: 'testrider@test.edu',
        password: 'TestPass123!',
      });
      riderToken = data.data.token;
    });

    it('logs in rider2', async () => {
      const { data } = await req('POST', '/auth/login', {
        university_email: 'testrider2@test.edu',
        password: 'TestPass123!',
      });
      rider2Token = data.data.token;
    });

    it('rejects wrong password', async () => {
      const { status } = await req('POST', '/auth/login', {
        university_email: 'testdriver@test.edu',
        password: 'wrong',
      });
      assert.strictEqual(status, 401);
    });

    it('rejects unauthenticated access', async () => {
      const { status } = await req('GET', '/rides/mine');
      assert.strictEqual(status, 401);
    });
  });

  describe('Rides', () => {
    it('creates a ride template', async () => {
      const { status, data } = await req('POST', '/rides', {
        origin_lat: 30.0444, origin_lng: 31.2357, origin_name: 'Tahrir',
        destination_lat: 30.0131, destination_lng: 31.2089, destination_name: 'CU',
        weekday: 1, departure_time: '08:00', seats_total: 2, fare: 10,
      }, driverToken);
      assert.strictEqual(status, 201);
      templateId = data.data.template.id;
      assert.ok(data.data.instances.length > 0);
      tripId = data.data.instances[0].id;
    });

    it('lists driver rides', async () => {
      const { status, data } = await req('GET', '/rides/mine', null, driverToken);
      assert.strictEqual(status, 200);
      assert.ok(data.data.length > 0);
    });

    it('rejects rider creating a ride', async () => {
      const { status } = await req('POST', '/rides', {
        origin_lat: 30, origin_lng: 31, destination_lat: 30, destination_lng: 31,
        weekday: 1, departure_time: '08:00', seats_total: 2,
      }, riderToken);
      assert.strictEqual(status, 403);
    });
  });

  describe('Matching & Requests', () => {
    it('finds matching rides', async () => {
      const { status, data } = await req('GET', '/matches?pickupLat=30.044&pickupLng=31.235', null, riderToken);
      assert.strictEqual(status, 200);
      assert.ok(Array.isArray(data.data));
    });

    it('requests a seat', async () => {
      const { status, data } = await req('POST', `/trips/${tripId}/requests`, {
        pickup_lat: 30.044, pickup_lng: 31.235,
      }, riderToken);
      assert.strictEqual(status, 201);
      requestId = data.data.id;
    });

    it('rejects duplicate request', async () => {
      const { status } = await req('POST', `/trips/${tripId}/requests`, {}, riderToken);
      assert.strictEqual(status, 409);
    });

    it('driver approves request', async () => {
      const { status, data } = await req('PATCH', `/requests/${requestId}/decision`, {
        decision: 'approved',
      }, driverToken);
      assert.strictEqual(status, 200);
      assert.strictEqual(data.data.status, 'approved');
    });

    it('shows in rider requests', async () => {
      const { status, data } = await req('GET', '/requests/mine', null, riderToken);
      assert.strictEqual(status, 200);
      assert.ok(data.data.some(r => r.id === requestId));
    });
  });

  describe('Overbooking prevention', () => {
    it('second rider requests last seat', async () => {
      const { status, data } = await req('POST', `/trips/${tripId}/requests`, {}, rider2Token);
      assert.strictEqual(status, 201);
      const req2Id = data.data.id;

      const { status: s2 } = await req('PATCH', `/requests/${req2Id}/decision`, {
        decision: 'approved',
      }, driverToken);
      assert.strictEqual(s2, 200);
    });

    it('no more seats - register new rider and try', async () => {
      const { data: regData } = await req('POST', '/auth/register', {
        university_email: 'testrider3@test.edu', password: 'TestPass123!',
        name: 'Rider3', role: 'rider',
      });
      const { data: loginData } = await req('POST', '/auth/login', {
        university_email: 'testrider3@test.edu', password: 'TestPass123!',
      });
      const r3Token = loginData.data.token;

      const { status } = await req('POST', `/trips/${tripId}/requests`, {}, r3Token);
      assert.strictEqual(status, 409);
    });
  });

  describe('History & Ratings', () => {
    it('completes a trip', async () => {
      const { status } = await req('PATCH', `/trips/${tripId}/complete`, {}, driverToken);
      assert.strictEqual(status, 200);
    });

    it('shows in history', async () => {
      const { status, data } = await req('GET', '/history', null, driverToken);
      assert.strictEqual(status, 200);
      assert.ok(data.data.some(t => t.id === tripId));
    });

    it('rider rates driver', async () => {
      const { status } = await req('POST', `/trips/${tripId}/ratings`, {
        subject_id: driverId, score: 5, comment: 'Great!',
      }, riderToken);
      assert.strictEqual(status, 201);
    });

    it('rejects duplicate rating', async () => {
      const { status } = await req('POST', `/trips/${tripId}/ratings`, {
        subject_id: driverId, score: 4,
      }, riderToken);
      assert.strictEqual(status, 409);
    });

    it('gets reliability', async () => {
      const { status, data } = await req('GET', `/users/${driverId}/reliability`, null, riderToken);
      assert.strictEqual(status, 200);
      assert.ok(data.data.average_score > 0);
    });

    it('gets badges', async () => {
      const { status, data } = await req('GET', `/users/${driverId}/badges`, null, riderToken);
      assert.strictEqual(status, 200);
      assert.ok(Array.isArray(data.data));
    });
  });
});

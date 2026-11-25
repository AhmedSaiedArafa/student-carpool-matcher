const createRideSchema = {
  origin_lat: { required: true, type: 'number' },
  origin_lng: { required: true, type: 'number' },
  destination_lat: { required: true, type: 'number' },
  destination_lng: { required: true, type: 'number' },
  weekday: { required: true, type: 'number', min: 0, max: 6 },
  departure_time: { required: true },
  seats_total: { required: true, type: 'number', min: 1, max: 8 },
};

module.exports = { createRideSchema };

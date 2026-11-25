const createRideSchema = {
  origin_lat: { required: true, type: 'number', min: -90, max: 90 },
  origin_lng: { required: true, type: 'number', min: -180, max: 180 },
  destination_lat: { required: true, type: 'number', min: -90, max: 90 },
  destination_lng: { required: true, type: 'number', min: -180, max: 180 },
  departure_time: { required: true, pattern: /^\d{2}:\d{2}$/ },
  seats_total: { required: true, type: 'integer', min: 1, max: 8 },
  schedule_type: { required: true, oneOf: ['once', 'weekly'] },
  fare: { type: 'number', min: 0, max: 9999.99 },
  origin_name: { maxLength: 255 },
  destination_name: { maxLength: 255 },
  pickup_area_radius_km: { type: 'number', min: 0.5, max: 20 },
};

const updateRideSchema = {
  origin_lat: { type: 'number', min: -90, max: 90 },
  origin_lng: { type: 'number', min: -180, max: 180 },
  destination_lat: { type: 'number', min: -90, max: 90 },
  destination_lng: { type: 'number', min: -180, max: 180 },
  departure_time: { pattern: /^\d{2}:\d{2}$/ },
  seats_total: { type: 'integer', min: 1, max: 8 },
  fare: { type: 'number', min: 0, max: 9999.99 },
  origin_name: { maxLength: 255 },
  destination_name: { maxLength: 255 },
  pickup_area_radius_km: { type: 'number', min: 0.5, max: 20 },
};

module.exports = { createRideSchema, updateRideSchema };

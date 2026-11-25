const matchQuerySchema = {
  pickupLat: { required: true, type: 'number', min: -90, max: 90 },
  pickupLng: { required: true, type: 'number', min: -180, max: 180 },
  dropoffLat: { type: 'number', min: -90, max: 90 },
  dropoffLng: { type: 'number', min: -180, max: 180 },
};

const requestSeatSchema = {
  pickup_lat: { type: 'number', min: -90, max: 90 },
  pickup_lng: { type: 'number', min: -180, max: 180 },
  offered_fare: { type: 'number', min: 0, max: 9999.99 },
};

const geocodeQuerySchema = {
  q: { required: true, minLength: 2, maxLength: 100 },
};

const reverseGeocodeSchema = {
  lat: { required: true, type: 'number', min: -90, max: 90 },
  lng: { required: true, type: 'number', min: -180, max: 180 },
};

module.exports = { matchQuerySchema, requestSeatSchema, geocodeQuerySchema, reverseGeocodeSchema };

const matchQuerySchema = {
  pickupLat: { required: true, type: 'number' },
  pickupLng: { required: true, type: 'number' },
};

const requestSeatSchema = {
  pickup_lat: { type: 'number' },
  pickup_lng: { type: 'number' },
};

module.exports = { matchQuerySchema, requestSeatSchema };

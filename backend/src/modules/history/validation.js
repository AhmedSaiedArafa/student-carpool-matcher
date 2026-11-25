const createRatingSchema = {
  subject_id: { required: true, type: 'integer', min: 1 },
  score: { required: true, type: 'integer', min: 1, max: 5 },
  comment: { maxLength: 300 },
};

module.exports = { createRatingSchema };

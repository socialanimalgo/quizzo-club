function shuffledIndices(length) {
  const indices = Array.from({ length }, (_, index) => index);
  for (let index = indices.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [indices[index], indices[swapIndex]] = [indices[swapIndex], indices[index]];
  }
  return indices;
}

function shuffleQuestionOptions(options, correctIndex) {
  const order = shuffledIndices(options.length);
  const shuffled = order.map(index => options[index]);
  const nextCorrectIndex = order.findIndex(index => index === correctIndex);
  return { options: shuffled, correctIndex: nextCorrectIndex };
}

async function rebalanceQuestionOptionOrder(pool) {
  const markerKey = 'question_option_rebalanced_v1';
  const { rows: metaRows } = await pool.query('SELECT value FROM app_meta WHERE key = $1', [markerKey]);
  if (metaRows.length) return;

  const { rows } = await pool.query('SELECT id, options, correct_index FROM questions');
  for (const row of rows) {
    const rawOptions = Array.isArray(row.options) ? row.options : [];
    if (!rawOptions.length) continue;
    const texts = rawOptions.map(option => typeof option === 'string' ? option : option?.text).filter(Boolean);
    if (texts.length !== rawOptions.length) continue;

    const { options, correctIndex } = shuffleQuestionOptions(texts, row.correct_index || 0);
    const payload = options.map((text, index) => ({ text, correct: index === correctIndex }));

    await pool.query(
      'UPDATE questions SET options = $1, correct_index = $2 WHERE id = $3',
      [JSON.stringify(payload), correctIndex, row.id]
    );
  }

  await pool.query(
    `INSERT INTO app_meta (key, value, updated_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
    [markerKey, JSON.stringify({ at: new Date().toISOString() })]
  );
}

module.exports = {
  shuffleQuestionOptions,
  rebalanceQuestionOptionOrder,
};

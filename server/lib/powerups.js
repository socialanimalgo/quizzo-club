const POWERUPS = {
  fifty: {
    id: 'fifty',
    name: '50:50',
    description: 'Makne dva netočna odgovora',
    coins: 120,
    gems: 8,
    emoji: '½',
  },
  freeze: {
    id: 'freeze',
    name: 'Freeze',
    description: 'Zaustavlja timer i rješava pitanje',
    coins: 180,
    gems: 12,
    emoji: '❄',
  },
  doublexp: {
    id: 'doublexp',
    name: 'Double XP',
    description: 'Sljedeći točan odgovor vrijedi 2× XP',
    coins: 150,
    gems: 10,
    emoji: '2×',
  },
  reveal: {
    id: 'reveal',
    name: 'Reveal',
    description: 'Otkriva točan odgovor',
    coins: 220,
    gems: 15,
    emoji: '👁',
  },
};

const BUNDLES = {
  starter: {
    id: 'starter',
    name: 'Starter',
    off_pct: 20,
    cost_gems: 30,
    items: { fifty: 5, freeze: 3, doublexp: 3 },
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    off_pct: 35,
    cost_gems: 75,
    items: { fifty: 10, freeze: 8, doublexp: 8, reveal: 5 },
  },
  mega: {
    id: 'mega',
    name: 'Mega',
    off_pct: 45,
    cost_gems: 150,
    items: { fifty: 25, freeze: 20, doublexp: 20, reveal: 15 },
  },
};

const GEM_PACKS = {
  g1: { id: 'g1', gems: 20, bonus: 0, price_eur: 1.99 },
  g2: { id: 'g2', gems: 60, bonus: 10, price_eur: 4.99 },
  g3: { id: 'g3', gems: 180, bonus: 40, price_eur: 12.99, popular: true },
  g4: { id: 'g4', gems: 500, bonus: 150, price_eur: 29.99 },
};

function normalizeInventoryRows(rows) {
  const base = Object.keys(POWERUPS).reduce((acc, key) => ({ ...acc, [key]: 0 }), {});
  for (const row of rows) {
    if (row.powerup_id in base) base[row.powerup_id] = Number(row.qty) || 0;
  }
  return base;
}

async function getWallet(pool, userId) {
  const { rows: userRows } = await pool.query(
    'SELECT coins, gems FROM users WHERE id = $1',
    [userId]
  );
  if (!userRows.length) throw new Error('User not found');

  const { rows: inventoryRows } = await pool.query(
    'SELECT powerup_id, qty FROM user_powerups WHERE user_id = $1',
    [userId]
  );

  return {
    coins: Number(userRows[0].coins) || 0,
    gems: Number(userRows[0].gems) || 0,
    inv: normalizeInventoryRows(inventoryRows),
  };
}

async function upsertInventory(client, userId, powerupId, qtyDelta) {
  await client.query(
    `INSERT INTO user_powerups (user_id, powerup_id, qty)
     VALUES ($1, $2, GREATEST($3, 0))
     ON CONFLICT (user_id, powerup_id) DO UPDATE SET
       qty = user_powerups.qty + $3`,
    [userId, powerupId, qtyDelta]
  );
}

async function grantPowerup(clientOrPool, userId, powerupId, qty, source = 'shop') {
  if (!POWERUPS[powerupId]) throw new Error('Invalid powerup');
  if (!qty || qty < 1) throw new Error('Invalid qty');

  await upsertInventory(clientOrPool, userId, powerupId, qty);
  const powerup = POWERUPS[powerupId];
  const { rows } = await clientOrPool.query(
    `INSERT INTO powerup_purchases (user_id, powerup_id, qty, currency, source, cost_coins, cost_gems)
     VALUES ($1, $2, $3, 'gift', $4, $5, $6)
     RETURNING *`,
    [userId, powerupId, qty, source, powerup.coins * qty, powerup.gems * qty]
  );
  return rows[0];
}

async function consumePowerup(clientOrPool, userId, powerupId) {
  if (!POWERUPS[powerupId]) throw new Error('Invalid powerup');

  const { rows } = await clientOrPool.query(
    `UPDATE user_powerups
     SET qty = qty - 1
     WHERE user_id = $1 AND powerup_id = $2 AND qty > 0
     RETURNING qty`,
    [userId, powerupId]
  );

  if (!rows.length) {
    const err = new Error('Powerup unavailable');
    err.code = 'POWERUP_UNAVAILABLE';
    throw err;
  }

  return rows[0];
}

async function grantPowerupSet(clientOrPool, userId, items, source) {
  const results = [];
  for (const [powerupId, qty] of Object.entries(items)) {
    if (!qty) continue;
    results.push(await grantPowerup(clientOrPool, userId, powerupId, qty, source));
  }
  return results;
}

module.exports = {
  POWERUPS,
  BUNDLES,
  GEM_PACKS,
  getWallet,
  grantPowerup,
  grantPowerupSet,
  consumePowerup,
  normalizeInventoryRows,
};

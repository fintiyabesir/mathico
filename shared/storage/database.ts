import * as SQLite from 'expo-sqlite';

let db: SQLite.SQLiteDatabase | null = null;

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!db) {
    db = await SQLite.openDatabaseAsync('mathico.db');
    await initSchema(db);
  }
  return db;
}

async function initSchema(db: SQLite.SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS user_profile (
      id TEXT PRIMARY KEY,
      displayName TEXT NOT NULL,
      avatar TEXT NOT NULL,
      ageGroup TEXT NOT NULL,
      startDifficultyPreference TEXT NOT NULL,
      selectedTheme TEXT NOT NULL DEFAULT 'child',
      createdAt TEXT NOT NULL,
      settingsJson TEXT NOT NULL DEFAULT '{}'
    );

    CREATE TABLE IF NOT EXISTS skill (
      id TEXT PRIMARY KEY,
      operationType TEXT NOT NULL,
      topicType TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS skill_level (
      id TEXT PRIMARY KEY,
      skillId TEXT NOT NULL,
      levelNo INTEGER NOT NULL,
      expectedTimeMs INTEGER NOT NULL,
      parametersJson TEXT NOT NULL,
      basePoint INTEGER NOT NULL,
      FOREIGN KEY (skillId) REFERENCES skill(id)
    );

    CREATE TABLE IF NOT EXISTS session (
      id TEXT PRIMARY KEY,
      userProfileId TEXT NOT NULL,
      mode TEXT NOT NULL,
      startedAt TEXT NOT NULL,
      endedAt TEXT,
      completed INTEGER NOT NULL DEFAULT 0,
      pendingPoints REAL NOT NULL DEFAULT 0,
      finalizedPoints REAL NOT NULL DEFAULT 0,
      FOREIGN KEY (userProfileId) REFERENCES user_profile(id)
    );

    CREATE TABLE IF NOT EXISTS session_question (
      id TEXT PRIMARY KEY,
      sessionId TEXT NOT NULL,
      skillId TEXT NOT NULL,
      levelNo INTEGER NOT NULL,
      questionPayloadJson TEXT NOT NULL,
      correctAnswer TEXT NOT NULL,
      presentedAt TEXT NOT NULL,
      FOREIGN KEY (sessionId) REFERENCES session(id)
    );

    CREATE TABLE IF NOT EXISTS answer_attempt (
      id TEXT PRIMARY KEY,
      sessionQuestionId TEXT NOT NULL,
      attemptNo INTEGER NOT NULL DEFAULT 1,
      submittedAnswer TEXT NOT NULL,
      isCorrect INTEGER NOT NULL DEFAULT 0,
      responseTimeMs INTEGER NOT NULL,
      usedHint INTEGER NOT NULL DEFAULT 0,
      awardedPoints REAL NOT NULL DEFAULT 0,
      FOREIGN KEY (sessionQuestionId) REFERENCES session_question(id)
    );

    CREATE TABLE IF NOT EXISTS level_progress (
      id TEXT PRIMARY KEY,
      userProfileId TEXT NOT NULL,
      skillId TEXT NOT NULL,
      currentLevel INTEGER NOT NULL DEFAULT 1,
      rollingAccuracy REAL NOT NULL DEFAULT 0,
      rollingMedianTimeMs REAL NOT NULL DEFAULT 0,
      rollingScore REAL NOT NULL DEFAULT 0,
      confidenceScore REAL NOT NULL DEFAULT 0,
      lastEvaluatedAt TEXT NOT NULL,
      UNIQUE(userProfileId, skillId),
      FOREIGN KEY (userProfileId) REFERENCES user_profile(id),
      FOREIGN KEY (skillId) REFERENCES skill(id)
    );

    CREATE TABLE IF NOT EXISTS daily_goal (
      id TEXT PRIMARY KEY,
      userProfileId TEXT NOT NULL,
      date TEXT NOT NULL,
      goalType TEXT NOT NULL,
      targetValue REAL NOT NULL,
      currentValue REAL NOT NULL DEFAULT 0,
      completed INTEGER NOT NULL DEFAULT 0,
      UNIQUE(userProfileId, date, goalType),
      FOREIGN KEY (userProfileId) REFERENCES user_profile(id)
    );

    CREATE TABLE IF NOT EXISTS reward_transaction (
      id TEXT PRIMARY KEY,
      userProfileId TEXT NOT NULL,
      type TEXT NOT NULL,
      amount REAL NOT NULL,
      description TEXT NOT NULL,
      createdByType TEXT NOT NULL DEFAULT 'system',
      createdAt TEXT NOT NULL,
      FOREIGN KEY (userProfileId) REFERENCES user_profile(id)
    );

    CREATE TABLE IF NOT EXISTS badge (
      id TEXT PRIMARY KEY,
      key TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      iconEmoji TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS badge_award (
      id TEXT PRIMARY KEY,
      userProfileId TEXT NOT NULL,
      badgeId TEXT NOT NULL,
      awardedAt TEXT NOT NULL,
      FOREIGN KEY (userProfileId) REFERENCES user_profile(id),
      FOREIGN KEY (badgeId) REFERENCES badge(id)
    );

    CREATE TABLE IF NOT EXISTS performance_snapshot (
      id TEXT PRIMARY KEY,
      userProfileId TEXT NOT NULL,
      periodType TEXT NOT NULL,
      startDate TEXT NOT NULL,
      endDate TEXT NOT NULL,
      metricsJson TEXT NOT NULL,
      FOREIGN KEY (userProfileId) REFERENCES user_profile(id)
    );
  `);

  await seedSkillsAndLevels(db);
  await seedBadges(db);
}

async function seedSkillsAndLevels(db: SQLite.SQLiteDatabase): Promise<void> {
  const existing = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM skill'
  );
  if (existing && existing.count > 0) return;

  const operations = ['addition', 'subtraction', 'multiplication', 'division'];

  for (const op of operations) {
    const skillId = `skill_${op}`;
    await db.runAsync(
      'INSERT INTO skill (id, operationType, topicType) VALUES (?, ?, ?)',
      [skillId, op, op]
    );

    const levels = getSkillLevels(op);
    for (const level of levels) {
      await db.runAsync(
        'INSERT INTO skill_level (id, skillId, levelNo, expectedTimeMs, parametersJson, basePoint) VALUES (?, ?, ?, ?, ?, ?)',
        [
          `${skillId}_level_${level.levelNo}`,
          skillId,
          level.levelNo,
          level.expectedTimeMs,
          JSON.stringify(level.params),
          level.basePoint,
        ]
      );
    }
  }
}

function getSkillLevels(operation: string) {
  const base = {
    addition: [
      { levelNo: 1, expectedTimeMs: 8000, basePoint: 10, params: { minNum: 1, maxNum: 9, digits: 1, requiresCarry: false, requiresBorrow: false, hasRemainder: false } },
      { levelNo: 2, expectedTimeMs: 10000, basePoint: 15, params: { minNum: 1, maxNum: 20, digits: 2, requiresCarry: false, requiresBorrow: false, hasRemainder: false } },
      { levelNo: 3, expectedTimeMs: 12000, basePoint: 20, params: { minNum: 10, maxNum: 99, digits: 2, requiresCarry: true, requiresBorrow: false, hasRemainder: false } },
      { levelNo: 4, expectedTimeMs: 15000, basePoint: 28, params: { minNum: 10, maxNum: 199, digits: 3, requiresCarry: true, requiresBorrow: false, hasRemainder: false } },
      { levelNo: 5, expectedTimeMs: 18000, basePoint: 38, params: { minNum: 100, maxNum: 999, digits: 3, requiresCarry: true, requiresBorrow: false, hasRemainder: false } },
    ],
    subtraction: [
      { levelNo: 1, expectedTimeMs: 8000, basePoint: 10, params: { minNum: 1, maxNum: 9, digits: 1, requiresCarry: false, requiresBorrow: false, hasRemainder: false } },
      { levelNo: 2, expectedTimeMs: 10000, basePoint: 15, params: { minNum: 1, maxNum: 20, digits: 2, requiresCarry: false, requiresBorrow: false, hasRemainder: false } },
      { levelNo: 3, expectedTimeMs: 12000, basePoint: 20, params: { minNum: 10, maxNum: 99, digits: 2, requiresCarry: false, requiresBorrow: true, hasRemainder: false } },
      { levelNo: 4, expectedTimeMs: 15000, basePoint: 28, params: { minNum: 10, maxNum: 199, digits: 3, requiresCarry: false, requiresBorrow: true, hasRemainder: false } },
      { levelNo: 5, expectedTimeMs: 18000, basePoint: 38, params: { minNum: 100, maxNum: 999, digits: 3, requiresCarry: false, requiresBorrow: true, hasRemainder: false } },
    ],
    multiplication: [
      { levelNo: 1, expectedTimeMs: 10000, basePoint: 15, params: { minNum: 1, maxNum: 5, digits: 1, requiresCarry: false, requiresBorrow: false, hasRemainder: false } },
      { levelNo: 2, expectedTimeMs: 12000, basePoint: 22, params: { minNum: 1, maxNum: 9, digits: 1, requiresCarry: false, requiresBorrow: false, hasRemainder: false } },
      { levelNo: 3, expectedTimeMs: 15000, basePoint: 30, params: { minNum: 2, maxNum: 12, digits: 2, requiresCarry: false, requiresBorrow: false, hasRemainder: false } },
      { levelNo: 4, expectedTimeMs: 18000, basePoint: 40, params: { minNum: 5, maxNum: 25, digits: 2, requiresCarry: true, requiresBorrow: false, hasRemainder: false } },
      { levelNo: 5, expectedTimeMs: 22000, basePoint: 55, params: { minNum: 10, maxNum: 50, digits: 2, requiresCarry: true, requiresBorrow: false, hasRemainder: false } },
    ],
    division: [
      { levelNo: 1, expectedTimeMs: 10000, basePoint: 15, params: { minNum: 1, maxNum: 5, digits: 1, requiresCarry: false, requiresBorrow: false, hasRemainder: false } },
      { levelNo: 2, expectedTimeMs: 12000, basePoint: 22, params: { minNum: 1, maxNum: 9, digits: 1, requiresCarry: false, requiresBorrow: false, hasRemainder: false } },
      { levelNo: 3, expectedTimeMs: 15000, basePoint: 30, params: { minNum: 2, maxNum: 12, digits: 2, requiresCarry: false, requiresBorrow: false, hasRemainder: false } },
      { levelNo: 4, expectedTimeMs: 18000, basePoint: 40, params: { minNum: 5, maxNum: 25, digits: 2, requiresCarry: false, requiresBorrow: false, hasRemainder: true } },
      { levelNo: 5, expectedTimeMs: 22000, basePoint: 55, params: { minNum: 10, maxNum: 50, digits: 2, requiresCarry: false, requiresBorrow: false, hasRemainder: true } },
    ],
  };
  return base[operation as keyof typeof base] || base.addition;
}

async function seedBadges(db: SQLite.SQLiteDatabase): Promise<void> {
  const existing = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM badge'
  );
  if (existing && existing.count > 0) return;

  const badges = [
    { id: 'badge_first_session', key: 'first_session', name: 'İlk Adım', description: 'İlk seansını tamamladın!', iconEmoji: '🌟' },
    { id: 'badge_streak_3', key: 'streak_3', name: '3 Gün Seri', description: '3 gün üst üste çalıştın!', iconEmoji: '🔥' },
    { id: 'badge_streak_7', key: 'streak_7', name: '7 Gün Seri', description: '7 gün üst üste çalıştın!', iconEmoji: '🏆' },
    { id: 'badge_perfect_session', key: 'perfect_session', name: 'Mükemmel Seans', description: 'Bir seansı %100 doğrulukla tamamladın!', iconEmoji: '💯' },
    { id: 'badge_speed_demon', key: 'speed_demon', name: 'Hız Ustası', description: 'Beklenen sürenin yarısında cevap verdin!', iconEmoji: '⚡' },
    { id: 'badge_level_up', key: 'level_up', name: 'Seviye Atladı', description: 'Bir seviye yükseldin!', iconEmoji: '📈' },
    { id: 'badge_100_questions', key: '100_questions', name: '100 Soru', description: '100 soru çözdün!', iconEmoji: '💪' },
    { id: 'badge_all_operations', key: 'all_operations', name: 'Dört İşlem', description: 'Tüm işlem türlerinde çalıştın!', iconEmoji: '🎓' },
  ];

  for (const badge of badges) {
    await db.runAsync(
      'INSERT INTO badge (id, key, name, description, iconEmoji) VALUES (?, ?, ?, ?, ?)',
      [badge.id, badge.key, badge.name, badge.description, badge.iconEmoji]
    );
  }
}

/**
 * Seed realistic mock data for CRIAS demos.
 *
 * Creates demo users (analyst + manager), a set of firms across industries with
 * QUARTERLY financial history and trajectories (improving / deteriorating /
 * stable), a prediction per quarter (with SHAP values so charts render), and
 * counterfactual + RCES strategies for the riskier firms. Also writes a handful
 * of audit-log entries.
 *
 * Idempotent: wipes firms/financial_entries/predictions/counterfactuals and
 * re-seeds. Existing users (incl. your admin) are preserved; demo users are
 * upserted. Never touches production-only data beyond those demo collections.
 *
 * Usage (from crias/backend, with MONGODB_URI in .env or the environment):
 *   node scripts/createAdmin.js ...   # (once, for the admin)
 *   node scripts/seedMockData.js
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const { User, Firm, FinancialEntry, Prediction, Counterfactual, AuditLog } = require('../src/models');
const engine = require('../src/ml/engine');

// Deterministic dates (no Date.now needed): four recent quarter-ends.
const QUARTERS = [
  new Date('2025-09-30'),
  new Date('2025-12-31'),
  new Date('2026-03-31'),
  new Date('2026-06-30'),
];

// health h in [0,1]: 1 = very healthy (low PD), 0 = distressed (high PD)
function rawFromHealth(assets, h) {
  const debtRatio = 0.85 - 0.5 * h;                 // 0.35 .. 0.85
  const debt = Math.round(assets * debtRatio);
  const liquidityRatio = 0.1 + 0.6 * h;             // 0.10 .. 0.70
  const cash = Math.round(liquidityRatio * debt);
  const inventory = Math.round(assets * (0.15 + 0.15 * (1 - h)));
  return { assets, debt, cash, inventory };
}

// Firm profiles: [name, code, industry, assets, startHealth, endHealth]
const FIRMS = [
  ['Aurora Manufacturing',  'AURORA1', 'Manufacturing', 4_500_000, 0.88, 0.90], // healthy, stable
  ['Bluepeak Retail',       'BLUE02',  'Retail',        2_200_000, 0.35, 0.78], // recovering
  ['Cedar Logistics',       'CEDAR3',  'Logistics',     3_100_000, 0.72, 0.22], // deteriorating
  ['Delta Foods',           'DELTA4',  'Food & Bev',    1_800_000, 0.12, 0.10], // distressed
  ['Everest Tech',          'EVRST5',  'Technology',    6_000_000, 0.55, 0.58], // medium, stable
  ['Falcon Energy',         'FALC06',  'Energy',        5_200_000, 0.60, 0.16], // sharp decline
  ['Granite Construction',  'GRNT07',  'Construction',  2_700_000, 0.62, 0.88], // improving
  ['Harbor Pharma',         'HARB08',  'Pharma',        3_900_000, 0.40, 0.38], // medium/high
];

// Override timestamps (Mongoose sets createdAt to now on insert otherwise)
async function stampCreatedAt(Model, id, date) {
  await Model.updateOne({ _id: id }, { $set: { createdAt: date, updatedAt: date } }, { timestamps: false });
}

async function main() {
  if (!process.env.MONGODB_URI) { console.error('MONGODB_URI not set.'); process.exit(1); }
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 });
  console.log('Connected. Seeding mock data...\n');

  // --- reset demo collections (keep users + audit history) ---
  await Promise.all([
    Firm.deleteMany({}), FinancialEntry.deleteMany({}),
    Prediction.deleteMany({}), Counterfactual.deleteMany({}),
  ]);

  // --- users ---
  let admin = await User.findOne({ role: 'admin' });
  if (!admin) {
    admin = await User.create({ fullName: 'CRIAS Admin', email: 'admin@crias.demo', passwordHash: 'Admin@123', role: 'admin' });
  }
  const upsertUser = async (fullName, email, password, role) => {
    let u = await User.findOne({ email });
    if (!u) u = await User.create({ fullName, email, passwordHash: password, role });
    return u;
  };
  const analyst = await upsertUser('Anita Analyst', 'analyst@crias.demo', 'Analyst@123', 'analyst');
  const manager = await upsertUser('Manav Manager', 'manager@crias.demo', 'Manager@123', 'manager');

  const models = ['xgboost', 'random_forest', 'logistic_regression'];
  let firmCount = 0, entryCount = 0, predCount = 0, cfCount = 0;
  const riskTally = { low: 0, medium: 0, high: 0, critical: 0 };

  for (let fi = 0; fi < FIRMS.length; fi++) {
    const [firmName, firmCode, industry, assets, h0, h1] = FIRMS[fi];
    const firm = await Firm.create({
      firmName, firmCode, industry,
      createdBy: analyst._id,
      assignedManager: manager._id,
    });
    await stampCreatedAt(Firm, firm._id, QUARTERS[0]);
    firmCount++;

    let lastPrediction = null, lastEntry = null;
    for (let q = 0; q < QUARTERS.length; q++) {
      const h = h0 + (h1 - h0) * (q / (QUARTERS.length - 1));
      const raw = rawFromHealth(assets, h);
      const entry = await FinancialEntry.create({
        firmId: firm._id,
        submittedBy: analyst._id,
        reportingPeriod: QUARTERS[q],
        raw,
      });
      await stampCreatedAt(FinancialEntry, entry._id, QUARTERS[q]);
      entryCount++;

      const model = models[fi % models.length];
      const { pd, riskLabel, modelVersion } = engine.predict(entry.features, model);
      const { shapValues } = engine.explain(entry.features, model);
      const prediction = await Prediction.create({
        firmId: firm._id,
        entryId: entry._id,
        modelUsed: model,
        modelVersion,
        pd,
        riskLabel,
        shapValues,
        createdBy: analyst._id,
      });
      await stampCreatedAt(Prediction, prediction._id, QUARTERS[q]);
      predCount++;
      lastPrediction = { doc: prediction, pd, riskLabel };
      lastEntry = entry;
    }
    riskTally[lastPrediction.riskLabel]++;

    // Counterfactuals + strategies for the latest prediction of risky firms
    if (lastPrediction.pd > 0.55) {
      const feats = { ...lastEntry.features, ...lastEntry.raw };
      const { scenarios } = engine.counterfactuals(feats, 0.35);
      if (scenarios.length) {
        const original = { assets: lastEntry.raw.assets, debt: lastEntry.raw.debt, cash: lastEntry.raw.cash, inventory: lastEntry.raw.inventory };
        const { ranked } = engine.rankStrategies(original, scenarios, lastPrediction.pd);
        await Counterfactual.create({ predictionId: lastPrediction.doc._id, firmId: firm._id, scenarios: ranked });
        cfCount++;
      }
    }
  }

  // --- a few audit-log entries for the admin logs page ---
  const logs = [
    { userId: admin._id, action: 'login', resource: 'auth', status: 'success' },
    { userId: analyst._id, action: 'login', resource: 'auth', status: 'success' },
    { userId: analyst._id, action: 'create', resource: 'firm', status: 'success' },
    { userId: analyst._id, action: 'predict', resource: 'prediction', status: 'success' },
    { userId: null, action: 'login', resource: 'auth', status: 'failure', metadata: { reason: 'Invalid password' } },
    { userId: manager._id, action: 'login', resource: 'auth', status: 'success' },
  ];
  await AuditLog.insertMany(logs.map((l) => ({ ...l, ipAddress: '127.0.0.1', userAgent: 'seed-script' })));

  console.log(`Users:          admin + analyst@crias.demo (Analyst@123) + manager@crias.demo (Manager@123)`);
  console.log(`Firms:          ${firmCount}`);
  console.log(`Financial data: ${entryCount} entries (4 quarters each)`);
  console.log(`Predictions:    ${predCount} (with SHAP)`);
  console.log(`Counterfactuals:${cfCount} firms with ranked strategies`);
  console.log(`Latest risk mix: ${JSON.stringify(riskTally)}`);
  console.log(`Audit logs:     ${logs.length}`);
  console.log('\nDone.');

  await mongoose.disconnect();
  process.exit(0);
}

main().catch((e) => { console.error('Seed failed:', e.message); process.exit(1); });

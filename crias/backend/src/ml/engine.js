/**
 * CRIAS ML Engine (pure JavaScript)
 * ---------------------------------
 * Runs entirely in-process inside the Node backend — no Python service needed.
 * Implements the exact same math as the original scikit-learn models:
 *   - StandardScaler
 *   - Logistic Regression  (sigmoid of linear score)
 *   - Random Forest        (mean of per-tree class-1 proportions)
 *   - Gradient Boosting     ("xgboost": init_raw + lr * sum(tree leaves), then sigmoid)
 *
 * Model parameters live in ./models.json, exported from ai-service/export_models.py
 * and validated to match sklearn.predict_proba to < 1e-9.
 *
 * Explanations use EXACT Shapley values (brute force over the 3 features against
 * the scaler-mean baseline) — additive attributions in probability space that
 * sum to f(x) - f(baseline). This replaces the SHAP Python dependency faithfully.
 */

const MODELS = require('./models.json');
const FEATURES = MODELS.features; // ['current_ratio','debt_ratio','liquidity_ratio']

const sigmoid = (z) => 1 / (1 + Math.exp(-z));

// ---- StandardScaler -------------------------------------------------------
function scale(x) {
  const { mean, scale: sd } = MODELS.scaler;
  return x.map((v, i) => (v - mean[i]) / sd[i]);
}

// ---- Decision-tree walk ---------------------------------------------------
function walk(tree, xScaled) {
  let node = 0;
  const { children_left: cl, children_right: cr, feature: feat, threshold: thr, value } = tree;
  while (cl[node] !== -1) {
    node = xScaled[feat[node]] <= thr[node] ? cl[node] : cr[node];
  }
  return value[node];
}

// ---- Per-model probability of default (class 1) ---------------------------
function probaLogistic(xScaled) {
  const { coef, intercept } = MODELS.logistic_regression;
  let z = intercept;
  for (let i = 0; i < coef.length; i++) z += coef[i] * xScaled[i];
  return sigmoid(z);
}

function probaRandomForest(xScaled) {
  const trees = MODELS.random_forest.trees;
  let acc = 0;
  for (const t of trees) {
    const v = walk(t, xScaled); // [count_class0, count_class1]
    acc += v[1] / (v[0] + v[1]);
  }
  return acc / trees.length;
}

function probaXgboost(xScaled) {
  const { init_raw, learning_rate, trees } = MODELS.xgboost;
  let raw = init_raw;
  for (const t of trees) raw += learning_rate * walk(t, xScaled)[0];
  return sigmoid(raw);
}

const PROBA = {
  logistic_regression: probaLogistic,
  random_forest: probaRandomForest,
  xgboost: probaXgboost,
};

const VALID_MODELS = Object.keys(PROBA);

// Order a features object into the model's expected feature vector
function toVector(features) {
  const defaults = { current_ratio: 1.0, debt_ratio: 0.5, liquidity_ratio: 0.3 };
  return FEATURES.map((f) => {
    const v = features[f];
    return Number.isFinite(v) ? v : defaults[f];
  });
}

function predictProba(features, modelName = 'xgboost') {
  if (!PROBA[modelName]) throw new Error(`Unknown model: ${modelName}`);
  return PROBA[modelName](scale(toVector(features)));
}

// ---- Risk classification (matches SRS thresholds) -------------------------
function riskLabel(pd) {
  if (pd <= 0.3) return 'low';
  if (pd <= 0.55) return 'medium';
  if (pd <= 0.75) return 'high';
  return 'critical';
}

function predict(features, modelName = 'xgboost') {
  const pd = predictProba(features, modelName);
  return { pd: round(pd, 4), riskLabel: riskLabel(pd), modelVersion: 'v1.0' };
}

// ---- Exact Shapley-value explanations -------------------------------------
// With only 3 features, iterate all coalitions. Baseline = scaler mean, i.e.
// the scaled feature vector [0,0,0]. Contribution is in probability space.
function explain(features, modelName = 'xgboost') {
  const probaFn = PROBA[modelName];
  if (!probaFn) throw new Error(`No explainer for model: ${modelName}`);

  const x = scale(toVector(features)); // actual scaled values
  const base = [0, 0, 0]; // scaler mean in scaled space
  const n = FEATURES.length;

  // f over a coalition S: features in S take actual value, others take baseline
  const f = (S) => probaFn(x.map((v, i) => (S.has(i) ? v : base[i])));

  const factorial = (k) => (k <= 1 ? 1 : k * factorial(k - 1));
  const shap = new Array(n).fill(0);

  // Enumerate all subsets of the OTHER features for each feature i
  const others = (i) => [...Array(n).keys()].filter((j) => j !== i);
  for (let i = 0; i < n; i++) {
    const rest = others(i);
    for (let mask = 0; mask < (1 << rest.length); mask++) {
      const S = new Set();
      for (let b = 0; b < rest.length; b++) if (mask & (1 << b)) S.add(rest[b]);
      const sSize = S.size;
      const weight = (factorial(sSize) * factorial(n - sSize - 1)) / factorial(n);
      const withI = new Set(S);
      withI.add(i);
      shap[i] += weight * (f(withI) - f(S));
    }
  }

  const shapValues = FEATURES.map((feature, i) => ({
    feature,
    value: round(shap[i], 4),
    direction: shap[i] > 0 ? 'positive' : 'negative',
  }));
  shapValues.sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
  return { shapValues };
}

// ---- Counterfactual generation (grid search, ports counterfactual.py) -----
const DEFAULT_CONSTRAINTS = {
  cash: { min: 0, max: 10_000_000, step: 10_000 },
  debt: { min: 0, max: 50_000_000, step: 50_000 },
  inventory: { min: 0, max: 20_000_000, step: 25_000 },
};

function ratiosFromRaw(raw) {
  return {
    current_ratio: raw.debt > 0 ? raw.assets / raw.debt : 0,
    debt_ratio: raw.assets > 0 ? raw.debt / raw.assets : 0,
    liquidity_ratio: raw.debt > 0 ? raw.cash / raw.debt : 0,
  };
}

function makeScenario(current, changes) {
  const raw = { ...current, ...changes };
  return {
    features: { ...ratiosFromRaw(raw), assets: raw.assets, debt: raw.debt, cash: raw.cash, inventory: raw.inventory },
  };
}

function counterfactuals(features, targetPd = 0.3, constraints = {}) {
  const c = { ...DEFAULT_CONSTRAINTS, ...constraints };
  const raw = {
    assets: num(features.assets, 1_000_000),
    debt: num(features.debt, 500_000),
    cash: num(features.cash, 200_000),
    inventory: num(features.inventory, 100_000),
  };

  const scenarios = [];

  // Strategy 1: increase cash (improve liquidity)
  for (const inc of [0.1, 0.2, 0.3, 0.5, 0.8]) {
    const newCash = raw.cash * (1 + inc);
    if (newCash <= c.cash.max) scenarios.push(makeScenario(raw, { cash: newCash }));
  }
  // Strategy 2: reduce debt
  for (const dec of [0.1, 0.2, 0.3, 0.4, 0.5]) {
    const newDebt = raw.debt * (1 - dec);
    if (newDebt >= c.debt.min && newDebt > 0) scenarios.push(makeScenario(raw, { debt: newDebt }));
  }
  // Strategy 3: combined
  for (const inc of [0.2, 0.3]) {
    for (const dec of [0.2, 0.3]) {
      const newCash = raw.cash * (1 + inc);
      const newDebt = raw.debt * (1 - dec);
      if (newCash <= c.cash.max && newDebt >= c.debt.min && newDebt > 0) {
        scenarios.push(makeScenario(raw, { cash: newCash, debt: newDebt }));
      }
    }
  }
  // Strategy 4: reduce inventory -> convert to cash
  for (const dec of [0.2, 0.3, 0.5]) {
    const newInv = raw.inventory * (1 - dec);
    const newCash = raw.cash + (raw.inventory - newInv) * 0.8;
    if (newInv >= 0) scenarios.push(makeScenario(raw, { cash: newCash, inventory: newInv }));
  }

  // Predict PD (xgboost) for each scenario and keep those meeting the target
  const valid = [];
  for (const s of scenarios) {
    const pdNew = predictProba(s.features, 'xgboost');
    if (pdNew <= targetPd) {
      s.pd_new = round(pdNew, 4);
      valid.push(s);
    }
  }
  valid.sort((a, b) => a.pd_new - b.pd_new);
  return { scenarios: valid.slice(0, 5) };
}

// ---- RCES strategy ranking (ports rces.py) --------------------------------
const COST_WEIGHTS = { inventory: 0.001, cash: 0.001, debt: 0.002 };

function transitionCost(original, next) {
  const d = (k) => Math.abs(num(next[k], num(original[k], 0)) - num(original[k], 0));
  return d('inventory') * COST_WEIGHTS.inventory + d('cash') * COST_WEIGHTS.cash + d('debt') * COST_WEIGHTS.debt;
}

function rankStrategies(original, cfs, pdOld) {
  const ranked = cfs.map((scenario) => {
    const features = scenario.features || scenario;
    const pdNew = 'pd_new' in scenario ? scenario.pd_new : predictProba(features, 'xgboost');
    const cost = transitionCost(original, features);
    const pdReduction = pdOld - pdNew;
    return {
      features,
      pd_new: round(pdNew, 4),
      cost: round(cost, 2),
      rces: round(pdReduction / (cost + 1), 6),
      pd_reduction: round(pdReduction, 4),
    };
  });
  ranked.sort((a, b) => b.rces - a.rces);
  ranked.forEach((item, i) => (item.rank = i + 1));
  return { ranked };
}

// ---- helpers --------------------------------------------------------------
function round(v, d) {
  const f = 10 ** d;
  return Math.round(v * f) / f;
}
function num(v, fallback) {
  return Number.isFinite(v) ? v : fallback;
}

module.exports = {
  VALID_MODELS,
  predict,
  predictProba,
  riskLabel,
  explain,
  counterfactuals,
  rankStrategies,
};

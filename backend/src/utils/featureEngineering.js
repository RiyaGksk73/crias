/**
 * Feature Engineering Module
 * Computes derived financial ratios from raw accounting data
 */

const computeFeatures = (raw) => {
  const { assets, debt, cash, inventory } = raw;
  
  // Validate inputs
  if (debt <= 0) {
    throw new Error('Debt must be greater than 0');
  }
  if (assets < 0 || cash < 0 || inventory < 0) {
    throw new Error('Assets, cash, and inventory must be non-negative');
  }
  
  const current_ratio = assets / debt;
  const debt_ratio = debt / assets;
  const liquidity_ratio = cash / debt;
  
  // Check for NaN or Infinity
  if (!isFinite(current_ratio) || !isFinite(debt_ratio) || !isFinite(liquidity_ratio)) {
    throw new Error('Computed features resulted in invalid values');
  }
  
  return {
    current_ratio: Number(current_ratio.toFixed(6)),
    debt_ratio: Number(debt_ratio.toFixed(6)),
    liquidity_ratio: Number(liquidity_ratio.toFixed(6))
  };
};

const validateRawData = (raw) => {
  const errors = [];
  
  if (typeof raw.assets !== 'number' || raw.assets < 0) {
    errors.push('assets must be a non-negative number');
  }
  if (typeof raw.debt !== 'number' || raw.debt <= 0) {
    errors.push('debt must be a positive number');
  }
  if (typeof raw.cash !== 'number' || raw.cash < 0) {
    errors.push('cash must be a non-negative number');
  }
  if (typeof raw.inventory !== 'number' || raw.inventory < 0) {
    errors.push('inventory must be a non-negative number');
  }
  
  return errors;
};

const getRiskLabel = (pd) => {
  if (pd <= 0.30) return 'low';
  if (pd <= 0.55) return 'medium';
  if (pd <= 0.75) return 'high';
  return 'critical';
};

module.exports = {
  computeFeatures,
  validateRawData,
  getRiskLabel
};

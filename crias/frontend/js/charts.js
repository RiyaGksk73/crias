/**
 * CRIAS Charts Module
 * Chart.js based visualizations
 */

const charts = {
  // Store chart instances for cleanup
  instances: {},

  // Destroy existing chart
  destroy(id) {
    if (this.instances[id]) {
      this.instances[id].destroy();
      delete this.instances[id];
    }
  },

  // PD Trend Chart
  createPDTrendChart(canvasId, predictions) {
    this.destroy(canvasId);
    
    const ctx = document.getElementById(canvasId);
    if (!ctx) return null;

    const labels = predictions.map(p => 
      utils.formatDate(p.entryId?.reportingPeriod || p.createdAt)
    ).reverse();
    
    const data = predictions.map(p => p.pd * 100).reverse();

    this.instances[canvasId] = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'PD (%)',
          data,
          borderColor: '#2563eb',
          backgroundColor: 'rgba(37, 99, 235, 0.1)',
          fill: true,
          tension: 0.3,
          pointRadius: 4,
          pointBackgroundColor: '#2563eb'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true,
            max: 100,
            ticks: {
              callback: value => value + '%'
            }
          }
        },
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            callbacks: {
              label: context => `PD: ${context.raw.toFixed(1)}%`
            }
          }
        }
      }
    });

    return this.instances[canvasId];
  },

  // SHAP Bar Chart
  createSHAPChart(containerId, shapValues) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = '';

    // Find max absolute value for scaling
    const maxValue = Math.max(...shapValues.map(s => Math.abs(s.value)));

    shapValues.forEach(shap => {
      const bar = document.createElement('div');
      bar.className = 'shap-bar';

      const width = (Math.abs(shap.value) / maxValue) * 50;
      const isPositive = shap.direction === 'positive';

      bar.innerHTML = `
        <span class="shap-feature">${this.formatFeatureName(shap.feature)}</span>
        <div class="shap-bar-container">
          <div class="shap-bar-fill ${shap.direction}" 
               style="width: ${width}%"></div>
        </div>
        <span class="shap-value" style="color: ${isPositive ? '#ef4444' : '#22c55e'}">
          ${isPositive ? '+' : ''}${shap.value.toFixed(3)}
        </span>
      `;

      container.appendChild(bar);
    });
  },

  // Format feature names for display
  formatFeatureName(feature) {
    const names = {
      'current_ratio': 'Current Ratio',
      'debt_ratio': 'Debt Ratio',
      'liquidity_ratio': 'Liquidity Ratio'
    };
    return names[feature] || feature;
  },

  // Risk Gauge Chart
  createRiskGauge(canvasId, pd) {
    this.destroy(canvasId);
    
    const ctx = document.getElementById(canvasId);
    if (!ctx) return null;

    const pdPercent = pd * 100;

    this.instances[canvasId] = new Chart(ctx, {
      type: 'doughnut',
      data: {
        datasets: [{
          data: [pdPercent, 100 - pdPercent],
          backgroundColor: [this.getRiskColor(pd), '#e2e8f0'],
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '75%',
        rotation: -90,
        circumference: 180,
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            enabled: false
          }
        }
      }
    });

    return this.instances[canvasId];
  },

  // Get risk color based on PD
  getRiskColor(pd) {
    if (pd <= 0.30) return '#22c55e';
    if (pd <= 0.55) return '#f59e0b';
    if (pd <= 0.75) return '#f97316';
    return '#ef4444';
  },

  // Financial Metrics Radar Chart
  createMetricsRadar(canvasId, features) {
    this.destroy(canvasId);
    
    const ctx = document.getElementById(canvasId);
    if (!ctx) return null;

    this.instances[canvasId] = new Chart(ctx, {
      type: 'radar',
      data: {
        labels: ['Current Ratio', 'Debt Ratio', 'Liquidity Ratio'],
        datasets: [{
          label: 'Current Values',
          data: [
            Math.min(features.current_ratio, 3),
            features.debt_ratio,
            Math.min(features.liquidity_ratio, 1)
          ],
          backgroundColor: 'rgba(37, 99, 235, 0.2)',
          borderColor: '#2563eb',
          pointBackgroundColor: '#2563eb'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          r: {
            beginAtZero: true,
            max: 3
          }
        },
        plugins: {
          legend: {
            display: false
          }
        }
      }
    });

    return this.instances[canvasId];
  },

  // Model Comparison Chart
  createModelComparisonChart(canvasId, modelResults) {
    this.destroy(canvasId);
    
    const ctx = document.getElementById(canvasId);
    if (!ctx) return null;

    const labels = modelResults.map(m => m.name);
    const data = modelResults.map(m => m.pd * 100);

    this.instances[canvasId] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'PD (%)',
          data,
          backgroundColor: data.map(d => this.getRiskColor(d / 100)),
          borderRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true,
            max: 100,
            ticks: {
              callback: value => value + '%'
            }
          }
        },
        plugins: {
          legend: {
            display: false
          }
        }
      }
    });

    return this.instances[canvasId];
  }
};

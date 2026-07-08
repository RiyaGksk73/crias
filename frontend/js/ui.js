/**
 * CRIAS UI Components
 * Reusable UI component functions
 */

const ui = {
  // Render firm card
  firmCard(firm, latestPrediction = null) {
    const pd = latestPrediction?.pd;
    const riskLabel = latestPrediction?.riskLabel || 'unknown';
    
    return `
      <div class="firm-card" onclick="window.location.href='/pages/firm.html?id=${firm._id}'">
        <div class="firm-card-header">
          <div>
            <div class="firm-name">${firm.firmName}</div>
            <span class="firm-code">${firm.firmCode}</span>
          </div>
          ${pd !== undefined ? `
            <div class="risk-indicator">
              <span class="risk-dot ${riskLabel}"></span>
              <span class="badge badge-${riskLabel}">${riskLabel}</span>
            </div>
          ` : ''}
        </div>
        ${firm.industry ? `<div class="firm-industry">${firm.industry}</div>` : ''}
        <div class="firm-stats">
          <div class="firm-stat">
            <div class="firm-stat-value">${pd !== undefined ? utils.formatPercent(pd) : '-'}</div>
            <div class="firm-stat-label">Latest PD</div>
          </div>
          <div class="firm-stat">
            <div class="firm-stat-value">${utils.formatDate(firm.createdAt)}</div>
            <div class="firm-stat-label">Created</div>
          </div>
        </div>
      </div>
    `;
  },

  // Render prediction row
  predictionRow(prediction) {
    return `
      <tr>
        <td>${utils.formatDateTime(prediction.createdAt)}</td>
        <td>
          <span class="pd-value ${prediction.riskLabel}" style="font-size: 18px;">
            ${utils.formatPercent(prediction.pd)}
          </span>
        </td>
        <td>
          <span class="badge badge-${prediction.riskLabel}">${prediction.riskLabel}</span>
        </td>
        <td>${prediction.modelUsed}</td>
        <td>${prediction.createdBy?.fullName || '-'}</td>
        <td>
          <button class="btn btn-secondary" onclick="viewPrediction('${prediction._id}')">
            View
          </button>
        </td>
      </tr>
    `;
  },

  // Render strategy card
  strategyCard(strategy) {
    return `
      <div class="strategy-card">
        <div class="strategy-header">
          <span class="strategy-rank">${strategy.rank}</span>
          <span class="strategy-rces">RCES: <span>${strategy.rces.toFixed(4)}</span></span>
        </div>
        <div class="strategy-changes">
          <div class="strategy-change">
            <div class="strategy-change-label">Cash</div>
            <div class="strategy-change-value">${utils.formatCurrency(strategy.features.cash)}</div>
          </div>
          <div class="strategy-change">
            <div class="strategy-change-label">Debt</div>
            <div class="strategy-change-value">${utils.formatCurrency(strategy.features.debt)}</div>
          </div>
          <div class="strategy-change">
            <div class="strategy-change-label">Inventory</div>
            <div class="strategy-change-value">${utils.formatCurrency(strategy.features.inventory)}</div>
          </div>
        </div>
        <div class="strategy-footer">
          <span class="strategy-pd">New PD: ${utils.formatPercent(strategy.pd_new)}</span>
          <span class="strategy-cost">Cost: ${utils.formatCurrency(strategy.cost)}</span>
        </div>
      </div>
    `;
  },

  // Render user row for admin
  userRow(user) {
    return `
      <tr>
        <td>${user.fullName}</td>
        <td>${user.email}</td>
        <td><span class="badge badge-${user.role}">${user.role}</span></td>
        <td>
          <span class="badge ${user.isActive ? 'badge-low' : 'badge-critical'}">
            ${user.isActive ? 'Active' : 'Inactive'}
          </span>
        </td>
        <td>${utils.formatDateTime(user.lastLogin)}</td>
        <td>
          <div class="action-buttons">
            <button class="btn-icon" onclick="editUserRole('${user._id}', '${user.role}')" title="Edit Role">
              ✏️
            </button>
            ${user.isActive ? `
              <button class="btn-icon" onclick="deactivateUser('${user._id}')" title="Deactivate">
                🚫
              </button>
            ` : ''}
          </div>
        </td>
      </tr>
    `;
  },

  // Render audit log row
  auditLogRow(log) {
    return `
      <tr>
        <td>${utils.formatDateTime(log.createdAt)}</td>
        <td>${log.userId?.fullName || 'System'}</td>
        <td><span class="badge">${log.action}</span></td>
        <td>${log.resource}</td>
        <td>
          <span class="badge ${log.status === 'success' ? 'badge-low' : 'badge-critical'}">
            ${log.status}
          </span>
        </td>
        <td>${log.ipAddress || '-'}</td>
      </tr>
    `;
  },

  // Render pagination
  pagination(current, total, onPageChange) {
    if (total <= 1) return '';
    
    let html = '<div class="pagination">';
    
    // Previous button
    html += `<button ${current === 1 ? 'disabled' : ''} 
              onclick="${onPageChange}(${current - 1})">←</button>`;
    
    // Page numbers
    for (let i = 1; i <= total; i++) {
      if (i === 1 || i === total || (i >= current - 1 && i <= current + 1)) {
        html += `<button class="${i === current ? 'active' : ''}" 
                  onclick="${onPageChange}(${i})">${i}</button>`;
      } else if (i === current - 2 || i === current + 2) {
        html += '<span>...</span>';
      }
    }
    
    // Next button
    html += `<button ${current === total ? 'disabled' : ''} 
              onclick="${onPageChange}(${current + 1})">→</button>`;
    
    html += '</div>';
    return html;
  },

  // Modal functions
  showModal(id) {
    const modal = document.getElementById(id);
    if (modal) modal.style.display = 'flex';
  },

  hideModal(id) {
    const modal = document.getElementById(id);
    if (modal) modal.style.display = 'none';
  },

  // Confirm dialog
  async confirm(message) {
    return window.confirm(message);
  },

  // Form helpers
  getFormData(formId) {
    const form = document.getElementById(formId);
    if (!form) return {};
    
    const formData = new FormData(form);
    const data = {};
    for (const [key, value] of formData) {
      data[key] = value;
    }
    return data;
  },

  // Disable/enable form
  setFormLoading(formId, loading) {
    const form = document.getElementById(formId);
    if (!form) return;

    const submitBtn = form.querySelector('button[type="submit"]');
    const inputs = form.querySelectorAll('input, select, textarea');

    if (loading) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span class="spinner" style="width:16px;height:16px;"></span> Loading...';
      inputs.forEach(i => i.disabled = true);
    } else {
      submitBtn.disabled = false;
      submitBtn.innerHTML = submitBtn.dataset.originalText || 'Submit';
      inputs.forEach(i => i.disabled = false);
    }
  }
};

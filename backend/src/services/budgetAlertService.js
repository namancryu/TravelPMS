/**
 * Budget Alert Service
 * 예산 임계값 체크 및 알림 생성
 */

/**
 * 예산 사용률 계산
 * @param {number} spent - 사용한 금액
 * @param {number} allocated - 배정된 예산
 * @returns {number} - 사용률 (0-100)
 */
function calculateUsageRate(spent, allocated) {
  if (!allocated || allocated === 0) return 0;
  return Math.round((spent / allocated) * 100);
}

/**
 * 알림 레벨 결정
 * @param {number} usageRate - 사용률
 * @returns {string} - 'safe' | 'warning' | 'danger' | 'over'
 */
function getAlertLevel(usageRate) {
  if (usageRate >= 100) return 'over';
  if (usageRate >= 80) return 'danger';
  if (usageRate >= 60) return 'warning';
  return 'safe';
}

/**
 * 알림 메시지 생성
 * @param {string} category - 카테고리
 * @param {number} usageRate - 사용률
 * @param {number} spent - 사용 금액
 * @param {number} allocated - 배정 예산
 * @param {number} remaining - 남은 예산
 * @returns {string} - 알림 메시지
 */
function generateAlertMessage(category, usageRate, spent, allocated, remaining) {
  const categoryNames = {
    accommodation: '숙소',
    food: '식비',
    activities: '활동',
    transportation: '교통',
    shopping: '쇼핑',
    other: '기타'
  };

  const categoryName = categoryNames[category] || category;

  if (usageRate >= 100) {
    const over = spent - allocated;
    return `⛔ ${categoryName} 예산을 ${over.toLocaleString()}원 초과했습니다! (${usageRate}% 사용)`;
  }

  if (usageRate >= 80) {
    return `⚠️ ${categoryName} 예산의 ${usageRate}%를 사용했습니다. 남은 예산: ${remaining.toLocaleString()}원`;
  }

  if (usageRate >= 60) {
    return `📊 ${categoryName} 예산의 ${usageRate}%를 사용 중입니다. 남은 예산: ${remaining.toLocaleString()}원`;
  }

  return `✅ ${categoryName} 예산 사용이 안정적입니다. (${usageRate}% 사용)`;
}

/**
 * 카테고리별 예산 알림 체크
 * @param {Object} category - 카테고리 예산 정보
 * @param {string} categoryName - 카테고리 이름
 * @returns {Object|null} - 알림 객체 또는 null
 */
function checkCategoryAlert(category, categoryName) {
  const spent = category.spent || 0;
  const allocated = category.allocated || 0;

  if (allocated === 0) return null;

  const usageRate = calculateUsageRate(spent, allocated);
  const remaining = allocated - spent;
  const level = getAlertLevel(usageRate);

  // safe 레벨은 알림 생성 안 함
  if (level === 'safe') return null;

  return {
    category: categoryName,
    level,
    usageRate,
    spent,
    allocated,
    remaining,
    message: generateAlertMessage(categoryName, usageRate, spent, allocated, remaining),
    timestamp: new Date().toISOString()
  };
}

/**
 * 프로젝트 전체 예산 알림 생성
 * @param {Object} project - 프로젝트 객체
 * @returns {Object} - 알림 정보
 */
function generateBudgetAlerts(project) {
  const alerts = [];
  const budget = project.budget;

  if (!budget) {
    return {
      projectId: project.id,
      projectTitle: project.title,
      alerts: [],
      summary: {
        total: 0,
        danger: 0,
        warning: 0,
        safe: 0
      }
    };
  }

  // 카테고리별 알림 체크
  if (budget.categories) {
    Object.keys(budget.categories).forEach(categoryName => {
      const category = budget.categories[categoryName];
      const alert = checkCategoryAlert(category, categoryName);
      if (alert) {
        alerts.push(alert);
      }
    });
  }

  // 전체 예산 체크
  const totalSpent = budget.spent || 0;
  const totalAllocated = budget.total || 0;

  if (totalAllocated > 0) {
    const totalUsageRate = calculateUsageRate(totalSpent, totalAllocated);
    const totalRemaining = totalAllocated - totalSpent;
    const totalLevel = getAlertLevel(totalUsageRate);

    if (totalLevel !== 'safe') {
      alerts.unshift({
        category: 'total',
        level: totalLevel,
        usageRate: totalUsageRate,
        spent: totalSpent,
        allocated: totalAllocated,
        remaining: totalRemaining,
        message: generateAlertMessage('전체 예산', totalUsageRate, totalSpent, totalAllocated, totalRemaining),
        timestamp: new Date().toISOString(),
        isPrimary: true
      });
    }
  }

  // 알림 우선순위 정렬 (over > danger > warning)
  alerts.sort((a, b) => {
    const levelOrder = { over: 0, danger: 1, warning: 2 };
    return levelOrder[a.level] - levelOrder[b.level];
  });

  // 요약 정보
  const summary = {
    total: alerts.length,
    over: alerts.filter(a => a.level === 'over').length,
    danger: alerts.filter(a => a.level === 'danger').length,
    warning: alerts.filter(a => a.level === 'warning').length,
    totalSpent,
    totalAllocated,
    totalRemaining: totalAllocated - totalSpent,
    totalUsageRate: calculateUsageRate(totalSpent, totalAllocated)
  };

  return {
    projectId: project.id,
    projectTitle: project.title,
    alerts,
    summary,
    hasAlerts: alerts.length > 0,
    hasCriticalAlerts: summary.over > 0 || summary.danger > 0,
    generatedAt: new Date().toISOString()
  };
}

/**
 * 예산 상태 평가
 * @param {Object} project - 프로젝트 객체
 * @returns {string} - 'healthy' | 'caution' | 'critical' | 'over'
 */
function evaluateBudgetHealth(project) {
  const budget = project.budget;
  if (!budget) return 'healthy';

  const totalSpent = budget.spent || 0;
  const totalAllocated = budget.total || 0;
  const usageRate = calculateUsageRate(totalSpent, totalAllocated);

  if (usageRate >= 100) return 'over';
  if (usageRate >= 80) return 'critical';
  if (usageRate >= 60) return 'caution';
  return 'healthy';
}

/**
 * 예산 추천 메시지 생성
 * @param {Object} alertsData - 알림 데이터
 * @returns {Array<string>} - 추천 메시지 배열
 */
function generateRecommendations(alertsData) {
  const recommendations = [];
  const { alerts, summary } = alertsData;

  // 초과한 카테고리가 있는 경우
  const overCategories = alerts.filter(a => a.level === 'over' && a.category !== 'total');
  if (overCategories.length > 0) {
    recommendations.push('💡 예산을 초과한 카테고리의 지출을 재검토하고, 다른 카테고리에서 예산을 재배분하는 것을 고려하세요.');
  }

  // 위험 단계 카테고리가 있는 경우
  const dangerCategories = alerts.filter(a => a.level === 'danger' && a.category !== 'total');
  if (dangerCategories.length > 0) {
    recommendations.push('⚠️ 위험 단계의 카테고리는 남은 일정 동안 지출을 최소화해야 합니다.');
  }

  // 전체 예산 사용률이 높은 경우
  if (summary.totalUsageRate >= 80) {
    recommendations.push('📉 전체 예산 사용률이 높습니다. 필수 지출만 진행하고, 선택적 활동은 재고하세요.');
  }

  // 여러 카테고리에서 경고가 있는 경우
  if (alerts.length >= 3) {
    recommendations.push('🔄 여러 카테고리에서 예산 압박이 있습니다. 전체 예산 계획을 재조정하는 것을 권장합니다.');
  }

  // 알림이 없는 경우
  if (alerts.length === 0) {
    recommendations.push('✨ 예산 관리가 잘 되고 있습니다! 이대로 유지하세요.');
  }

  return recommendations;
}

module.exports = {
  calculateUsageRate,
  getAlertLevel,
  generateAlertMessage,
  checkCategoryAlert,
  generateBudgetAlerts,
  evaluateBudgetHealth,
  generateRecommendations
};

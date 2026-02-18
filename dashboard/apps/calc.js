export function setupCalcApp() {
  const exprEl = document.getElementById('calcExpression');
  const resultEl = document.getElementById('calcResult');
  const historyEl = document.getElementById('calcHistory');
  const buttons = document.querySelectorAll('.calc-buttons button');
  if (!exprEl || !resultEl || !historyEl || !buttons.length) return null;

  let expression = '';
  const history = [];

  const renderHistory = () => {
    historyEl.innerHTML = '';
    if (history.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'calc-history__empty';
      empty.textContent = 'No calculations yet';
      historyEl.appendChild(empty);
      return;
    }

    history.slice(-6).reverse().forEach((item) => {
      const row = document.createElement('div');
      row.className = 'calc-history__item';
      const expr = document.createElement('span');
      expr.textContent = item.expr;
      const result = document.createElement('strong');
      result.textContent = item.result;
      row.appendChild(expr);
      row.appendChild(result);
      historyEl.appendChild(row);
    });
  };

  const updateDisplay = (expr, res) => {
    exprEl.textContent = expr || '0';
    resultEl.textContent = res ?? '0';
  };

  const evaluateExpression = () => {
    if (!expression) return null;
    try {
      const sanitized = expression.replace(/[^0-9+\-*/.() ]/g, '');
      const value = Function(`"use strict"; return (${sanitized})`)();
      if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
      }
    } catch {
      return null;
    }
    return null;
  };

  const addToHistory = (expr, res) => {
    history.push({ expr, result: res });
    renderHistory();
  };

  const appendValue = (val) => {
    expression += val;
    const preview = evaluateExpression();
    updateDisplay(expression, preview !== null ? preview : '...');
  };

  const clearAll = () => {
    expression = '';
    updateDisplay('0', '0');
  };

  const backspace = () => {
    expression = expression.slice(0, -1);
    const preview = evaluateExpression();
    updateDisplay(expression || '0', preview !== null ? preview : '0');
  };

  const calculate = () => {
    const result = evaluateExpression();
    if (result === null) {
      updateDisplay('Error', '0');
      expression = '';
      return;
    }
    addToHistory(expression, result);
    expression = result.toString();
    updateDisplay(expression, result);
  };

  buttons.forEach((button) => {
    const val = button.dataset.value;
    const action = button.dataset.action;
    button.addEventListener('click', () => {
      if (action === 'clear') return clearAll();
      if (action === 'backspace') return backspace();
      if (action === 'equals') return calculate();
      if (val) appendValue(val);
    });
  });

  const handleKeyDown = (e) => {
    const key = e.key;
    const allowed = '0123456789.+-*/()';
    if (allowed.includes(key)) {
      appendValue(key);
    } else if (key === 'Enter' || key === '=') {
      e.preventDefault();
      calculate();
    } else if (key === 'Backspace') {
      backspace();
    } else if (key === 'Escape') {
      clearAll();
    }
  };

  window.addEventListener('keydown', handleKeyDown);
  updateDisplay('0', '0');
  renderHistory();

  return () => window.removeEventListener('keydown', handleKeyDown);
}

export function renderLoginPageMarkup(props) {
  return `
    <main class="page page--centered">
      <section class="panel auth-panel">
        <div class="panel__header">
          <p class="eyebrow">Legend Review</p>
          <h1>人工审核后台</h1>
          <p class="muted">请输入管理员密码后进入投稿审核列表。</p>
        </div>
        <form class="auth-form" id="login-form">
          <label class="field">
            <span class="field__label">管理员密码</span>
            <input
              class="text-input"
              id="admin-secret-input"
              type="password"
              name="secret"
              autocomplete="current-password"
              placeholder="请输入管理员密码"
              ${props.loading ? 'disabled' : ''}
            />
          </label>
          <button class="primary-button" type="submit" ${props.loading ? 'disabled' : ''}>
            ${props.loading ? '登录中...' : '登录'}
          </button>
          <p class="form-error">${props.errorMessage || ''}</p>
        </form>
      </section>
    </main>
  `;
}

export function renderLoginPage(container, props) {
  container.innerHTML = renderLoginPageMarkup(props);

  const formElement = container.querySelector('#login-form');
  const inputElement = container.querySelector('#admin-secret-input');

  if (inputElement) {
    inputElement.focus();
  }

  if (formElement) {
    formElement.addEventListener('submit', function handleSubmit(event) {
      event.preventDefault();

      if (props.loading) {
        return;
      }

      const secret = inputElement ? inputElement.value : '';
      props.onLogin(secret);
    });
  }
}

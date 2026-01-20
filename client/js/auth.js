/*
  Arquivo: auth.js
  Responsável por: gerenciar a experiência de autenticação no frontend.
  Aqui entra tudo relacionado com: controle do modal de login/cadastro (abrir/fechar, abas),
  manipulação do DOM dos formulários, validações client-side em tempo real, micro-interações
  (feedback de erro/sucesso, loaders, animações), toggles de visibilidade de senha, e chamadas
  HTTP (`fetch`) para os endpoints de autenticação do backend (`/api/auth/login`, `/api/auth/register`, `/api/auth/verify`).
  Também gerencia o armazenamento do token no `localStorage` e expõe métodos utilitários (ex.: `logout`).
  Deve permanecer focado em UI e comunicação com a API; regras de negócio e persistência ficam no backend.
*/

// ========================================
// SISTEMA DE AUTENTICAÇÃO
// ========================================

class AuthSystem {
  constructor() {
    this.API_BASE_URL = 'http://localhost:3000/api/auth';
    this.modal = document.getElementById('auth-modal');
    this.loginForm = document.getElementById('login-form');
    this.registerForm = document.getElementById('register-form');
    this.loginTab = document.getElementById('login-tab');
    this.registerTab = document.getElementById('register-tab');
    this.loginPanel = document.getElementById('login-panel');
    this.registerPanel = document.getElementById('register-panel');
    
    this.init();
  }

  init() {
    // Verificar se o usuário já está autenticado
    this.checkAuth();

    // Event listeners
    this.setupEventListeners();

    // Inicializar ícones do Lucide
    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }

    // ensure traffic notice exists and show it immediately
    this.ensureTrafficNotice();
    this.showTrafficNotice();
  }

  ensureTrafficNotice() {
    if (document.getElementById('traffic-notice')) return;
    const notice = document.createElement('div');
    notice.id = 'traffic-notice';
    notice.className = 'traffic-notice';
    notice.setAttribute('role', 'status');
    notice.setAttribute('aria-live', 'polite');
    notice.innerHTML = `<span class="traffic-notice__icon" aria-hidden="true">⚠️</span><span class="traffic-notice__text">Estamos com alto tráfego: aguarde até 10 segundos após clicar em <strong>Entrar</strong> ou <strong>criar cadastro</strong>.</span>`;
    document.body.appendChild(notice);
  }

  showTrafficNotice() {
    const n = document.getElementById('traffic-notice');
    if (!n) return;
    n.classList.remove('hidden');
    // retrigger entry animation
    n.classList.remove('enter');
    // force reflow
    // eslint-disable-next-line no-unused-expressions
    n.offsetWidth;
    n.classList.add('enter');
    const onEnd = (ev) => {
      if (ev.target !== n) return;
      n.removeEventListener('animationend', onEnd);
      n.classList.remove('enter');
    };
    n.addEventListener('animationend', onEnd);
  }

  hideTrafficNotice() {
    const n = document.getElementById('traffic-notice');
    if (n) n.classList.add('hidden');
  }

  setupEventListeners() {
    // Tabs
    this.loginTab?.addEventListener('click', () => this.switchTab('login'));
    this.registerTab?.addEventListener('click', () => this.switchTab('register'));

    // Forms
    this.loginForm?.addEventListener('submit', (e) => this.handleLogin(e));
    this.registerForm?.addEventListener('submit', (e) => this.handleRegister(e));

    // Password toggles
    document.querySelectorAll('.password-toggle').forEach(toggle => {
      toggle.addEventListener('click', (e) => this.togglePasswordVisibility(e));
    });

    // Validação em tempo real
    this.setupRealTimeValidation();

    // Fechar modal ao clicar no overlay
    const overlay = document.querySelector('.auth-modal__overlay');
    // NÃO permitir fechar o modal clicando fora; mostrar aviso solicitando login/cadastro
    overlay?.addEventListener('click', (e) => {
      e.stopPropagation();
      const activeForm = this.registerPanel.classList.contains('auth-panel--active') ? 'register' : 'login';
      this.showMessage(activeForm, 'Por favor, conclua o login ou cadastro para acessar a plataforma.', 'error');
    });
  }

  setupRealTimeValidation() {
    // Email validation
    const emailInput = document.getElementById('register-email');
    emailInput?.addEventListener('blur', (e) => {
      const email = e.target.value;
      const errorElement = document.getElementById('register-email-error');
      
      if (email && !this.validateEmail(email)) {
        this.showFieldError(e.target, errorElement, 'Email inválido');
      } else {
        this.clearFieldError(e.target, errorElement);
      }
    });

    // Username validation
    const usernameInput = document.getElementById('register-username');
    usernameInput?.addEventListener('blur', (e) => {
      const username = e.target.value;
      const errorElement = document.getElementById('register-username-error');
      
      if (username && (username.length < 3 || username.length > 30)) {
        this.showFieldError(e.target, errorElement, 'Nome de usuário deve ter entre 3 e 30 caracteres');
      } else {
        this.clearFieldError(e.target, errorElement);
      }
    });

    // Password confirmation
    const confirmPasswordInput = document.getElementById('register-confirm-password');
    confirmPasswordInput?.addEventListener('input', (e) => {
      const password = document.getElementById('register-password').value;
      const confirmPassword = e.target.value;
      const errorElement = document.getElementById('register-confirm-password-error');
      
      if (confirmPassword && password !== confirmPassword) {
        this.showFieldError(e.target, errorElement, 'As senhas não coincidem');
      } else {
        this.clearFieldError(e.target, errorElement);
      }
    });
  }

  async checkAuth() {
    const token = localStorage.getItem('token');
    
    if (token) {
      try {
        const response = await fetch(`${this.API_BASE_URL}/verify`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (response.ok) {
          // Usuário autenticado, não mostrar modal
          // garantir que a notificação de tráfego seja escondida
          try { this.hideTrafficNotice(); } catch (e) { /* noop */ }
          this.closeModal();
          return true;
        } else {
          // Token inválido, limpar e mostrar modal
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          this.showModal();
          return false;
        }
      } catch (error) {
        console.error('Erro ao verificar autenticação:', error);
        this.showModal();
        return false;
      }
    } else {
      // Sem token, mostrar modal
      this.showModal();
      return false;
    }
  }

  showModal() {
    this.modal?.classList.add('active');
    document.body.style.overflow = 'hidden';

    // ensure traffic notice visible when modal opens
    try { this.showTrafficNotice(); } catch (e) { /* noop */ }

    // Focus no primeiro input
    setTimeout(() => {
      const firstInput = this.loginPanel.querySelector('input');
      firstInput?.focus();
    }, 300);
  }

  closeModal() {
    this.modal?.classList.remove('active');
    document.body.style.overflow = '';
  }

  switchTab(tab) {
    if (tab === 'login') {
      // Ativar aba de login
      this.loginTab.classList.add('auth-tab--active');
      this.registerTab.classList.remove('auth-tab--active');
      this.loginTab.setAttribute('aria-selected', 'true');
      this.registerTab.setAttribute('aria-selected', 'false');
      
      // Mostrar painel de login
      this.loginPanel.classList.add('auth-panel--active');
      this.registerPanel.classList.remove('auth-panel--active');
      this.loginPanel.removeAttribute('hidden');
      this.registerPanel.setAttribute('hidden', '');
      
      // Focus no primeiro input
      const firstInput = this.loginPanel.querySelector('input');
      firstInput?.focus();
    } else {
      // Ativar aba de cadastro
      this.registerTab.classList.add('auth-tab--active');
      this.loginTab.classList.remove('auth-tab--active');
      this.registerTab.setAttribute('aria-selected', 'true');
      this.loginTab.setAttribute('aria-selected', 'false');
      
      // Mostrar painel de cadastro
      this.registerPanel.classList.add('auth-panel--active');
      this.loginPanel.classList.remove('auth-panel--active');
      this.registerPanel.removeAttribute('hidden');
      this.loginPanel.setAttribute('hidden', '');
      
      // Focus no primeiro input
      const firstInput = this.registerPanel.querySelector('input');
      firstInput?.focus();
    }

    // Reinicializar ícones do Lucide
    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }
  }

  async handleLogin(e) {
    e.preventDefault();
    
    const formData = new FormData(this.loginForm);
    const data = {
      usernameOrEmail: formData.get('usernameOrEmail'),
      password: formData.get('password')
    };

    // Validação básica
    if (!data.usernameOrEmail || !data.password) {
      this.showMessage('login', 'Preencha todos os campos', 'error');
      return;
    }

    // Mostrar loading
    this.setLoadingState(this.loginForm, true);

    try {
      const response = await fetch(`${this.API_BASE_URL}/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });

      const result = await response.json();

      if (response.ok && result.success) {
        // Salvar token e user (compatível com dataService.js)
        localStorage.setItem('token', result.data.token);
        localStorage.setItem('user', JSON.stringify(result.data.user));
        localStorage.setItem('userName', result.data.user.username);
        
        // Mostrar sucesso
        this.showMessage('login', 'Login realizado com sucesso!', 'success');
        // hide traffic notice now that login succeeded
        this.hideTrafficNotice();
        
        // Fechar modal após 1 segundo
        setTimeout(() => {
          this.closeModal();
          this.loginForm.reset();
          // Recarregar página para aplicar autenticação
          window.location.reload();
        }, 1000);
      } else {
        this.showMessage('login', result.message || 'Erro ao fazer login', 'error');
      }
    } catch (error) {
      console.error('Erro ao fazer login:', error);
      this.showMessage('login', 'Erro de conexão. Verifique se o servidor está rodando.', 'error');
    } finally {
      this.setLoadingState(this.loginForm, false);
    }
  }

  async handleRegister(e) {
    e.preventDefault();
    
    const formData = new FormData(this.registerForm);
    const data = {
      username: formData.get('username'),
      email: formData.get('email'),
      password: formData.get('password'),
      confirmPassword: formData.get('confirmPassword')
    };

    // Validação básica
    if (!data.username || !data.email || !data.password || !data.confirmPassword) {
      this.showMessage('register', 'Preencha todos os campos', 'error');
      return;
    }

    if (!this.validateEmail(data.email)) {
      this.showMessage('register', 'Email inválido', 'error');
      return;
    }

    if (data.password !== data.confirmPassword) {
      this.showMessage('register', 'As senhas não coincidem', 'error');
      return;
    }

    if (data.password.length < 6) {
      this.showMessage('register', 'A senha deve ter no mínimo 6 caracteres', 'error');
      return;
    }

    // Mostrar loading
    this.setLoadingState(this.registerForm, true);

    try {
      const response = await fetch(`${this.API_BASE_URL}/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });

      const result = await response.json();

      if (response.ok && result.success) {
        // Salvar token e user (compatível com dataService.js)
        localStorage.setItem('token', result.data.token);
        localStorage.setItem('user', JSON.stringify(result.data.user));
        localStorage.setItem('userName', result.data.user.username);
        
        // Mostrar sucesso
        this.showMessage('register', 'Conta criada com sucesso!', 'success');
        // hide traffic notice now that registration succeeded
        this.hideTrafficNotice();
        
        // Fechar modal após 1 segundo
        setTimeout(() => {
          this.closeModal();
          this.registerForm.reset();
          // Recarregar página para aplicar autenticação
          window.location.reload();
        }, 1000);
      } else {
        this.showMessage('register', result.message || 'Erro ao criar conta', 'error');
      }
    } catch (error) {
      console.error('Erro ao criar conta:', error);
      this.showMessage('register', 'Erro de conexão. Verifique se o servidor está rodando.', 'error');
    } finally {
      this.setLoadingState(this.registerForm, false);
    }
  }

  togglePasswordVisibility(e) {
    const button = e.currentTarget;
    const targetId = button.getAttribute('data-target');
    const input = document.getElementById(targetId);
    const icon = button.querySelector('.password-toggle-icon');

    if (input.type === 'password') {
      input.type = 'text';
      button.setAttribute('aria-label', 'Ocultar senha');
      icon.setAttribute('data-lucide', 'eye-off');
    } else {
      input.type = 'password';
      button.setAttribute('aria-label', 'Mostrar senha');
      icon.setAttribute('data-lucide', 'eye');
    }

    // Reinicializar ícone
    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }
  }

  showMessage(form, message, type) {
    const messageElement = document.getElementById(`${form}-message`);
    
    messageElement.textContent = message;
    messageElement.className = `form-message ${type} show`;

    // Esconder após 5 segundos
    setTimeout(() => {
      messageElement.classList.remove('show');
    }, 5000);
  }

  showFieldError(input, errorElement, message) {
    input.classList.add('error');
    errorElement.textContent = message;
  }

  clearFieldError(input, errorElement) {
    input.classList.remove('error');
    errorElement.textContent = '';
  }

  setLoadingState(form, isLoading) {
    const submitBtn = form.querySelector('.auth-submit-btn');
    const submitText = submitBtn.querySelector('.auth-submit-text');
    const loader = submitBtn.querySelector('.auth-submit-loader');
    const inputs = form.querySelectorAll('input');

    if (isLoading) {
      submitBtn.disabled = true;
      submitText.style.opacity = '0';
      loader.removeAttribute('hidden');
      inputs.forEach(input => input.disabled = true);
    } else {
      submitBtn.disabled = false;
      submitText.style.opacity = '1';
      loader.setAttribute('hidden', '');
      inputs.forEach(input => input.disabled = false);
    }
  }

  validateEmail(email) {
    const emailRegex = /^\S+@\S+\.\S+$/;
    return emailRegex.test(email);
  }

  // Método para logout
  logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('userName');
    this.showModal();
    window.location.reload();
  }
}

// Inicializar sistema de autenticação quando o DOM estiver pronto
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.authSystem = new AuthSystem();
  });
} else {
  window.authSystem = new AuthSystem();
}

// Exportar para uso em outros módulos
export default AuthSystem;

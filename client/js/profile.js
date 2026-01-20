// Profile page interactions: avatar upload, about save, change password, support and cancel subscription

const $ = (s) => document.querySelector(s);

/**
 * Shows a toast notification
 * @param {string} message - Message to display
 * @param {string} type - 'success', 'error', or 'info'
 */
function showToast(message, type = 'info') {
    const existingToast = document.querySelector('.toast-notification');
    if (existingToast) existingToast.remove();

    const toast = document.createElement('div');
    toast.className = `toast-notification toast-${type}`;
    toast.textContent = message;
    toast.setAttribute('role', 'alert');
    toast.setAttribute('aria-live', 'polite');
    
    document.body.appendChild(toast);
    
    // Trigger animation
    requestAnimationFrame(() => {
        toast.classList.add('show');
    });
    
    // Remove after 3 seconds
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

/**
 * Validates password strength
 * @param {string} password - Password to validate
 * @returns {object} {valid: boolean, message: string}
 */
function validatePassword(password) {
    if (!password || password.length < 8) {
        return { valid: false, message: 'A senha deve ter pelo menos 8 caracteres.' };
    }
    
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);
    
    if (!hasUpperCase || !hasLowerCase || !hasNumbers) {
        return { 
            valid: false, 
            message: 'A senha deve conter maiúsculas, minúsculas e números.' 
        };
    }
    
    return { valid: true, message: 'Senha válida' };
}

/**
 * Safely parses and validates profile data from localStorage
 * @param {string} raw - Raw JSON string
 * @returns {object|null} Parsed and validated data or null
 */
function safeParseProfileData(raw) {
    if (!raw) return null;
    
    try {
        const data = JSON.parse(raw);
        
        // Validate data structure
        if (typeof data !== 'object' || data === null) {
            console.warn('[Profile] Invalid data structure');
            return null;
        }
        
        return data;
    } catch (error) {
        console.error('[Profile] JSON parse error:', error);
        return null;
    }
}

/**
 * Safely saves to localStorage with error handling
 * @param {string} key - Storage key
 * @param {*} value - Value to store
 * @returns {boolean} Success status
 */
function safeSaveToStorage(key, value) {
    try {
        const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
        localStorage.setItem(key, stringValue);
        return true;
    } catch (error) {
        console.error('[Profile] Storage error:', error);
        
        if (error.name === 'QuotaExceededError') {
            showToast('Espaço de armazenamento cheio. Limpe dados antigos.', 'error');
        } else {
            showToast('Erro ao salvar dados. Tente novamente.', 'error');
        }
        
        return false;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const avatarInput = $('#avatar-input');
    const avatarImg = $('#profile-avatar');
    const aboutForm = $('#about-form');
    const aboutName = $('#about-name');
    const aboutAge = $('#about-age');
    const aboutProfession = $('#about-profession');
    const aboutHasChildren = $('#about-has-children');
    const aboutChildrenCount = $('#about-children-count');
    const aboutMarital = $('#about-marital');
    const aboutDescription = $('#about-description');
    const saveAboutBtn = $('#save-about');
    const changePasswordForm = $('#change-password-form');
    const cancelBtn = $('#cancel-subscription');

    // Load saved profile data and avatar (localStorage)
    try{
        const raw = localStorage.getItem('profile:data');
        const data = safeParseProfileData(raw);

        if(data) {
            if(aboutName) aboutName.value = data.name || '';
            if(aboutAge) aboutAge.value = data.age || '';
            if(aboutProfession) aboutProfession.value = data.profession || '';
            if(aboutHasChildren) aboutHasChildren.checked = !!data.hasChildren;
            if(aboutChildrenCount) {
                aboutChildrenCount.value = data.childrenCount || 0;
                aboutChildrenCount.disabled = !data.hasChildren;
            }
            if(aboutMarital) aboutMarital.value = data.maritalStatus || 'solteiro';
            if(aboutDescription) aboutDescription.value = data.description || '';

            // update profile card
            if(data.name) $('#profile-name').textContent = data.name;
            if(data.age) $('#profile-age').textContent = (data.age ? data.age + ' anos' : '');
            if(data.profession) $('#profile-profession').textContent = data.profession;
        } else {
            // backwards compatibility: single about text
            const savedAbout = localStorage.getItem('profile:about');
            if(savedAbout && aboutDescription) aboutDescription.value = savedAbout;
        }

        const savedAvatar = localStorage.getItem('profile:avatar');
        if(savedAvatar && avatarImg) avatarImg.src = savedAvatar;
    }catch(e){ 
        console.error('[Profile] Load error:', e);
        showToast('Erro ao carregar dados do perfil.', 'error');
    }

    // Avatar preview & persist to localStorage
    if(avatarInput && avatarImg){
        avatarInput.addEventListener('change', (e) => {
            const file = e.target.files && e.target.files[0];
            if(!file) return;
            
            // Validate file type
            if (!file.type.startsWith('image/')) {
                showToast('Por favor, selecione um arquivo de imagem válido.', 'error');
                return;
            }
            
            // Validate file size (max 2MB)
            if (file.size > 2 * 1024 * 1024) {
                showToast('A imagem deve ter no máximo 2MB.', 'error');
                return;
            }
            
            const reader = new FileReader();
            reader.onload = () => {
                avatarImg.src = reader.result;
                if (safeSaveToStorage('profile:avatar', reader.result)) {
                    showToast('Avatar atualizado com sucesso!', 'success');
                }
            };
            reader.onerror = () => {
                showToast('Erro ao ler o arquivo de imagem.', 'error');
            };
            reader.readAsDataURL(file);
        });
    }

    // Save about / profile data
    if(saveAboutBtn){
        saveAboutBtn.addEventListener('click', () => {
            try{
                const profileData = {
                    name: aboutName ? aboutName.value.trim() : '',
                    age: aboutAge ? (aboutAge.value ? Number(aboutAge.value) : '') : '',
                    profession: aboutProfession ? aboutProfession.value.trim() : '',
                    hasChildren: aboutHasChildren ? aboutHasChildren.checked : false,
                    childrenCount: aboutChildrenCount ? (aboutChildrenCount.value ? Number(aboutChildrenCount.value) : 0) : 0,
                    maritalStatus: aboutMarital ? aboutMarital.value : 'solteiro',
                    description: aboutDescription ? aboutDescription.value.trim() : ''
                };

                if (safeSaveToStorage('profile:data', profileData)) {
                    // Update header card
                    if(profileData.name) $('#profile-name').textContent = profileData.name;
                    if(typeof profileData.age !== 'undefined') $('#profile-age').textContent = (profileData.age ? profileData.age + ' anos' : '');
                    if(profileData.profession) $('#profile-profession').textContent = profileData.profession;

                    saveAboutBtn.textContent = 'Salvo \u2713';
                    showToast('Perfil salvo com sucesso!', 'success');
                    setTimeout(()=> saveAboutBtn.textContent = 'Salvar', 1500);
                } else {
                    showToast('Erro ao salvar perfil. Tente novamente.', 'error');
                }
            }catch(e){ 
                console.error('[Profile] Save error:', e);
                showToast('Erro ao salvar perfil.', 'error');
            }
        });
    }

    // Change password (client-side validation only)
    if(changePasswordForm){
        changePasswordForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const current = $('#current-password').value || '';
            const next = $('#new-password').value || '';
            const confirm = $('#confirm-password').value || '';

            if(!current || !next){ 
                showToast('Preencha todos os campos de senha.', 'error');
                return; 
            }
            
            const validation = validatePassword(next);
            if(!validation.valid){ 
                showToast(validation.message, 'error');
                return; 
            }
            
            if(next !== confirm){ 
                showToast('A confirmação não coincide com a nova senha.', 'error');
                return; 
            }

            // Simulate change password success (real app should call API)
            showToast('Senha alterada com sucesso!', 'success');
            changePasswordForm.reset();
        });
    }

    // Cancel subscription - confirmation
    if(cancelBtn){
        cancelBtn.addEventListener('click', () => {
            const ok = confirm('Tem certeza que deseja cancelar sua assinatura? Esta ação pode ser irreversível.');
            if(!ok) return;
            // Simulate cancellation (real app should call API)
            showToast('Sua assinatura foi cancelada. Enviaremos um e-mail de confirmação.', 'info');
        });
    }

    // Toggle children count enabled/disabled
    if(aboutHasChildren && aboutChildrenCount){
        aboutHasChildren.addEventListener('change', () => {
            aboutChildrenCount.disabled = !aboutHasChildren.checked;
            if(!aboutHasChildren.checked) aboutChildrenCount.value = 0;
        });
    }
});

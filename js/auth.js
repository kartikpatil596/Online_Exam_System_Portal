/**
 * Authentication Module for Login, Registration, Logout & Protection logic.
 */

function getAuthToken() {
    return localStorage.getItem('access_token');
}

function getUserRole() {
    return localStorage.getItem('user_role');
}

function isAuthenticated() {
    return !!getAuthToken();
}

function getAppRootUrl() {
    const path = window.location.pathname;
    if (path.includes('/admin/') || path.includes('/student/') || path.includes('/exam/')) {
        return '../';
    }
    return './';
}

function logout() {
    localStorage.removeItem('access_token');
    localStorage.removeItem('user');
    localStorage.removeItem('user_role');
    window.location.href = getAppRootUrl() + 'login.html';
}

function redirectBasedOnRole(role) {
    const root = getAppRootUrl();
    if (role === 'admin' || role === 'instructor') {
        window.location.href = root + 'admin/dashboard.html';
    } else {
        window.location.href = root + 'student/dashboard.html';
    }
}

async function fetchCurrentUser() {
    if (!isAuthenticated()) return null;
    try {
        const data = await apiRequest('/auth/me', 'GET');
        return data.user;
    } catch (err) {
        logout();
        return null;
    }
}

function checkPageProtection(requiredRole = null) {
    const token = getAuthToken();
    const role = getUserRole();
    const currentPath = window.location.pathname;

    if (!token) {
        if (currentPath.includes('/admin/') || currentPath.includes('/student/') || currentPath.includes('/exam/')) {
            window.location.href = '/login.html';
        }
        return;
    }

    // Already logged in, redirect away from login/register pages
    if (currentPath.includes('login.html') || currentPath.includes('register.html')) {
        redirectBasedOnRole(role);
        return;
    }

    if (requiredRole && role !== requiredRole && role !== 'admin') {
        alert('Access Denied: You do not have permission to view this page.');
        redirectBasedOnRole(role);
    }
}

// Bind auth forms if present
document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const alertBox = document.getElementById('alertBox');

    function showAlert(message, type = 'error') {
        if (!alertBox) {
            alert(message);
            return;
        }
        alertBox.className = `alert alert-${type}`;
        alertBox.textContent = message;
        alertBox.style.display = 'block';
    }

    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = loginForm.username.value.trim();
            const password = loginForm.password.value;
            const submitBtn = loginForm.querySelector('button[type="submit"]');

            try {
                submitBtn.disabled = true;
                submitBtn.textContent = 'Signing in...';

                const response = await apiRequest('/auth/login', 'POST', { username, password });
                
                localStorage.setItem('access_token', response.access_token);
                localStorage.setItem('user', JSON.stringify(response.user));
                localStorage.setItem('user_role', response.user.role);

                redirectBasedOnRole(response.user.role);
            } catch (err) {
                showAlert(err.message, 'error');
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Sign In';
            }
        });
    }

    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = registerForm.username.value.trim();
            const email = registerForm.email.value.trim();
            const password = registerForm.password.value;
            const role = registerForm.role ? registerForm.role.value : 'student';
            const submitBtn = registerForm.querySelector('button[type="submit"]');

            try {
                submitBtn.disabled = true;
                submitBtn.textContent = 'Creating account...';

                await apiRequest('/auth/register', 'POST', { username, email, password, role });
                showAlert('Account created successfully! Redirecting to login...', 'success');

                setTimeout(() => {
                    window.location.href = 'login.html';
                }, 1500);
            } catch (err) {
                showAlert(err.message, 'error');
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Register';
            }
        });
    }
});

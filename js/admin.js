/**
 * Teacher & Admin Portal Management Controller with Excel/Word Exports & Notifications.
 */

let currentExamIdForExport = null;

document.addEventListener('DOMContentLoaded', () => {
    checkPageProtection('admin');
    
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    document.getElementById('adminName').textContent = user.username || 'Teacher/Admin';
    document.getElementById('adminEmail').textContent = user.email || '';

    loadOverviewStats();
});

function showAdminTab(tabName) {
    const tabs = ['overview', 'users', 'categories', 'questions', 'exams'];
    tabs.forEach(t => {
        const el = document.getElementById(`${t}Tab`);
        if (el) el.style.display = (t === tabName) ? 'block' : 'none';
    });

    const navItems = document.querySelectorAll('.nav-menu .nav-item');
    navItems.forEach(item => item.classList.remove('active'));
    
    const activeNav = Array.from(navItems).find(i => i.getAttribute('onclick').includes(tabName));
    if (activeNav) activeNav.classList.add('active');

    if (tabName === 'overview') loadOverviewStats();
    if (tabName === 'users') loadUsers();
    if (tabName === 'categories') loadCategories();
    if (tabName === 'questions') loadQuestions();
    if (tabName === 'exams') loadAdminExams();
}

async function loadOverviewStats() {
    try {
        const data = await apiRequest('/results/analytics', 'GET');
        document.getElementById('statStudents').textContent = data.total_students || 0;
        document.getElementById('statExams').textContent = data.total_exams || 0;
        document.getElementById('statQuestions').textContent = data.total_questions || 0;
        document.getElementById('statAttempts').textContent = data.total_attempts || 0;
    } catch (err) {
        console.error('Failed to load analytics:', err);
    }
}

async function loadUsers() {
    const search = document.getElementById('userSearch').value;
    const role = document.getElementById('userRoleFilter').value;
    const tbody = document.getElementById('usersTableBody');

    try {
        const data = await apiRequest(`/admin/users?search=${encodeURIComponent(search)}&role=${role}`, 'GET');
        const users = data.users || [];

        if (!users.length) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center">No users found.</td></tr>';
            return;
        }

        tbody.innerHTML = users.map(u => `
            <tr>
                <td>${u.id}</td>
                <td><strong>${u.username}</strong></td>
                <td>${u.email}</td>
                <td><span class="role-badge ${u.role}">${u.role}</span></td>
                <td><span class="badge ${u.is_active ? 'active' : 'inactive'}">${u.is_active ? 'Active' : 'Inactive'}</span></td>
                <td>
                    <button class="btn btn-sm btn-secondary" onclick="toggleUserStatus(${u.id}, ${!u.is_active})">
                        ${u.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="deleteUser(${u.id})">Delete</button>
                </td>
            </tr>
        `).join('');
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center text-danger">Error: ${err.message}</td></tr>`;
    }
}

async function toggleUserStatus(userId, newStatus) {
    try {
        await apiRequest(`/admin/users/${userId}`, 'PUT', { is_active: newStatus });
        loadUsers();
    } catch (err) {
        alert('Failed to update status: ' + err.message);
    }
}

async function deleteUser(userId) {
    if (!confirm('Are you sure you want to delete this user account?')) return;
    try {
        await apiRequest(`/admin/users/${userId}`, 'DELETE');
        loadUsers();
    } catch (err) {
        alert('Failed to delete user: ' + err.message);
    }
}

async function loadCategories() {
    const list = document.getElementById('categoriesList');
    try {
        const data = await apiRequest('/categories', 'GET');
        const categories = data.categories || [];

        if (!categories.length) {
            list.innerHTML = '<p class="empty-state">No categories found. Click "+ Add Category" to create one.</p>';
            return;
        }

        list.innerHTML = categories.map(c => `
            <div class="stat-card">
                <h3>Subject Category</h3>
                <h4 style="margin: 0.5rem 0; font-size: 1.15rem;">${c.name}</h4>
                <p style="font-size: 0.85rem; color: #64748b; margin-bottom: 1rem;">${c.description || 'No description'}</p>
                <div style="font-size: 0.85rem;">Questions: <strong>${c.question_count || 0}</strong></div>
            </div>
        `).join('');
    } catch (err) {
        list.innerHTML = `<p class="empty-state text-danger">Error: ${err.message}</p>`;
    }
}

async function openAddCategoryModal() {
    const name = prompt('Enter Category Name (e.g. Python, DBMS, Java):');
    if (!name) return;
    const description = prompt('Enter Category Description:');

    try {
        await apiRequest('/categories', 'POST', { name, description });
        alert('Category added successfully!');
        loadCategories();
    } catch (err) {
        alert('Failed to add category: ' + err.message);
    }
}

async function loadQuestions() {
    const container = document.getElementById('questionsList');
    try {
        const data = await apiRequest('/questions', 'GET');
        const questions = data.questions || [];

        if (!questions.length) {
            container.innerHTML = '<p class="empty-state">No questions in bank. Click "+ Add Question" to create one.</p>';
            return;
        }

        container.innerHTML = questions.map((q, idx) => `
            <div class="stat-card" style="margin-bottom: 1rem;">
                <div style="display: flex; justify-content: space-between;">
                    <h3>${q.category_name || 'General'} | Difficulty: ${q.difficulty.toUpperCase()}</h3>
                    <span>Default Marks: <strong>${q.default_marks}</strong></span>
                </div>
                <h4 style="margin: 0.5rem 0; font-size: 1.05rem;">Q${idx + 1}. ${q.question_text}</h4>
                <ul style="padding-left: 1.25rem; font-size: 0.9rem; color: #334155;">
                    ${(q.options || []).map(opt => `
                        <li style="${opt.is_correct ? 'color: #166534; font-weight: 600;' : ''}">
                            ${opt.option_text} ${opt.is_correct ? '✓ (Correct)' : ''}
                        </li>
                    `).join('')}
                </ul>
            </div>
        `).join('');
    } catch (err) {
        container.innerHTML = `<p class="empty-state text-danger">Error: ${err.message}</p>`;
    }
}

async function openAddQuestionModal() {
    const catData = await apiRequest('/categories', 'GET');
    const categories = catData.categories || [];

    if (!categories.length) {
        alert('Please create at least one Category before adding questions.');
        return;
    }

    const catNameList = categories.map(c => `${c.id}: ${c.name}`).join('\n');
    const catIdStr = prompt(`Select Category ID:\n${catNameList}`);
    const catId = parseInt(catIdStr);

    if (!catId) return;

    const qText = prompt('Enter Question Text:');
    if (!qText) return;

    const optA = prompt('Option A:');
    const optB = prompt('Option B:');
    const correctOpt = prompt('Which option is correct? (A or B):').trim().toUpperCase();

    try {
        await apiRequest('/questions', 'POST', {
            category_id: catId,
            question_text: qText,
            question_type: 'mcq_single',
            difficulty: 'medium',
            default_marks: 1.0,
            negative_marks: 0.25,
            options: [
                { option_text: optA, is_correct: correctOpt === 'A' },
                { option_text: optB, is_correct: correctOpt === 'B' }
            ]
        });
        alert('Question added successfully!');
        loadQuestions();
    } catch (err) {
        alert('Failed to add question: ' + err.message);
    }
}

async function loadAdminExams() {
    const list = document.getElementById('adminExamsList');
    try {
        const data = await apiRequest('/exams', 'GET');
        const exams = data.exams || [];

        if (!exams.length) {
            list.innerHTML = '<p class="empty-state">No exams created yet. Click "+ Create New Exam" to start.</p>';
            return;
        }

        list.innerHTML = exams.map(e => `
            <div class="stat-card" style="border-left-color: ${e.is_published ? '#22c55e' : '#ef4444'};">
                <div style="display: flex; justify-content: space-between;">
                    <h3>${e.category_name || 'General'}</h3>
                    <span class="badge ${e.is_published ? 'active' : 'inactive'}">
                        ${e.is_published ? 'Published' : 'Draft'}
                    </span>
                </div>
                <h4 style="margin: 0.5rem 0; font-size: 1.15rem;">${e.title}</h4>
                <div style="font-size: 0.85rem; margin-bottom: 1rem;">
                    <span>⏱ ${e.duration_minutes} mins</span> | 
                    <span>💯 ${e.total_marks} Marks</span> | 
                    <span>❓ ${e.question_count} Questions</span>
                </div>
                <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                    <button class="btn btn-sm ${e.is_published ? 'btn-secondary' : 'btn-primary'}" onclick="togglePublishExam(${e.id}, ${!e.is_published})">
                        ${e.is_published ? 'Unpublish' : 'Publish'}
                    </button>
                    <button class="btn btn-sm btn-info" onclick="openResultsModal(${e.id}, '${e.title.replace(/'/g, "\\'")}')">
                        View Submissions & Export
                    </button>
                </div>
            </div>
        `).join('');
    } catch (err) {
        list.innerHTML = `<p class="empty-state text-danger">Error: ${err.message}</p>`;
    }
}

async function togglePublishExam(examId, shouldPublish) {
    try {
        const endpoint = `/exams/${examId}/${shouldPublish ? 'publish' : 'unpublish'}`;
        await apiRequest(endpoint, 'POST');
        loadAdminExams();
    } catch (err) {
        alert('Failed to toggle exam state: ' + err.message);
    }
}

async function openCreateExamModal() {
    const title = prompt('Enter Exam Title:');
    if (!title) return;
    const durationStr = prompt('Enter Duration in Minutes (e.g. 30):', '30');

    try {
        await apiRequest('/exams', 'POST', {
            title,
            duration_minutes: parseInt(durationStr) || 30,
            passing_marks: 5.0,
            negative_marking_rate: 0.25
        });
        alert('Exam created in draft mode!');
        loadAdminExams();
    } catch (err) {
        alert('Failed to create exam: ' + err.message);
    }
}

async function openResultsModal(examId, examTitle) {
    currentExamIdForExport = examId;
    document.getElementById('modalExamTitle').textContent = `Submissions & Results: ${examTitle}`;
    const tbody = document.getElementById('resultsTableBody');
    tbody.innerHTML = '<tr><td colspan="6" class="text-center">Loading attempt submissions...</td></tr>';
    document.getElementById('resultsModal').style.display = 'flex';

    try {
        const attempts = await apiRequest(`/results/exams/${examId}`, 'GET');
        if (!attempts || !attempts.length) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center">No student submissions recorded for this exam yet.</td></tr>';
            return;
        }

        tbody.innerHTML = attempts.map(a => `
            <tr>
                <td>#${a.id}</td>
                <td><strong>Student #${a.student_id}</strong></td>
                <td><strong>${a.total_score} Marks</strong></td>
                <td><span class="badge ${a.status === 'submitted' ? 'active' : 'inactive'}">${a.status.toUpperCase()}</span></td>
                <td><span class="${a.tab_switch_count > 0 ? 'result-fail' : ''}">${a.tab_switch_count} Violations</span></td>
                <td>${a.submit_time ? new Date(a.submit_time).toLocaleString() : 'In Progress'}</td>
            </tr>
        `).join('');
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center text-danger">Error loading results: ${err.message}</td></tr>`;
    }
}

function closeResultsModal() {
    document.getElementById('resultsModal').style.display = 'none';
}

function exportExcel() {
    if (!currentExamIdForExport) return;
    const token = localStorage.getItem('access_token');
    const url = `${API_BASE_URL}/exports/exams/${currentExamIdForExport}/excel`;
    
    // Download via authenticated fetch blob
    fetch(url, { headers: { 'Authorization': `Bearer ${token}` } })
        .then(res => res.blob())
        .then(blob => {
            const a = document.createElement('a');
            a.href = window.URL.createObjectURL(blob);
            a.download = `Exam_Results_${currentExamIdForExport}.xlsx`;
            a.click();
        })
        .catch(err => alert('Excel export failed: ' + err.message));
}

function exportWord() {
    if (!currentExamIdForExport) return;
    const token = localStorage.getItem('access_token');
    const url = `${API_BASE_URL}/exports/exams/${currentExamIdForExport}/word`;
    
    fetch(url, { headers: { 'Authorization': `Bearer ${token}` } })
        .then(res => res.blob())
        .then(blob => {
            const a = document.createElement('a');
            a.href = window.URL.createObjectURL(blob);
            a.download = `Question_Paper_${currentExamIdForExport}.docx`;
            a.click();
        })
        .catch(err => alert('Word export failed: ' + err.message));
}

function openNotificationModal() {
    document.getElementById('notificationModal').style.display = 'flex';
}

function closeNotificationModal() {
    document.getElementById('notificationModal').style.display = 'none';
}

async function sendBroadcastNotification() {
    const title = document.getElementById('notifTitle').value.trim();
    const message = document.getElementById('notifMessage').value.trim();

    if (!title || !message) {
        alert('Please enter both a title and message.');
        return;
    }

    try {
        await apiRequest('/notifications', 'POST', {
            title,
            message,
            type: 'info'
        });
        alert('Notification sent successfully to all students!');
        closeNotificationModal();
        document.getElementById('notifTitle').value = '';
        document.getElementById('notifMessage').value = '';
    } catch (err) {
        alert('Failed to send notification: ' + err.message);
    }
}

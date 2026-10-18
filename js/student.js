/**
 * Student Dashboard Controller with Notifications.
 */

document.addEventListener('DOMContentLoaded', async () => {
    checkPageProtection('student');
    
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    document.getElementById('userName').textContent = user.username || 'Student';
    document.getElementById('userEmail').textContent = user.email || '';

    loadStudentExams();
    loadNotifications();
});

function showTab(tabName) {
    const tabs = ['activeExams', 'upcomingExams', 'completedExams'];
    tabs.forEach(t => {
        const el = document.getElementById(`${t}Tab`);
        if (el) el.style.display = (t === tabName) ? 'block' : 'none';
    });

    const navItems = document.querySelectorAll('.nav-menu .nav-item');
    navItems.forEach(item => item.classList.remove('active'));
    
    const activeNav = Array.from(navItems).find(i => i.getAttribute('onclick').includes(tabName));
    if (activeNav) activeNav.classList.add('active');
}

async function loadStudentExams() {
    try {
        const response = await apiRequest('/student/exams', 'GET');
        const exams = response.exams || [];

        renderActiveExams(exams.filter(e => e.student_status === 'in_progress' || (e.is_published && e.student_status === 'not_started')));
        renderUpcomingExams(exams.filter(e => e.start_time && new Date(e.start_time) > new Date()));
        renderCompletedExams(exams.filter(e => e.student_status === 'submitted' || e.student_status === 'expired'));
    } catch (err) {
        console.error('Error loading student exams:', err);
    }
}

function renderActiveExams(exams) {
    const list = document.getElementById('activeExamsList');
    if (!exams.length) {
        list.innerHTML = '<p class="empty-state">No active examinations available at the moment.</p>';
        return;
    }

    list.innerHTML = exams.map(e => `
        <div class="stat-card">
            <h3>${e.category_name || 'General'}</h3>
            <h4 style="margin: 0.5rem 0; font-size: 1.15rem;">${e.title}</h4>
            <p style="font-size: 0.875rem; color: #64748b; margin-bottom: 1rem;">${e.description || 'No description'}</p>
            <div style="font-size: 0.85rem; margin-bottom: 1rem;">
                <span>⏱ Duration: <strong>${e.duration_minutes} mins</strong></span> | 
                <span>💯 Total Marks: <strong>${e.total_marks}</strong></span>
            </div>
            <a href="../exam/exam.html?exam_id=${e.id}" class="btn btn-primary btn-block">
                ${e.student_status === 'in_progress' ? 'Resume Exam' : 'Start Exam Now'}
            </a>
        </div>
    `).join('');
}

function renderUpcomingExams(exams) {
    const list = document.getElementById('upcomingExamsList');
    if (!exams.length) {
        list.innerHTML = '<p class="empty-state">No upcoming examinations scheduled.</p>';
        return;
    }

    list.innerHTML = exams.map(e => `
        <div class="stat-card" style="border-left-color: #64748b;">
            <h3>${e.category_name || 'General'}</h3>
            <h4 style="margin: 0.5rem 0; font-size: 1.15rem;">${e.title}</h4>
            <p style="font-size: 0.85rem; color: #64748b; margin-bottom: 1rem;">
                📅 Scheduled: <strong>${new Date(e.start_time).toLocaleString()}</strong>
            </p>
            <button class="btn btn-secondary btn-block" disabled>Upcoming</button>
        </div>
    `).join('');
}

function renderCompletedExams(exams) {
    const list = document.getElementById('completedExamsList');
    if (!exams.length) {
        list.innerHTML = '<p class="empty-state">You have not completed any examinations yet.</p>';
        return;
    }

    list.innerHTML = exams.map(e => `
        <div class="stat-card" style="border-left-color: #22c55e;">
            <h3>${e.category_name || 'General'}</h3>
            <h4 style="margin: 0.5rem 0; font-size: 1.15rem;">${e.title}</h4>
            <div style="font-size: 0.9rem; margin-bottom: 1rem;">
                <span>Obtained Score: <strong>${e.total_score !== null ? e.total_score : 'Grading'}</strong> / ${e.total_marks}</span>
            </div>
            <button class="btn btn-secondary btn-block" onclick="viewResult(${e.attempt_id})">View Detailed Result</button>
        </div>
    `).join('');
}

function viewResult(attemptId) {
    alert('Displaying detailed result scorecard for Attempt #' + attemptId);
}

async function loadNotifications() {
    try {
        const notifs = await apiRequest('/notifications', 'GET');
        const notifList = document.getElementById('notifList');
        const notifBadge = document.getElementById('notifBadge');

        const unreadCount = notifs.filter(n => !n.is_read).length;
        if (unreadCount > 0) {
            notifBadge.textContent = unreadCount;
            notifBadge.style.display = 'inline-block';
        } else {
            notifBadge.style.display = 'none';
        }

        if (!notifs.length) {
            notifList.innerHTML = '<div class="notif-item">No notifications yet.</div>';
            return;
        }

        notifList.innerHTML = notifs.map(n => `
            <div class="notif-item ${n.is_read ? '' : 'unread'}" onclick="markNotifRead(${n.id})">
                <div class="title">${n.title}</div>
                <div>${n.message}</div>
                <div class="time">${new Date(n.created_at).toLocaleString()}</div>
            </div>
        `).join('');

    } catch (err) {
        console.error('Failed to load notifications:', err);
    }
}

function toggleNotifications() {
    const dropdown = document.getElementById('notifDropdown');
    dropdown.style.display = (dropdown.style.display === 'block') ? 'none' : 'block';
}

async function markNotifRead(notifId) {
    try {
        await apiRequest(`/notifications/${notifId}/read`, 'PUT');
        loadNotifications();
    } catch (err) {
        console.error('Failed to mark read:', err);
    }
}

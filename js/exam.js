/**
 * Live Examination Runner Controller with Anti-Cheat, Pre-Exam Terms, & Auto-Save.
 */

let examData = null;
let attemptData = null;
let questions = [];
let userAnswers = {}; // { question_id: { selected_option_id, is_marked_for_review } }
let currentQuestionIndex = 0;
let examTimer = null;
let isSubmitting = false;
let strikeCount = 0;
const MAX_STRIKES = 3;
let examId = null;

document.addEventListener('DOMContentLoaded', async () => {
    checkPageProtection();
    
    const urlParams = new URLSearchParams(window.location.search);
    examId = urlParams.get('exam_id');

    if (!examId) {
        alert('Invalid Exam ID specified.');
        window.location.href = '../student/dashboard.html';
        return;
    }

    try {
        // Fetch exam overview details for the Pre-Exam Rules Modal
        const examDetails = await apiRequest(`/exams/${examId}`, 'GET');
        examData = examDetails;

        document.getElementById('examTitle').textContent = examData.title;
        document.getElementById('examCategory').textContent = examData.category_name || 'General';
        
        // Populate Rules summary
        document.getElementById('ruleDuration').textContent = examData.duration_minutes || 30;
        document.getElementById('ruleMarks').textContent = examData.total_marks || 0;
        document.getElementById('rulePass').textContent = examData.passing_marks || 0;

        // Show Rules Modal initially
        document.getElementById('rulesModal').style.display = 'flex';

    } catch (err) {
        alert('Failed to load examination details: ' + err.message);
        window.location.href = '../student/dashboard.html';
    }
});

function toggleStartBtn() {
    const isChecked = document.getElementById('termsCheck').checked;
    document.getElementById('btnStartExam').disabled = !isChecked;
}

async function startExamWithRules() {
    // Hide Rules Modal
    document.getElementById('rulesModal').style.display = 'none';

    try {
        // Start or resume exam session in backend
        const response = await apiRequest(`/exams/${examId}/start`, 'POST');
        
        attemptData = response.attempt;
        examData = response.exam;
        questions = response.questions || [];

        // Initialize user answers state map
        questions.forEach(q => {
            userAnswers[q.id] = {
                selected_option_id: null,
                is_marked_for_review: false
            };
        });

        // Initialize Timer
        examTimer = new ExamTimer(
            response.server_deadline,
            (remainingMs) => {
                const timerEl = document.getElementById('timerDisplay');
                timerEl.textContent = ExamTimer.formatTime(remainingMs);
                if (remainingMs < 5 * 60 * 1000) {
                    timerEl.style.color = '#ef4444'; // Red warning under 5 mins
                }
            },
            () => {
                alert('Time expired! Your examination is being submitted automatically.');
                submitExamNow();
            }
        );
        examTimer.start();

        // Setup Anti-Cheat Monitoring
        setupAntiCheat(examId, attemptData.id);

        // Render Initial Question & Palette
        renderPalette();
        showQuestion(0);

    } catch (err) {
        alert('Failed to start examination: ' + err.message);
        window.location.href = '../student/dashboard.html';
    }
}

function showQuestion(index) {
    if (index < 0 || index >= questions.length) return;
    currentQuestionIndex = index;

    const q = questions[index];
    const userAns = userAnswers[q.id];

    document.getElementById('questionNumber').textContent = `Question ${index + 1} of ${questions.length}`;
    document.getElementById('questionMarks').textContent = `${q.default_marks} Mark${q.default_marks > 1 ? 's' : ''}`;
    document.getElementById('questionText').textContent = q.question_text;

    // Render Options
    const optionsContainer = document.getElementById('optionsContainer');
    optionsContainer.innerHTML = '';

    (q.options || []).forEach((opt, idx) => {
        const optionDiv = document.createElement('div');
        optionDiv.className = `option-item ${userAns.selected_option_id === opt.id ? 'selected' : ''}`;
        optionDiv.onclick = () => selectOption(q.id, opt.id);

        const radio = document.createElement('input');
        radio.type = 'radio';
        radio.name = `question_${q.id}`;
        radio.value = opt.id;
        radio.checked = (userAns.selected_option_id === opt.id);

        const label = document.createElement('span');
        label.textContent = `${String.fromCharCode(65 + idx)}. ${opt.option_text}`;

        optionDiv.appendChild(radio);
        optionDiv.appendChild(label);
        optionsContainer.appendChild(optionDiv);
    });

    // Update Nav Buttons
    document.getElementById('btnPrev').disabled = (index === 0);
    document.getElementById('btnNext').disabled = (index === questions.length - 1);

    const btnReview = document.getElementById('btnReview');
    if (userAns.is_marked_for_review) {
        btnReview.textContent = 'Unmark Review';
        btnReview.className = 'btn btn-secondary';
    } else {
        btnReview.textContent = 'Mark for Review';
        btnReview.className = 'btn btn-warning';
    }

    renderPalette();
}

async function selectOption(questionId, optionId) {
    const userAns = userAnswers[questionId];
    if (userAns.selected_option_id === optionId) {
        userAns.selected_option_id = null; // Toggle unselect
    } else {
        userAns.selected_option_id = optionId;
    }

    showQuestion(currentQuestionIndex);

    // Auto-save answer to server
    try {
        await apiRequest(`/exams/${examData.id}/answer`, 'POST', {
            attempt_id: attemptData.id,
            question_id: questionId,
            selected_option_id: userAns.selected_option_id
        });
    } catch (err) {
        console.error('Auto-save error:', err);
    }
}

async function toggleMarkForReview() {
    const q = questions[currentQuestionIndex];
    const userAns = userAnswers[q.id];
    userAns.is_marked_for_review = !userAns.is_marked_for_review;

    showQuestion(currentQuestionIndex);

    try {
        await apiRequest(`/exams/${examData.id}/review`, 'POST', {
            attempt_id: attemptData.id,
            question_id: q.id,
            is_marked_for_review: userAns.is_marked_for_review
        });
    } catch (err) {
        console.error('Review toggle error:', err);
    }
}

function prevQuestion() {
    if (currentQuestionIndex > 0) showQuestion(currentQuestionIndex - 1);
}

function nextQuestion() {
    if (currentQuestionIndex < questions.length - 1) showQuestion(currentQuestionIndex + 1);
}

function renderPalette() {
    const paletteGrid = document.getElementById('questionPalette');
    paletteGrid.innerHTML = '';

    questions.forEach((q, idx) => {
        const btn = document.createElement('button');
        const userAns = userAnswers[q.id];

        let statusClass = 'unanswered';
        if (userAns.selected_option_id && userAns.is_marked_for_review) {
            statusClass = 'answered-review';
        } else if (userAns.selected_option_id) {
            statusClass = 'answered';
        } else if (userAns.is_marked_for_review) {
            statusClass = 'review';
        }

        btn.className = `palette-btn ${statusClass} ${idx === currentQuestionIndex ? 'current' : ''}`;
        btn.textContent = idx + 1;
        btn.onclick = () => showQuestion(idx);

        paletteGrid.appendChild(btn);
    });
}

function setupAntiCheat(examId, attemptId) {
    // 1. Tab switch / visibility monitoring
    document.addEventListener('visibilitychange', () => {
        if (document.hidden && !isSubmitting) {
            handleViolation(examId, attemptId, 'TAB_SWITCH', 'Switched tab or minimized browser window');
        }
    });

    // 2. Window focus lost
    window.addEventListener('blur', () => {
        if (!isSubmitting) {
            handleViolation(examId, attemptId, 'WINDOW_BLUR', 'Focus moved away from examination window');
        }
    });

    // 3. Right click prevention
    document.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        handleViolation(examId, attemptId, 'RIGHT_CLICK', 'Right-click context menu attempted');
    });

    // 4. Copy/Cut/Paste prevention
    ['copy', 'cut', 'paste'].forEach(evt => {
        document.addEventListener(evt, (e) => {
            e.preventDefault();
            handleViolation(examId, attemptId, `${evt.toUpperCase()}_ATTEMPT`, `${evt} attempted`);
        });
    });

    // 5. Keyboard shortcuts block (F12, Ctrl+C, Ctrl+V, Alt+Tab)
    document.addEventListener('keydown', (e) => {
        if (e.key === 'F12' || (e.ctrlKey && ['c', 'v', 'a', 'u', 'p', 's'].includes(e.key.toLowerCase()))) {
            e.preventDefault();
            handleViolation(examId, attemptId, 'KEYBOARD_SHORTCUT', `Shortcut pressed: ${e.key}`);
        }
    });
}

async function handleViolation(examId, attemptId, violationType, details) {
    strikeCount++;
    
    // Log to backend
    try {
        await apiRequest(`/exams/${examId}/violations`, 'POST', {
            attempt_id: attemptId,
            violation_type: violationType,
            metadata: { details, strike: strikeCount, time: new Date().toISOString() }
        });
    } catch (err) {
        console.error('Violation logging failed:', err);
    }

    if (strikeCount >= MAX_STRIKES) {
        alert(`CRITICAL VIOLATION: Maximum allowed window violations (${MAX_STRIKES}) reached. Your examination is locked and will auto-submit now.`);
        submitExamNow();
    } else {
        document.getElementById('strikeBadge').textContent = `⚠️ VIOLATION WARNING (${strikeCount} / ${MAX_STRIKES})`;
        document.getElementById('violationModal').style.display = 'flex';
    }
}

function resumeExam() {
    document.getElementById('violationModal').style.display = 'none';
}

function confirmSubmitExam() {
    let answeredCount = 0;
    let reviewCount = 0;

    Object.values(userAnswers).forEach(ans => {
        if (ans.selected_option_id) answeredCount++;
        if (ans.is_marked_for_review) reviewCount++;
    });

    document.getElementById('summaryAnswered').textContent = answeredCount;
    document.getElementById('summaryUnanswered').textContent = questions.length - answeredCount;
    document.getElementById('summaryReview').textContent = reviewCount;

    document.getElementById('submitModal').style.display = 'flex';
}

function closeSubmitModal() {
    document.getElementById('submitModal').style.display = 'none';
}

async function submitExamNow() {
    if (isSubmitting) return;
    isSubmitting = true;

    if (examTimer) examTimer.stop();

    try {
        const response = await apiRequest(`/exams/${examData.id}/submit`, 'POST', {
            attempt_id: attemptData.id
        });

        alert(`Exam submitted successfully! Score: ${response.result.total_score} / ${response.result.total_marks}`);
        window.location.href = '../student/dashboard.html';
    } catch (err) {
        alert('Submission failed: ' + err.message);
        isSubmitting = false;
    }
}

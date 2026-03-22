// --- CONFIGURATION ---
const USE_REAL_DATABASE = true;

// Detect environment
// If we are on localhost, use 'http://localhost:3000'
// If we are on Render, use '' (relative path), so it uses the current domain automatically
const API_BASE_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'http://localhost:3000' 
    : ''; // Leave empty if serving static files FROM the Node server, OR put your Render backend URL here (e.g., 'https://my-app.onrender.com')

// ... existing code ...
// --- GLOBAL STATE ---
let currentUser = null;

// --- DOM LOAD & EVENT LISTENERS ---
document.addEventListener('DOMContentLoaded', () => {
    // Auth Enter Keys
    addEnterListener("loginPassword", handleLogin);
    addEnterListener("signupPassword", handleSignup);

    // Dashboard Search Enter Keys
    addEnterListener("studentIdInput", handleStudentSearch);
    addEnterListener("programInput", handleStudentSearch);
    addEnterListener("staffIdInput", handleStaffSearch);
    addEnterListener("deptInput", handleStaffSearch);

    // Set Default Dates for Admin Forms
    const today = new Date().toISOString().split('T')[0];
    if(document.getElementById('adminAttDate')) document.getElementById('adminAttDate').value = today;
    if(document.getElementById('adminStaffAttDate')) document.getElementById('adminStaffAttDate').value = today;
});

function addEnterListener(inputId, actionFunction) {
    const el = document.getElementById(inputId);
    if(el) {
        el.addEventListener("keypress", function(event) {
            if (event.key === "Enter") {
                event.preventDefault();
                actionFunction();
            }
        });
    }
}

// ==========================================
// 0. MOBILE RESPONSIVENESS LOGIC (ADDED)
// ==========================================

function toggleMobileSidebar() {
    const sidebar = document.getElementById('mainSidebar');
    const overlay = document.getElementById('mobile-overlay');

    if (sidebar.classList.contains('active')) {
        sidebar.classList.remove('active');
        overlay.classList.add('hidden');
    } else {
        sidebar.classList.add('active');
        overlay.classList.remove('hidden');
    }
}

// ==========================================
// 1. AUTHENTICATION LOGIC
// ==========================================

function showSignup() {
    document.getElementById('login-form').classList.add('hidden');
    document.getElementById('signup-form').classList.remove('hidden');
    document.getElementById('auth-message').innerText = "";
}

function showLogin() {
    document.getElementById('signup-form').classList.add('hidden');
    document.getElementById('login-form').classList.remove('hidden');
    document.getElementById('auth-message').innerText = "";
}

async function handleLogin() {
    const userIn = document.getElementById('loginUsername').value;
    const passIn = document.getElementById('loginPassword').value;
    const msgBox = document.getElementById('auth-message');

    if (!userIn || !passIn) {
        msgBox.innerText = "Please fill in all fields.";
        return;
    }

    msgBox.innerText = "Logging in...";

    try {
        const user = await authenticateUser(userIn, passIn);
        
        // SUCCESS
        currentUser = user;
        document.getElementById('currentUserDisplay').innerText = "Welcome, " + user.username;
        
        document.getElementById('auth-container').classList.add('hidden');
        document.getElementById('dashboard-container').classList.remove('hidden');

        const contentGrid = document.querySelector('.content-grid');
        const adminPanel = document.getElementById('admin-panel');
        const dirPanel = document.getElementById('directory-panel');

        if (user.username.toLowerCase() === 'admin') {
            // Admin Mode
            adminPanel.classList.remove('hidden');
            dirPanel.classList.add('hidden');
            contentGrid.classList.remove('full-width'); 
        } else {
            // User Mode
            adminPanel.classList.add('hidden');
            dirPanel.classList.remove('hidden');
            contentGrid.classList.remove('full-width'); 
            loadDirectories();
        }

    } catch (error) { // <--- THIS IS FIXED NOW
        msgBox.innerText = error.message;
    }
}

async function handleSignup() {
    const userIn = document.getElementById('signupUsername').value;
    const emailIn = document.getElementById('signupEmail').value;
    const passIn = document.getElementById('signupPassword').value;
    const msgBox = document.getElementById('auth-message');

    if (!userIn || !emailIn || !passIn) {
        msgBox.innerText = "Please fill in all fields.";
        return;
    }

    try {
        await registerUser(userIn, emailIn, passIn);
        alert("Account created successfully! Please Login.");
        showLogin();
    } catch (error) {
        msgBox.innerText = error.message;
    }
}

function handleLogout() {
    currentUser = null;
    document.getElementById('dashboard-container').classList.add('hidden');
    document.getElementById('auth-container').classList.remove('hidden');
    document.getElementById('admin-panel').classList.add('hidden');
    
    // Remove the full-width class to reset to default state
    const contentGrid = document.querySelector('.content-grid');
    if (contentGrid) contentGrid.classList.remove('full-width');

    // Reset Inputs
    document.getElementById('loginUsername').value = "";
    document.getElementById('loginPassword').value = "";
    document.getElementById('auth-message').innerText = "";
    resetDashboard();
}

// ==========================================
// 2. DASHBOARD LOGIC (Search & Display)
// ==========================================

async function handleStudentSearch() {
    const idInput = document.getElementById('studentIdInput').value;
    const progInput = document.getElementById('programInput').value;
    const id = parseInt(idInput);

    if(isNaN(id) || progInput.trim() === "") {
        alert("Please enter both a valid Student ID and a Program.");
        return;
    }

    try {
        const studentData = await fetchStudentFromDatabase(id, progInput);
        if (studentData) {
            renderDashboard(studentData, "student");
            // ADDED: Auto close sidebar on mobile if search successful
            if(window.innerWidth <= 768) toggleMobileSidebar();
        }
    } catch (error) {
        alert(error.message);
        resetDashboard();
    }
}

async function handleStaffSearch() {
    const idInput = document.getElementById('staffIdInput').value;
    const deptInput = document.getElementById('deptInput').value;
    const id = parseInt(idInput);

    if(isNaN(id) || deptInput.trim() === "") {
        alert("Please enter both a valid Employee ID and a Department.");
        return;
    }

    try {
        const staffData = await fetchStaffFromDatabase(id, deptInput);
        if (staffData) {
            renderDashboard(staffData, "staff");
            // ADDED: Auto close sidebar on mobile if search successful
            if(window.innerWidth <= 768) toggleMobileSidebar();
        }
    } catch (error) {
        alert(error.message);
        resetDashboard();
    }
}

function renderDashboard(data, type) {
    const dashTitle = document.getElementById('dashboardTitle');
    const infoDisplay = document.getElementById('infoDisplay');
    const topCardTitle = document.getElementById('topCardTitle');
    const headerRow = document.getElementById('mainTableHeader');
    
    // Inside renderDashboard function...
    // 1. Sort the data efficiently
    const sortedList = mergeSortData(data.dataList); // Switched to Merge Sort

    // 2. Example: Using Binary Search (Console Log demonstration)
    // You can open your browser console to see this working
    console.log("Searching for 'Algorithms' course...");
    const searchResult = binarySearch(sortedList, "Algorithms");
    if (searchResult) {
        console.log("Binary Search Found:", searchResult);
    } else {
        console.log("Binary Search: Course not found");
    }

    if (type === "student") {
        dashTitle.innerHTML = `<i class="fa-solid fa-user-graduate"></i> Student Dashboard`;
        infoDisplay.innerText = `Viewing: ${data.name} | ${data.program}`;
        topCardTitle.innerHTML = `<i class="fa-solid fa-book-open"></i> Grades & Performance`;
        headerRow.innerHTML = `<tr><th>Course Name</th><th>Grade</th><th>Details</th></tr>`;
    } else {
        dashTitle.innerHTML = `<i class="fa-solid fa-user-tie"></i> Staff Dashboard`;
        infoDisplay.innerText = `Viewing: ${data.name} | ${data.department}`;
        topCardTitle.innerHTML = `<i class="fa-solid fa-list-check"></i> Assigned Tasks`;
        headerRow.innerHTML = `<tr><th>Task Name</th><th>Status</th><th>Action</th></tr>`;
    }

    const mainBody = document.getElementById('mainTableBody');
    mainBody.innerHTML = ""; 
    
    if (sortedList.length === 0) {
        mainBody.innerHTML = `<tr><td colspan="3" class="empty-state">No data records found</td></tr>`;
    } else {
        sortedList.forEach(item => {
            // Add color coding for status or high grades
            let badgeColor = "background:#e2e8f0; color:#333;"; // Default gray
            
            // Logic for visual flair
            if(type === "student" && parseInt(item.value) >= 90) badgeColor = "background:#d1fae5; color:#065f46;"; // Green
            if(type === "student" && parseInt(item.value) < 75) badgeColor = "background:#fee2e2; color:#991b1b;"; // Red
            if(item.value === "Completed") badgeColor = "background:#d1fae5; color:#065f46;";
            if(item.value === "Pending") badgeColor = "background:#ffedd5; color:#9a3412;";

            const valHtml = `<span style="${badgeColor} padding:4px 8px; border-radius:12px; font-weight:600; font-size:0.85em;">${item.value}</span>`;
            
            const row = `<tr>
                <td><strong>${item.name}</strong></td>
                <td>${valHtml}</td>
                <td><button class="action-btn outline-btn" style="padding:4px 8px; font-size:0.75rem;">View</button></td>
            </tr>`;
            mainBody.innerHTML += row;
        });
    }

    const attBody = document.getElementById('attendanceBody');
    attBody.innerHTML = "";
    if (data.attendance.length === 0) {
        attBody.innerHTML = `<tr><td colspan="2" class="empty-state">No attendance records</td></tr>`;
    } else {
        data.attendance.forEach(a => {
            let icon = "";
            if(a.status === "Present") icon = "<i class='fa-solid fa-check-circle' style='color:var(--success)'></i>";
            else if(a.status === "Absent") icon = "<i class='fa-solid fa-times-circle' style='color:var(--danger)'></i>";
            
            const row = `<tr><td>${a.date}</td><td>${icon} ${a.status}</td></tr>`;
            attBody.innerHTML += row;
        });
    }
}

function resetDashboard() {
    document.getElementById('infoDisplay').innerText = "No User Selected";
    const emptyRow = `<tr><td colspan="3" class="center-text">--------</td></tr>`;
    document.getElementById('mainTableBody').innerHTML = emptyRow + emptyRow + emptyRow;
    document.getElementById('attendanceBody').innerHTML = emptyRow + emptyRow + emptyRow;
}

// REPLACE the 'bubbleSortData' function in script.js with this:

function mergeSortData(dataArray) {
    if (dataArray.length <= 1) {
        return dataArray;
    }

    // 1. DIVIDE
    const middle = Math.floor(dataArray.length / 2);
    const left = dataArray.slice(0, middle);
    const right = dataArray.slice(middle);

    // 2. CONQUER (Recursive Calls)
    return merge(mergeSortData(left), mergeSortData(right));
}

// Helper function to merge two sorted arrays
function merge(left, right) {
    let resultArray = [];
    let leftIndex = 0;
    let rightIndex = 0;

    while (leftIndex < left.length && rightIndex < right.length) {
        // Compare names (Case insensitive)
        if (left[leftIndex].name.toLowerCase() < right[rightIndex].name.toLowerCase()) {
            resultArray.push(left[leftIndex]);
            leftIndex++;
        } else {
            resultArray.push(right[rightIndex]);
            rightIndex++;
        }
    }

    // Concatenate remaining elements
    return resultArray.concat(left.slice(leftIndex)).concat(right.slice(rightIndex));
}

// ==========================================
// SECTION 3: ADMIN PANEL LOGIC
// ==========================================

async function adminDeleteStudent() {
    const id = document.getElementById('deleteStudentId').value;
    const msg = document.getElementById('admin-msg');

    if (!id) {
        msg.style.color = "red";
        msg.innerText = "Please enter an ID to delete.";
        return;
    }

    // Confirmation Dialog
    const confirmDelete = confirm(`WARNING: This will delete Student ID ${id} and ALL their grades/attendance history. This cannot be undone.\n\nAre you sure?`);
    
    if (!confirmDelete) return;

    try {
        const res = await fetch('/api/delete-student', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ student_id: id })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Delete failed");

        msg.style.color = "red";
        msg.innerText = data.message;
        document.getElementById('deleteStudentId').value = ""; // Clear input

    } catch (e) {
        msg.style.color = "red";
        msg.innerText = e.message;
    }
}

async function adminDeleteStaff() {
    const id = document.getElementById('deleteStaffId').value;
    const msg = document.getElementById('admin-msg');

    if (!id) {
        msg.style.color = "red";
        msg.innerText = "Please enter an ID to delete.";
        return;
    }

    // Confirmation Dialog
    const confirmDelete = confirm(`WARNING: This will delete Staff ID ${id} and ALL their tasks/attendance history. This cannot be undone.\n\nAre you sure?`);
    
    if (!confirmDelete) return;

    try {
        const res = await fetch('/api/delete-staff', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ staff_id: id })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Delete failed");

        msg.style.color = "red";
        msg.innerText = data.message;
        document.getElementById('deleteStaffId').value = ""; // Clear input

    } catch (e) {
        msg.style.color = "red";
        msg.innerText = e.message;
    }
}

async function adminCreateStudent() {
    const id = document.getElementById('newStudentId').value;
    const name = document.getElementById('newStudentName').value;
    const program = document.getElementById('newStudentProgram').value;
    const msg = document.getElementById('admin-msg');

    if(!id || !name || !program) { 
        msg.style.color="red"; 
        msg.innerText = "ID, Name, and Program are required"; 
        return; 
    }

    try {
        const res = await fetch('/api/add-new-student', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ student_id: id, full_name: name, program: program })
        });
        
        const data = await res.json();
        if(!res.ok) throw new Error(data.error || "Failed to create student");

        msg.style.color = "green";
        msg.innerText = data.message;
        
        // Clear inputs
        document.getElementById('newStudentId').value = "";
        document.getElementById('newStudentName').value = "";
        document.getElementById('newStudentProgram').value = "";
    } catch(e) {
        msg.style.color = "red";
        msg.innerText = e.message;
    }
}

async function adminCreateStaff() {
    const id = document.getElementById('newStaffId').value;
    const name = document.getElementById('newStaffName').value;
    const dept = document.getElementById('newStaffDept').value;
    const msg = document.getElementById('admin-msg');

    if(!id || !name || !dept) { 
        msg.style.color="red"; 
        msg.innerText = "ID, Name, and Department are required"; 
        return; 
    }

    try {
        const res = await fetch('/api/add-new-staff', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ staff_id: id, full_name: name, department: dept })
        });
        
        const data = await res.json();
        if(!res.ok) throw new Error(data.error || "Failed to create staff");

        msg.style.color = "green";
        msg.innerText = data.message;

        // Clear inputs
        document.getElementById('newStaffId').value = "";
        document.getElementById('newStaffName').value = "";
        document.getElementById('newStaffDept').value = "";
    } catch(e) {
        msg.style.color = "red";
        msg.innerText = e.message;
    }
}


function showAdminTab(type) {
    const studentForms = document.getElementById('admin-student-forms');
    const staffForms = document.getElementById('admin-staff-forms');
    const btns = document.querySelectorAll('.tab-btn');

    document.getElementById('admin-msg').innerText = "";

    if (type === 'student') {
        studentForms.classList.remove('hidden');
        staffForms.classList.add('hidden');
        btns[0].classList.add('active');
        btns[1].classList.remove('active');
    } else {
        studentForms.classList.add('hidden');
        staffForms.classList.remove('hidden');
        btns[0].classList.remove('active');
        btns[1].classList.add('active');
    }
}

async function adminAddGrade() {
    const id = document.getElementById('adminStudentId').value;
    const course = document.getElementById('adminCourse').value;
    const grade = document.getElementById('adminGrade').value;
    const msg = document.getElementById('admin-msg');

    if(!id || !course || !grade) { msg.style.color="red"; msg.innerText = "All fields required"; return; }

    try {
        const res = await fetch('/api/add-grade', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ student_id: id, course_name: course, grade_value: grade })
        });
        const data = await res.json();
        if(!res.ok) throw new Error(data.error || "Failed to add grade");
        
        msg.style.color = "green";
        msg.innerText = "Grade Added Successfully!";
        // Clear inputs except ID (for rapid entry)
        document.getElementById('adminCourse').value = "";
        document.getElementById('adminGrade').value = "";
    } catch(e) {
        msg.style.color = "red";
        msg.innerText = e.message;
    }
}

async function adminAddStudentAttendance() {
    const id = document.getElementById('adminAttStudentId').value;
    const date = document.getElementById('adminAttDate').value;
    const status = document.getElementById('adminAttStatus').value;
    const msg = document.getElementById('admin-msg');

    if(!id || !date) { msg.style.color="red"; msg.innerText = "ID and Date required"; return; }

    try {
        const res = await fetch('/api/add-student-attendance', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ student_id: id, date: date, status: status })
        });
        const data = await res.json();
        if(!res.ok) throw new Error(data.error || "Failed");

        msg.style.color = "green";
        msg.innerText = "Student Attendance Marked!";
    } catch(e) {
        msg.style.color = "red";
        msg.innerText = e.message;
    }
}

async function adminAddTask() {
    const id = document.getElementById('adminStaffId').value;
    const task = document.getElementById('adminTask').value;
    const status = document.getElementById('adminTaskStatus').value;
    const msg = document.getElementById('admin-msg');

    if(!id || !task) { msg.style.color="red"; msg.innerText = "ID and Task required"; return; }

    try {
        const res = await fetch('/api/add-task', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ staff_id: id, task_name: task, status: status })
        });
        const data = await res.json();
        if(!res.ok) throw new Error(data.error || "Failed");

        msg.style.color = "green";
        msg.innerText = "Staff Task Assigned!";
        document.getElementById('adminTask').value = "";
    } catch(e) {
        msg.style.color = "red";
        msg.innerText = e.message;
    }
}

async function adminAddStaffAttendance() {
    const id = document.getElementById('adminAttStaffId').value;
    const date = document.getElementById('adminStaffAttDate').value;
    const status = document.getElementById('adminStaffAttStatus').value;
    const msg = document.getElementById('admin-msg');

    if(!id || !date) { msg.style.color="red"; msg.innerText = "ID and Date required"; return; }

    try {
        const res = await fetch('/api/add-staff-attendance', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ staff_id: id, date: date, status: status })
        });
        const data = await res.json();
        if(!res.ok) throw new Error(data.error || "Failed");

        msg.style.color = "green";
        msg.innerText = "Staff Attendance Marked!";
    } catch(e) {
        msg.style.color = "red";
        msg.innerText = e.message;
    }
}

// ==========================================
// 4. API LAYER
// ==========================================

async function authenticateUser(username, password) {
    if (USE_REAL_DATABASE) {
        // CHANGE: Use backticks ` ` and add ${API_BASE_URL}
        const response = await fetch(`${API_BASE_URL}/api/login`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ username, password })
        });
        if (!response.ok) throw new Error("Invalid Credentials");
        return await response.json();
    } else {
        return { username: username };
    }
}

async function registerUser(username, email, password) {
    if (USE_REAL_DATABASE) {
        // FIXED: Use backticks ` ` so ${API_BASE_URL} actually works
        const response = await fetch(`${API_BASE_URL}/api/register`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ username, email, password })
        });
        if (!response.ok) throw new Error("Registration Failed");
        return await response.json();
    }
}

async function fetchStudentFromDatabase(id, program) {
    if (USE_REAL_DATABASE) {
        const response = await fetch(`/api/student?id=${id}&program=${program}`);
        if (!response.ok) throw new Error("Student not found");
        return await response.json();
    }
}

async function fetchStaffFromDatabase(id, department) {
    if (USE_REAL_DATABASE) {
        const response = await fetch(`/api/staff?id=${id}&department=${department}`);
        if (!response.ok) throw new Error("Staff not found");
        return await response.json();
    }
}

// ==========================================
// 5. KEYBOARD SHORTCUTS & UTILS
// ==========================================

// Add this to your existing DOMContentLoaded event
document.addEventListener('keydown', (e) => {
    // 1. Toggle Help Modal (?)
    if (e.key === '?' && !isInputFocused()) {
        toggleShortcutsModal();
    }

    // 2. Escape Key (Global Reset/Close)
    if (e.key === 'Escape') {
        document.getElementById('shortcuts-modal').classList.add('hidden');
        if(document.activeElement) document.activeElement.blur(); // Unfocus inputs
        resetDashboard();
    }

    // 3. Alt Key Combinations
    if (e.altKey) {
        switch(e.key.toLowerCase()) {
            case 'l': // Logout
                e.preventDefault();
                handleLogout();
                break;
            case 's': // Focus Student Search
                e.preventDefault();
                focusInput('studentIdInput');
                // ADDED: Ensure sidebar is open on mobile
                if(window.innerWidth <= 768) {
                   document.getElementById('mainSidebar').classList.add('active');
                   document.getElementById('mobile-overlay').classList.remove('hidden');
                }
                break;
            case 'e': // Focus Employee/Staff Search
                e.preventDefault();
                focusInput('staffIdInput');
                // ADDED: Ensure sidebar is open on mobile
                if(window.innerWidth <= 768) {
                    document.getElementById('mainSidebar').classList.add('active');
                    document.getElementById('mobile-overlay').classList.remove('hidden');
                }
                break;
            case '1': // Admin Tab: Student
                e.preventDefault();
                if(currentUser && currentUser.username === 'admin') showAdminTab('student');
                break;
            case '2': // Admin Tab: Staff
                e.preventDefault();
                if(currentUser && currentUser.username === 'admin') showAdminTab('staff');
                break;
        }
    }
});

function isInputFocused() {
    const el = document.activeElement;
    return (el.tagName === 'INPUT' || el.tagName === 'SELECT' || el.tagName === 'TEXTAREA');
}

function focusInput(id) {
    const el = document.getElementById(id);
    if(el) {
        el.focus();
        // Visual cue
        el.style.backgroundColor = "#e0f2fe";
        setTimeout(() => el.style.backgroundColor = "", 300);
    }
}

function toggleShortcutsModal() {
    const modal = document.getElementById('shortcuts-modal');
    if (modal.classList.contains('hidden')) {
        modal.classList.remove('hidden');
    } else {
        modal.classList.add('hidden');
    }
}

function binarySearch(sortedArray, targetName) {
    let left = 0;
    let right = sortedArray.length - 1;

    while (left <= right) {
        const mid = Math.floor((left + right) / 2);
        const currentName = sortedArray[mid].name.toLowerCase();
        const target = targetName.toLowerCase();

        if (currentName === target) {
            return sortedArray[mid]; // Found it!
        } else if (currentName < target) {
            left = mid + 1; // Search Right Half
        } else {
            right = mid - 1; // Search Left Half
        }
    }
    return null; // Not Found
}

// ==========================================
// 6. DIRECTORY & SORTING LOGIC
// ==========================================

let globalStudentList = [];
let globalStaffList = [];

async function loadDirectories() {
    try {
        // Fetch Students
        if(USE_REAL_DATABASE) {
            const sRes = await fetch('/api/all-students');
            globalStudentList = await sRes.json();
            renderStudentList(globalStudentList);

            // Fetch Staff
            const stRes = await fetch('/api/all-staff');
            globalStaffList = await stRes.json();
            renderStaffList(globalStaffList);
        }
    } catch (e) {
        console.error("Error loading directories:", e);
    }
}

function renderStudentList(data) {
    const container = document.getElementById('studentListContainer');
    container.innerHTML = "";

    if(!data || data.length === 0) {
        container.innerHTML = "<div class='loader'>No students found</div>";
        return;
    }

    data.forEach(s => {
        // Calculate average grade display
        let gradeDisplay = s.average_grade ? Math.round(s.average_grade) + "%" : "N/A";
        
        const html = `
            <div class="dir-item" onclick="quickSearchStudent(${s.student_id}, '${s.program}')">
                <div class="dir-avatar"><i class="fa-solid fa-user-graduate"></i></div>
                <div class="dir-info">
                    <h4>${s.full_name}</h4>
                    <p>ID: ${s.student_id} | ${s.program}</p>
                </div>
                <div class="grade-badge">${gradeDisplay}</div>
            </div>
        `;
        container.innerHTML += html;
    });
}

function renderStaffList(data) {
    const container = document.getElementById('staffListContainer');
    container.innerHTML = "";

    if(!data || data.length === 0) {
        container.innerHTML = "<div class='loader'>No staff found</div>";
        return;
    }

    data.forEach(s => {
        const html = `
            <div class="dir-item" onclick="quickSearchStaff(${s.staff_id}, '${s.department}')">
                <div class="dir-avatar" style="background:#f1f5f9; color:#475569"><i class="fa-solid fa-user-tie"></i></div>
                <div class="dir-info">
                    <h4>${s.full_name}</h4>
                    <p>ID: ${s.staff_id}</p>
                </div>
                <div class="dept-badge">${s.department}</div>
            </div>
        `;
        container.innerHTML += html;
    });
}

// --- SORTING FUNCTIONS ---

function sortStudents() {
    const criteria = document.getElementById('studentSort').value;
    let sorted = [...globalStudentList]; // Copy array

    if (criteria === 'alpha') {
        sorted.sort((a, b) => a.full_name.localeCompare(b.full_name));
    } else if (criteria === 'grade') {
        // Sort by average_grade descending (nulls last)
        sorted.sort((a, b) => {
            let gradeA = a.average_grade || 0;
            let gradeB = b.average_grade || 0;
            return gradeB - gradeA;
        });
    }

    renderStudentList(sorted);
}

function sortStaff() {
    const criteria = document.getElementById('staffSort').value;
    let sorted = [...globalStaffList];

    if (criteria === 'alpha') {
        sorted.sort((a, b) => a.full_name.localeCompare(b.full_name));
    } else if (criteria === 'dept') {
        sorted.sort((a, b) => a.department.localeCompare(b.department));
    }

    renderStaffList(sorted);
}

// Helper: Click a list item to fill the search bar automatically
function quickSearchStudent(id, program) {
    document.getElementById('studentIdInput').value = id;
    document.getElementById('programInput').value = program;
    handleStudentSearch();
}

function quickSearchStaff(id, dept) {
    document.getElementById('staffIdInput').value = id;
    document.getElementById('deptInput').value = dept;
    handleStaffSearch();
}
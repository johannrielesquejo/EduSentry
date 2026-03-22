// 1. Load environment variables (If you installed dotenv)
require('dotenv').config(); 

// 2. Load libraries (ONLY ONCE)
const express = require('express');
const mysql = require('mysql2'); // <--- Ensure this line appears only once!
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 3000;

// --- MIDDLEWARE ---
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(__dirname)); 

// --- DATABASE CONNECTION ---
const db = mysql.createPool({ // <--- Changed from createConnection to createPool
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT || 4000,
    waitForConnections: true, // <--- Add this
    connectionLimit: 10,      // <--- Add this
    queueLimit: 0,            // <--- Add this
    ssl: {
        minVersion: 'TLSv1.2',
        rejectUnauthorized: false
    }
});



// ==================================================================
// API ENDPOINTS
// ==================================================================

// --- AUTHENTICATION ---

// 1. LOGIN
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    const query = 'SELECT * FROM Users WHERE username = ? AND password_hash = ?';
    
    db.query(query, [username, password], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        
        if (results.length > 0) {
            res.json(results[0]);
        } else {
            res.status(401).json({ error: "Invalid Credentials" });
        }
    });
});

// 2. REGISTER
app.post('/api/register', (req, res) => {
    const { username, email, password } = req.body;
    const query = 'INSERT INTO Users (username, email, password_hash) VALUES (?, ?, ?)';
    
    db.query(query, [username, email, password], (err, result) => {
        if (err) {
            // ADD THIS LINE to see the error in Render Dashboard -> Logs
            console.error("Database Error:", err.message); 
            
            return res.status(500).json({ error: "Registration failed: " + err.message });
        }
        res.json({ success: true, message: "User registered" });
    });
});

// --- DATA RETRIEVAL (GET) ---

// 3. GET STUDENT DATA
app.get('/api/student', (req, res) => {
    const { id, program } = req.query;

    const studentQuery = 'SELECT * FROM Students WHERE student_id = ?';
    
    db.query(studentQuery, [id], (err, students) => {
        if (err) return res.status(500).send(err);
        if (students.length === 0) return res.status(404).send("Student not found");

        const student = students[0];
        
        if (student.program.toLowerCase() !== program.trim().toLowerCase()) {
            return res.status(400).send("Program does not match record");
        }

        const gradesQuery = 'SELECT course_name as name, grade_value as value FROM StudentGrades WHERE student_id = ?';
        const attQuery = 'SELECT DATE_FORMAT(att_date, "%Y-%m-%d") as date, status FROM StudentAttendance WHERE student_id = ? ORDER BY att_date DESC';

        db.query(gradesQuery, [id], (err, grades) => {
            if (err) return res.status(500).send(err);

            db.query(attQuery, [id], (err, attendance) => {
                if (err) return res.status(500).send(err);

                const finalData = {
                    id: student.student_id,
                    name: student.full_name,
                    program: student.program,
                    dataList: grades,
                    attendance: attendance
                };
                res.json(finalData);
            });
        });
    });
});

// 4. GET STAFF DATA
app.get('/api/staff', (req, res) => {
    const { id, department } = req.query;

    const staffQuery = 'SELECT * FROM Staff WHERE staff_id = ?';
    
    db.query(staffQuery, [id], (err, staffList) => {
        if (err) return res.status(500).send(err);
        if (staffList.length === 0) return res.status(404).send("Staff not found");

        const staff = staffList[0];

        if (staff.department.toLowerCase() !== department.trim().toLowerCase()) {
            return res.status(400).send("Department does not match record");
        }

        const tasksQuery = 'SELECT task_name as name, status as value FROM StaffTasks WHERE staff_id = ?';
        const attQuery = 'SELECT DATE_FORMAT(att_date, "%Y-%m-%d") as date, status FROM StaffAttendance WHERE staff_id = ? ORDER BY att_date DESC';

        db.query(tasksQuery, [id], (err, tasks) => {
            if (err) return res.status(500).send(err);

            db.query(attQuery, [id], (err, attendance) => {
                if (err) return res.status(500).send(err);

                const finalData = {
                    id: staff.staff_id,
                    name: staff.full_name,
                    department: staff.department,
                    dataList: tasks,
                    attendance: attendance
                };
                res.json(finalData);
            });
        });
    });
});

// --- DATA ENTRY (POST - Admin Features) ---

// 5. ADD STUDENT GRADE
app.post('/api/add-grade', (req, res) => {
    const { student_id, course_name, grade_value } = req.body;
    // Check if student exists first (optional safety check)
    const checkQuery = 'SELECT * FROM Students WHERE student_id = ?';
    db.query(checkQuery, [student_id], (err, result) => {
        if (result.length === 0) return res.status(404).json({ error: "Student ID not found" });

        const query = 'INSERT INTO StudentGrades (student_id, course_name, grade_value) VALUES (?, ?, ?)';
        db.query(query, [student_id, course_name, grade_value], (err, result) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true, message: "Grade added successfully" });
        });
    });
});

// 6. ADD STUDENT ATTENDANCE
app.post('/api/add-student-attendance', (req, res) => {
    const { student_id, date, status } = req.body;
    const checkQuery = 'SELECT * FROM Students WHERE student_id = ?';
    db.query(checkQuery, [student_id], (err, result) => {
        if (result.length === 0) return res.status(404).json({ error: "Student ID not found" });

        const query = 'INSERT INTO StudentAttendance (student_id, att_date, status) VALUES (?, ?, ?)';
        db.query(query, [student_id, date, status], (err, result) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true, message: "Attendance marked successfully" });
        });
    });
});

// 7. ADD STAFF TASK
app.post('/api/add-task', (req, res) => {
    const { staff_id, task_name, status } = req.body;
    const checkQuery = 'SELECT * FROM Staff WHERE staff_id = ?';
    db.query(checkQuery, [staff_id], (err, result) => {
        if (result.length === 0) return res.status(404).json({ error: "Staff ID not found" });

        const query = 'INSERT INTO StaffTasks (staff_id, task_name, status) VALUES (?, ?, ?)';
        db.query(query, [staff_id, task_name, status], (err, result) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true, message: "Task added successfully" });
        });
    });
});

// 8. ADD STAFF ATTENDANCE
app.post('/api/add-staff-attendance', (req, res) => {
    const { staff_id, date, status } = req.body;
    const checkQuery = 'SELECT * FROM Staff WHERE staff_id = ?';
    db.query(checkQuery, [staff_id], (err, result) => {
        if (result.length === 0) return res.status(404).json({ error: "Staff ID not found" });

        const query = 'INSERT INTO StaffAttendance (staff_id, att_date, status) VALUES (?, ?, ?)';
        db.query(query, [staff_id, date, status], (err, result) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true, message: "Staff Attendance marked successfully" });
        });
    });
});

// 9. ADD NEW STUDENT (CREATE PROFILE)
app.post('/api/add-new-student', (req, res) => {
    const { student_id, full_name, program } = req.body;
    
    // Check if ID already exists
    const checkQuery = 'SELECT * FROM Students WHERE student_id = ?';
    db.query(checkQuery, [student_id], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        if (result.length > 0) return res.status(400).json({ error: "Student ID already exists" });

        const query = 'INSERT INTO Students (student_id, full_name, program) VALUES (?, ?, ?)';
        db.query(query, [student_id, full_name, program], (err, result) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true, message: "New Student Profile Created!" });
        });
    });
});

// 10. ADD NEW STAFF (CREATE PROFILE)
app.post('/api/add-new-staff', (req, res) => {
    const { staff_id, full_name, department } = req.body;

    // Check if ID already exists
    const checkQuery = 'SELECT * FROM Staff WHERE staff_id = ?';
    db.query(checkQuery, [staff_id], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        if (result.length > 0) return res.status(400).json({ error: "Staff ID already exists" });

        const query = 'INSERT INTO Staff (staff_id, full_name, department) VALUES (?, ?, ?)';
        db.query(query, [staff_id, full_name, department], (err, result) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true, message: "New Staff Profile Created!" });
        });
    });
});

// --- NEW: DIRECTORY ENDPOINTS ---

// 13. GET ALL STUDENTS (With Average Grade)
app.get('/api/all-students', (req, res) => {
    // This query joins students with grades and calculates the average
    // CAST(grade_value AS UNSIGNED) ensures we treat "90" as a number, not a string
    const query = `
        SELECT s.student_id, s.full_name, s.program, 
        AVG(CAST(sg.grade_value AS UNSIGNED)) as average_grade 
        FROM Students s 
        LEFT JOIN StudentGrades sg ON s.student_id = sg.student_id 
        GROUP BY s.student_id
    `;
    
    db.query(query, (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

// 14. GET ALL STAFF
app.get('/api/all-staff', (req, res) => {
    const query = 'SELECT * FROM Staff';
    db.query(query, (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

// START SERVER
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});

// ==================================================================
// DELETE API (CAUTION: Removes all related data)
// ==================================================================

// 11. DELETE STUDENT (AND THEIR GRADES/ATTENDANCE)
app.delete('/api/delete-student', (req, res) => {
    const { student_id } = req.body;

    // Step 1: Delete Grades
    db.query('DELETE FROM StudentGrades WHERE student_id = ?', [student_id], (err) => {
        if (err) return res.status(500).json({ error: "Failed to delete grades: " + err.message });

        // Step 2: Delete Attendance
        db.query('DELETE FROM StudentAttendance WHERE student_id = ?', [student_id], (err) => {
            if (err) return res.status(500).json({ error: "Failed to delete attendance: " + err.message });

            // Step 3: Delete Student Profile
            db.query('DELETE FROM Students WHERE student_id = ?', [student_id], (err, result) => {
                if (err) return res.status(500).json({ error: "Failed to delete student: " + err.message });
                
                if (result.affectedRows === 0) {
                    return res.status(404).json({ error: "Student ID not found" });
                }
                
                res.json({ success: true, message: "Student and all records deleted permanently." });
            });
        });
    });
});

// 12. DELETE STAFF (AND THEIR TASKS/ATTENDANCE)
app.delete('/api/delete-staff', (req, res) => {
    const { staff_id } = req.body;

    // Step 1: Delete Tasks
    db.query('DELETE FROM StaffTasks WHERE staff_id = ?', [staff_id], (err) => {
        if (err) return res.status(500).json({ error: "Failed to delete tasks: " + err.message });

        // Step 2: Delete Attendance
        db.query('DELETE FROM StaffAttendance WHERE staff_id = ?', [staff_id], (err) => {
            if (err) return res.status(500).json({ error: "Failed to delete attendance: " + err.message });

            // Step 3: Delete Staff Profile
            db.query('DELETE FROM Staff WHERE staff_id = ?', [staff_id], (err, result) => {
                if (err) return res.status(500).json({ error: "Failed to delete staff: " + err.message });
                
                if (result.affectedRows === 0) {
                    return res.status(404).json({ error: "Staff ID not found" });
                }

                res.json({ success: true, message: "Staff and all records deleted permanently." });
            });
        });
    });
});
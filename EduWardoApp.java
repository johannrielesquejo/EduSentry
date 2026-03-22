import javax.swing.*;
import javax.swing.border.EmptyBorder;
import javax.swing.border.LineBorder;
import javax.swing.table.DefaultTableCellRenderer;
import javax.swing.table.DefaultTableModel;
import javax.swing.table.JTableHeader;
import java.awt.*;
import java.awt.event.KeyEvent;
import java.awt.event.MouseAdapter;
import java.awt.event.MouseEvent;
import java.sql.*;
import java.util.ArrayList;
import java.util.List;

public class EduWardoApp {

    // --- CONFIGURATION ---
    private static final String DB_URL = "jdbc:mysql://localhost:3306/SchoolSystem";
    private static final String DB_USER = "root";
    private static final String DB_PASS = "";

    // --- COLORS ---
    private static final Color COL_PRIMARY = new Color(67, 97, 238);   
    private static final Color COL_BG_MAIN = new Color(248, 249, 250); 
    private static final Color COL_SIDEBAR = new Color(30, 41, 59);    
    private static final Color COL_TEXT    = new Color(43, 45, 66);    
    private static final Color COL_ACCENT  = new Color(76, 201, 240);  
    private static final Color COL_DANGER  = new Color(239, 35, 60);   

    // --- FONTS ---
    private static final Font FONT_TITLE = new Font("Segoe UI", Font.BOLD, 24);
    private static final Font FONT_HEADER = new Font("Segoe UI", Font.BOLD, 14);
    private static final Font FONT_BODY = new Font("Segoe UI", Font.PLAIN, 14);

    // --- GLOBAL COMPONENTS (Static for Access) ---
    private static User currentUser;
    private static JFrame mainFrame;
    private static JLabel statusLabel;
    private static JTable mainTable;
    private static JTable attendanceTable;
    
    // Components needed for Shortcuts
    private static JTextField stIdInput;   // Student Search Input
    private static JTextField sfIdInput;   // Staff Search Input
    private static JTabbedPane adminTabs;  // Admin Tabs
    private static JDialog helpDialog;     // Help Modal

    public static void main(String[] args) {
        try { Class.forName("com.mysql.cj.jdbc.Driver"); } catch (Exception e) {}
        try { UIManager.setLookAndFeel(UIManager.getSystemLookAndFeelClassName()); } catch (Exception e) {}
        SwingUtilities.invokeLater(EduWardoApp::showLoginScreen);
    }

    // ==========================================
    // 1. LOGIN SCREEN
    // ==========================================
   // ==========================================
    // 1. AUTHENTICATION SYSTEM (Login & Sign Up)
    // ==========================================
    private static JFrame authFrame;
    private static JPanel authCardPanel;
    private static CardLayout authLayout;

    private static void showLoginScreen() {
        if(authFrame == null) {
            authFrame = new JFrame("EduSentry - Access");
            authFrame.setSize(900, 600);
            authFrame.setDefaultCloseOperation(JFrame.EXIT_ON_CLOSE);
            authFrame.setLocationRelativeTo(null);
            authFrame.setLayout(new GridBagLayout());
            authFrame.getContentPane().setBackground(new Color(240, 242, 245));
        } else {
            // 2. CRITICAL FIX: Clear the old panel if the frame already exists
            authFrame.getContentPane().removeAll();
            authFrame.repaint();
        }


        authLayout = new CardLayout();
        authCardPanel = new JPanel(authLayout);
        authCardPanel.setOpaque(false); // Transparent to show background

        // Create the two panels
        JPanel loginPanel = createAuthCard(true);
        JPanel signupPanel = createAuthCard(false);

        authCardPanel.add(loginPanel, "LOGIN");
        authCardPanel.add(signupPanel, "SIGNUP");

        authFrame.add(authCardPanel);
        authFrame.setVisible(true);
    }

 private static JPanel createAuthCard(boolean isLogin) {
        JPanel card = new JPanel();
        card.setLayout(new BoxLayout(card, BoxLayout.Y_AXIS));
        card.setBackground(Color.WHITE);
        
        // Compact Border
        card.setBorder(BorderFactory.createCompoundBorder(
            new LineBorder(new Color(220, 220, 220), 1, true),
            new EmptyBorder(30, 40, 30, 40)
        ));

        // Header
        JLabel icon = new JLabel("🎓");
        icon.setFont(new Font("Segoe UI Emoji", Font.PLAIN, 40));
        centerComponent(icon);

        JLabel title = new JLabel(isLogin ? "Welcome Back" : "Create Account");
        title.setFont(new Font("Segoe UI", Font.BOLD, 20)); // Smaller Font
        title.setForeground(COL_PRIMARY);
        centerComponent(title);

        // Inputs
        JTextField userField = createStyledTextField();
        JTextField emailField = createStyledTextField();
        JPasswordField passField = createStyledPasswordField();

        // Buttons
        ModernButton actionBtn = new ModernButton(isLogin ? "Login" : "Sign Up", COL_PRIMARY);
        centerComponent(actionBtn);
        actionBtn.setMaximumSize(new Dimension(280, 35)); // Match Input Width

        JButton switchBtn = new JButton(isLogin ? "No account? Create one" : "Already have an account? Login");
        styleLinkButton(switchBtn);

        // --- ASSEMBLY (Micro-Spacing) ---
        card.add(icon); 
        card.add(Box.createVerticalStrut(5));
        card.add(title); 
        card.add(Box.createVerticalStrut(20));

        card.add(createCenteredLabel("Username"));
        card.add(Box.createVerticalStrut(3));
        card.add(userField); 
        card.add(Box.createVerticalStrut(10));

        if (!isLogin) {
            card.add(createCenteredLabel("Email Address"));
            card.add(Box.createVerticalStrut(3));
            card.add(emailField); 
            card.add(Box.createVerticalStrut(10));
        }

        card.add(createCenteredLabel("Password"));
        card.add(Box.createVerticalStrut(3));
        card.add(passField); 
        card.add(Box.createVerticalStrut(20));

        card.add(actionBtn);
        card.add(Box.createVerticalStrut(8));
        card.add(switchBtn);

        // --- LOGIC ---
        switchBtn.addActionListener(e -> authLayout.show(authCardPanel, isLogin ? "SIGNUP" : "LOGIN"));

        actionBtn.addActionListener(e -> {
            String u = userField.getText();
            String p = new String(passField.getPassword());
            if (isLogin) {
                authenticate(u, p, authFrame);
            } else {
                String mail = emailField.getText();
                if(u.isEmpty() || p.isEmpty() || mail.isEmpty()) {
                    JOptionPane.showMessageDialog(authFrame, "All fields required.");
                    return;
                }
                registerUser(u, mail, p);
            }
        });

        return card;
    }

    // ==========================================
    // DATABASE LOGIC FOR SIGNUP
    // ==========================================
    private static void registerUser(String username, String email, String password) {
        try (Connection conn = DriverManager.getConnection(DB_URL, DB_USER, DB_PASS)) {
            // Check if username exists
            PreparedStatement check = conn.prepareStatement("SELECT * FROM Users WHERE username = ?");
            check.setString(1, username);
            if (check.executeQuery().next()) {
                JOptionPane.showMessageDialog(authFrame, "Username already exists!");
                return;
            }

            // Insert New User
            String sql = "INSERT INTO Users (username, email, password_hash) VALUES (?, ?, ?)";
            PreparedStatement ps = conn.prepareStatement(sql);
            ps.setString(1, username);
            ps.setString(2, email);
            ps.setString(3, password);
            
            ps.executeUpdate();
            
            JOptionPane.showMessageDialog(authFrame, "Account Created! Please Login.");
            authLayout.show(authCardPanel, "LOGIN"); // Switch back to login screen automatically
            
        } catch (SQLException e) {
            e.printStackTrace();
            JOptionPane.showMessageDialog(authFrame, "Registration Error: " + e.getMessage());
        }
    }
    // ==========================================
    // 2. DASHBOARD
    // ==========================================
    private static void showDashboard() {
        mainFrame = new JFrame("EduSentry - Dashboard");
        mainFrame.setSize(1200, 800);
        mainFrame.setDefaultCloseOperation(JFrame.EXIT_ON_CLOSE);
        mainFrame.setLocationRelativeTo(null);

        // --- SIDEBAR ---
        JPanel sidebar = new JPanel();
        sidebar.setPreferredSize(new Dimension(260, 800));
        sidebar.setBackground(COL_SIDEBAR);
        sidebar.setLayout(new BoxLayout(sidebar, BoxLayout.Y_AXIS));
        sidebar.setBorder(new EmptyBorder(25, 20, 25, 20));

        JLabel brand = new JLabel("EduSentry");
        brand.setForeground(Color.WHITE);
        brand.setFont(new Font("Segoe UI", Font.BOLD, 22));

        // Assign to STATIC variables for Shortcuts
        stIdInput = createSidebarInput("Student ID");
        JTextField stProgIn = createSidebarInput("Program (CS, IT)");
        ModernButton stSearchBtn = new ModernButton("Search Student", COL_ACCENT);
        stSearchBtn.setForeground(COL_TEXT);

        sfIdInput = createSidebarInput("Staff ID");
        JTextField sfDeptIn = createSidebarInput("Department");
        ModernButton sfSearchBtn = new ModernButton("Search Staff", COL_ACCENT);
        sfSearchBtn.setForeground(COL_TEXT);

        ModernButton logoutBtn = new ModernButton("Logout", COL_DANGER);

        stSearchBtn.addActionListener(e -> loadStudentData(stIdInput.getText(), stProgIn.getText()));
        sfSearchBtn.addActionListener(e -> loadStaffData(sfIdInput.getText(), sfDeptIn.getText()));
        logoutBtn.addActionListener(e -> logout());

        // 1. Make Enter key trigger Student Search
        stIdInput.addActionListener(e -> stSearchBtn.doClick());
        stProgIn.addActionListener(e -> stSearchBtn.doClick());

        // 2. Make Enter key trigger Staff Search
        sfIdInput.addActionListener(e -> sfSearchBtn.doClick());
        sfDeptIn.addActionListener(e -> sfSearchBtn.doClick());

        sidebar.add(brand);
        sidebar.add(Box.createVerticalStrut(40));
        addSidebarSection(sidebar, "STUDENT PORTAL", stIdInput, stProgIn, stSearchBtn);
        sidebar.add(Box.createVerticalStrut(30));
        addSidebarSection(sidebar, "STAFF PORTAL", sfIdInput, sfDeptIn, sfSearchBtn);
        sidebar.add(Box.createVerticalGlue());
        sidebar.add(logoutBtn);

        // --- MAIN CONTENT ---
        JPanel mainContent = new JPanel(new BorderLayout());
        mainContent.setBackground(COL_BG_MAIN);
        
        JPanel topBar = new JPanel(new BorderLayout());
        topBar.setBackground(Color.WHITE);
        topBar.setBorder(new EmptyBorder(15, 30, 15, 30));
        
        JLabel pageTitle = new JLabel("Dashboard Overview");
        pageTitle.setFont(new Font("Segoe UI", Font.BOLD, 18));
        pageTitle.setForeground(COL_TEXT);
        
        statusLabel = new JLabel("No user selected");
        statusLabel.setFont(new Font("Segoe UI", Font.BOLD, 12));
        statusLabel.setForeground(Color.GRAY);
        statusLabel.setOpaque(true);
        statusLabel.setBackground(new Color(240, 240, 240));
        statusLabel.setBorder(new EmptyBorder(5, 15, 5, 15));
        
        // Help Button
        JButton helpBtn = new JButton("?");
        helpBtn.setFocusable(false);
        helpBtn.addActionListener(e -> toggleHelpModal());
        JPanel rightHeader = new JPanel(new FlowLayout(FlowLayout.RIGHT));
        rightHeader.setBackground(Color.WHITE);
        rightHeader.add(statusLabel);
        rightHeader.add(helpBtn);

        topBar.add(pageTitle, BorderLayout.WEST);
        topBar.add(rightHeader, BorderLayout.EAST);

        JPanel cardPanel = new JPanel(new BorderLayout());
        cardPanel.setBackground(COL_BG_MAIN);
        cardPanel.setBorder(new EmptyBorder(20, 20, 20, 20));
        
        JPanel dataCard = new JPanel(new GridLayout(1, 2, 20, 0));
        dataCard.setBackground(COL_BG_MAIN); 

        mainTable = createStyledTable();
        attendanceTable = createStyledTable();
        
        dataCard.add(createTablePanel("Records & Grades", mainTable));
        dataCard.add(createTablePanel("Attendance History", attendanceTable));
        cardPanel.add(dataCard, BorderLayout.CENTER);

        mainContent.add(topBar, BorderLayout.NORTH);
        mainContent.add(cardPanel, BorderLayout.CENTER);

        mainFrame.add(sidebar, BorderLayout.WEST);
        mainFrame.add(mainContent, BorderLayout.CENTER);
        
        if(currentUser.username.equalsIgnoreCase("admin")) {
            mainFrame.add(createAdminPanel(), BorderLayout.EAST);
        }

        // --- ACTIVATE KEYBOARD SHORTCUTS ---
        setupGlobalShortcuts();

        mainFrame.setVisible(true);
    }

    // ==========================================
    // 3. KEYBOARD SHORTCUTS LOGIC
    // ==========================================
    private static void setupGlobalShortcuts() {
        KeyboardFocusManager.getCurrentKeyboardFocusManager()
            .addKeyEventDispatcher(e -> {
                // Only trigger on KEY_PRESSED
                if (e.getID() == KeyEvent.KEY_PRESSED) {
                    
                    // 1. HELP MODAL (?)
                    if (e.getKeyChar() == '?' && !(e.getSource() instanceof javax.swing.text.JTextComponent)) {
                        toggleHelpModal();
                        return true;
                    }

                    // 2. ESCAPE (Close Modal / Reset)
                    if (e.getKeyCode() == KeyEvent.VK_ESCAPE) {
                        if (helpDialog != null && helpDialog.isVisible()) {
                            helpDialog.dispose();
                        } else {
                            resetDashboard();
                        }
                        return true;
                    }

                    // 3. ALT COMBINATIONS
                    if (e.isAltDown()) {
                        switch (e.getKeyCode()) {
                            case KeyEvent.VK_L: // Alt + L (Logout)
                                logout();
                                return true;
                            case KeyEvent.VK_S: // Alt + S (Focus Student)
                                if (stIdInput != null) stIdInput.requestFocusInWindow();
                                return true;
                            case KeyEvent.VK_E: // Alt + E (Focus Staff)
                                if (sfIdInput != null) sfIdInput.requestFocusInWindow();
                                return true;
                            case KeyEvent.VK_1: // Alt + 1 (Tab 1)
                                if (adminTabs != null) adminTabs.setSelectedIndex(0);
                                return true;
                            case KeyEvent.VK_2: // Alt + 2 (Tab 2)
                                if (adminTabs != null) adminTabs.setSelectedIndex(1);
                                return true;
                        }
                    }
                }
                return false; // Allow other events to pass
            });
    }

    private static void toggleHelpModal() {
        if(helpDialog != null && helpDialog.isVisible()) {
            helpDialog.dispose();
            return;
        }
        
        helpDialog = new JDialog(mainFrame, "Keyboard Shortcuts", false); // Non-modal
        helpDialog.setSize(300, 250);
        helpDialog.setLocationRelativeTo(mainFrame);
        
        JPanel p = new JPanel();
        p.setLayout(new BoxLayout(p, BoxLayout.Y_AXIS));
        p.setBorder(new EmptyBorder(20, 20, 20, 20));
        p.setBackground(Color.WHITE);
        
        p.add(new JLabel("<html><h3>Shortcuts</h3>" +
                "<b>Alt + S</b> : Search Student<br>" +
                "<b>Alt + E</b> : Search Staff<br>" +
                "<b>Alt + 1</b> : Admin Student Tab<br>" +
                "<b>Alt + 2</b> : Admin Staff Tab<br>" +
                "<b>Alt + L</b> : Logout<br>" +
                "<b>?</b> : Toggle this menu<br>" +
                "<b>Esc</b> : Close / Reset</html>"));
                
        helpDialog.add(p);
        helpDialog.setVisible(true);
    }
    
    private static void resetDashboard() {
        statusLabel.setText("No User Selected");
        mainTable.setModel(new DefaultTableModel());
        attendanceTable.setModel(new DefaultTableModel());
        if(mainFrame.getFocusOwner() != null) mainFrame.requestFocus(); // Blur inputs
    }
    
    private static void logout() {
        mainFrame.dispose();
        currentUser = null;
        showLoginScreen();
    }

    // ==========================================
    // 4. ADMIN PANEL
    // ==========================================
    private static JComponent createAdminPanel() {
        JTabbedPane tabs = new JTabbedPane();
        tabs.setFont(FONT_HEADER);
        tabs.setBackground(Color.WHITE);
        tabs.setPreferredSize(new Dimension(340, 0)); // Slightly wider for comfort
        
        // --- STUDENT TAB ---
        JPanel stContent = new JPanel();
        stContent.setLayout(new BoxLayout(stContent, BoxLayout.Y_AXIS));
        stContent.setBackground(Color.WHITE);
        stContent.setBorder(new EmptyBorder(20, 20, 20, 20));
        
        // 1. New Student Section
        addSectionHeader(stContent, "Create New Student");
        JTextField nId = createStyledTextField();
        JTextField nName = createStyledTextField();
        JTextField nProg = createStyledTextField();
        
        addInputGroup(stContent, "Student ID:", nId);
        addInputGroup(stContent, "Full Name:", nName);
        addInputGroup(stContent, "Program:", nProg);
        
        ModernButton btnCreateSt = new ModernButton("Create Profile", COL_PRIMARY);
        btnCreateSt.addActionListener(e -> executeUpdate("INSERT INTO Students VALUES (?,?,?)", nId.getText(), nName.getText(), nProg.getText()));
        addActionButton(stContent, btnCreateSt);

        // 2. Grades Section
        addDivider(stContent);
        addSectionHeader(stContent, "Add Grade");
        
        JTextField gId = createStyledTextField();
        JTextField gCourse = createStyledTextField();
        JTextField gVal = createStyledTextField();

        addInputGroup(stContent, "Student ID:", gId);
        addInputGroup(stContent, "Course Name:", gCourse);
        addInputGroup(stContent, "Grade Value:", gVal);
        
        ModernButton btnGrade = new ModernButton("Submit Grade", COL_ACCENT);
        btnGrade.setForeground(COL_TEXT);
        btnGrade.addActionListener(e -> executeUpdate("INSERT INTO StudentGrades (student_id, course_name, grade_value) VALUES (?,?,?)", gId.getText(), gCourse.getText(), gVal.getText()));
        addActionButton(stContent, btnGrade);

        // 3. Attendance Section (The one you asked for)
        addDivider(stContent);
        addSectionHeader(stContent, "Mark Attendance");
        
        JTextField aId = createStyledTextField();
        JTextField aDate = createStyledTextField();
        aDate.setText(java.time.LocalDate.now().toString()); // Auto-fill Today
        
        String[] statuses = {"Present", "Absent", "Late", "Excused"};
        JComboBox<String> aStatus = new JComboBox<>(statuses);
        styleComboBox(aStatus);

        addInputGroup(stContent, "Student ID:", aId);
        addInputGroup(stContent, "Date (YYYY-MM-DD):", aDate);
        addInputGroup(stContent, "Status:", aStatus);
        
        ModernButton btnAtt = new ModernButton("Mark Attendance", COL_SIDEBAR);
        btnAtt.addActionListener(e -> executeUpdate("INSERT INTO StudentAttendance (student_id, att_date, status) VALUES (?,?,?)", aId.getText(), aDate.getText(), aStatus.getSelectedItem().toString()));
        addActionButton(stContent, btnAtt);


        // --- STAFF TAB ---
        JPanel sfContent = new JPanel();
        sfContent.setLayout(new BoxLayout(sfContent, BoxLayout.Y_AXIS));
        sfContent.setBackground(Color.WHITE);
        sfContent.setBorder(new EmptyBorder(20, 20, 20, 20));

        // 1. New Staff
        addSectionHeader(sfContent, "Create New Staff");
        JTextField sId = createStyledTextField();
        JTextField sName = createStyledTextField();
        JTextField sDept = createStyledTextField();
        
        addInputGroup(sfContent, "Staff ID:", sId);
        addInputGroup(sfContent, "Full Name:", sName);
        addInputGroup(sfContent, "Department:", sDept);
        
        ModernButton btnCreateSf = new ModernButton("Create Profile", COL_PRIMARY);
        btnCreateSf.addActionListener(e -> executeUpdate("INSERT INTO Staff VALUES (?,?,?)", sId.getText(), sName.getText(), sDept.getText()));
        addActionButton(sfContent, btnCreateSf);
        
        // 2. Assign Task
        addDivider(sfContent);
        addSectionHeader(sfContent, "Assign Task");
        
        JTextField tId = createStyledTextField();
        JTextField tTask = createStyledTextField();
        JTextField tStatus = createStyledTextField();
        
        addInputGroup(sfContent, "Staff ID:", tId);
        addInputGroup(sfContent, "Task Description:", tTask);
        addInputGroup(sfContent, "Initial Status:", tStatus);
        
        ModernButton btnTask = new ModernButton("Assign Task", COL_ACCENT);
        btnTask.setForeground(COL_TEXT);
        btnTask.addActionListener(e -> executeUpdate("INSERT INTO StaffTasks (staff_id, task_name, status) VALUES (?,?,?)", tId.getText(), tTask.getText(), tStatus.getText()));
        addActionButton(sfContent, btnTask);

        // --- SCROLL PANES (The Fix for Positioning) ---
        JScrollPane stScroll = new JScrollPane(stContent);
        stScroll.setBorder(null);
        stScroll.getVerticalScrollBar().setUnitIncrement(16); // Smooth scrolling
        
        JScrollPane sfScroll = new JScrollPane(sfContent);
        sfScroll.setBorder(null);
        sfScroll.getVerticalScrollBar().setUnitIncrement(16);

        tabs.addTab("Students", stScroll);
        tabs.addTab("Staff", sfScroll);
        
        return tabs;
    }

    // --- HELPER METHODS FOR LAYOUT (Paste these below createAdminPanel) ---
    
    private static void addInputGroup(JPanel p, String labelText, JComponent input) {
        JLabel l = new JLabel(labelText);
        l.setFont(new Font("Segoe UI", Font.BOLD, 11));
        l.setForeground(Color.GRAY);
        l.setAlignmentX(Component.LEFT_ALIGNMENT);
        
        input.setAlignmentX(Component.LEFT_ALIGNMENT);
        input.setMaximumSize(new Dimension(Integer.MAX_VALUE, 35)); // Force consistent height
        
        p.add(l);
        p.add(Box.createVerticalStrut(4));
        p.add(input);
        p.add(Box.createVerticalStrut(12)); // Consistent gap between inputs
    }

    private static void addSectionHeader(JPanel p, String text) {
        JLabel l = new JLabel(text);
        l.setFont(new Font("Segoe UI", Font.BOLD, 14));
        l.setForeground(COL_TEXT);
        l.setAlignmentX(Component.LEFT_ALIGNMENT);
        p.add(l);
        p.add(Box.createVerticalStrut(10));
    }
    
    private static void addActionButton(JPanel p, JButton btn) {
        btn.setAlignmentX(Component.LEFT_ALIGNMENT);
        btn.setMaximumSize(new Dimension(Integer.MAX_VALUE, 40));
        p.add(Box.createVerticalStrut(5));
        p.add(btn);
    }

    private static void addDivider(JPanel p) {
        p.add(Box.createVerticalStrut(20));
        JSeparator sep = new JSeparator();
        sep.setMaximumSize(new Dimension(Integer.MAX_VALUE, 1));
        sep.setForeground(new Color(230,230,230));
        p.add(sep);
        p.add(Box.createVerticalStrut(20));
    }

    private static void styleComboBox(JComboBox box) {
        box.setFont(FONT_BODY);
        box.setBackground(Color.WHITE);
        box.setMaximumSize(new Dimension(Integer.MAX_VALUE, 35));
        ((JLabel)box.getRenderer()).setBorder(new EmptyBorder(0,5,0,0));
    }

    // ==========================================
    // 5. UI HELPERS
    // ==========================================
    private static JPanel createTablePanel(String title, JTable table) {
        JPanel panel = new JPanel(new BorderLayout());
        panel.setBackground(Color.WHITE);
        panel.setBorder(BorderFactory.createCompoundBorder(
            new LineBorder(new Color(230, 230, 230), 1), new EmptyBorder(0, 0, 0, 0)));
        JLabel titleLbl = new JLabel(title);
        titleLbl.setFont(new Font("Segoe UI", Font.BOLD, 14));
        titleLbl.setBorder(new EmptyBorder(15, 15, 15, 15));
        JScrollPane scroll = new JScrollPane(table);
        scroll.setBorder(null); scroll.getViewport().setBackground(Color.WHITE);
        panel.add(titleLbl, BorderLayout.NORTH); panel.add(scroll, BorderLayout.CENTER);
        return panel;
    }

    private static JTable createStyledTable() {
        JTable table = new JTable();
        table.setRowHeight(35); 
        table.setShowVerticalLines(false);
        table.setGridColor(new Color(240, 240, 240));
        table.setFont(FONT_BODY);
        table.setSelectionBackground(new Color(230, 240, 255));
        table.setSelectionForeground(COL_TEXT);
        JTableHeader header = table.getTableHeader();
        header.setFont(FONT_HEADER);
        header.setBackground(Color.WHITE);
        header.setForeground(Color.GRAY);
        header.setPreferredSize(new Dimension(0, 40));
        ((DefaultTableCellRenderer)header.getDefaultRenderer()).setHorizontalAlignment(JLabel.LEFT);
        return table;
    }

    private static class ModernButton extends JButton {
        public ModernButton(String text, Color bg) {
            super(text); setBackground(bg); setForeground(Color.WHITE);
            setFont(new Font("Segoe UI", Font.BOLD, 13)); setFocusPainted(false);
            setBorder(new EmptyBorder(10, 20, 10, 20)); setCursor(new Cursor(Cursor.HAND_CURSOR));
            setContentAreaFilled(false); setOpaque(true);
            addMouseListener(new MouseAdapter() {
                public void mouseEntered(MouseEvent e) { setBackground(bg.darker()); }
                public void mouseExited(MouseEvent e) { setBackground(bg); }
            });
        }
        protected void paintComponent(Graphics g) {
            Graphics2D g2 = (Graphics2D) g.create();
            g2.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
            g2.setColor(getBackground()); g2.fillRoundRect(0, 0, getWidth(), getHeight(), 10, 10);
            super.paintComponent(g); g2.dispose();
        }
    }

    private static JTextField createStyledTextField() { JTextField tf = new JTextField(20); styleInput(tf); return tf; }
    private static JPasswordField createStyledPasswordField() { JPasswordField pf = new JPasswordField(20); styleInput(pf); return pf; }
    private static void styleInput(JTextField tf) {
        tf.setFont(FONT_BODY);
        // 1. Reduce internal padding (makes the text sit tighter)
        tf.setBorder(BorderFactory.createCompoundBorder(
            new LineBorder(new Color(200, 200, 200)), 
            new EmptyBorder(4, 10, 4, 10) // Was 8
        ));
        
        // 2. FORCE EXACT SIZE (This stops them from being "big")
        Dimension size = new Dimension(280, 35); // Width: 280, Height: 35
        tf.setMaximumSize(size);
        tf.setPreferredSize(size);
    }
    
    private static JTextField createSidebarInput(String hint) {
        JTextField tf = new JTextField();
        tf.setBackground(new Color(51, 65, 85)); tf.setForeground(Color.WHITE);
        tf.setCaretColor(Color.WHITE);
        tf.setBorder(BorderFactory.createCompoundBorder(new LineBorder(new Color(71, 85, 105)), new EmptyBorder(8, 10, 8, 10)));
        tf.setToolTipText(hint); tf.setMaximumSize(new Dimension(Integer.MAX_VALUE, 35));
        return tf;
    }

    private static void addSidebarSection(JPanel sidebar, String header, JComponent... comps) {
        JLabel l = new JLabel(header); l.setForeground(new Color(148, 163, 184)); l.setFont(new Font("Segoe UI", Font.BOLD, 11));
        sidebar.add(l); sidebar.add(Box.createVerticalStrut(10));
        for(JComponent c : comps) { sidebar.add(c); sidebar.add(Box.createVerticalStrut(8)); }
    }
    
    private static JLabel createLabel(String text) {
        JLabel l = new JLabel(text); l.setFont(new Font("Segoe UI", Font.BOLD, 12));
        l.setForeground(COL_TEXT); l.setAlignmentX(Component.LEFT_ALIGNMENT); return l;
    }

    // ==========================================
    // 6. LOGIC & ALGORITHMS
    // ==========================================
    private static void authenticate(String u, String p, JFrame frame) {
        try (Connection conn = DriverManager.getConnection(DB_URL, DB_USER, DB_PASS);
             PreparedStatement s = conn.prepareStatement("SELECT * FROM Users WHERE username=? AND password_hash=?")) {
            s.setString(1, u); s.setString(2, p);
            ResultSet rs = s.executeQuery();
            if(rs.next()) {
                currentUser = new User(rs.getInt("id"), rs.getString("username"), rs.getString("email"));
                frame.dispose(); showDashboard();
            } else { JOptionPane.showMessageDialog(frame, "Invalid Credentials"); }
        } catch (Exception e) { e.printStackTrace(); JOptionPane.showMessageDialog(frame, "DB Error: " + e.getMessage()); }
    }
    
    private static void executeUpdate(String sql, String... params) {
        try (Connection conn = DriverManager.getConnection(DB_URL, DB_USER, DB_PASS);
             PreparedStatement ps = conn.prepareStatement(sql)) {
            for(int i=0; i<params.length; i++) ps.setString(i+1, params[i]);
            ps.executeUpdate(); JOptionPane.showMessageDialog(mainFrame, "Success!");
        } catch (SQLException ex) { JOptionPane.showMessageDialog(mainFrame, "Error: " + ex.getMessage()); }
    }

    private static void loadStudentData(String id, String prog) {
        try (Connection conn = DriverManager.getConnection(DB_URL, DB_USER, DB_PASS)) {
            PreparedStatement ps = conn.prepareStatement("SELECT * FROM Students WHERE student_id=?");
            ps.setString(1, id); ResultSet rs = ps.executeQuery();
            if(rs.next()) {
                if(!rs.getString("program").equalsIgnoreCase(prog)) { JOptionPane.showMessageDialog(mainFrame, "Program Mismatch"); return; }
                statusLabel.setText("Student: " + rs.getString("full_name"));
                
                // Fetch & Sort Grades
                List<RecordItem> rawData = new ArrayList<>();
                PreparedStatement psGrades = conn.prepareStatement("SELECT course_name, grade_value FROM StudentGrades WHERE student_id=?");
                psGrades.setString(1, id); ResultSet rsGrades = psGrades.executeQuery();
                while(rsGrades.next()) rawData.add(new RecordItem(rsGrades.getString(1), rsGrades.getString(2)));

                List<RecordItem> sortedData = mergeSort(rawData);
                DefaultTableModel model = new DefaultTableModel(new String[]{"Course", "Grade"}, 0);
                for(RecordItem item : sortedData) model.addRow(new Object[]{item.name, item.value});
                mainTable.setModel(model);

                // Binary Search Test
                RecordItem found = binarySearch(sortedData, "Algorithms");
                if(found != null) JOptionPane.showMessageDialog(mainFrame, "Binary Search: 'Algorithms' found with Grade " + found.value);

                // Attendance
                populateTable(attendanceTable, conn, "SELECT att_date, status FROM StudentAttendance WHERE student_id=? ORDER BY att_date DESC", id, "Date", "Status");
            } else { JOptionPane.showMessageDialog(mainFrame, "Student Not Found"); }
        } catch (Exception e) { e.printStackTrace(); }
    }

    private static void loadStaffData(String id, String dept) {
        try (Connection conn = DriverManager.getConnection(DB_URL, DB_USER, DB_PASS)) {
            PreparedStatement ps = conn.prepareStatement("SELECT * FROM Staff WHERE staff_id=?");
            ps.setString(1, id); ResultSet rs = ps.executeQuery();
            if(rs.next()) {
                if(!rs.getString("department").equalsIgnoreCase(dept)) { JOptionPane.showMessageDialog(mainFrame, "Dept Mismatch"); return; }
                statusLabel.setText("Staff: " + rs.getString("full_name"));
                
                // Fetch Tasks
                populateTable(mainTable, conn, "SELECT task_name, status FROM StaffTasks WHERE staff_id=?", id, "Task", "Status");
                populateTable(attendanceTable, conn, "SELECT att_date, status FROM StaffAttendance WHERE staff_id=? ORDER BY att_date DESC", id, "Date", "Status");
            } else { JOptionPane.showMessageDialog(mainFrame, "Staff Not Found"); }
        } catch (Exception e) { e.printStackTrace(); }
    }

    private static void populateTable(JTable table, Connection conn, String sql, String id, String col1, String col2) throws SQLException {
        PreparedStatement ps = conn.prepareStatement(sql); ps.setString(1, id); ResultSet rs = ps.executeQuery();
        DefaultTableModel model = new DefaultTableModel(new String[]{col1, col2}, 0);
        while(rs.next()) model.addRow(new Object[]{rs.getString(1), rs.getString(2)});
        table.setModel(model);
    }
    
    // --- DSA ALGORITHMS ---
    static class RecordItem { String name; String value; public RecordItem(String n, String v) { this.name=n; this.value=v; } }
    
    private static List<RecordItem> mergeSort(List<RecordItem> list) {
        if (list.size() <= 1) return list;
        int mid = list.size() / 2;
        List<RecordItem> left = mergeSort(list.subList(0, mid));
        List<RecordItem> right = mergeSort(list.subList(mid, list.size()));
        return merge(left, right);
    }

    private static List<RecordItem> merge(List<RecordItem> left, List<RecordItem> right) {
        List<RecordItem> result = new ArrayList<>();
        int i = 0, j = 0;
        while (i < left.size() && j < right.size()) {
            if (left.get(i).name.compareToIgnoreCase(right.get(j).name) < 0) result.add(left.get(i++));
            else result.add(right.get(j++));
        }
        while (i < left.size()) result.add(left.get(i++));
        while (j < right.size()) result.add(right.get(j++));
        return result;
    }
    
    private static RecordItem binarySearch(List<RecordItem> sortedList, String targetName) {
        int left = 0; int right = sortedList.size() - 1;
        while (left <= right) {
            int mid = left + (right - left) / 2;
            int res = targetName.compareToIgnoreCase(sortedList.get(mid).name);
            if (res == 0) return sortedList.get(mid);
            if (res > 0) left = mid + 1; else right = mid - 1;
        }
        return null;
    }

    static class User { int id; String username; String email; User(int id, String u, String e) { this.id=id; this.username=u; this.email=e; } }

// --- LAYOUT HELPERS (Paste at bottom of file) ---

    private static void centerComponent(JComponent c) {
        c.setAlignmentX(Component.CENTER_ALIGNMENT);
    }

    private static JLabel createCenteredLabel(String text) {
        JLabel l = new JLabel(text);
        l.setFont(new Font("Segoe UI", Font.BOLD, 11)); // Smaller label font
        l.setForeground(Color.GRAY);
        l.setAlignmentX(Component.CENTER_ALIGNMENT);
        return l;
    }

    private static void styleLinkButton(JButton btn) {
        btn.setBorderPainted(false);
        btn.setContentAreaFilled(false);
        btn.setForeground(COL_PRIMARY);
        btn.setFont(new Font("Segoe UI", Font.PLAIN, 12));
        btn.setCursor(new Cursor(Cursor.HAND_CURSOR));
        btn.setAlignmentX(Component.CENTER_ALIGNMENT);
    }
}


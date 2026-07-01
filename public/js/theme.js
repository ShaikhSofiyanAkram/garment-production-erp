// Theme management
const ThemeManager = {
    init: function() {
        // Load saved theme
        const savedTheme = localStorage.getItem('theme') || 'light';
        this.setTheme(savedTheme);
        
        // Add toggle button listener
        const toggleBtn = document.getElementById('themeToggle');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => this.toggleTheme());
        }
        
        // Watch for system theme change
        this.watchSystemTheme();
    },
    
    setTheme: function(theme) {
        if (theme === 'dark') {
            document.body.classList.add('dark-theme');
            localStorage.setItem('theme', 'dark');
            this.updateToggleIcon('dark');
        } else {
            document.body.classList.remove('dark-theme');
            localStorage.setItem('theme', 'light');
            this.updateToggleIcon('light');
        }
    },
    
    toggleTheme: function() {
        const currentTheme = localStorage.getItem('theme') || 'light';
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        this.setTheme(newTheme);
        
        // Optional: Save preference to server
        this.saveToServer(newTheme);
    },
    
    updateToggleIcon: function(theme) {
        const toggleBtn = document.getElementById('themeToggle');
        if (!toggleBtn) return;
        
        if (theme === 'dark') {
            toggleBtn.innerHTML = '<i class="fas fa-sun"></i>';
            toggleBtn.title = 'Switch to Light Mode';
        } else {
            toggleBtn.innerHTML = '<i class="fas fa-moon"></i>';
            toggleBtn.title = 'Switch to Dark Mode';
        }
    },
    
    watchSystemTheme: function() {
        // Listen for system theme changes (if user hasn't manually set)
        if (window.matchMedia) {
            window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
                const manualTheme = localStorage.getItem('theme_manual');
                if (!manualTheme) {
                    this.setTheme(e.matches ? 'dark' : 'light');
                }
            });
        }
    },
    
    saveToServer: async function(theme) {
        try {
            const response = await fetch('/api/settings/theme', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': document.querySelector('meta[name="csrf-token"]')?.content
                },
                body: JSON.stringify({ theme })
            });
            if (!response.ok) {
                console.log('Theme preference not saved to server');
            }
        } catch (error) {
            console.log('Theme save error:', error);
        }
    }
};

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    ThemeManager.init();
});
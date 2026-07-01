const Setting = require('../models/Setting');
const AuditLog = require('../models/AuditLog');

// Default settings
const defaultSettings = {
    general: {
        company_name: { value: 'Garment Factory ERP', description: 'Company Name' },
        company_address: { value: '123 Fashion Street, Garment District', description: 'Company Address' },
        company_phone: { value: '+91 9876543210', description: 'Phone Number' },
        company_email: { value: 'info@garmentfactory.com', description: 'Email Address' },
        company_gst: { value: '07AAACA1234A1Z', description: 'GST Number' },
        bill_footer: { value: 'Thank you for your business!', description: 'Bill Footer Message' }
    },
    rates: {
        helper_daily_rate: { value: 300, description: 'Helper Daily Rate (₹)' },
        cutting_monthly_rate: { value: 12000, description: 'Cutting Worker Monthly Salary (₹)' },
        default_gst: { value: 18, description: 'Default GST Percentage (%)' },
        round_off_enabled: { value: true, description: 'Enable Round Off in Bills' },
        friday_holiday: { value: true, description: 'Friday Holiday for Helper Salary' }
    },
    system: {
        site_name: { value: 'Garment ERP', description: 'Site Name' },
        timezone: { value: 'Asia/Kolkata', description: 'Timezone' },
        date_format: { value: 'DD/MM/YYYY', description: 'Date Format' },
        items_per_page: { value: 25, description: 'Items Per Page' },
        dark_mode_default: { value: 'light', description: 'Default Theme' },
        email_notifications: { value: true, description: 'Enable Email Notifications' }
    }
};

// Get all settings
exports.getSettings = async (req, res) => {
    try {
        let settings = await Setting.find({}).sort({ category: 1, key: 1 });
        
        // Group by category
        const groupedSettings = {};
        settings.forEach(setting => {
            if (!groupedSettings[setting.category]) {
                groupedSettings[setting.category] = [];
            }
            groupedSettings[setting.category].push(setting);
        });
        
        // Add defaults for missing settings
        for (const [category, categorySettings] of Object.entries(defaultSettings)) {
            if (!groupedSettings[category]) {
                groupedSettings[category] = [];
            }
            for (const [key, config] of Object.entries(categorySettings)) {
                const exists = groupedSettings[category].find(s => s.key === key);
                if (!exists) {
                    groupedSettings[category].push({
                        category,
                        key,
                        value: config.value,
                        description: config.description
                    });
                }
            }
        }
        
        res.render('settings/index', {
            title: 'System Settings',
            layout: 'layouts/main',
            user: req.session.user,
            settings: groupedSettings,
            activeTab: req.query.tab || 'general',
            success_msg: req.flash('success_msg'),
            error_msg: req.flash('error_msg')
        });
    } catch (error) {
        console.error(error);
        req.flash('error_msg', 'Error loading settings');
        res.redirect('/dashboard');
    }
};

// Update settings
// Update settings - Add this at the end of updateSettings function
exports.updateSettings = async (req, res) => {
    try {
        const { category, settings } = req.body;
        
        for (const [key, value] of Object.entries(settings)) {
            let finalValue = value;
            if (value === 'true') finalValue = true;
            if (value === 'false') finalValue = false;
            if (!isNaN(value) && value !== '' && value !== 'true' && value !== 'false') {
                finalValue = parseFloat(value);
            }
            
            await Setting.findOneAndUpdate(
                { category, key },
                { value: finalValue, updatedBy: req.session.user.id, updatedAt: new Date() },
                { upsert: true, new: true }
            );
        }
        
        // ✅ Reload settings into locals
        const allSettings = await Setting.find({});
        req.app.locals.settings = {};
        allSettings.forEach(setting => {
            if (!req.app.locals.settings[setting.category]) {
                req.app.locals.settings[setting.category] = {};
            }
            req.app.locals.settings[setting.category][setting.key] = setting.value;
        });
        
        // Also update res.locals for current request
        res.locals.settings = req.app.locals.settings;
        
        // Log audit
        await AuditLog.create({
            user: req.session.user.id,
            userType: 'admin',
            action: 'UPDATE',
            module: 'settings',
            details: { changes: `Updated ${category} settings` },
            ipAddress: req.ip || req.connection.remoteAddress,
            userAgent: req.headers['user-agent']
        });
        
        req.flash('success_msg', 'Settings updated successfully');
        res.redirect(`/settings?tab=${category}`);
    } catch (error) {
        console.error(error);
        req.flash('error_msg', 'Error updating settings');
        res.redirect('/settings');
    }
};

// Get audit logs
exports.getAuditLogs = async (req, res) => {
    try {
        const { module, user, fromDate, toDate, limit = 100 } = req.query;
        
        let filter = {};
        if (module) filter.module = module;
        if (user) filter.user = user;
        if (fromDate || toDate) {
            filter.timestamp = {};
            if (fromDate) filter.timestamp.$gte = new Date(fromDate);
            if (toDate) filter.timestamp.$lte = new Date(toDate);
        }
        
        const logs = await AuditLog.find(filter)
            .populate('user', 'username')
            .sort({ timestamp: -1 })
            .limit(parseInt(limit));
        
        if (req.xhr || req.headers.accept?.includes('application/json')) {
            return res.json({ logs });
        }
        
        res.render('settings/audit-logs', {
            title: 'Audit Logs',
            layout: 'layouts/main',
            user: req.session.user,
            logs,
            modules: ['auth', 'cutting', 'assignment', 'production', 'finishing', 'packing', 'billing', 'payment', 'worker', 'product', 'fabric', 'settings', 'report']
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
};

// Export settings
exports.exportSettings = async (req, res) => {
    try {
        const settings = await Setting.find({});
        res.json({
            exportedAt: new Date(),
            exportedBy: req.session.user.username,
            settings
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Import settings
exports.importSettings = async (req, res) => {
    try {
        const { settings } = req.body;
        
        for (const setting of settings) {
            await Setting.findOneAndUpdate(
                { category: setting.category, key: setting.key },
                { value: setting.value, updatedBy: req.session.user.id, updatedAt: new Date() },
                { upsert: true }
            );
        }
        
        req.flash('success_msg', 'Settings imported successfully');
        res.redirect('/settings');
    } catch (error) {
        req.flash('error_msg', 'Error importing settings');
        res.redirect('/settings');
    }
};
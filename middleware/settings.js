const Setting = require('../models/Setting');

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

// Load settings into res.locals (global for all views)
const loadSettings = async (req, res, next) => {
    try {
        // Create default settings if not exist
        for (const [category, settings] of Object.entries(defaultSettings)) {
            for (const [key, config] of Object.entries(settings)) {
                const exists = await Setting.findOne({ category, key });
                if (!exists) {
                    await Setting.create({
                        category,
                        key,
                        value: config.value,
                        description: config.description
                    });
                }
            }
        }

        // Load all settings into locals
        const allSettings = await Setting.find({});
        res.locals.settings = {};
        
        allSettings.forEach(setting => {
            if (!res.locals.settings[setting.category]) {
                res.locals.settings[setting.category] = {};
            }
            res.locals.settings[setting.category][setting.key] = setting.value;
        });

        // Set default values if missing
        for (const [category, settings] of Object.entries(defaultSettings)) {
            for (const [key, config] of Object.entries(settings)) {
                if (!res.locals.settings[category]?.[key]) {
                    if (!res.locals.settings[category]) res.locals.settings[category] = {};
                    res.locals.settings[category][key] = config.value;
                }
            }
        }

        next();
    } catch (error) {
        console.error('Error loading settings:', error);
        res.locals.settings = defaultSettings;
        next();
    }
};

// Get single setting value
const getSetting = (category, key) => {
    if (res.locals?.settings?.[category]?.[key]) {
        return res.locals.settings[category][key];
    }
    return defaultSettings[category]?.[key]?.value || null;
};

module.exports = { loadSettings, getSetting, defaultSettings };







// const Client = require('../models/Client');

// exports.getClients = async (req, res) => {
//     try {
//         const clients = await Client.find({ isActive: true }).sort({ name: 1 });
//         res.render('clients/index', { title: 'Client Management', clients });
//     } catch (error) {
//         req.flash('error_msg', 'Error fetching clients');
//         res.redirect('/dashboard');
//     }
// };

// exports.createForm = (req, res) => {
//     res.render('clients/create', { title: 'Add New Client' });
// };

// exports.createClient = async (req, res) => {
//     try {
//         const { name, gstNo, phone, address, creditLimit, openingBalance } = req.body;
//         await Client.create({ name, gstNo, phone, address, creditLimit, openingBalance, createdBy: req.session.user.id });
//         req.flash('success_msg', 'Client added successfully');
//         res.redirect('/clients');
//     } catch (error) {
//         req.flash('error_msg', 'Error creating client');
//         res.redirect('/clients/create');
//     }
// };

// exports.getClientApi = async (req, res) => {
//     try {
//         const clients = await Client.find({ isActive: true }).select('name _id');
//         res.json(clients);
//     } catch (error) {
//         res.status(500).json({ error: error.message });
//     }
// };

// exports.quickAddClient = async (req, res) => {
//     try {
//         const { name, phone } = req.body;
//         const client = await Client.create({ name, phone, createdBy: req.session.user.id });
//         res.json({ success: true, client: { _id: client._id, name: client.name } });
//     } catch (error) {
//         res.status(500).json({ success: false, error: error.message });
//     }
// };







// // Edit form
// exports.editForm = async (req, res) => {
//     try {
//         const client = await Client.findById(req.params.id);
//         if (!client) {
//             req.flash('error_msg', 'Client not found');
//             return res.redirect('/clients');
//         }
//         res.render('clients/edit', { title: 'Edit Client/Party', client });
//     } catch (error) {
//         req.flash('error_msg', 'Error fetching client');
//         res.redirect('/clients');
//     }
// };

// // Update client
// exports.updateClient = async (req, res) => {
//     try {
//         const { name, phone, email, address, gst, type, isActive } = req.body;
        
//         await Client.findByIdAndUpdate(req.params.id, {
//             name,
//             phone,
//             email,
//             address,
//             gst,
//             type,
//             isActive: isActive === 'on'
//         });
        
//         req.flash('success_msg', 'Client/Party updated successfully');
//         res.redirect('/clients');
//     } catch (error) {
//         console.error(error);
//         req.flash('error_msg', 'Error updating client');
//         res.redirect(`/clients/edit/${req.params.id}`);
//     }
// };

// // Delete client
// exports.deleteClient = async (req, res) => {
//     try {
//         await Client.findByIdAndDelete(req.params.id);
//         req.flash('success_msg', 'Client/Party deleted successfully');
//         res.redirect('/clients');
//     } catch (error) {
//         console.error(error);
//         req.flash('error_msg', 'Error deleting client');
//         res.redirect('/clients');
//     }
// };

// // API: Get all parties for dropdown
// exports.getParties = async (req, res) => {
//     try {
//         const parties = await Client.find({ isActive: true, type: { $in: ['party', 'both'] } }).select('name phone');
//         res.json(parties);
//     } catch (error) {
//         res.status(500).json({ error: 'Server error' });
//     }
// };

// // API: Get all clients for dropdown
// exports.getClientsList = async (req, res) => {
//     try {
//         const clients = await Client.find({ isActive: true, type: { $in: ['client', 'both'] } }).select('name phone');
//         res.json(clients);
//     } catch (error) {
//         res.status(500).json({ error: 'Server error' });
//     }
// };
const Client = require('../models/Client');

// Get all clients (for list page)
exports.getClients = async (req, res) => {
    try {
        const clients = await Client.find({ isActive: true }).sort({ name: 1 });
        res.render('clients/index', { title: 'Client Management', clients });
    } catch (error) {
        console.error(error);
        req.flash('error_msg', 'Error fetching clients');
        res.redirect('/dashboard');
    }
};

// Show create form
exports.createForm = (req, res) => {
    res.render('clients/create', { title: 'Add New Client' });
};

// Create client
exports.createClient = async (req, res) => {
    try {
        const { name, phone, gstNo, address, creditLimit, openingBalance } = req.body;
        await Client.create({
            name,
            phone,
            gstNo: gstNo || '',
            address: address || '',
            creditLimit: creditLimit || 0,
            openingBalance: openingBalance || 0,
            createdBy: req.session.user.id
        });
        req.flash('success_msg', 'Client added successfully');
        res.redirect('/clients');
    } catch (error) {
        console.error(error);
        req.flash('error_msg', 'Error creating client');
        res.redirect('/clients/create');
    }
};

// Show edit form
exports.editForm = async (req, res) => {
    try {
        const client = await Client.findById(req.params.id);
        if (!client) {
            req.flash('error_msg', 'Client not found');
            return res.redirect('/clients');
        }
        res.render('clients/edit', { title: 'Edit Client', client });
    } catch (error) {
        console.error(error);
        req.flash('error_msg', 'Error fetching client');
        res.redirect('/clients');
    }
};

// Update client
exports.updateClient = async (req, res) => {
    try {
        const { name, phone, gstNo, address, creditLimit, openingBalance, isActive } = req.body;
        await Client.findByIdAndUpdate(req.params.id, {
            name,
            phone,
            gstNo: gstNo || '',
            address: address || '',
            creditLimit: creditLimit || 0,
            openingBalance: openingBalance || 0,
            isActive: isActive === 'on'
        });
        req.flash('success_msg', 'Client updated successfully');
        res.redirect('/clients');
    } catch (error) {
        console.error(error);
        req.flash('error_msg', 'Error updating client');
        res.redirect(`/clients/edit/${req.params.id}`);
    }
};

// Delete client (hard delete)
exports.deleteClient = async (req, res) => {
    try {
        await Client.findByIdAndDelete(req.params.id);
        res.sendStatus(200);
    } catch (error) {
        console.error(error);
        res.status(500).send(error.message);
    }
};

// API: Get all clients for dropdown
exports.getClientApi = async (req, res) => {
    try {
        const clients = await Client.find({ isActive: true }).select('name phone _id');
        res.json(clients);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Quick add client via API (for modal)
exports.quickAddClient = async (req, res) => {
    try {
        const { name, phone, gst, address } = req.body;
        const client = await Client.create({
            name,
            phone,
            gstNo: gst || '',
            address: address || '',
            createdBy: req.session.user.id
        });
        res.json({ success: true, client: { _id: client._id, name: client.name } });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// Get parties (for future use)
exports.getParties = async (req, res) => {
    try {
        const parties = await Client.find({ isActive: true }).select('name phone');
        res.json(parties);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Get clients list (for future use)
exports.getClientsList = async (req, res) => {
    try {
        const clients = await Client.find({ isActive: true }).select('name phone');
        res.json(clients);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};


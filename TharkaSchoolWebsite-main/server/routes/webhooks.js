const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const User = require('../models/User');
const Course = require('../models/Course');

router.post('/', async (req, res) => {
    try {
        const payload = req.body;

        // --- 2. CLERK WEBHOOK HANDLER ---
        // Clerk events contain a 'type' property
        const type = payload.type;
        
        if (type === 'user.created' || type === 'user.updated') {
            const { id, email_addresses, first_name, last_name, private_metadata } = payload.data;
            const email = email_addresses && email_addresses.length > 0 ? email_addresses[0].email_address : "";
            const name = `${first_name || ''} ${last_name || ''}`.trim();
            
            // Default role is user unless specified in private_metadata
            const role = (private_metadata && private_metadata.role) ? private_metadata.role : 'user';

            await User.findOneAndUpdate(
                { clerkId: id },
                {
                    clerkId: id,
                    email: email,
                    name: name,
                    role: role
                },
                { upsert: true, new: true }
            );
        } else if (type === 'user.deleted') {
            const { id } = payload.data;
            await User.findOneAndDelete({ clerkId: id });
        }

        res.status(200).json({ success: true });
    } catch (err) {
        console.error('Webhook Error:', err.message);
        res.status(400).json({ success: false, message: err.message });
    }
});

module.exports = router;
